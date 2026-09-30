/**
 * Snapshot generator for Penumbra compact blocks.
 *
 * Generates gzip-compressed chunk files containing length-prefixed compact block
 * protobufs. Chunks are immutable once written. A manifest tracks available chunks.
 *
 * This module is server-side only.
 */

import fs from 'fs/promises'
import path from 'path'
import { gzipSync } from 'zlib'

import { penumbraConfig } from '@/lib/config'
import { embeddedShielddQueryUrl } from '@/lib/native-wallet/penumbra/embedded-shieldd'

// =============================================================================
// Configuration
// =============================================================================

const CHUNK_SIZE = parseInt(process.env.SNAPSHOT_CHUNK_SIZE || '100000', 10)
const SNAPSHOTS_DIR = path.join(process.cwd(), 'data', 'snapshots')
const MANIFEST_PATH = path.join(SNAPSHOTS_DIR, 'manifest.json')

/** Check for new chunks every 5 minutes */
const CHECK_INTERVAL_MS = 5 * 60 * 1000

/** Batch size for range requests to avoid a single huge gRPC response */
const RANGE_BATCH_SIZE = 10000

// Lock to prevent concurrent chunk generation
let isGenerating = false

// Periodic check interval handle
let checkInterval: ReturnType<typeof setInterval> | null = null

// =============================================================================
// Types
// =============================================================================

export interface ChunkInfo {
  startHeight: number
  endHeight: number
  file: string
  sizeBytes: number
}

export interface Manifest {
  chainId: string
  /**
   * SHA-256 of the height-0 compact block. Identifies the genesis content, so we
   * can detect a chain reset that reuses the same chainId but has a new genesis
   * (common in local demos). Chunks from a previous genesis are invalid and must
   * be discarded — serving them poisons the client's reconstructed SCT.
   */
  chainMarker?: string
  chunkSize: number
  chunks: ChunkInfo[]
  latestHeight: number
  generatedAt: string
}

// =============================================================================
// gRPC-web helpers
// =============================================================================

function createGrpcWebRequest(requestBytes: Uint8Array): string {
  const frame = new Uint8Array(5 + requestBytes.length)
  frame[0] = 0
  const len = requestBytes.length
  frame[1] = (len >> 24) & 0xff
  frame[2] = (len >> 16) & 0xff
  frame[3] = (len >> 8) & 0xff
  frame[4] = len & 0xff
  frame.set(requestBytes, 5)
  return Buffer.from(frame).toString('base64')
}

/**
 * Decode a gRPC-web-text response body into raw binary.
 * gRPC-web-text streaming responses consist of multiple base64-padded chunks
 * concatenated together. Buffer.from() stops at the first padding, so we must
 * split on padding boundaries and decode each chunk separately.
 */
function decodeGrpcWebText(base64Response: string): Buffer {
  const chunks = base64Response.match(/[A-Za-z0-9+/]+=*=*/g) || []
  return Buffer.concat(chunks.map((c) => Buffer.from(c, 'base64')))
}

function parseAllGrpcWebFrames(base64Response: string): Uint8Array[] {
  const responseBytes = decodeGrpcWebText(base64Response)
  const frames: Uint8Array[] = []
  let offset = 0

  while (offset + 5 <= responseBytes.length) {
    const flags = responseBytes[offset]
    const msgLen =
      (responseBytes[offset + 1] << 24) |
      (responseBytes[offset + 2] << 16) |
      (responseBytes[offset + 3] << 8) |
      responseBytes[offset + 4]

    offset += 5

    if (msgLen === 0 || offset + msgLen > responseBytes.length) break

    if (flags === 0) {
      frames.push(responseBytes.slice(offset, offset + msgLen))
    }

    offset += msgLen
  }

  return frames
}

// =============================================================================
// Block fetching
// =============================================================================

