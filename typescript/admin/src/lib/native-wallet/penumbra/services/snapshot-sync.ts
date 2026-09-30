'use client'

// src/lib/native-wallet/penumbra/services/snapshot-sync.ts
/**
 * Snapshot-based fast sync for Penumbra compact blocks.
 *
 * Downloads pre-built chunk files from the server instead of fetching blocks
 * one-by-one. Each chunk contains length-prefixed compact block protobufs,
 * served gzip-compressed. The browser decompresses natively.
 *
 * After snapshot sync completes, the normal block-by-block sync takes over
 * for the remaining gap to chain tip.
 */

import { CompactBlock } from '@mizufinance/protobuf/shieldd/core/component/compact_block/v1/compact_block_pb'

// =============================================================================
// Types
// =============================================================================

interface ChunkInfo {
  startHeight: number
  endHeight: number
  file: string
  sizeBytes: number
}

interface Manifest {
  chainId: string
  chunkSize: number
  chunks: ChunkInfo[]
  latestHeight: number
  generatedAt: string
}

export interface SnapshotSyncCallbacks {
  /** Called with each compact block for processing (scanBlock, saveScanResult, etc.) */
  onBlock: (block: CompactBlock) => Promise<void>
  /** Called periodically with progress */
  onProgress?: (currentHeight: number, totalHeight: number) => void
  /** Check if sync should be aborted */
  isStopping?: () => boolean
}

// =============================================================================
// Manifest
// =============================================================================

async function fetchManifest(): Promise<Manifest | null> {
  try {
    const response = await fetch('/api/penumbra/snapshot/manifest', {
      cache: 'no-cache',
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

// =============================================================================
// Chunk Parsing
// =============================================================================

/**
 * Download a chunk file and iterate over the compact blocks inside.
 * The server sends gzip-compressed data with Content-Encoding: gzip,
 * so the browser decompresses automatically.
 *
 * Binary format: [4 bytes: length (uint32 BE)][N bytes: CompactBlock protobuf]...
 */
async function* parseChunk(chunkFile: string): AsyncGenerator<CompactBlock> {
  const response = await fetch(`/api/penumbra/snapshot/${chunkFile}`)
  if (!response.ok) {
    throw new Error(`Failed to download chunk ${chunkFile}: ${response.status}`)
  }

  // Read the full response as an ArrayBuffer (browser handles gzip decompression)
  const buffer = await response.arrayBuffer()
  const data = new Uint8Array(buffer)

  let offset = 0
  while (offset + 4 <= data.length) {
    // Read length prefix (uint32 BE)
    const len =
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]
    offset += 4

    if (len === 0 || offset + len > data.length) break

    // Parse compact block from protobuf bytes
    const blockBytes = data.slice(offset, offset + len)
    offset += len

    yield CompactBlock.fromBinary(blockBytes)
  }
}

// =============================================================================
// Snapshot Sync
// =============================================================================

/**
 * Perform snapshot-based fast sync.
 *
 * Downloads and processes any snapshot chunks that are ahead of the current
 * sync height. Returns the height reached after processing all available
 * snapshot chunks.
 *
 * @param currentHeight - The current local sync height (-1 if no sync yet)
 * @param callbacks - Block processing and progress callbacks
 * @param chainTip - Current chain height; blocks above it are never scanned
 *   (snapshots beyond the tip belong to a previous chain and would poison the SCT)
 * @returns The height reached after snapshot sync, or currentHeight if no snapshots available
 */
export async function snapshotSync(
  currentHeight: number,
  callbacks: SnapshotSyncCallbacks,
  chainTip?: number
): Promise<number> {
  const manifest = await fetchManifest()
  if (!manifest || manifest.chunks.length === 0) {
    console.log('[SnapshotSync] No snapshots available, falling back to normal sync')
    return currentHeight
  }

  // Find chunks we need (those with blocks after our current height)
  const tip = chainTip !== undefined && chainTip > 0 ? chainTip : Infinity
  const neededChunks = manifest.chunks.filter(
    (chunk) => chunk.endHeight > currentHeight && chunk.startHeight <= tip
  )

  if (neededChunks.length === 0) {
    console.log('[SnapshotSync] Already synced past all available snapshots')
    return currentHeight
  }

  console.log(
    `[SnapshotSync] Found ${neededChunks.length} chunks to process ` +
    `(heights ${neededChunks[0].startHeight}..${neededChunks[neededChunks.length - 1].endHeight})`
  )

  const totalEndHeight = neededChunks[neededChunks.length - 1].endHeight
  let height = currentHeight

  for (const chunk of neededChunks) {
    if (callbacks.isStopping?.()) break

    console.log(
      `[SnapshotSync] Downloading chunk ${chunk.file} ` +
      `(blocks ${chunk.startHeight}..${chunk.endHeight}, ${(chunk.sizeBytes / 1024).toFixed(0)}KB)`
    )

    try {
      for await (const block of parseChunk(chunk.file)) {
        if (callbacks.isStopping?.()) break

        const blockHeight = Number(block.height)

        // Skip blocks we've already processed. Must compare against the
        // RUNNING height, not the starting height: chunks can overlap at
        // boundaries (e.g. a generator off-by-one duplicating each chunk's
        // first block), and scanning a block twice inserts duplicate
        // commitments into the SCT — producing a root the chain never had.
        if (blockHeight <= height) continue

        // Never scan past the chain tip — such blocks can only come from a
        // stale snapshot of a previous chain.
        if (blockHeight > tip) {
          console.warn(
            `[SnapshotSync] Chunk ${chunk.file} contains blocks beyond the chain tip (${blockHeight} > ${tip}), stopping snapshot sync`
          )
          return height
        }

        await callbacks.onBlock(block)
        height = blockHeight

        // Report progress every 1000 blocks
        if (blockHeight % 1000 === 0) {
          callbacks.onProgress?.(height, totalEndHeight)
        }
      }

      // Report progress after each chunk
      callbacks.onProgress?.(height, totalEndHeight)
      console.log(`[SnapshotSync] Completed chunk ${chunk.file}, height: ${height}`)
    } catch (error) {
      console.error(`[SnapshotSync] Failed to process chunk ${chunk.file}:`, error)
      // Return whatever height we reached — normal sync will pick up from here
      break
    }
  }

  console.log(`[SnapshotSync] Snapshot sync complete, reached height ${height}`)
  return height
}
