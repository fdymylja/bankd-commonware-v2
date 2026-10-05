/**
 * Shieldd WebView Bridge — Bundled version with real WASM modules.
 *
 * This runs inside a hidden React Native WebView. It:
 * 1. Loads the embedded-Shieldd WASM modules (bundled by Vite)
 * 2. Manages IndexedDB for notes, SCT, params
 * 3. Syncs compact blocks from Bankd's embedded Shieldd via gRPC-web
 * 4. Responds to commands from React Native via postMessage
 */

import {
  generateSpendKey,
  getFullViewingKey,
  getAddressByIndex,
  getEphemeralByIndex,
  getWalletId,
  getTransparentAddress,
} from '@mizufinance/wasm/keys'
import { getAddressIndexByAddress } from '@mizufinance/wasm/address'
import { authorizePlan, buildActionParallel, buildParallel, getWitness } from '@mizufinance/wasm/build'
import { assetIdFromBaseDenom } from '@mizufinance/wasm/asset'
import { planTransaction as wasmPlanTransaction } from '@mizufinance/wasm/planner'
import { ViewServer } from '@mizufinance/wasm/view-server'
import { prepareDisclosure, exportDisclosure, inspectDisclosure, confirmDisclosureAcceptance } from '@mizufinance/wasm/disclosure'
import { committedDisclosureTransaction, disclosureRequest } from '../../packages/shared/src/shieldd/disclosure'
import { createShielddFetch, rpc, getFinalizedHeight, broadcast, waitForConfirmation, assertCommittedAnchor } from './commonware'
import {
  FullViewingKey,
  SpendKey,
  Address,
  AddressIndex,
} from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import { TransactionPlan } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import { TransactionPlannerRequest } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'
import { AssetId, Value } from '@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb'
import {
  AssetMetadataByIdRequest,
  AssetMetadataByIdResponse,
  EvmCall,
  HostExecution,
  HostTransfer,
  HostWithdrawal,
} from '@mizufinance/protobuf/shieldd/core/component/shielded_pool/v1/shielded_pool_pb'
import {
  CompactBlockRangeRequest,
  CompactBlockRangeResponse,
} from '@mizufinance/protobuf/shieldd/core/component/compact_block/v1/compact_block_pb'
import {
  AppParametersRequest,
  AppParametersResponse,
} from '@mizufinance/protobuf/shieldd/core/app/v1/app_pb'
import { Amount } from '@mizufinance/protobuf/shieldd/core/num/v1/num_pb'

import { addressFromBech32m, bech32mAddress } from './shieldd-address'

// =============================================================================
// State
// =============================================================================

let isInitialized = false
let grpcUrl = ''
let rpcUrl = ''
let chainId = ''
let proverUrl = 'http://127.0.0.1:8090'

let fvkBytes: Uint8Array | null = null
let spendKeyBytes: Uint8Array | null = null
let isSyncing = false
let isStopping = false
let syncTargetHeight = 0
let viewServer: any = null

// =============================================================================
// Message Transport
// =============================================================================

function sendToRN(event: any) {
  if ((window as any).ReactNativeWebView) {
    ;(window as any).ReactNativeWebView.postMessage(JSON.stringify(event))
  }
}

function sendError(message: string, requestId?: string, stack?: string) {
  sendToRN({ type: 'error', requestId, message, stack })
}

window.addEventListener('message', (event) => {
  try {
    const cmd = JSON.parse(event.data)
    handleCommand(cmd)
  } catch (e: any) {
    sendError('Failed to parse command: ' + e.message, undefined, e.stack)
  }
})

document.addEventListener('message', ((event: any) => {
  try {
    const cmd = JSON.parse(event.data)
    handleCommand(cmd)
  } catch (e: any) {
    sendError('Failed to parse command: ' + e.message, undefined, e.stack)
  }
}) as EventListener)

// =============================================================================
// Command Handler
// =============================================================================

let mutationInProgress = false
const MUTATIONS = new Set(['init', 'send', 'withdraw', 'buildTransaction', 'broadcastTransaction', 'clearData'])
async function handleCommand(cmd: any) {
  const mutation = MUTATIONS.has(cmd.type)
  if (mutation && mutationInProgress) { sendError('Another wallet operation is in progress', cmd.requestId); return }
  if (mutation) mutationInProgress = true
  try {
    switch (cmd.type) {
      case 'deriveKeys': await handleDeriveKeys(cmd); break
      case 'init': await handleInit(cmd); break
      case 'startSync': await handleStartSync(cmd); break
      case 'stopSync': handleStopSync(cmd); break
      case 'getBalances': await handleGetBalances(cmd); break
      case 'getAddress': await handleGetAddress(cmd); break
      case 'getEphemeralAddress': await handleGetEphemeralAddress(cmd); break
      case 'getTransparentAddress': await handleGetTransparentAddr(cmd); break
      case 'planTransaction': await handlePlanTx(cmd); break
      case 'buildTransaction': await handleBuildTx(cmd); break
      case 'broadcastTransaction': await handleBroadcastTx(cmd); break
      case 'getSyncStatus': handleGetSyncStatus(cmd); break
      case 'withdraw': await handleWithdraw(cmd); break
      case 'send': await handleSend(cmd); break
      case 'computeAssetIds': await handleComputeAssetIds(cmd); break
      case 'clearData': await handleClearData(cmd); break
      case 'getAddressOwnership': await handleGetAddressOwnership(cmd); break
      case 'exportDisclosure': await handleDisclosureExport(cmd); break
      default: sendError('Unknown command: ' + cmd.type, cmd.requestId)
    }
  } catch (e: any) {
    sendError(e.message, cmd.requestId, e.stack)
  } finally {
    if (mutation) mutationInProgress = false
  }
}

async function handleDisclosureExport(cmd: import('../lib/penumbra-webview/bridge-protocol').ExportDisclosureCommand) {
  if (!fvkBytes) throw new Error('Unlock the wallet before preparing a disclosure')
  const request = disclosureRequest(chainId, cmd.selection, cmd.method)
  const transaction = await committedDisclosureTransaction(grpcUrl, chainId, cmd.selection)
  const witness = await prepareDisclosure(request, [transaction], new FullViewingKey({ inner: fvkBytes }))
  const packageJson = await exportDisclosure(witness, cmd.method)
  const verification = await confirmDisclosureAcceptance(packageJson, chainId, [{ height: cmd.selection.height, transactions: [transaction] }])
  sendToRN({ type: 'disclosureResult', requestId: cmd.requestId, packageJson, preview: await inspectDisclosure(packageJson), verification })
}