async function fetchCompactBlockRange(
  startHeight: number,
  endHeight: number
): Promise<Uint8Array[]> {
  const { CompactBlockRangeRequest, CompactBlockRangeResponse } = await import(
    '@mizufinance/protobuf/shieldd/core/component/compact_block/v1/compact_block_pb'
  )

  const request = new CompactBlockRangeRequest({
    startHeight: BigInt(startHeight),
    endHeight: BigInt(endHeight + 1),
    keepAlive: false,
  })
  const base64Request = createGrpcWebRequest(request.toBinary())

  const response = await fetch(
    embeddedShielddQueryUrl(penumbraConfig.grpcUrl, 'CompactBlockRange'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web-text',
        Accept: 'application/grpc-web-text',
      },
      body: base64Request,
    }
  )

  if (!response.ok) {
    throw new Error(`CompactBlockRange failed: ${response.status}`)
  }

  const base64Body = await response.text()
  const messageFrames = parseAllGrpcWebFrames(base64Body)

  const blocks: Uint8Array[] = []
  for (const frame of messageFrames) {
    const rangeResponse = CompactBlockRangeResponse.fromBinary(frame)
    if (!rangeResponse.compactBlock) continue
    // The RPC's end_height is inclusive (the request above over-asks by one so
    // that end_height is never the 0 = unbounded sentinel), so clamp to exactly
    // the requested range. An extra boundary block per chunk gets scanned twice
    // by clients, corrupting their SCT root.
    const height = Number(rangeResponse.compactBlock.height)
    if (height < startHeight || height > endHeight) continue
    blocks.push(rangeResponse.compactBlock.toBinary())
  }

  return blocks
}

/**
 * Compute a marker that uniquely identifies the current chain's genesis: the
 * SHA-256 of the height-0 compact block. A wiped/restarted chain produces a
 * different genesis block (and thus a different marker) even if the chainId is
 * reused, which is how we detect that on-disk chunks are stale.
 */
async function getGenesisMarker(): Promise<string | null> {
  try {
    const blocks = await fetchCompactBlockRange(0, 0)
    if (!blocks[0]) return null
    const { createHash } = await import('crypto')
    return createHash('sha256').update(Buffer.from(blocks[0])).digest('hex')
  } catch (error) {
    console.error('[Snapshot] Failed to read genesis marker:', error)
    return null
  }
}

async function getChainHeight(): Promise<number> {
  try {
    const response = await fetch(`${penumbraConfig.rpcUrl}/status`, {
      cache: 'no-store',
    })
    if (!response.ok) return 0
    const data = await response.json()
    const height =
      data.result?.sync_info?.latest_block_height ??
      data.syncInfo?.latestBlockHeight ??
      0
    return typeof height === 'string' ? parseInt(height, 10) : height
  } catch {
    return 0
  }
}

// =============================================================================
// Manifest I/O
// =============================================================================

async function ensureSnapshotsDir(): Promise<void> {
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true })
}

export async function loadManifest(): Promise<Manifest> {
  try {
    const data = await fs.readFile(MANIFEST_PATH, 'utf-8')
    return JSON.parse(data) as Manifest
  } catch {
    return {
      chainId: penumbraConfig.chainId,
      chunkSize: CHUNK_SIZE,
      chunks: [],
      latestHeight: 0,
      generatedAt: new Date().toISOString(),
    }
  }
}

async function saveManifest(manifest: Manifest): Promise<void> {
  const tmpPath = MANIFEST_PATH + '.tmp'
  await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2))
  await fs.rename(tmpPath, MANIFEST_PATH)
}

/**
 * Delete every chunk file referenced by the manifest and return a fresh, empty
 * manifest for the given chain identity. Used when the on-disk snapshots belong
 * to a previous genesis (chain reset) and would otherwise poison clients.
 */
