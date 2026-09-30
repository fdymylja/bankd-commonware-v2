'use client'

// src/lib/native-wallet/services/view-server-sync.ts
/**
 * Block sync using Penumbra's ViewServer WASM.
 * 
 * This properly populates the Penumbra-standard IDB tables (SPENDABLE_NOTES, TREE_*, etc.)
 * which are required for transaction planning.
 * 
 * NOTE: This module can only be used on the client side (browser) because it uses WASM.
 */

import { CompactBlock } from '@mizufinance/protobuf/shieldd/core/component/compact_block/v1/compact_block_pb'
import type { FullViewingKey } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import type { IdbConstants } from '@mizufinance/types/indexed-db'
import type { ScanBlockResult,StateCommitmentTree,StoreCommitment,StoreHash,StoredPosition } from '@mizufinance/types/state-commitment-tree'
// ViewServer is imported dynamically to avoid SSR issues with WASM
// import { ViewServer } from '@mizufinance/wasm/view-server'

import {
  DB_NAME,
  DB_VERSION,
  IDB_TABLES,
  clearPenumbraSyncTables,
  getDB,
  getSyncState,
  savePenumbraChainFingerprint,
} from '../../core'
import { SHIELDD_BASE_DENOM } from '../protocol'

/**
 * Dynamically import ViewServer to avoid SSR issues with WASM.
 */
async function getViewServerClass(): Promise<typeof import('@mizufinance/wasm/view-server').ViewServer> {
  const mod = await import('@mizufinance/wasm/view-server')
  return mod.ViewServer
}

// =============================================================================
// Types
// =============================================================================

export interface ViewServerSyncConfig {
  fullViewingKey: FullViewingKey
  grpcUrl: string
  chainId: string
  onProgress?: (height: number, chainHeight: number) => void
  onNotesFound?: (count: number, height: number) => void
  onError?: (error: Error) => void
}

export interface SyncStatus {
  isRunning: boolean
  currentHeight: number
  chainHeight: number
  isSynced: boolean
}

export interface SyncRuntimeStatus extends SyncStatus {
  hasActiveViewServer: boolean
  lastError?: string
}

const runtimeStatus: SyncRuntimeStatus = {
  isRunning: false,
  currentHeight: 0,
  chainHeight: 0,
  isSynced: false,
  hasActiveViewServer: false,
}

const SCT_STORAGE_VERSION = 2

function updateRuntimeStatus(patch: Partial<SyncRuntimeStatus>): void {
  Object.assign(runtimeStatus, patch)
  runtimeStatus.hasActiveViewServer = Boolean(activeViewServer)
  runtimeStatus.isSynced =
    runtimeStatus.chainHeight > 0 &&
    runtimeStatus.currentHeight >= Math.max(0, runtimeStatus.chainHeight - 1)
}

export function getViewServerRuntimeStatus(): SyncRuntimeStatus {
  return { ...runtimeStatus, hasActiveViewServer: Boolean(activeViewServer) }
}

// =============================================================================
// IDB Constants
// =============================================================================

function getIdbConstants(): IdbConstants {
  return {
    name: DB_NAME,
    version: DB_VERSION,
    tables: IDB_TABLES as unknown as IdbConstants['tables'],
  }
}

// =============================================================================
// gRPC-web Helpers
// =============================================================================

/**
 * Create a gRPC-web framed request from protobuf bytes.
 */
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
 * Parse a gRPC-web response into message bytes.
 */
function parseGrpcWebResponse(base64Response: string): Uint8Array | null {
  const allBytes: number[] = []
  const frames = base64Response.trim().split(/(?<==)(?=[A-Za-z])/)
  for (const f of frames) {
    if (f) {
      const decoded = Buffer.from(f, 'base64')
      for (let i = 0; i < decoded.length; i++) {
        allBytes.push(decoded[i])
      }
    }
  }
  
  const responseBytes = Uint8Array.from(allBytes)
  if (responseBytes.length < 5) return null
  
  const msgLen = (responseBytes[1] << 24) | (responseBytes[2] << 16) | (responseBytes[3] << 8) | responseBytes[4]
  if (msgLen === 0 || responseBytes.length < 5 + msgLen) return null
  
  return responseBytes.slice(5, 5 + msgLen)
}

// =============================================================================
// SCT Storage
// =============================================================================

/**
 * Load the State Commitment Tree from IndexedDB.
 */
async function loadStoredTree(): Promise<StateCommitmentTree> {
  const db = await getDB()
  
  const lastPosition = await db.get('TREE_LAST_POSITION', 'last_position') as StoredPosition | undefined
  const lastForgotten = await db.get('TREE_LAST_FORGOTTEN', 'last_forgotten') as bigint | undefined
  const hashes = await db.getAll('TREE_HASHES') as StoreHash[]
  const commitments = await db.getAll('TREE_COMMITMENTS') as StoreCommitment[]
  
  // Sort hashes by position (computed from epoch/block/commitment) then by height
  // This ensures consistent ordering for tree reconstruction
  const sortedHashes = [...hashes].sort((a, b) => {
    const posA = a.position.epoch * 4294967296 + a.position.block * 65536 + a.position.commitment
    const posB = b.position.epoch * 4294967296 + b.position.block * 65536 + b.position.commitment
    if (posA !== posB) return posA - posB
    return a.height - b.height
  })
  
  return {
    last_position: lastPosition ?? { Position: { epoch: 0, block: 0, commitment: 0 } },
    last_forgotten: lastForgotten ?? 0n,
    hashes: sortedHashes ?? [],
    commitments: commitments ?? [],
  }
}