// =============================================================================
// IndexedDB Setup
// =============================================================================

let DB_NAME = 'bankd-commonware-wallet'
const DB_VERSION = 2
const IDB_TABLES = {
  assets: 'ASSETS',
  auctions: 'AUCTIONS',
  auction_outstanding_reserves: 'AUCTION_OUTSTANDING_RESERVES',
  advice_notes: 'ADVICE_NOTES',
  spendable_notes: 'SPENDABLE_NOTES',
  swaps: 'SWAPS',
  fmd_parameters: 'FMD_PARAMETERS',
  app_parameters: 'APP_PARAMETERS',
  gas_prices: 'GAS_PRICES',
  epochs: 'EPOCHS',
  prices: 'PRICES',
  validator_infos: 'VALIDATOR_INFOS',
  transactions: 'TRANSACTIONS',
  full_sync_height: 'FULL_SYNC_HEIGHT',
  tree_commitments: 'TREE_COMMITMENTS',
  tree_hashes: 'TREE_HASHES',
  tree_last_position: 'TREE_LAST_POSITION',
  tree_last_forgotten: 'TREE_LAST_FORGOTTEN',
  lqt_historical_votes: 'LQT_HISTORICAL_VOTES',
}

let db: IDBDatabase | null = null

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    let staleSchema = false
    request.onerror = () => reject(staleSchema
      ? new Error('Stale prototype wallet format. Clear the WebView wallet data and rescan the compatible chain.')
      : request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      if (event.oldVersion !== 0) {
        staleSchema = true
        request.transaction!.abort()
        return
      }
      const database = (event.target as IDBOpenDBRequest).result
      const stores = Object.values(IDB_TABLES)
      for (const name of stores) {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name)
        }
      }
    }
  })
}

async function getDB(): Promise<IDBDatabase> {
  if (!db) db = await openDatabase()
  return db
}

function idbGet(storeName: string, key: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const database = await getDB()
    const tx = database.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbPut(storeName: string, value: any, key: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const database = await getDB()
    const tx = database.transaction(storeName, 'readwrite')
    const request = tx.objectStore(storeName).put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function idbGetAll(storeName: string): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    const database = await getDB()
    const tx = database.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbClear(storeName: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const database = await getDB()
    const tx = database.transaction(storeName, 'readwrite')
    const request = tx.objectStore(storeName).clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// =============================================================================
// Helpers
// =============================================================================

function base64ToBytes(b64: string): Uint8Array {
  // gRPC-web-text concatenates independently base64-encoded frames with padding
  // in the middle. Match each base64 chunk (chars + optional padding), decode
  // individually with atob(), and concatenate. Matches admin's decodeGrpcWebText.
  const chunks = b64.match(/[A-Za-z0-9+/]+=*=*/g) || []
  const parts: Uint8Array[] = []
  let totalLen = 0
  for (const chunk of chunks) {
    const binary = atob(chunk)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    parts.push(bytes)
    totalLen += bytes.length
  }
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string, expectedLength?: number): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!/^[0-9a-fA-F]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error(`Invalid hex value: ${hex}`)
  }
  const bytes = new Uint8Array(normalized.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) ?? [])
  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new Error(`Expected ${expectedLength} bytes, received ${bytes.length}`)
  }
  return bytes
}

const BANKD_QUERY_PATH = '/query/'
let bankdQueryProxyInstalled = false
function installBankdQueryProxy() {
  if (bankdQueryProxyInstalled) return
  globalThis.fetch = createShielddFetch(() => rpcUrl, globalThis.fetch.bind(globalThis))
  bankdQueryProxyInstalled = true
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
  return bytesToBase64(frame)
}

function parseGrpcWebResponse(base64Response: string): Uint8Array | null {
  const responseBytes = base64ToBytes(base64Response)
  if (responseBytes.length < 5) return null
  if (responseBytes[0] === 0x80) return null
  const msgLen = (responseBytes[1] << 24) | (responseBytes[2] << 16) | (responseBytes[3] << 8) | responseBytes[4]
  if (msgLen === 0 || responseBytes.length < 5 + msgLen) return null
  return responseBytes.slice(5, 5 + msgLen)
}

function parseAllGrpcWebFrames(base64Response: string): Uint8Array[] {
  const responseBytes = base64ToBytes(base64Response)
  const frames: Uint8Array[] = []
  let offset = 0
  while (offset + 5 <= responseBytes.length) {
    const flags = responseBytes[offset]
    const msgLen = (responseBytes[offset + 1] << 24) | (responseBytes[offset + 2] << 16) |
                   (responseBytes[offset + 3] << 8) | responseBytes[offset + 4]
    offset += 5
    if (msgLen === 0 || offset + msgLen > responseBytes.length) break
    if (flags === 0) frames.push(responseBytes.slice(offset, offset + msgLen))
    offset += msgLen
  }
  return frames
}

// =============================================================================
// Derive Keys
// =============================================================================

async function handleDeriveKeys(cmd: any) {
  try {
    const sk = await generateSpendKey(cmd.seedPhrase)
    const fvk = await getFullViewingKey(sk)
    const address = await getAddressByIndex(fvk, 0)
    const bech32 = bech32mAddress(address)

    let transparentAddr = ''
    try {
      const result = await getTransparentAddress(fvk)
      transparentAddr = result.encoding
    } catch { /* transparent address may not be available */ }

    sendToRN({
      type: 'deriveKeysResult',
      requestId: cmd.requestId,
      success: true,
      fvk: bytesToBase64(fvk.inner),
      spendKey: bytesToBase64(sk.inner),
      address: bech32,
      transparentAddress: transparentAddr,
    })
  } catch (e: any) {
    sendToRN({ type: 'deriveKeysResult', requestId: cmd.requestId, success: false, error: e.message })
  }
}