async function invalidateSnapshots(
  manifest: Manifest,
  chainId: string,
  chainMarker: string | null,
  reason: string
): Promise<Manifest> {
  console.warn(
    `[Snapshot] Invalidating ${manifest.chunks.length} stale chunk(s): ${reason}`
  )
  for (const chunk of manifest.chunks) {
    try {
      await fs.unlink(path.join(SNAPSHOTS_DIR, chunk.file))
    } catch (error) {
      console.warn(`[Snapshot] Could not delete ${chunk.file}:`, error)
    }
  }
  const fresh: Manifest = {
    chainId,
    chainMarker: chainMarker ?? undefined,
    chunkSize: CHUNK_SIZE,
    chunks: [],
    latestHeight: 0,
    generatedAt: new Date().toISOString(),
  }
  await saveManifest(fresh)
  return fresh
}

// =============================================================================
// Chunk generation
// =============================================================================

async function generateChunk(
  startHeight: number,
  endHeight: number
): Promise<ChunkInfo | null> {
  console.log(
    `[Snapshot] Generating chunk: blocks ${startHeight}..${endHeight}`
  )

  const parts: Buffer[] = []

  for (
    let batchStart = startHeight;
    batchStart <= endHeight;
    batchStart += RANGE_BATCH_SIZE
  ) {
    const batchEnd = Math.min(batchStart + RANGE_BATCH_SIZE - 1, endHeight)

    console.log(`[Snapshot]   fetching blocks ${batchStart}..${batchEnd}`)

    let blocks: Uint8Array[]
    try {
      blocks = await fetchCompactBlockRange(batchStart, batchEnd)
    } catch (error) {
      console.error(
        `[Snapshot] Failed to fetch range ${batchStart}..${batchEnd}:`,
        error
      )
      return null
    }

    if (blocks.length < batchEnd - batchStart + 1) {
      console.error(
        `[Snapshot] Expected ${batchEnd - batchStart + 1} blocks, got ${blocks.length}`
      )
      return null
    }

    for (const blockBytes of blocks) {
      const lenBuf = Buffer.alloc(4)
      lenBuf.writeUInt32BE(blockBytes.length, 0)
      parts.push(lenBuf)
      parts.push(Buffer.from(blockBytes))
    }
  }

  const uncompressed = Buffer.concat(parts)
  const compressed = gzipSync(uncompressed)

  const filename = `snapshot-${startHeight}.bin.gz`
  const filePath = path.join(SNAPSHOTS_DIR, filename)
  await fs.writeFile(filePath, compressed)

  console.log(
    `[Snapshot] Chunk written: ${filename} (${uncompressed.length} bytes → ${compressed.length} bytes gzipped)`
  )

  return {
    startHeight,
    endHeight,
    file: filename,
    sizeBytes: compressed.length,
  }
}

// =============================================================================
// Public API
// =============================================================================

/** Returns true if chunk generation is currently in progress. */
export function isSnapshotGenerating(): boolean {
  return isGenerating
}

/**
 * Check if new chunks need generating and kick off background generation.
 * Returns the current manifest immediately (non-blocking).
 */