/**
 * Save scan results to IndexedDB.
 */
async function saveScanResult(result: ScanBlockResult): Promise<void> {
  const db = await getDB()
  
  const tx = db.transaction([
    'SPENDABLE_NOTES',
    'SWAPS',
    'TREE_LAST_POSITION',
    'TREE_LAST_FORGOTTEN',
    'TREE_HASHES',
    'TREE_COMMITMENTS',
    'FULL_SYNC_HEIGHT',
    'syncState',
  ], 'readwrite')
  
  // Save new notes
  for (const note of result.newNotes) {
    const noteJson = note.toJson() as Record<string, unknown>
    const commitmentInner = (noteJson.noteCommitment as { inner?: string })?.inner
    if (commitmentInner) {
      await tx.objectStore('SPENDABLE_NOTES').put(noteJson, commitmentInner)
    }
  }
  
  // Save SCT updates
  const sctUpdates = result.sctUpdates
  
  if (sctUpdates.set_position) {
    await tx.objectStore('TREE_LAST_POSITION').put(sctUpdates.set_position, 'last_position')
  }
  
  if (sctUpdates.set_forgotten !== undefined) {
    await tx.objectStore('TREE_LAST_FORGOTTEN').put(sctUpdates.set_forgotten, 'last_forgotten')
  }
  
  // Store new hashes
  // Key includes both position and height since the same position can have multiple heights
  for (const hash of sctUpdates.store_hashes) {
    const position = hash.position.epoch * 65536 * 65536 + hash.position.block * 65536 + hash.position.commitment
    const key = `${position}:${hash.height}`
    await tx.objectStore('TREE_HASHES').put(hash, key)
  }
  
  // Store new commitments
  for (const commitment of sctUpdates.store_commitments) {
    await tx.objectStore('TREE_COMMITMENTS').put(commitment, commitment.commitment.inner)
  }
  
  // Delete ranges emitted by the WASM view server are part of the canonical SCT
  // storage update. Keeping stale hashes can reconstruct a root the chain never
  // accepted, causing invalid-anchor broadcasts.
  if (sctUpdates.delete_ranges.length > 0) {
    const hashStore = tx.objectStore('TREE_HASHES')
    const allKeys = await hashStore.getAllKeys()

    for (const deleteRange of sctUpdates.delete_ranges) {
      const startPos = deleteRange.positions.start.epoch * 65536 * 65536 +
        deleteRange.positions.start.block * 65536 +
        deleteRange.positions.start.commitment
      const endPos = deleteRange.positions.end.epoch * 65536 * 65536 +
        deleteRange.positions.end.block * 65536 +
        deleteRange.positions.end.commitment

      for (const key of allKeys) {
        const keyStr = String(key)
        if (!keyStr.includes(':')) continue

        const [posStr, heightStr] = keyStr.split(':')
        const position = parseInt(posStr, 10)
        const height = parseInt(heightStr, 10)

        if (
          position >= startPos &&
          position < endPos &&
          height < deleteRange.below_height
        ) {
          await hashStore.delete(key)
        }
      }
    }
  }
  
  // Update sync height
  await tx.objectStore('FULL_SYNC_HEIGHT').put(result.height, 'height')
  const syncState = await tx.objectStore('syncState').get('current') as {
    fullSyncHeight?: number
    appParams?: Uint8Array | null
    fmdParams?: Uint8Array | null
    chainId?: string
    chainMarker?: string
    lastObservedChainHeight?: number
    lastObservedHeight?: number
    sctStorageVersion?: number
  } | undefined
  await tx.objectStore('syncState').put({
    fullSyncHeight: Number(result.height),
    appParams: syncState?.appParams ?? null,
    fmdParams: syncState?.fmdParams ?? null,
    chainId: syncState?.chainId,
    chainMarker: syncState?.chainMarker,
    lastObservedChainHeight: syncState?.lastObservedChainHeight ?? syncState?.lastObservedHeight ?? 0,
    sctStorageVersion: SCT_STORAGE_VERSION,
  }, 'current')
  
  await tx.done
}

/**
 * Mark spent notes by matching nullifiers from compact blocks against stored notes.
 *
 * The WASM ViewServer detects nullifiers during scanning, but the ScanBlockResult
 * only contains new notes/swaps and SCT updates — not spent nullifier info.
 * We need to check the compact blocks directly for nullifiers and mark matching
 * notes with `heightSpent` so the planner doesn't select them.
 */