// =============================================================================
// Init
// =============================================================================

async function handleInit(cmd: any) {
  try {
    grpcUrl = cmd.grpcUrl
    rpcUrl = cmd.rpcUrl || cmd.grpcUrl
    chainId = cmd.chainId
    proverUrl = cmd.proverUrl || proverUrl
    installBankdQueryProxy()
    fvkBytes = base64ToBytes(cmd.fvk)
    spendKeyBytes = cmd.spendKey ? base64ToBytes(cmd.spendKey) : null
    const evmChainId = Number(BigInt(await rpc<string>(rpcUrl, 'eth_chainId')))
    if (chainId !== `bankd-${evmChainId}`) throw new Error('Wallet chain ID does not match the Commonware node')
    const genesis = await rpc<{ hash: string } | null>(rpcUrl, 'eth_getBlockByNumber', ['0x0', false])
    if (!genesis?.hash) throw new Error('Cannot identify the Commonware network')
    const walletId = await getWalletId(new FullViewingKey({ inner: fvkBytes }))
    DB_NAME = `bankd-commonware:${chainId}:${bytesToHex(walletId.inner)}:${new URL(rpcUrl).host}:${genesis.hash}`
    db?.close()
    db = null
    viewServer = null
    syncTargetHeight = 0
    await getDB()
    isInitialized = true

    // If FVK was provided, derive and send back the spend key info
    // Also derive the Penumbra address for account 0
    if (fvkBytes && fvkBytes.length > 0) {
      const fvk = new FullViewingKey({ inner: fvkBytes })
      try {
        const address = await getAddressByIndex(fvk, 0)
        const bech32 = bech32mAddress(address)
        sendToRN({ type: 'addressResult', requestId: undefined, address: bech32, accountIndex: 0 })
      } catch (e: any) {
        console.warn('[Bridge] Failed to derive address:', e.message)
      }
    }

    sendToRN({ type: 'initResult', requestId: cmd.requestId, success: true })
  } catch (e: any) {
    sendToRN({ type: 'initResult', requestId: cmd.requestId, success: false, error: e.message })
  }
}

// =============================================================================
// SCT Storage
// =============================================================================

async function loadStoredTree() {
  const T = IDB_TABLES
  const lastPosition = await idbGet(T.tree_last_position, 'last_position')
  const lastForgotten = await idbGet(T.tree_last_forgotten, 'last_forgotten')
  const hashes = await idbGetAll(T.tree_hashes)
  const commitments = await idbGetAll(T.tree_commitments)
  return {
    last_position: lastPosition || { Position: { epoch: 0, block: 0, commitment: 0 } },
    last_forgotten: lastForgotten || 0n,
    hashes: (hashes || []).sort((a: any, b: any) => a.height - b.height),
    commitments: commitments || [],
  }
}

// Block timestamp cache (height → ISO string)
const blockTimestampCache = new Map<number, string>()

async function getBlockTimestamp(height: number): Promise<string> {
  const cached = blockTimestampCache.get(height)
  if (cached) return cached
  const block = await rpc<{ timestamp: string } | null>(rpcUrl, 'eth_getBlockByNumber', ['0x' + height.toString(16), false])
  if (!block) return new Date().toISOString()
  const time = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString()
  blockTimestampCache.set(height, time)
  return time
}

/** Save scan result to IDB. Returns activity entries for new/spent notes. */
async function saveScanResult(result: any, scannedBlocks?: any[]): Promise<any[]> {
  const activity: any[] = []
  const database = await getDB()
  const T = IDB_TABLES
  const storeNames = [
    T.spendable_notes, T.swaps, T.tree_last_position, T.tree_last_forgotten,
    T.tree_hashes, T.tree_commitments, T.full_sync_height,
  ]
  const tx = database.transaction(storeNames, 'readwrite')

  // Collect raw note data during IDB transaction (no async calls here!)
  const receivedNotes: { assetId: string; amount: string; height: number }[] = []
  const spentNotes: { assetId: string; amount: string; height: number }[] = []

  for (const note of result.newNotes) {
    const noteJson = note.toJson()
    const key = noteJson.noteCommitment?.inner
    if (key) tx.objectStore(T.spendable_notes).put(noteJson, key)

    const assetId = noteJson.note?.value?.assetId?.inner
    const amt = noteJson.note?.value?.amount
    if (assetId && amt) {
      const amountBigInt = BigInt(amt.hi || '0') * 18446744073709551616n + BigInt(amt.lo || '0')
      if (amountBigInt > 0n) {
        receivedNotes.push({ assetId, amount: amountBigInt.toString(), height: Number(noteJson.heightCreated || 0) })
      }
    }
  }

  // Mark spent notes: match nullifiers from scanned blocks against stored notes
  if (scannedBlocks && scannedBlocks.length > 0) {
    const nullifierSet = new Map<string, number>()
    for (const block of scannedBlocks) {
      const blockHeight = Number(block.height)
      for (const nf of block.nullifiers ?? []) {
        const nfBase64 = nf.inner ? bytesToBase64(nf.inner) : null
        if (nfBase64) nullifierSet.set(nfBase64, blockHeight)
      }
    }

    if (nullifierSet.size > 0) {
      const notesStore = tx.objectStore(T.spendable_notes)
      const cursorReq = notesStore.openCursor()
      // Collect spent note data during cursor (sync), resolve metadata after
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) { resolve(); return }
          const noteJson = cursor.value
          if (!noteJson.heightSpent && noteJson.nullifier?.inner) {
            const spentHeight = nullifierSet.get(noteJson.nullifier.inner)
            if (spentHeight !== undefined) {
              noteJson.heightSpent = spentHeight.toString()
              cursor.update(noteJson)

              const assetId = noteJson.note?.value?.assetId?.inner
              const amt = noteJson.note?.value?.amount
              if (assetId && amt) {
                const amountBigInt = BigInt(amt.hi || '0') * 18446744073709551616n + BigInt(amt.lo || '0')
                spentNotes.push({ assetId, amount: amountBigInt.toString(), height: spentHeight })
              }
            }
          }
          cursor.continue()
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      })
    }
  }

  for (const swap of result.newSwaps) {
    const swapJson = swap.toJson()
    const key = swapJson.swapCommitment?.inner
    if (key) tx.objectStore(T.swaps).put(swapJson, key)
  }

  const sctUpdates = result.sctUpdates
  if (sctUpdates.set_position) {
    tx.objectStore(T.tree_last_position).put(sctUpdates.set_position, 'last_position')
  }
  if (sctUpdates.set_forgotten !== undefined) {
    tx.objectStore(T.tree_last_forgotten).put(sctUpdates.set_forgotten, 'last_forgotten')
  }
  for (const hash of sctUpdates.store_hashes) {
    const pos = hash.position.epoch * 65536 * 65536 + hash.position.block * 65536 + hash.position.commitment
    tx.objectStore(T.tree_hashes).put(hash, pos + ':' + hash.height)
  }
  for (const commitment of sctUpdates.store_commitments) {
    tx.objectStore(T.tree_commitments).put(commitment, commitment.commitment.inner)
  }
  tx.objectStore(T.full_sync_height).put(result.height, 'height')

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  // Build activity entries — symbol/decimals resolved on RN side via customTokens
  for (const rn of receivedNotes) {
    const timestamp = await getBlockTimestamp(rn.height)
    activity.push({ action: 'received', assetId: rn.assetId, amount: rn.amount, height: rn.height, timestamp })
  }
  for (const sn of spentNotes) {
    const timestamp = await getBlockTimestamp(sn.height)
    activity.push({ action: 'spent', assetId: sn.assetId, amount: sn.amount, height: sn.height, timestamp })
  }

  return activity
}

