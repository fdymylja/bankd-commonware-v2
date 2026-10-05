/**
 * usePenumbraWebView — Main hook for managing the Penumbra WebView bridge.
 *
 * Handles:
 * - WebView lifecycle (ready detection, initialization)
 * - Request-response correlation via requestId
 * - Sync state tracking
 * - Balance caching
 * - Command helpers for all bridge operations
 *
 * Usage:
 *   const { webViewRef, isReady, syncProgress, balances, ... } = usePenumbraWebView()
 *   <PenumbraWebView ref={webViewRef} onEvent={onEvent} />
 */

import { useCallback, useRef, useState } from 'react'

import type {
  BridgeCommand,
  BridgeEvent,
  PenumbraBridgeBalance,
} from './bridge-protocol'
import { generateRequestId } from './bridge-protocol'
import type { OwnPenumbraAddressInfo } from '@bankd/shared/penumbra'
import type { PenumbraWebViewHandle } from './PenumbraWebView'

// =============================================================================
// Types
// =============================================================================

export interface SyncProgress {
  currentHeight: number
  targetHeight: number
  isSynced: boolean
  /** Percentage 0-100 */
  percent: number
}

export interface PenumbraWebViewState {
  /** Ref to attach to the PenumbraWebView component. */
  webViewRef: React.RefObject<PenumbraWebViewHandle | null>

  /** Event handler to pass to PenumbraWebView's onEvent prop. */
  onEvent: (event: BridgeEvent) => void

  /** Error handler to pass to PenumbraWebView's onError prop. */
  onWebViewError: (error: string) => void

  /** Whether the WebView bridge has loaded and sent 'ready'. */
  isReady: boolean

  /** Whether WASM has been initialized (init command succeeded). */
  isInitialized: boolean

  /** Whether sync is currently running. */
  isSyncing: boolean

  /** Current sync progress (updated via fire-and-forget events). */
  syncProgress: SyncProgress | null

  /** Latest balances from the bridge. */
  balances: PenumbraBridgeBalance[]

  /** Last error message from the bridge. */
  lastError: string | null

  // =========================================================================
  // Commands
  // =========================================================================

  /** Initialize WASM and IndexedDB. Must be called after isReady=true. */
  init(params: {
    fvk: string
    spendKey: string
    grpcUrl: string
    rpcUrl?: string
    proverUrl?: string
    chainId: string
  }): Promise<boolean>

  /** Start syncing compact blocks. */
  startSync(): Promise<void>

  /** Stop syncing. */
  stopSync(): Promise<void>

  /** Query current balances. */
  getBalances(accountIndex?: number): Promise<PenumbraBridgeBalance[]>

  /** Compute Penumbra asset IDs (SHA256 with domain separation) for base denoms. */
  computeAssetIds(denoms: string[]): Promise<Record<string, string>>

  /** Get a Penumbra address for an account. */
  getAddress(accountIndex: number): Promise<string>

  /** Generate a fresh ephemeral shielded address for an account. */
  getEphemeralAddress(accountIndex: number): Promise<string>

  /** Get the transparent (IBC-compatible) address. */
  getTransparentAddress(): Promise<string>

  /** Plan a transaction. */
  planTransaction(request: string): Promise<string>

  /** Build (authorize + witness) a transaction from a plan. */
  buildTransaction(plan: string): Promise<{ transaction: string; transactionId: string }>

  /** Broadcast a built transaction. */
  broadcastTransaction(transaction: string): Promise<{ hash: string; height: number }>

  /** Get current sync status. */
  getSyncStatus(): Promise<{
    isRunning: boolean
    currentHeight: number
    targetHeight: number
    isSynced: boolean
  }>

  /** Execute a Shieldd host transfer or host execution through Bankd. */
  withdraw(params: {
    amount: string
    denom: string
    destinationAddress?: string
    execution?: {
      refundAddress?: string
      gasLimit: string
      calls: {
        contract: `0x${string}`
        calldata: `0x${string}`
      }[]
    }
    sourceAccountIndex?: number
    onProgress?: (step: string, message: string) => void
  }): Promise<{ success: boolean; txHash?: string; error?: string }>