async function markSpentNotes(blocks: CompactBlock[]): Promise<void> {
  // Collect all nullifiers from the blocks
  const nullifierMap = new Map<string, number>() // base64 nullifier → block height
  for (const block of blocks) {
    const blockHeight = Number(block.height)
    for (const nf of block.nullifiers) {
      if (nf.inner.length > 0) {
        // Convert to base64 to match the JSON format stored in IDB
        const base64 = Buffer.from(nf.inner).toString('base64')
        nullifierMap.set(base64, blockHeight)
      }
    }
  }

  if (nullifierMap.size === 0) return

  const db = await getDB()
  const tx = db.transaction('SPENDABLE_NOTES', 'readwrite')
  const store = tx.objectStore('SPENDABLE_NOTES')

  // Iterate all stored notes and check if their nullifier was spent
  let cursor = await store.openCursor()
  while (cursor) {
    const noteJson = cursor.value as Record<string, unknown>
    if (
      !noteJson.heightSpent &&
      noteJson.nullifier &&
      (noteJson.nullifier as Record<string, unknown>).inner
    ) {
      const nfInner = (noteJson.nullifier as Record<string, unknown>).inner as string
      const spentHeight = nullifierMap.get(nfInner)
      if (spentHeight !== undefined) {
        noteJson.heightSpent = spentHeight.toString()
        await cursor.update(noteJson)
      }
    }
    cursor = await cursor.continue()
  }

  await tx.done
}

/**
 * Get the last synced height from IDB.
 */
async function getLastSyncedHeight(): Promise<bigint> {
  const db = await getDB()
  const height = await db.get('FULL_SYNC_HEIGHT', 'height') as bigint | undefined
  return height ?? 0n
}

// Track if we've saved initial parameters
let hasSavedInitialParams = false

async function saveNullifierWindow(window: {
  protocolVersion: number
  currentGeneration: bigint
  recentPositionFloor: bigint
  archivedGenerationCount: bigint
  archivedHistoryHead: Uint8Array
}): Promise<void> {
  const db = await getDB()
  await db.put(
    'FMD_PARAMETERS',
    {
      protocol_version: window.protocolVersion,
      current_generation: Number(window.currentGeneration),
      recent_position_floor: Number(window.recentPositionFloor),
      archived_generation_count: Number(window.archivedGenerationCount),
      archived_history_head: Array.from(window.archivedHistoryHead),
    },
    'nullifier-window'
  )
}

/**
 * Save FMD parameters and other chain parameters from a compact block.
 */
async function saveBlockParameters(compactBlock: CompactBlock): Promise<void> {
  // Only save if we have parameters to save
  if (
    !compactBlock.appParametersUpdated &&
    !compactBlock.gasPrices &&
    !compactBlock.nullifierWindow
  ) {
    return
  }
  
  const db = await getDB()
  
  // Save app parameters if flagged as updated or on first sync
  if (compactBlock.appParametersUpdated || !hasSavedInitialParams) {
    await fetchAndSaveAppParameters()
  }
  
  // Save gas prices if present (keyed by asset ID)
  if (compactBlock.gasPrices && compactBlock.gasPrices.assetId?.inner) {
    const gasPricesJson = compactBlock.gasPrices.toJson()
    const assetIdKey = Buffer.from(compactBlock.gasPrices.assetId.inner).toString('base64')
    await db.put('GAS_PRICES', gasPricesJson, assetIdKey)
    if (!hasSavedInitialParams) {
      console.log('[ViewServerSync] Saved gas prices')
    }
  }

  // Current Shieldd transaction plans bind to the chain's nullifier
  // generation window. Store a snake_case, number-only representation so the
  // Rust WASM planner can deserialize it directly from IndexedDB. These
  // values are protocol-bounded below JavaScript's safe integer limit.
  if (compactBlock.nullifierWindow) {
    await saveNullifierWindow(compactBlock.nullifierWindow)
  }
  
  // Save epoch info when epoch root is present (end of epoch)
  if (compactBlock.epochRoot) {
    const epochIndex = Number(compactBlock.height)
    await db.put('EPOCHS', {
      index: epochIndex,
      startHeight: compactBlock.height,
    }, `epoch-${epochIndex}`)
  }
  
  hasSavedInitialParams = true
}

/**
 * Fetch and save FMD parameters from app parameters.
 * FMD params are nested inside app parameters in the shielded_pool_params field.
 */
async function fetchAndSaveFmdParameters(): Promise<void> {
  const db = await getDB()
  
  try {
    const { AppParametersRequest, AppParametersResponse } = await import(
      '@mizufinance/protobuf/shieldd/core/app/v1/app_pb'
    )
    
    const request = new AppParametersRequest({})
    const base64Request = createGrpcWebRequest(request.toBinary())
    
    const response = await fetch('/api/penumbra/app-params', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web-text',
        'Accept': 'application/grpc-web-text',
      },
      body: base64Request,
    })
    
    if (!response.ok) {
      console.warn('[ViewServerSync] Failed to fetch app parameters')
      return
    }
    
    const messageBytes = parseGrpcWebResponse(await response.text())
    if (!messageBytes) return
    const appParamsResponse = AppParametersResponse.fromBinary(messageBytes)
    
    if (appParamsResponse.appParameters) {
      const appParamsJson = appParamsResponse.appParameters.toJson()
      await db.put('APP_PARAMETERS', appParamsJson, 'params')
      console.log('[ViewServerSync] Saved app parameters')
      
      // Save gas prices if present in fee params
      const feeParams = appParamsResponse.appParameters.feeParams
      if (feeParams?.fixedGasPrices) {
        const gasPrices = feeParams.fixedGasPrices
        
        let assetIdKey: string
        if (gasPrices.assetId?.inner) {
          assetIdKey = Buffer.from(gasPrices.assetId.inner).toString('base64')
        } else {
          const { assetIdFromBaseDenom } = await import('../wasm-loader')
          const baseAssetId =
            await assetIdFromBaseDenom(SHIELDD_BASE_DENOM)
          assetIdKey = Buffer.from(baseAssetId.inner).toString('base64')
          
          const { AssetId } = await import(
            '@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb'
          )
          gasPrices.assetId = new AssetId({ inner: baseAssetId.inner })
        }
        
        const gasPricesJson = gasPrices.toJson()
        await db.put('GAS_PRICES', gasPricesJson, assetIdKey)
        console.log('[ViewServerSync] Saved gas prices, assetId key:', assetIdKey)
      }
    }
  } catch (error) {
    console.warn('[ViewServerSync] Failed to fetch FMD parameters:', error)
  }
}