async function getLastSyncedHeight(): Promise<bigint> {
  const height = await idbGet(IDB_TABLES.full_sync_height, 'height')
  if (!height) return 0n
  const n = BigInt(height)
  // Sanity check: if value is unreasonably large, treat as 0 (corrupt data)
  if (n > 100_000_000n) return 0n
  return n
}

// =============================================================================
// Chain parameter fetching
// =============================================================================

async function fetchAndSaveAppParameters() {
  try {
    const request = new AppParametersRequest({})
    const base64Request = createGrpcWebRequest(request.toBinary())
    const response = await fetch(grpcUrl + BANKD_QUERY_PATH + 'AppParameters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/grpc-web-text', 'Accept': 'application/grpc-web-text' },
      body: base64Request,
    })
    if (!response.ok) return
    const messageBytes = parseGrpcWebResponse(await response.text())
    if (!messageBytes) return
    const appParamsResponse = AppParametersResponse.fromBinary(messageBytes)
    if (!appParamsResponse.appParameters) return

    const T = IDB_TABLES
    await idbPut(T.app_parameters, appParamsResponse.appParameters.toJson(), 'params')

    const feeParams = appParamsResponse.appParameters.feeParams
    if (feeParams?.fixedGasPrices) {
      const gasPrices = feeParams.fixedGasPrices

      // If assetId is missing, derive Bankd's native Shieldd asset ID.
      if (!gasPrices.assetId?.inner) {
        const stakingAssetId = await assetIdFromBaseDenom('abrl')
        gasPrices.assetId = new AssetId({ inner: stakingAssetId.inner })
      }

      const assetIdKey = bytesToBase64(gasPrices.assetId!.inner)
      await idbPut(T.gas_prices, gasPrices.toJson(), assetIdKey)
      console.log('[Bridge] Saved gas prices, assetId key:', assetIdKey.slice(0, 20) + '...')
    }
  } catch (e: any) {
    console.warn('[Bridge] Failed to fetch app parameters:', e)
  }
}

// =============================================================================
// Compact block fetching
// =============================================================================

const RANGE_BATCH_SIZE = 256
const FLUSH_INTERVAL = 128

async function fetchCompactBlockRange(startHeight: number, endHeight: number) {
  const request = new CompactBlockRangeRequest({
    startHeight: BigInt(startHeight),
    endHeight: BigInt(endHeight + 1),
    keepAlive: false,
  })
  const base64Request = createGrpcWebRequest(request.toBinary())
  const response = await fetch(grpcUrl + BANKD_QUERY_PATH + 'CompactBlockRange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/grpc-web-text', 'Accept': 'application/grpc-web-text' },
    body: base64Request,
  })
  if (!response.ok) throw new Error('CompactBlockRange failed: ' + response.status)

  const base64Body = await response.text()
  const messageFrames = parseAllGrpcWebFrames(base64Body)
  return messageFrames.map(frame => CompactBlockRangeResponse.fromBinary(frame).compactBlock!).filter(Boolean)
}

async function getChainHeight(): Promise<number> {
  return getFinalizedHeight(rpcUrl)
}

// =============================================================================
// Sync
// =============================================================================