  /** Send tokens privately within Penumbra. Plan + build + broadcast. */
  send(params: {
    amount: string
    assetId: string
    recipientAddress: string
    sourceAccountIndex?: number
    onProgress?: (step: string, message: string) => void
  }): Promise<{ success: boolean; txHash?: string; error?: string }>

  /** Export selected accepted evidence without changing wallet state. */
  exportDisclosure(selection: import('@bankd/shared/shieldd/disclosure').DisclosureSelection, method: 'openings' | 'payload-keys'): Promise<import('./bridge-protocol').DisclosureResultEvent>

  /** Clear all local Penumbra data. */
  clearData(): Promise<void>

  /** Derive Penumbra keys from seed phrase via WASM. */
  deriveKeys(seedPhrase: string): Promise<{
    fvk: string
    spendKey: string
    address: string
    transparentAddress: string
  }>

  /**
   * Check if a Penumbra address belongs to this wallet using the FVK.
   * Uses WASM `getAddressIndexByAddress` (Prax-style indexByAddress).
   */
  getOwnAddressInfo(address: string): Promise<OwnPenumbraAddressInfo>
}

// =============================================================================
// Pending request tracking
// =============================================================================

type PendingRequest = {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/** Default timeout for request-response correlation (30 seconds). */
const REQUEST_TIMEOUT_MS = 30_000

/** Extended timeout for operations that may take longer (build, broadcast). */
const LONG_REQUEST_TIMEOUT_MS = 120_000

// =============================================================================
// Hook
// =============================================================================

// Activity listener type (exported for consumers)
import type { NoteActivity } from './bridge-protocol'
export type ActivityListener = (activity: NoteActivity[]) => void
const activityListeners = new Set<ActivityListener>()

/** Subscribe to note activity events from Penumbra sync. */
export function onNoteActivity(listener: ActivityListener): () => void {
  activityListeners.add(listener)
  return () => { activityListeners.delete(listener) }
}

export function usePenumbraWebView(): PenumbraWebViewState {
  const webViewRef = useRef<PenumbraWebViewHandle | null>(null)
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map())
  const progressCallbacks = useRef<Map<string, (step: string, message: string) => void>>(new Map())

  // State
  const [isReady, setIsReady] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [balances, setBalances] = useState<PenumbraBridgeBalance[]>([])
  const [lastError, setLastError] = useState<string | null>(null)

  // =========================================================================
  // Request-response correlation
  // =========================================================================

  const sendRequest = useCallback(
    <T>(
      command: BridgeCommand,
      timeoutMs: number = REQUEST_TIMEOUT_MS
    ): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const requestId = (command as { requestId?: string }).requestId
        if (!requestId) {
          reject(new Error('Command must have a requestId'))
          return
        }

        // Set up timeout
        const timeout = setTimeout(() => {
          pendingRequests.current.delete(requestId)
          reject(
            new Error(
              `Request ${command.type} timed out after ${timeoutMs}ms`
            )
          )
        }, timeoutMs)

        // Store the pending request
        pendingRequests.current.set(requestId, { resolve, reject, timeout })

        // Send the command
        webViewRef.current?.sendCommand(command)
      })
    },
    []
  )

  const resolvePending = useCallback(
    (requestId: string | undefined, value: any) => {
      if (!requestId) return
      const pending = pendingRequests.current.get(requestId)
      if (pending) {
        clearTimeout(pending.timeout)
        pendingRequests.current.delete(requestId)
        pending.resolve(value)
      }
    },
    []
  )

  const rejectPending = useCallback(
    (requestId: string | undefined, error: string) => {
      if (!requestId) return
      const pending = pendingRequests.current.get(requestId)
      if (pending) {
        clearTimeout(pending.timeout)
        pendingRequests.current.delete(requestId)
        pending.reject(new Error(error))
      }
    },
    []
  )

  // =========================================================================
  // Event handler (passed to PenumbraWebView's onEvent prop)
  // =========================================================================

  const onEvent = useCallback(
    (event: BridgeEvent) => {
      switch (event.type) {
        // --- Lifecycle ---
        case 'ready':
          setIsReady(true)
          setIsInitialized(false)
          setIsSyncing(false)
          setSyncProgress(null)
          setLastError(null)
          break

        case 'initResult':
          if (event.success) {
            setIsInitialized(true)
            resolvePending(event.requestId, true)
          } else {
            setLastError(event.error || 'Init failed')
            rejectPending(
              event.requestId,
              event.error || 'Init failed'
            )
          }
          break

        // --- Sync ---
        case 'syncStarted':
          setIsSyncing(true)
          resolvePending(event.requestId, undefined)
          break

        case 'syncProgress': {
          const percent =
            event.targetHeight > 0
              ? Math.min(
                  100,
                  Math.round(
                    (event.currentHeight / event.targetHeight) * 100
                  )
                )
              : 0
          setSyncProgress({
            currentHeight: event.currentHeight,
            targetHeight: event.targetHeight,
            isSynced: event.isSynced,
            percent,
          })
          break
        }

        case 'notesFound':
          console.log(
            `[Penumbra] Found ${event.count} notes at height ${event.height}`
          )
          if (event.activity && event.activity.length > 0) {
            activityListeners.forEach((fn) => fn(event.activity!))
          }
          break

        case 'syncStopped':
          setIsSyncing(false)
          resolvePending(event.requestId, undefined)
          break

        // --- Balances ---
        case 'balancesResult':
          setBalances(event.balances)
          resolvePending(event.requestId, event.balances)
          break

        // --- Asset IDs ---
        case 'computeAssetIdsResult':
          resolvePending(event.requestId, event.assetIds)
          break

        // --- Addresses ---
        case 'addressResult':
          resolvePending(event.requestId, event.address)
          break

        case 'ephemeralAddressResult':
          resolvePending(event.requestId, event.address)
          break

        case 'transparentAddressResult':
          resolvePending(event.requestId, event.address)
          break

        // --- Transactions ---
        case 'planResult':
          if (event.success && event.plan) {
            resolvePending(event.requestId, event.plan)
          } else {
            rejectPending(
              event.requestId,
              event.error || 'Plan failed'
            )
          }
          break

        case 'buildResult':
          if (event.success && event.transaction) {
            resolvePending(event.requestId, {
              transaction: event.transaction,
              transactionId: event.transactionId,
            })
          } else {
            rejectPending(
              event.requestId,
              event.error || 'Build failed'
            )
          }
          break

        case 'broadcastResult':
          if (event.success) {
            resolvePending(event.requestId, {
              hash: event.hash,
              height: event.height,
            })
          } else {
            rejectPending(
              event.requestId,
              event.error || 'Broadcast failed'
            )
          }
          break

        // --- Status ---
        case 'syncStatusResult':
          resolvePending(event.requestId, {
            isRunning: event.isRunning,
            currentHeight: event.currentHeight,
            targetHeight: event.targetHeight,
            isSynced: event.isSynced,
          })
          break

        case 'clearDataResult':
          if (event.success) {
            setBalances([])
            setSyncProgress(null)
            setIsInitialized(false)
            setIsSyncing(false)
            resolvePending(event.requestId, undefined)
          } else {
            rejectPending(
              event.requestId,
              event.error || 'Clear data failed'
            )
          }
          break

        // --- Withdraw ---
        case 'withdrawResult':
          progressCallbacks.current.delete(event.requestId)
          if (event.success) {
            resolvePending(event.requestId, {
              success: true,
              txHash: event.txHash,
            })
          } else {
            resolvePending(event.requestId, {
              success: false,
              error: event.error || 'Withdrawal failed',
              txHash: event.txHash,
            })
          }
          break

        // --- TX Progress ---
        case 'txProgress': {
          const cb = progressCallbacks.current.get(event.requestId)
          cb?.(event.step, event.message)
          break
        }

        case 'disclosureResult':
          resolvePending(event.requestId, event)
          break

        // --- Send ---
        case 'sendResult':
          progressCallbacks.current.delete(event.requestId)
          if (event.success) {
            resolvePending(event.requestId, {
              success: true,
              txHash: event.txHash,
            })
          } else {
            resolvePending(event.requestId, {
              success: false,
              error: event.error || 'Send failed',
            })
          }
          break

        // --- Key Derivation ---
        case 'deriveKeysResult':
          if (event.success) {
            resolvePending(event.requestId, {
              fvk: event.fvk,
              spendKey: event.spendKey,
              address: event.address,
              transparentAddress: event.transparentAddress,
            })
          } else {
            rejectPending(event.requestId, event.error || 'Key derivation failed')
          }
          break

        // --- Errors ---
        case 'webviewLog' as any:
          console.log((event as any).message)
          break

        // --- Address Ownership ---
        case 'addressOwnershipResult':
          resolvePending(event.requestId, {
            belongsToWallet: event.belongsToWallet,
            accountIndex: event.accountIndex,
            isEphemeral: event.isEphemeral,
            randomizer: event.randomizerBase64
              ? Uint8Array.from(atob(event.randomizerBase64), c => c.charCodeAt(0))
              : undefined,
          } satisfies OwnPenumbraAddressInfo)
          break

        case 'error':
          console.error('[PenumbraBridge] Error from WebView:', event.message)
          setLastError(event.message)
          if (event.requestId) {
            rejectPending(event.requestId, event.message)
          }
          break
      }
    },
    [resolvePending, rejectPending]
  )

  // =========================================================================
  // WebView error handler
  // =========================================================================

  const onWebViewError = useCallback((error: string) => {
    setLastError(`WebView load error: ${error}`)
    setIsReady(false)
  }, [])

  // =========================================================================
  // Command helpers
  // =========================================================================

  const init = useCallback(
    async (params: {
      fvk: string
      spendKey: string
      grpcUrl: string
      rpcUrl?: string
      proverUrl?: string
      chainId: string
    }): Promise<boolean> => {
      const requestId = generateRequestId()
      return sendRequest<boolean>({
        type: 'init',
        requestId,
        ...params,
      })
    },
    [sendRequest]
  )

  const startSync = useCallback(async (): Promise<void> => {
    const requestId = generateRequestId()
    return sendRequest<void>({
      type: 'startSync',
      requestId,
    })
  }, [sendRequest])

  const stopSync = useCallback(async (): Promise<void> => {
    const requestId = generateRequestId()
    return sendRequest<void>({
      type: 'stopSync',
      requestId,
    })
  }, [sendRequest])

  const getBalances = useCallback(
    async (accountIndex?: number): Promise<PenumbraBridgeBalance[]> => {
      const requestId = generateRequestId()
      return sendRequest<PenumbraBridgeBalance[]>({
        type: 'getBalances',
        requestId,
        accountIndex,
      })
    },
    [sendRequest]
  )

  const computeAssetIds = useCallback(
    async (denoms: string[]): Promise<Record<string, string>> => {
      const requestId = generateRequestId()
      return sendRequest<Record<string, string>>({
        type: 'computeAssetIds',
        requestId,
        denoms,
      } as any)
    },
    [sendRequest]
  )

  const getAddress = useCallback(
    async (accountIndex: number): Promise<string> => {
      const requestId = generateRequestId()
      return sendRequest<string>({
        type: 'getAddress',
        requestId,
        accountIndex,
      })
    },
    [sendRequest]
  )

  const getEphemeralAddress = useCallback(
    async (accountIndex: number): Promise<string> => {
      const requestId = generateRequestId()
      return sendRequest<string>({
        type: 'getEphemeralAddress',
        requestId,
        accountIndex,
      })
    },
    [sendRequest]
  )

  const getTransparentAddress = useCallback(async (): Promise<string> => {
    const requestId = generateRequestId()
    return sendRequest<string>({
      type: 'getTransparentAddress',
      requestId,
    })
  }, [sendRequest])

  const planTransaction = useCallback(
    async (request: string): Promise<string> => {
      const requestId = generateRequestId()
      return sendRequest<string>(
        {
          type: 'planTransaction',
          requestId,
          request,
        },
        LONG_REQUEST_TIMEOUT_MS
      )
    },
    [sendRequest]
  )

  const buildTransaction = useCallback(
    async (
      plan: string
    ): Promise<{ transaction: string; transactionId: string }> => {
      const requestId = generateRequestId()
      return sendRequest<{ transaction: string; transactionId: string }>(
        {
          type: 'buildTransaction',
          requestId,
          plan,
        },
        LONG_REQUEST_TIMEOUT_MS
      )
    },
    [sendRequest]
  )

  const broadcastTransaction = useCallback(
    async (
      transaction: string
    ): Promise<{ hash: string; height: number }> => {
      const requestId = generateRequestId()
      return sendRequest<{ hash: string; height: number }>(
        {
          type: 'broadcastTransaction',
          requestId,
          transaction,
        },
        LONG_REQUEST_TIMEOUT_MS
      )
    },
    [sendRequest]
  )

  const getSyncStatus = useCallback(async () => {
    const requestId = generateRequestId()
    return sendRequest<{
      isRunning: boolean
      currentHeight: number
      targetHeight: number
      isSynced: boolean
    }>({
      type: 'getSyncStatus',
      requestId,
    })
  }, [sendRequest])

  const clearData = useCallback(async (): Promise<void> => {
    const requestId = generateRequestId()
    return sendRequest<void>({
      type: 'clearData',
      requestId,
    })
  }, [sendRequest])

  const withdraw = useCallback(
    async (params: {
      amount: string
      denom: string
      destinationAddress?: string
      execution?: {
        refundAddress?: string
        gasLimit: string
        calls: {
          contract: `0x${string}`
          calldata: `0x${string}`
        }[]
      }
      sourceAccountIndex?: number
      onProgress?: (step: string, message: string) => void
    }): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      const requestId = generateRequestId()
      if (params.onProgress) {
        progressCallbacks.current.set(requestId, params.onProgress)
      }
      const { onProgress: _, ...cmdParams } = params
      return sendRequest({
        type: 'withdraw',
        requestId,
        ...cmdParams,
      } as any, LONG_REQUEST_TIMEOUT_MS)
    },
    [sendRequest]
  )

  const send = useCallback(
    async (params: {
      amount: string
      assetId: string
      recipientAddress: string
      sourceAccountIndex?: number
      onProgress?: (step: string, message: string) => void
    }): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      const requestId = generateRequestId()
      if (params.onProgress) {
        progressCallbacks.current.set(requestId, params.onProgress)
      }
      return sendRequest({
        type: 'send',
        requestId,
        amount: params.amount,
        assetId: params.assetId,
        recipientAddress: params.recipientAddress,
        sourceAccountIndex: params.sourceAccountIndex,
      } as any, LONG_REQUEST_TIMEOUT_MS)
    },
    [sendRequest]
  )

  const deriveKeys = useCallback(
    async (seedPhrase: string): Promise<{
      fvk: string; spendKey: string; address: string; transparentAddress: string
    }> => {
      const requestId = generateRequestId()
      return sendRequest({
        type: 'deriveKeys',
        requestId,
        seedPhrase,
      } as any, LONG_REQUEST_TIMEOUT_MS)
    },
    [sendRequest]
  )

  const getOwnAddressInfo = useCallback(
    async (address: string): Promise<OwnPenumbraAddressInfo> => {
      const requestId = generateRequestId()
      return sendRequest<OwnPenumbraAddressInfo>({
        type: 'getAddressOwnership',
        requestId,
        address,
      })
    },
    [sendRequest]
  )

  const exportDisclosure = useCallback(
    (selection: import('../../../packages/shared/src/shieldd/disclosure').DisclosureSelection, method: 'openings' | 'payload-keys') =>
      sendRequest<import('./bridge-protocol').DisclosureResultEvent>({ type: 'exportDisclosure', requestId: generateRequestId(), selection, method }),
    [sendRequest]
  )

  // =========================================================================
  // Return
  // =========================================================================

  return {
    webViewRef,
    onEvent,
    onWebViewError,
    isReady,
    isInitialized,
    isSyncing,
    syncProgress,
    balances,
    lastError,
    init,
    startSync,
    stopSync,
    getBalances,
    computeAssetIds,
    getAddress,
    getEphemeralAddress,
    getTransparentAddress,
    planTransaction,
    buildTransaction,
    broadcastTransaction,
    getSyncStatus,
    clearData,
    withdraw,
    send,
    deriveKeys,
    getOwnAddressInfo,
    exportDisclosure,
  }
}