async function fetchAndSaveNullifierWindow(): Promise<void> {
  try {
    const { NullifierWindowRequest, NullifierWindowResponse } = await import(
      '@mizufinance/protobuf/shieldd/core/component/sct/v1/sct_pb'
    )
    const request = new NullifierWindowRequest({})
    const response = await fetch('/api/penumbra/nullifier-window', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web-text',
        Accept: 'application/grpc-web-text',
      },
      body: createGrpcWebRequest(request.toBinary()),
    })
    if (!response.ok) {
      console.warn('[ViewServerSync] Failed to fetch nullifier window')
      return
    }
    const messageBytes = parseGrpcWebResponse(await response.text())
    if (!messageBytes) return
    const result = NullifierWindowResponse.fromBinary(messageBytes)
    if (result.window) {
      await saveNullifierWindow(result.window)
      console.log('[ViewServerSync] Saved nullifier window')
    }
  } catch (error) {
    console.warn('[ViewServerSync] Failed to fetch nullifier window:', error)
  }
}

/**
 * Fetch and save app parameters from the chain.
 */
async function fetchAndSaveAppParameters(): Promise<void> {
  const db = await getDB()
  try {
    const { AppParametersRequest, AppParametersResponse } = await import(
      '@mizufinance/protobuf/shieldd/core/app/v1/app_pb'
    )
    
    const request = new AppParametersRequest({})
    const base64Request = createGrpcWebRequest(request.toBinary())
    
    const response = await fetch('/api/penumbra/app-params', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web-text',
        'Accept': 'application/grpc-web-text',
      },
      body: base64Request,
    })
    
    if (!response.ok) return
    
    const messageBytes = parseGrpcWebResponse(await response.text())
    if (!messageBytes) return
    
    const appParamsResponse = AppParametersResponse.fromBinary(messageBytes)
    
    if (appParamsResponse.appParameters) {
      const appParamsJson = appParamsResponse.appParameters.toJson()
      await db.put('APP_PARAMETERS', appParamsJson, 'params')  // Key must be 'params'
      console.log('[ViewServerSync] Saved app parameters')
    }
  } catch (error) {
    console.warn('[ViewServerSync] Failed to fetch app parameters:', error)
  }
}

// =============================================================================
// Compact Block Fetching
// =============================================================================

/** Batch size for range requests */
const RANGE_BATCH_SIZE = 10000

/** Flush to IDB every N blocks (matches prax's approach) */
const FLUSH_INTERVAL = 5000

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

/**
 * Parse all gRPC-web data frames from a base64-encoded response.
 * Each frame: [1 byte flags][4 bytes length][N bytes message]
 * Flag 0x00 = data frame, 0x80 = trailers frame.
 */
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

    // Only process data frames (flags === 0), skip trailers (flags === 0x80)
    if (flags === 0) {
      frames.push(responseBytes.slice(offset, offset + msgLen))
    }

    offset += msgLen
  }

  return frames
}

/**
 * Fetch a range of compact blocks using the streaming CompactBlockRange RPC.
 * Returns an array of CompactBlock objects in order.
 */
async function fetchCompactBlockRange(startHeight: number, endHeight: number): Promise<CompactBlock[]> {
  const { CompactBlockRangeRequest, CompactBlockRangeResponse } = await import(
    '@mizufinance/protobuf/shieldd/core/component/compact_block/v1/compact_block_pb'
  )

  const request = new CompactBlockRangeRequest({
    startHeight: BigInt(startHeight),
    endHeight: BigInt(endHeight + 1), // endHeight is exclusive in the range RPC
    keepAlive: false,
  })
  const base64Request = createGrpcWebRequest(request.toBinary())

  const response = await fetch('/api/penumbra/compact-block-range', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web-text',
      'Accept': 'application/grpc-web-text',
    },
    body: base64Request,
  })

  if (!response.ok) {
    throw new Error(`CompactBlockRange failed: ${response.status}`)
  }

  const base64Body = await response.text()
  const messageFrames = parseAllGrpcWebFrames(base64Body)

  const blocks: CompactBlock[] = []
  for (const frame of messageFrames) {
    const rangeResponse = CompactBlockRangeResponse.fromBinary(frame)
    if (rangeResponse.compactBlock) {
      blocks.push(rangeResponse.compactBlock)
    }
  }

  return blocks
}

/**
 * Get the current chain height.
 */