async function handleStartSync(cmd: any) {
  if (!isInitialized) { sendError('Not initialized', cmd.requestId); return }
  if (isSyncing) { sendToRN({ type: 'syncStarted', requestId: cmd.requestId }); return }

  isSyncing = true
  isStopping = false
  sendToRN({ type: 'syncStarted', requestId: cmd.requestId })

  try {
    const fvk = new FullViewingKey({ inner: fvkBytes! })

    if (!viewServer) {
      viewServer = await ViewServer.initialize({
        fullViewingKey: fvk,
        getStoredTree: loadStoredTree,
        idbConstants: { name: DB_NAME, version: DB_VERSION, tables: IDB_TABLES },
      })
    }

    await fetchAndSaveAppParameters()

    const lastHeight = await getLastSyncedHeight()
    let currentHeight = lastHeight === 0n ? -1 : Number(lastHeight)
    let chainHeight = await getChainHeight()
    syncTargetHeight = chainHeight

    console.log('[Bridge] Starting sync from height', currentHeight, 'to chain height', chainHeight, 'grpcUrl:', grpcUrl)

    // Main sync loop
    while (!isStopping && currentHeight < chainHeight) {
      const nextHeight = currentHeight + 1
      const batchEnd = Math.min(nextHeight + RANGE_BATCH_SIZE - 1, chainHeight)

      let blocks: any[]
      try {
        blocks = await fetchCompactBlockRange(nextHeight, batchEnd)
      } catch (e: any) {
        console.warn('[Bridge] Fetch failed for range', nextHeight, '-', batchEnd, ':', e.message)
        await new Promise(r => setTimeout(r, 1000))
        continue
      }

      if (blocks.length === 0) {
        await new Promise(r => setTimeout(r, 1000))
        continue
      }

      let lastFlushHeight = currentHeight
      let pendingBlocks: any[] = []
      for (const block of blocks) {
        if (isStopping) break
        const blockHeight = Number(block.height)

        let scannerWantsFlush: boolean
        if (blockHeight === 0 || blockHeight === 1) {
          await viewServer.scanGenesisChunk(0n, block, false)
          scannerWantsFlush = await viewServer.genesisAdvice(block)
        } else {
          scannerWantsFlush = await viewServer.scanBlock(block, false)
        }
        pendingBlocks.push(block)

        if (scannerWantsFlush || blockHeight - lastFlushHeight >= FLUSH_INTERVAL || blockHeight >= chainHeight) {
          const result = viewServer.flushUpdates()
          const act = await saveScanResult(result, pendingBlocks)
          pendingBlocks = []
          lastFlushHeight = blockHeight
          if (act.length > 0) {
            sendToRN({ type: 'notesFound', count: result.newNotes.length, height: blockHeight, activity: act })
          }
        }
        currentHeight = blockHeight
      }

      if (currentHeight > lastFlushHeight) {
        const result = viewServer.flushUpdates()
        const act = await saveScanResult(result, pendingBlocks)
        pendingBlocks = []
        if (act.length > 0) {
          sendToRN({ type: 'notesFound', count: result.newNotes.length, height: currentHeight, activity: act })
        }
      }

      sendToRN({ type: 'syncProgress', currentHeight, targetHeight: chainHeight, isSynced: currentHeight >= chainHeight })
    }

    // Watch for new blocks
    if (!isStopping) {
      sendToRN({ type: 'syncProgress', currentHeight, targetHeight: chainHeight, isSynced: true })
      while (!isStopping) {
        await new Promise(r => setTimeout(r, 2000))
        const newHeight = await getChainHeight()
        if (newHeight > currentHeight) {
          chainHeight = newHeight
          syncTargetHeight = chainHeight
          try {
            const blocks = await fetchCompactBlockRange(currentHeight + 1, Math.min(currentHeight + RANGE_BATCH_SIZE, chainHeight))
            for (const block of blocks) {
              if (isStopping) break
              await viewServer.scanBlock(block, false)
              currentHeight = Number(block.height)
            }
            const result = viewServer.flushUpdates()
            const act = await saveScanResult(result, blocks)
            if (act.length > 0) {
              sendToRN({ type: 'notesFound', count: result.newNotes.length, height: currentHeight, activity: act })
            }
            sendToRN({ type: 'syncProgress', currentHeight, targetHeight: chainHeight, isSynced: currentHeight >= chainHeight })
          } catch { /* retry next loop */ }
        }
      }
    }
  } catch (e: any) {
    sendError('Sync error: ' + e.message, cmd.requestId, e.stack)
  } finally {
    isSyncing = false
  }
}

function handleStopSync(cmd: any) {
  isStopping = true
  sendToRN({ type: 'syncStopped', requestId: cmd.requestId })
}

// =============================================================================
// Balances
// =============================================================================

async function handleGetBalances(cmd: any) {
  try {
    const allNotes = await idbGetAll(IDB_TABLES.spendable_notes)
    const accountFilter = cmd.accountIndex

    const balanceMap: Record<string, { amount: string; accountIndex: number }> = {}
    for (const noteJson of allNotes) {
      if (noteJson.heightSpent) continue
      const assetId = noteJson.note?.value?.assetId?.inner
      const addressIndex = noteJson.addressIndex?.account ?? 0
      if (!assetId) continue
      if (accountFilter !== undefined && addressIndex !== accountFilter) continue

      const amount = noteJson.note.value.amount
      const amountBigInt = BigInt(amount?.hi || '0') * BigInt('18446744073709551616') + BigInt(amount?.lo || '0')
      const key = assetId + ':' + addressIndex

      if (balanceMap[key]) {
        balanceMap[key].amount = (BigInt(balanceMap[key].amount) + amountBigInt).toString()
      } else {
        balanceMap[key] = { amount: amountBigInt.toString(), accountIndex: addressIndex }
      }
    }

    // Try to fetch metadata for each asset
    const balances: any[] = []
    for (const [key, entry] of Object.entries(balanceMap)) {
      const assetIdBase64 = key.split(':')[0]
      let metadata: any = undefined

      // Try chain metadata lookup (baseDenom + decimals for RN-side symbol resolution)
      try {
          const assetIdBytes = base64ToBytes(assetIdBase64)
          const req = new AssetMetadataByIdRequest({ assetId: new AssetId({ inner: assetIdBytes }) })
          const base64Req = createGrpcWebRequest(req.toBinary())
          const resp = await fetch(grpcUrl + BANKD_QUERY_PATH + 'AssetMetadataById', {
            method: 'POST',
            headers: { 'Content-Type': 'application/grpc-web-text', 'Accept': 'application/grpc-web-text' },
            body: base64Req,
          })
          if (resp.ok) {
            const msgBytes = parseGrpcWebResponse(await resp.text())
            if (msgBytes) {
              const metadataResp = AssetMetadataByIdResponse.fromBinary(msgBytes)
              const m = metadataResp.denomMetadata
              if (m) {
                const displayUnit = m.denomUnits?.find((u: any) => u.exponent && u.exponent > 0)
                metadata = {
                  symbol: m.symbol || m.display || m.base || 'Unknown',
                  name: m.name || m.symbol || 'Unknown',
                  decimals: displayUnit?.exponent ?? 18,
                  baseDenom: m.base || '',
                }
              }
            }
          }
      } catch { /* ignore */ }

      balances.push({
        assetIdBase64,
        assetIdHex: '(base64:' + assetIdBase64 + ')',
        amount: entry.amount,
        accountIndex: entry.accountIndex,
        metadata,
      })
    }

    sendToRN({ type: 'balancesResult', requestId: cmd.requestId, balances })
  } catch (e: any) {
    sendError('Failed to get balances: ' + e.message, cmd.requestId, e.stack)
  }
}