export async function checkAndGenerate(): Promise<Manifest> {
  await ensureSnapshotsDir()
  let manifest = await loadManifest()

  const chainHeight = await getChainHeight()
  if (chainHeight === 0) return manifest

  // Detect a chain reset (new genesis, possibly reusing the chainId) and discard
  // stale chunks before serving or generating anything. Serving chunks from a
  // previous genesis silently poisons the client's SCT and produces broadcasts
  // the chain rejects with "provided anchor is not a valid SCT root".
  const chainMarker = await getGenesisMarker()
  const markerChanged = Boolean(
    chainMarker && manifest.chainMarker && manifest.chainMarker !== chainMarker
  )
  // Chunks recorded before marker support have unknown provenance — they may
  // belong to a previous genesis, and stamping the current marker onto them
  // would launder them as verified. Treat them as stale.
  const markerUnknown = Boolean(chainMarker && !manifest.chainMarker)
  // Chunks are only ever generated up to the tip, so chunks beyond the current
  // chain height conclusively belong to a previous (taller) chain.
  const chunksBeyondTip =
    manifest.chunks.length > 0 &&
    manifest.chunks[manifest.chunks.length - 1].endHeight > chainHeight
  const chainIdChanged =
    manifest.chunks.length > 0 && manifest.chainId !== penumbraConfig.chainId
  if (
    manifest.chunks.length > 0 &&
    (markerChanged || chainIdChanged || markerUnknown || chunksBeyondTip)
  ) {
    const reason = markerChanged
      ? `genesis marker changed (${manifest.chainMarker?.slice(0, 12)}… → ${chainMarker?.slice(0, 12)}…)`
      : chainIdChanged
        ? `chainId changed (${manifest.chainId} → ${penumbraConfig.chainId})`
        : markerUnknown
          ? 'existing chunks predate genesis-marker support (unknown provenance)'
          : `chunks extend beyond the chain tip (${manifest.chunks[manifest.chunks.length - 1].endHeight} > ${chainHeight})`
    manifest = await invalidateSnapshots(
      manifest,
      penumbraConfig.chainId,
      chainMarker,
      reason
    )
  }

  let markerNewlySet = false
  if (
    !markerChanged &&
    !chainIdChanged &&
    chainMarker &&
    !manifest.chainMarker
  ) {
    // First run with marker support, or a freshly-seeded manifest: record it so
    // a later genesis change is detectable.
    manifest.chainMarker = chainMarker
    markerNewlySet = true
  }

  manifest.chainId = penumbraConfig.chainId
  manifest.latestHeight = chainHeight
  manifest.generatedAt = new Date().toISOString()

  const lastChunkEnd =
    manifest.chunks.length > 0
      ? manifest.chunks[manifest.chunks.length - 1].endHeight
      : -1
  const nextChunkStart = lastChunkEnd + 1

  if (chainHeight - nextChunkStart + 1 < CHUNK_SIZE) {
    // Persist a newly-recorded marker even when no chunk is due, so genesis-
    // change detection survives a restart.
    if (markerNewlySet) await saveManifest(manifest)
    return manifest
  }

  if (!isGenerating) {
    void generateInBackground(manifest, chainHeight)
  }

  return manifest
}

async function generateInBackground(
  manifest: Manifest,
  chainHeight: number
): Promise<void> {
  if (isGenerating) return
  isGenerating = true

  try {
    const lastChunkEnd =
      manifest.chunks.length > 0
        ? manifest.chunks[manifest.chunks.length - 1].endHeight
        : -1
    let currentStart = lastChunkEnd + 1

    while (chainHeight - currentStart + 1 >= CHUNK_SIZE) {
      const chunkEnd = currentStart + CHUNK_SIZE - 1
      const chunk = await generateChunk(currentStart, chunkEnd)
      if (!chunk) break

      manifest.chunks.push(chunk)
      manifest.latestHeight = chainHeight
      manifest.generatedAt = new Date().toISOString()

      await saveManifest(manifest)
      console.log(`[Snapshot] Chunk generation complete: ${chunk.file}`)

      currentStart = chunkEnd + 1
    }

    await saveManifest(manifest)
  } catch (error) {
    console.error('[Snapshot] Background chunk generation failed:', error)
  } finally {
    isGenerating = false
  }
}

/**
 * Start periodic snapshot checks. Called once on server startup.
 * Checks every 5 minutes if new chunks need generating.
 */
export function startPeriodicCheck(): void {
  if (checkInterval) return

  console.log(
    `[Snapshot] Starting periodic check (every ${CHECK_INTERVAL_MS / 1000}s, chunk size: ${CHUNK_SIZE})`
  )

  // Run once immediately
  checkAndGenerate().catch((err) =>
    console.error('[Snapshot] Initial check failed:', err)
  )

  checkInterval = setInterval(() => {
    checkAndGenerate().catch((err) =>
      console.error('[Snapshot] Periodic check failed:', err)
    )
  }, CHECK_INTERVAL_MS)
}

/**
 * Stop periodic snapshot checks.
 */
export function stopPeriodicCheck(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}