async function getChainHeight(): Promise<number> {
  try {
    const response = await fetch('/api/penumbra/status')
    if (!response.ok) return 0
    const data = await response.json()
    const height = data.height ?? 0
    return typeof height === 'string' ? parseInt(height, 10) : height
  } catch {
    return 0
  }
}

async function getPenumbraChainMarker(): Promise<string> {
  try {
    const blocks = await fetchCompactBlockRange(0, 0)
    const firstBlock = blocks[0]
    if (firstBlock) {
      const bytes = firstBlock.toBinary()
      const hash = await crypto.subtle.digest('SHA-256', bytes)
      return Buffer.from(hash).toString('hex')
    }
  } catch (error) {
    console.warn('[ViewServerSync] Failed to read chain marker:', error)
  }
  return 'unknown'
}

/**
 * Ensure local Penumbra IndexedDB state belongs to the currently running chain.
 * Local demo resets can reuse the same chain ID and genesis content, so we also
 * clear state if the current chain height moved backwards relative to the last
 * browser-observed height.
 */
export async function ensureFreshPenumbraSyncState(chainId: string): Promise<{
  reset: boolean
  chainHeight: number
  marker: string
  reason?: 'chain' | 'marker' | 'height' | 'storage'
}> {
  const [chainHeight, marker, syncState] = await Promise.all([
    getChainHeight(),
    getPenumbraChainMarker(),
    getSyncState(),
  ])

  const storedHeight = Math.max(
    syncState?.lastObservedChainHeight ?? 0,
    syncState?.lastObservedHeight ?? 0,
    syncState?.fullSyncHeight ?? 0,
  )
  const chainChanged = Boolean(syncState?.chainId && syncState.chainId !== chainId)
  const markerChanged = Boolean(
    syncState?.chainMarker &&
    syncState.chainMarker !== marker &&
    marker !== 'unknown'
  )
  const heightMovedBackwards = chainHeight > 0 && storedHeight > chainHeight + 2
  const storageChanged = syncState?.sctStorageVersion !== SCT_STORAGE_VERSION

  if (chainChanged || markerChanged || heightMovedBackwards || storageChanged) {
    const reason = chainChanged ? 'chain' : markerChanged ? 'marker' : heightMovedBackwards ? 'height' : 'storage'
    console.warn('[ViewServerSync] Clearing stale Penumbra sync state', {
      chainChanged,
      markerChanged,
      heightMovedBackwards,
      storageChanged,
      storedHeight,
      chainHeight,
    })
    await clearPenumbraSyncTables()
    updateRuntimeStatus({ currentHeight: 0, chainHeight, lastError: undefined })
    await savePenumbraChainFingerprint({
      chainId,
      marker,
      lastObservedChainHeight: Math.max(chainHeight, 0),
      sctStorageVersion: SCT_STORAGE_VERSION,
    })
    return { reset: true, chainHeight, marker, reason }
  }

  await savePenumbraChainFingerprint({
    chainId,
    marker,
    lastObservedChainHeight: Math.max(chainHeight, 0),
    sctStorageVersion: SCT_STORAGE_VERSION,
  })
  return { reset: false, chainHeight, marker }
}

export async function getPenumbraWalletSyncStatus(): Promise<SyncStatus> {
  const [current, target] = await Promise.all([
    getLastSyncedHeight(),
    getChainHeight(),
  ])
  return {
    isRunning: Boolean(activeViewServer),
    currentHeight: Number(current),
    chainHeight: target,
    // current > tip means the local state belongs to a previous chain
    // (local resets reuse the chain ID) — that is stale, not synced.
    isSynced:
      target > 0 &&
      Number(current) >= Math.max(0, target - 1) &&
      Number(current) <= target + 2,
  }
}