// =============================================================================
// Address Handlers
// =============================================================================

async function handleGetAddress(cmd: any) {
  if (!fvkBytes) { sendError('Not initialized', cmd.requestId); return }
  try {
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const address = await getAddressByIndex(fvk, cmd.accountIndex)
    sendToRN({ type: 'addressResult', requestId: cmd.requestId, address: bech32mAddress(address), accountIndex: cmd.accountIndex })
  } catch (e: any) {
    sendError('Failed to get address: ' + e.message, cmd.requestId, e.stack)
  }
}

async function handleGetEphemeralAddress(cmd: any) {
  if (!fvkBytes) { sendError('Not initialized', cmd.requestId); return }
  try {
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const address = await getEphemeralByIndex(fvk, cmd.accountIndex)
    sendToRN({
      type: 'ephemeralAddressResult',
      requestId: cmd.requestId,
      address: bech32mAddress(address),
      accountIndex: cmd.accountIndex,
    })
  } catch (e: any) {
    sendError('Failed to get ephemeral address: ' + e.message, cmd.requestId, e.stack)
  }
}

async function handleGetTransparentAddr(cmd: any) {
  if (!fvkBytes) { sendError('Not initialized', cmd.requestId); return }
  try {
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const result = await getTransparentAddress(fvk)
    sendToRN({ type: 'transparentAddressResult', requestId: cmd.requestId, address: result.encoding })
  } catch (e: any) {
    sendError('Failed to get transparent address: ' + e.message, cmd.requestId, e.stack)
  }
}

// =============================================================================
// Transaction Handlers
// =============================================================================

async function handlePlanTx(cmd: any) {
  if (!fvkBytes) { sendError('Not initialized', cmd.requestId); return }
  try {
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const request = TransactionPlannerRequest.fromJson(JSON.parse(cmd.request))

    let gasPriceEntries = await idbGetAll(IDB_TABLES.gas_prices)
    if (gasPriceEntries.length === 0) {
      await fetchAndSaveAppParameters()
      gasPriceEntries = await idbGetAll(IDB_TABLES.gas_prices)
    }
    let gasFeeToken: AssetId
    if (gasPriceEntries.length > 0 && gasPriceEntries[0].assetId) {
      gasFeeToken = AssetId.fromJson(gasPriceEntries[0].assetId)
    } else {
      gasFeeToken = await assetIdFromBaseDenom('abrl')
    }

    const idbConstants = { name: DB_NAME, version: DB_VERSION, tables: IDB_TABLES }
    const plan = await wasmPlanTransaction(idbConstants, request, fvk, gasFeeToken, grpcUrl)
    sendToRN({ type: 'planResult', requestId: cmd.requestId, success: true, plan: JSON.stringify(plan.toJson()) })
  } catch (e: any) {
    sendToRN({ type: 'planResult', requestId: cmd.requestId, success: false, error: e.message })
  }
}

async function handleBuildTx(cmd: any) {
  if (!fvkBytes || !spendKeyBytes) { sendError('Not initialized', cmd.requestId); return }
  try {
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const sk = new SpendKey({ inner: spendKeyBytes })
    const plan = TransactionPlan.fromJson(JSON.parse(cmd.plan))

    const authData = await authorizePlan(sk, plan)
    const sct = await loadStoredTree()
    const witnessData = await getWitness(plan, sct as any)
    await assertCommittedAnchor(rpcUrl, witnessData.anchor?.inner)

    const actions = []
    for (let i = 0; i < plan.actions.length; i++) {
      actions.push(await buildActionParallel(plan, witnessData, fvk, i, { proverUrl }))
    }

    const transaction = await buildParallel(actions, plan, witnessData, authData)
    const txBytes = transaction.toBinary()
    const txId = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(txBytes))))

    sendToRN({ type: 'buildResult', requestId: cmd.requestId, success: true, transaction: bytesToBase64(txBytes), transactionId: txId })
  } catch (e: any) {
    sendToRN({ type: 'buildResult', requestId: cmd.requestId, success: false, error: e.message })
  }
}

async function handleBroadcastTx(cmd: any) {
  try {
    const shielddTxBytes = base64ToBytes(cmd.transaction)
    const hash = await broadcastShielddTransaction(shielddTxBytes)
    const height = await waitForConfirmation(rpcUrl, hash)
    if (isSyncing) await waitForWalletHeight(height)
    sendToRN({ type: 'broadcastResult', requestId: cmd.requestId, success: true, hash })
  } catch (e: any) {
    sendToRN({ type: 'broadcastResult', requestId: cmd.requestId, success: false, error: e.message })
  }
}

async function broadcastShielddTransaction(shielddTxBytes: Uint8Array): Promise<`0x${string}`> {
  return broadcast(rpcUrl, shielddTxBytes)
}

async function waitForWalletHeight(height: number): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (await getLastSyncedHeight() >= BigInt(height)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Transaction confirmed, but wallet sync is still pending; wait before sending again')
}

// =============================================================================
// Host withdrawal — Plan + Build + Bankd Broadcast in one step
// =============================================================================