export async function assertPenumbraWalletSynced(minHeight?: bigint): Promise<void> {
  // Wait for the finalized tip observed when this operation starts. A moving
  // target never settles while Commonware produces blocks faster than we poll.
  // Previously committed roots remain valid transaction anchors.
  const initial = await getPenumbraWalletSyncStatus()
  const target = BigInt(initial.chainHeight) > (minHeight ?? 0n)
    ? BigInt(initial.chainHeight)
    : (minHeight ?? 0n)
  const deadline = Date.now() + 60_000

  while (Date.now() < deadline) {
    const status = await getPenumbraWalletSyncStatus()
    const current = BigInt(status.currentHeight)
    // A local height beyond the current chain can belong to an earlier genesis.
    if (target > 0n && current >= target && current <= BigInt(status.chainHeight) + 2n) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error('Private wallet syncing')
}

/**
 * Verify that the witness anchor the wallet is about to broadcast was a real
 * chain SCT root. Penumbra rejects any anchor that was never a committed root
 * ("provided anchor is not a valid SCT root"); that only happens when the local
 * tree was reconstructed from poisoned state (e.g. stale snapshot chunks from a
 * previous genesis). Detect it here and fail with an actionable error instead of
 * emitting a doomed broadcast.
 *
 * Queries `sct/tree/anchor_lookup/{anchor}` — the exact check the chain itself
 * performs at broadcast (`check_claimed_anchor`). Unlike comparing against
 * `anchor_by_height(fullSyncHeight)`, this does not race with the sync height
 * advancing under us at the chain tip, so it cannot produce false positives
 * for a healthy tree.
 */
export async function assertSctAnchorMatchesChain(
  anchorInner: Uint8Array | undefined,
): Promise<void> {
  if (!anchorInner || anchorInner.length === 0) return

  const localHex = Buffer.from(anchorInner).toString('hex')

  let found: boolean
  try {
    const response = await fetch(`/api/penumbra/anchor-lookup/${localHex}`, {
      cache: 'no-store',
    })
    // Can't make a determination on query failure — don't block.
    if (!response.ok) return
    const data = (await response.json()) as { found?: boolean }
    found = Boolean(data.found)
  } catch {
    return
  }

  if (!found) {
    console.error(
      '[ViewServerSync] Witness anchor was never a chain SCT root (stale local state)',
      { anchor: localHex },
    )
    throw new Error(
      'Private wallet state is out of sync with the chain (reconstructed SCT ' +
        'root is invalid). Open the native wallet settings and run "Reset Cache ' +
        '& Resync", then try again.',
    )
  }
}

// =============================================================================
// ViewServer Sync Controller
// =============================================================================

// Global reference to the active ViewServer for witness generation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeViewServer: any = null

/**
 * Get the current SCT root from the active ViewServer.
 * This should be used instead of loading from IDB for witness generation.
 */
export function getActiveViewServerSctRoot(): Uint8Array | null {
  if (!activeViewServer) return null
  const root = activeViewServer.getSctRoot()
  return root?.inner ?? null
}

/**
 * Get the current tree state from the active ViewServer for witness generation.
 * Falls back to IDB if ViewServer is not available.
 */
export async function getActiveViewServerTree(): Promise<StateCommitmentTree> {
  // Always load from IDB since ViewServer doesn't expose full tree
  const tree = await loadStoredTree()
  return tree
}

export class ViewServerSyncController {
  private config: ViewServerSyncConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private viewServer: any = null
  private isRunning = false
  private isStopping = false
  private currentHeight = 0
  private chainHeight = 0
  private runPromise: Promise<void> | null = null

  constructor(config: ViewServerSyncConfig) {
    this.config = config
  }
  
  /**
   * Initialize the ViewServer WASM.
   */
  private async initViewServer(): Promise<void> {
    if (this.viewServer) return
    
    console.log('[ViewServerSync] Initializing ViewServer WASM...')
    
    // Dynamic import to avoid SSR issues
    const ViewServerClass = await getViewServerClass()
    
    this.viewServer = await ViewServerClass.initialize({
      fullViewingKey: this.config.fullViewingKey,
      getStoredTree: loadStoredTree,
      idbConstants: getIdbConstants(),
    })
    
    // Set global reference for witness generation
    activeViewServer = this.viewServer
    
    console.log('[ViewServerSync] ViewServer initialized')
  }
  
  /**
   * Start syncing blocks.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[ViewServerSync] Already running')
      return
    }
    this.runPromise = this.runSync()
    return this.runPromise
  }

  /**
   * Stop syncing and wait for the run loop to fully exit, including any
   * in-flight block scan or IDB flush. Callers that clear the sync tables
   * (reset & resync) MUST use this instead of stop(): a fire-and-forget stop
   * lets the old loop's final flush land in the freshly cleared DB, writing a
   * stale tree fragment + sync height that poisons the next sync permanently.
   */
  async stopAndWait(): Promise<void> {
    this.stop()
    if (this.runPromise) {
      try {
        await this.runPromise
      } catch {
        // Run-loop errors are already reported via onError.
      }
    }
  }

  /**
   * If the persisted tree's root was never a real chain anchor (state
   * corrupted by an interrupted sync, stale snapshots, or a previous chain),
   * clear the sync tables and reinitialize so we resync from genesis instead
   * of extending a poisoned tree.
   */
  private async healPersistedTreeIfInvalid(): Promise<void> {
    const lastHeight = Number(await getLastSyncedHeight())
    if (!Number.isFinite(lastHeight) || lastHeight <= 0 || !this.viewServer) {
      return
    }

    let found: boolean
    try {
      const rootHex = Buffer.from(this.viewServer.getSctRoot().inner).toString(
        'hex'
      )
      const response = await fetch(`/api/penumbra/anchor-lookup/${rootHex}`, {
        cache: 'no-store',
      })
      if (!response.ok) return
      const data = (await response.json()) as { found?: boolean }
      found = Boolean(data.found)
      if (!found) {
        console.warn(
          '[ViewServerSync] Persisted SCT root was never a chain anchor — clearing stale state and resyncing from genesis',
          { height: lastHeight, rootHex }
        )
      }
    } catch {
      // Can't make a determination — proceed with the loaded tree.
      return
    }

    if (!found) {
      await clearPenumbraSyncTables()
      activeViewServer = null
      this.viewServer = null
      this.currentHeight = -1
      updateRuntimeStatus({ currentHeight: 0 })
      await this.initViewServer()
    }
  }

  private async runSync(): Promise<void> {
    this.isRunning = true
    this.isStopping = false
    updateRuntimeStatus({
      isRunning: true,
      currentHeight: this.currentHeight,
      chainHeight: this.chainHeight,
      lastError: undefined,
    })
    
    try {
      const freshness = await ensureFreshPenumbraSyncState(this.config.chainId)
      if (freshness.reset) {
        activeViewServer = null
        this.viewServer = null
        this.currentHeight = -1
        this.chainHeight = freshness.chainHeight
        updateRuntimeStatus({
          currentHeight: 0,
          chainHeight: freshness.chainHeight,
        })
      }
      await this.initViewServer()

      // Validate the loaded tree before extending it. Runs before the params
      // fetch because a heal clears those tables too.
      await this.healPersistedTreeIfInvalid()

      // Fetch and save chain parameters used by current transaction planning.
      // This is needed before any transactions can be planned
      await Promise.all([
        fetchAndSaveFmdParameters(),
        fetchAndSaveNullifierWindow(),
      ])
      
      // Get starting point
      // Note: If no previous sync, start from -1 so first block is 0 (genesis)
      const lastHeight = await getLastSyncedHeight()
      this.currentHeight = lastHeight === 0n ? -1 : Number(lastHeight)
      this.chainHeight = await getChainHeight()
      updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })
      
      console.log(`[ViewServerSync] Starting sync from height ${this.currentHeight} to ${this.chainHeight}`)
      
      // Try snapshot-based fast sync first
      try {
        const { snapshotSync } = await import('./snapshot-sync')
        const snapshotHeight = await snapshotSync(
          this.currentHeight,
          {
          onBlock: async (compactBlock) => {
            const blockHeight = Number(compactBlock.height)
            
            await saveBlockParameters(compactBlock)
            
            let scannerWantsFlush: boolean
            // Only height 0 is the genesis block. Height 1 is a normal block and
            // must go through scanBlock — the genesis path does not call
            // end_epoch (or consult RolledUp advice), so routing height 1 (or any
            // later block) through it would diverge the SCT from the chain.
            if (blockHeight === 0) {
              console.log(`[ViewServerSync] Processing genesis block ${blockHeight} (from snapshot)...`)
              await this.viewServer!.scanGenesisChunk(0n, compactBlock, false)
              scannerWantsFlush = await this.viewServer!.genesisAdvice(compactBlock)
            } else {
              scannerWantsFlush = await this.viewServer!.scanBlock(compactBlock, false)
            }
            
            // Flush periodically or when scanner finds notes (matching prax's strategy)
            const shouldFlush = scannerWantsFlush
              || blockHeight % FLUSH_INTERVAL === 0
            
            if (shouldFlush) {
              const result = this.viewServer!.flushUpdates()
              await saveScanResult(result)
              
              // Mark notes spent by nullifiers in this block
              await markSpentNotes([compactBlock])
              
              if (result.newNotes.length > 0) {
                console.log(`[ViewServerSync] Found ${result.newNotes.length} notes at height ${blockHeight} (from snapshot)`)
                this.config.onNotesFound?.(result.newNotes.length, blockHeight)
              }
            }
          },
          onProgress: (current, _total) => {
            this.config.onProgress?.(current, this.chainHeight)
          },
          isStopping: () => this.isStopping,
          },
          this.chainHeight
        )
        
        if (snapshotHeight > this.currentHeight) {
          this.currentHeight = snapshotHeight
          // Refresh chain height after snapshot sync
          this.chainHeight = await getChainHeight()
          updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })
          console.log(`[ViewServerSync] Snapshot sync reached height ${this.currentHeight}, chain at ${this.chainHeight}`)
        }
      } catch (error) {
        console.warn('[ViewServerSync] Snapshot sync failed, continuing with normal sync:', error)
      }
      
      // Batch sync loop — fetch remaining blocks in ranges
      while (!this.isStopping && this.currentHeight < this.chainHeight) {
        const nextHeight = this.currentHeight + 1
        const batchEnd = Math.min(nextHeight + RANGE_BATCH_SIZE - 1, this.chainHeight)
        
        let blocks: CompactBlock[]
        try {
          blocks = await fetchCompactBlockRange(nextHeight, batchEnd)
        } catch (error) {
          console.warn(`[ViewServerSync] Failed to fetch range ${nextHeight}..${batchEnd}, retrying...`, error)
          await new Promise(r => setTimeout(r, 1000))
          continue
        }
        
        if (blocks.length === 0) {
          console.warn(`[ViewServerSync] Empty range ${nextHeight}..${batchEnd}, retrying...`)
          await new Promise(r => setTimeout(r, 1000))
          continue
        }
        
        // Process each block in the batch
        let lastFlushHeight = this.currentHeight
        for (const compactBlock of blocks) {
          if (this.isStopping) break
          
          const blockHeight = Number(compactBlock.height)
          
          // Save chain parameters from block (FMD, gas prices, app params)
          await saveBlockParameters(compactBlock)
          
          // Only height 0 is the genesis block; height 1+ are normal blocks.
          // The genesis path skips end_epoch / RolledUp advice, so routing any
          // non-genesis block through it would diverge the SCT from the chain.
          let scannerWantsFlush: boolean
          if (blockHeight === 0) {
            console.log(`[ViewServerSync] Processing genesis block ${blockHeight}...`)
            await this.viewServer!.scanGenesisChunk(0n, compactBlock, false)
            scannerWantsFlush = await this.viewServer!.genesisAdvice(compactBlock)
            console.log(`[ViewServerSync] Genesis block ${blockHeight} processed, hasNotes:`, scannerWantsFlush)
          } else {
            scannerWantsFlush = await this.viewServer!.scanBlock(compactBlock, false)
          }
          
          // Flush periodically, when scanner finds notes, or at chain tip
          const atTip = blockHeight >= this.chainHeight
          const shouldFlush = scannerWantsFlush
            || blockHeight - lastFlushHeight >= FLUSH_INTERVAL
            || atTip
          
          if (shouldFlush) {
            const result = this.viewServer!.flushUpdates()
            await saveScanResult(result)
            lastFlushHeight = blockHeight
            
            if (result.newNotes.length > 0) {
              console.log(`[ViewServerSync] Found ${result.newNotes.length} notes at height ${blockHeight}`)
              this.config.onNotesFound?.(result.newNotes.length, blockHeight)
            }
          }
          
          this.currentHeight = blockHeight
          updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })
        }
        
        // Always flush at end of batch if we haven't recently
        if (this.currentHeight > lastFlushHeight) {
          const result = this.viewServer!.flushUpdates()
          await saveScanResult(result)
          
          if (result.newNotes.length > 0) {
            this.config.onNotesFound?.(result.newNotes.length, this.currentHeight)
          }
        }
        
        // Mark notes spent by nullifiers in this batch
        await markSpentNotes(blocks)
        
        // Report progress after each batch
        this.config.onProgress?.(this.currentHeight, this.chainHeight)
        updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })
        
        // Refresh chain height after each batch
        this.chainHeight = await getChainHeight()
        updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })
      }
      
      if (!this.isStopping) {
      console.log('[ViewServerSync] Sync complete, watching for new blocks...')
        
        // Watch for new blocks — use small batches for near-tip sync
        while (!this.isStopping) {
          await new Promise(r => setTimeout(r, 2000))

          const newChainHeight = await getChainHeight()

          // A chain tip far below our synced height means the chain was reset
          // under us (local demo wipes reuse the chain ID, so only the height
          // regression is observable from a running tab). Restart the sync so
          // ensureFreshPenumbraSyncState can clear the stale state, instead of
          // idling forever at a height that no longer exists.
          if (newChainHeight > 0 && this.currentHeight > newChainHeight + 2) {
            console.warn(
              '[ViewServerSync] Chain height moved backwards (chain reset?), restarting sync',
              { currentHeight: this.currentHeight, chainHeight: newChainHeight },
            )
            setTimeout(() => {
              if (!this.isStopping) void this.start()
            }, 0)
            return
          }

          if (newChainHeight > this.chainHeight) {
            this.chainHeight = newChainHeight
            updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })
            
            // Fetch all new blocks in one range request
            const startHeight = this.currentHeight + 1
            let blocks: CompactBlock[]
            try {
              blocks = await fetchCompactBlockRange(startHeight, this.chainHeight)
            } catch {
              continue
            }
            
            for (const compactBlock of blocks) {
              if (this.isStopping) break
              
              const blockHeight = Number(compactBlock.height)
              
              await saveBlockParameters(compactBlock)
              
              const scannerWantsFlush = await this.viewServer!.scanBlock(compactBlock, false)
              
              this.currentHeight = blockHeight
              updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })

              if (scannerWantsFlush) {
                const result = this.viewServer!.flushUpdates()
                await saveScanResult(result)
                await markSpentNotes([compactBlock])

                if (result.newNotes.length > 0) {
                  console.log(`[ViewServerSync] Found ${result.newNotes.length} new notes at height ${blockHeight}`)
                  this.config.onNotesFound?.(result.newNotes.length, blockHeight)
                }
              }
            }
            
            // Always flush at tip — blocks arrive slowly so no batching needed
            const result = this.viewServer!.flushUpdates()
            await saveScanResult(result)
            
            // Mark notes spent by nullifiers in these blocks
            await markSpentNotes(blocks)
            
            if (result.newNotes.length > 0) {
              console.log(`[ViewServerSync] Found ${result.newNotes.length} new notes`)
              this.config.onNotesFound?.(result.newNotes.length, this.currentHeight)
            }
            
            this.config.onProgress?.(this.currentHeight, this.chainHeight)
            updateRuntimeStatus({ currentHeight: this.currentHeight, chainHeight: this.chainHeight })
          }
        }
      }
    } catch (error) {
      console.error('[ViewServerSync] Sync error:', error)
      updateRuntimeStatus({
        lastError: error instanceof Error ? error.message : String(error),
      })
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.isRunning = false
      updateRuntimeStatus({ isRunning: false })
    }
  }
  
  /**
   * Stop syncing.
   */
  stop(): void {
    console.log('[ViewServerSync] Stopping sync...')
    this.isStopping = true
    updateRuntimeStatus({ isRunning: false })
  }
  
  /**
   * Get current sync status.
   */
  getStatus(): SyncStatus {
    return {
      isRunning: this.isRunning,
      currentHeight: this.currentHeight,
      chainHeight: this.chainHeight,
      isSynced:
        this.currentHeight >= this.chainHeight &&
        this.currentHeight <= this.chainHeight + 2,
    }
  }
}

/**
 * Create a ViewServer sync controller.
 */
export function createViewServerSyncController(
  config: ViewServerSyncConfig
): ViewServerSyncController {
  return new ViewServerSyncController(config)
}