async function handleWithdraw(cmd: any) {
  let txHash: `0x${string}` | undefined
  if (!fvkBytes || !spendKeyBytes) { sendError('Not initialized with spend key', cmd.requestId); return }

  try {
    if (!isSyncing) throw new Error('Start wallet sync before sending')
    await waitForWalletHeight(await getFinalizedHeight(rpcUrl))
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const sk = new SpendKey({ inner: spendKeyBytes })

    // Callers pass amount in base units (e.g. "1500000" for 1.5 tokens).
    if (cmd.denom !== 'abrl') throw new Error('Only native BRL can be withdrawn on this Commonware base')
    const amountBigint = BigInt(cmd.amount)
    if (amountBigint <= 0n) throw new Error('Invalid amount')
    const lo = amountBigint & ((1n << 64n) - 1n)
    const hi = amountBigint >> 64n
    const value = new Value({
      amount: new Amount({ lo, hi }),
      assetId: await assetIdFromBaseDenom(cmd.denom),
    })

    let destination: HostWithdrawal['destination']
    if (cmd.execution) {
      const refundAddress = cmd.execution.refundAddress || bech32mAddress(await getAddressByIndex(fvk, 0))
      const calls = (cmd.execution.calls ?? []).map((call: any) => new EvmCall({
        contract: hexToBytes(call.contract, 20),
        calldata: hexToBytes(call.calldata),
      }))
      if (calls.length === 0) throw new Error('Host execution requires at least one EVM call')
      destination = {
        case: 'execution',
        value: new HostExecution({
          refundAddress,
          gasLimit: BigInt(cmd.execution.gasLimit),
          calls,
        }),
      }
    } else {
      if (!cmd.destinationAddress) throw new Error('Host transfer requires a destination address')
      destination = {
        case: 'transfer',
        value: new HostTransfer({ recipient: /^0x[0-9a-fA-F]{40}$/.test(cmd.destinationAddress) ? cmd.destinationAddress : (() => { throw new Error('Host withdrawal requires an EVM recipient') })() }),
      }
    }

    const withdrawal = new HostWithdrawal({ value, destination })
    const plannerRequest = new TransactionPlannerRequest({
      source: new AddressIndex({ account: cmd.sourceAccountIndex ?? 0 }),
      hostWithdrawals: [withdrawal],
    })

    // 1. Plan — ensure gas prices are available
    emitProgress(cmd.requestId, 'planning', 'Planning transaction…')
    let gasPriceEntries = await idbGetAll(IDB_TABLES.gas_prices)
    if (gasPriceEntries.length === 0) {
      console.log('[Withdraw] Gas prices missing, re-fetching app parameters...')
      await fetchAndSaveAppParameters()
      gasPriceEntries = await idbGetAll(IDB_TABLES.gas_prices)
    }
    let gasFeeToken: AssetId
    if (gasPriceEntries.length > 0 && gasPriceEntries[0].assetId) {
      gasFeeToken = AssetId.fromJson(gasPriceEntries[0].assetId)
    } else {
      gasFeeToken = await assetIdFromBaseDenom('abrl')
    }
    const idbConstants = { name: DB_NAME, version: DB_VERSION, tables: IDB_TABLES }
    const plan = await wasmPlanTransaction(idbConstants, plannerRequest, fvk, gasFeeToken, grpcUrl)

    // 2. Authorize
    emitProgress(cmd.requestId, 'authorizing', 'Authorizing…')
    const authData = await authorizePlan(sk, plan)

    // 3. Witness + Build
    emitProgress(cmd.requestId, 'building', 'Building ZK proofs…')
    const sct = await loadStoredTree()
    const witnessData = await getWitness(plan, sct as any)
    await assertCommittedAnchor(rpcUrl, witnessData.anchor?.inner)

    const actions = []
    for (let i = 0; i < plan.actions.length; i++) {
      actions.push(await buildActionParallel(plan, witnessData, fvk, i, { proverUrl }))
    }
    const transaction = await buildParallel(actions, plan, witnessData, authData)
    const txBytes = transaction.toBinary()

    // Submit the native EIP-2718 Shieldd envelope through the EVM RPC.
    emitProgress(cmd.requestId, 'broadcasting', 'Broadcasting…')
    txHash = await broadcastShielddTransaction(txBytes)

    emitProgress(cmd.requestId, 'confirming', 'Waiting for finality…')
    const height = await waitForConfirmation(rpcUrl, txHash)
    emitProgress(cmd.requestId, 'syncing', 'Syncing wallet…')
    await waitForWalletHeight(height)

    sendToRN({ type: 'withdrawResult', requestId: cmd.requestId, success: true, txHash })
  } catch (e: any) {
    console.error('[HostWithdrawal] Failed:', e)
    sendToRN({ type: 'withdrawResult', requestId: cmd.requestId, success: false, error: e.message, txHash })
  }
}

// =============================================================================
// Send (Penumbra-to-Penumbra private transfer)
// =============================================================================

function emitProgress(requestId: string, step: string, message: string) {
  sendToRN({ type: 'txProgress', requestId, step, message })
}

async function handleSend(cmd: any) {
  let txHash: `0x${string}` | undefined
  if (!fvkBytes || !spendKeyBytes) { sendError('Not initialized with spend key', cmd.requestId); return }

  try {
    if (!isSyncing) throw new Error('Start wallet sync before sending')
    await waitForWalletHeight(await getFinalizedHeight(rpcUrl))
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const sk = new SpendKey({ inner: spendKeyBytes })

    // Parse amount — cmd.amount is in base units (string bigint)
    const amountBigint = BigInt(cmd.amount)
    if (amountBigint <= 0n) throw new Error('Invalid amount')
    const lo = amountBigint & ((1n << 64n) - 1n)
    const hi = amountBigint >> 64n

    // Decode recipient address from bech32m
    const recipientInner = addressFromBech32m(cmd.recipientAddress)
    const recipientAddr = new Address({ inner: new Uint8Array(recipientInner.inner) })

    // Decode asset ID — may be hex, base64, or wrapped as "(base64:...)"
    let assetIdRaw = cmd.assetId as string
    let assetIdBytes: Uint8Array
    if (assetIdRaw.startsWith('(base64:')) {
      // Strip wrapper: "(base64:XXXX)" → "XXXX"
      assetIdRaw = assetIdRaw.slice(8, -1)
      assetIdBytes = base64ToBytes(assetIdRaw)
    } else if (/^[0-9a-fA-F]+$/.test(assetIdRaw)) {
      assetIdBytes = new Uint8Array(assetIdRaw.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)))
    } else {
      // Assume base64
      assetIdBytes = base64ToBytes(assetIdRaw)
    }
    const assetId = new AssetId({ inner: assetIdBytes })

    // Build planner request with output
    const plannerRequest = new TransactionPlannerRequest({
      source: new AddressIndex({ account: cmd.sourceAccountIndex ?? 0 }),
      outputs: [{
        value: new Value({
          amount: new Amount({ lo, hi }),
          assetId,
        }),
        address: recipientAddr,
      }],
    })

    // Serialize the planner request to JSON and back to ensure clean protobuf structure
    const requestJson = plannerRequest.toJson()
    const cleanRequest = TransactionPlannerRequest.fromJson(requestJson)

    // 1. Plan
    let gasPriceEntries = await idbGetAll(IDB_TABLES.gas_prices)
    if (gasPriceEntries.length === 0) {
      await fetchAndSaveAppParameters()
      gasPriceEntries = await idbGetAll(IDB_TABLES.gas_prices)
    }
    let gasFeeToken: AssetId
    if (gasPriceEntries.length > 0 && gasPriceEntries[0].assetId) {
      gasFeeToken = AssetId.fromJson(gasPriceEntries[0].assetId)
    } else {
      gasFeeToken = await assetIdFromBaseDenom('abrl')
    }
    const idbConstants = { name: DB_NAME, version: DB_VERSION, tables: IDB_TABLES }
    emitProgress(cmd.requestId, 'planning', 'Planning transaction…')
    const plan = await wasmPlanTransaction(idbConstants, cleanRequest, fvk, gasFeeToken, grpcUrl)

    // 2. Authorize
    emitProgress(cmd.requestId, 'authorizing', 'Authorizing…')
    const authData = await authorizePlan(sk, plan)

    // 3. Witness + Build
    emitProgress(cmd.requestId, 'building', 'Building ZK proofs…')
    const sct = await loadStoredTree()
    const witnessData = await getWitness(plan, sct as any)
    await assertCommittedAnchor(rpcUrl, witnessData.anchor?.inner)

    const actions = []
    for (let i = 0; i < plan.actions.length; i++) {
      actions.push(await buildActionParallel(plan, witnessData, fvk, i, { proverUrl }))
    }
    const transaction = await buildParallel(actions, plan, witnessData, authData)
    const txBytes = transaction.toBinary()

    // 5. Wrap as a Bankd Shieldd tx and broadcast.
    emitProgress(cmd.requestId, 'broadcasting', 'Broadcasting…')
    txHash = await broadcastShielddTransaction(txBytes)

    emitProgress(cmd.requestId, 'confirming', 'Waiting for finality…')
    const height = await waitForConfirmation(rpcUrl, txHash)
    emitProgress(cmd.requestId, 'syncing', 'Syncing wallet…')
    await waitForWalletHeight(height)

    sendToRN({ type: 'sendResult', requestId: cmd.requestId, success: true, txHash })
  } catch (e: any) {
    console.error('[Send] Failed:', e)
    sendToRN({ type: 'sendResult', requestId: cmd.requestId, success: false, error: e.message, txHash })
  }
}

// =============================================================================
// Status & Clear
// =============================================================================

function handleGetSyncStatus(cmd: any) {
  getLastSyncedHeight().then(async (lastHeight) => {
    const chainH = syncTargetHeight
    sendToRN({
      type: 'syncStatusResult', requestId: cmd.requestId,
      isRunning: isSyncing, currentHeight: Number(lastHeight), targetHeight: chainH, isSynced: isInitialized && chainH > 0 && Number(lastHeight) >= chainH,
    })
  }).catch((e: any) => sendError('Failed to get sync status: ' + e.message, cmd.requestId, e.stack))
}

async function handleClearData(cmd: any) {
  try {
    // Stop any running sync loop
    if (isSyncing) {
      isStopping = true
      // Wait for sync loop to exit (checks isStopping each iteration)
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 250))
        if (!isSyncing) break
      }
    }
    isSyncing = false
    isStopping = false

    // Clear all IDB stores (skip any that don't exist)
    const database = await getDB()
    const stores = Object.values(IDB_TABLES)
    for (const store of stores) {
      if (database.objectStoreNames.contains(store)) {
        await idbClear(store)
      }
    }

    // Reset internal state — close DB so re-init gets a fresh handle
    viewServer = null
    isInitialized = false
    fvkBytes = null
    spendKeyBytes = null
    if (db) { db.close(); db = null }

    sendToRN({ type: 'clearDataResult', requestId: cmd.requestId, success: true })
  } catch (e: any) {
    sendToRN({ type: 'clearDataResult', requestId: cmd.requestId, success: false, error: e.message })
  }
}

/**
 * Compute Penumbra asset IDs for a list of base denoms.
 * Uses the WASM assetIdFromBaseDenom function (proper domain separation).
 */
async function handleComputeAssetIds(cmd: any) {
  try {
    const denoms: string[] = cmd.denoms || []
    const result: Record<string, string> = {}
    for (const denom of denoms) {
      const assetId = await assetIdFromBaseDenom(denom)
      result[denom] = bytesToBase64(assetId.inner)
    }
    sendToRN({ type: 'computeAssetIdsResult', requestId: cmd.requestId, assetIds: result })
  } catch (e: any) {
    sendError('Failed to compute asset IDs: ' + e.message, cmd.requestId, e.stack)
  }
}

// =============================================================================
// Address Ownership Detection
// =============================================================================

async function handleGetAddressOwnership(cmd: any) {
  if (!fvkBytes) { sendError('Not initialized', cmd.requestId); return }
  try {
    const fvk = new FullViewingKey({ inner: fvkBytes })
    const addrInner = addressFromBech32m(cmd.address)
    const address = new Address({ inner: new Uint8Array(addrInner.inner) })

    const index = getAddressIndexByAddress(fvk, address)
    if (!index) {
      sendToRN({
        type: 'addressOwnershipResult',
        requestId: cmd.requestId,
        belongsToWallet: false,
      })
      return
    }

    const randomizer = index.randomizer
    const isEphemeral =
      randomizer != null &&
      randomizer.length > 0 &&
      randomizer.some((b: number) => b !== 0)

    sendToRN({
      type: 'addressOwnershipResult',
      requestId: cmd.requestId,
      belongsToWallet: true,
      accountIndex: index.account,
      isEphemeral,
      randomizerBase64: isEphemeral && randomizer ? bytesToBase64(randomizer) : undefined,
    })
  } catch (e: any) {
    sendError('Failed to check address ownership: ' + e.message, cmd.requestId, e.stack)
  }
}

// =============================================================================
// Ready
// =============================================================================

sendToRN({ type: 'ready' })
console.log('[Bridge] Penumbra WebView bridge loaded (bundled)')
