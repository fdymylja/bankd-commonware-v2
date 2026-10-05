// mobile/lib/penumbra-webview/bridge-protocol.ts
/**
 * Message protocol between React Native and the Penumbra WebView bridge.
 *
 * The WebView runs @mizufinance/wasm in a browser context with IndexedDB.
 * React Native communicates via postMessage / onMessage.
 *
 * All messages carry a `requestId` so the RN side can match responses to requests.
 */

// =============================================================================
// Commands (RN → WebView)
// =============================================================================

/** Initialize the WASM modules and IndexedDB. Must be called first. */
export type InitCommand = {
  type: 'init'
  requestId: string
  /** Full Viewing Key as base64-encoded inner bytes */
  fvk: string
  /** Spend Key as base64-encoded inner bytes (needed for tx authorization) */
  spendKey: string
  /** Penumbra gRPC-web proxy URL */
  grpcUrl: string
  /** CometBFT RPC URL (e.g. http://localhost:26657) */
  rpcUrl?: string
  /** Penumbra prover service URL */
  proverUrl?: string
  /** Penumbra chain ID */
  chainId: string
}

/** Start syncing compact blocks. */
export type StartSyncCommand = {
  type: 'startSync'
  requestId: string
}

/** Stop syncing. */
export type StopSyncCommand = {
  type: 'stopSync'
  requestId: string
}

/** Query current balances from IndexedDB. */
export type GetBalancesCommand = {
  type: 'getBalances'
  requestId: string
  /** Optional account filter (0-based index) */
  accountIndex?: number
}

/** Get a Penumbra address for an account index. */
export type GetAddressCommand = {
  type: 'getAddress'
  requestId: string
  accountIndex: number
}

/** Generate a fresh ephemeral shielded address for an account index. */
export type GetEphemeralAddressCommand = {
  type: 'getEphemeralAddress'
  requestId: string
  accountIndex: number
}

/** Get the transparent (IBC-compatible) address. */
export type GetTransparentAddressCommand = {
  type: 'getTransparentAddress'
  requestId: string
}

/** Plan a transaction from a planner request. */
export type PlanTransactionCommand = {
  type: 'planTransaction'
  requestId: string
  /** TransactionPlannerRequest as JSON */
  request: string
}

/** Authorize and build a transaction from a plan. */
export type BuildTransactionCommand = {
  type: 'buildTransaction'
  requestId: string
  /** TransactionPlan as JSON */
  plan: string
}

/** Broadcast a built transaction. */
export type BroadcastTransactionCommand = {
  type: 'broadcastTransaction'
  requestId: string
  /** Transaction as base64-encoded binary */
  transaction: string
}

/** Get sync status. */
export type GetSyncStatusCommand = {
  type: 'getSyncStatus'
  requestId: string
}

/** Clear all local data (notes, tree, params). */
export type ClearDataCommand = {
  type: 'clearData'
  requestId: string
}

export type HostExecutionCall = {
  /** 20-byte EVM contract address. */
  contract: `0x${string}`
  /** ABI-encoded EVM calldata. */
  calldata: `0x${string}`
}

/** Execute a Shieldd host withdrawal through Bankd. */
export type WithdrawCommand = {
  type: 'withdraw'
  requestId: string
  /** Amount in base units. */
  amount: string
  /** Canonical Shieldd base denom. */
  denom: string
  /** Bankd recipient for a direct host transfer. */
  destinationAddress?: string
  /** Ordered Bankd EVM calls for a host execution withdrawal. */
  execution?: {
    refundAddress?: string
    gasLimit: string
    calls: HostExecutionCall[]
  }
  /** Shieldd account index to spend from. */
  sourceAccountIndex?: number
}

/** Send tokens privately within Penumbra (Penumbra-to-Penumbra). Plan + build + broadcast. */
export type SendCommand = {
  type: 'send'
  requestId: string
  /** Amount in base units (string bigint, e.g. "1000000") */
  amount: string
  /** Asset ID as hex string */
  assetId: string
  /** Recipient Penumbra address (bech32m) */
  recipientAddress: string
  /** Source account index (default 0) */
  sourceAccountIndex?: number
}

/** Derive Penumbra keys from a seed phrase via WASM. */
export type DeriveKeysCommand = {
  type: 'deriveKeys'
  requestId: string
  /** BIP39 seed phrase */
  seedPhrase: string
}

/** Check if an address belongs to this wallet (ownership detection via FVK). */
export type GetAddressOwnershipCommand = {
  type: 'getAddressOwnership'
  requestId: string
  /** Bech32m-encoded Penumbra address */
  address: string
}

export type ExportDisclosureCommand = {
  type: 'exportDisclosure'
  requestId: string
  selection: import('../../../packages/shared/src/shieldd/disclosure').DisclosureSelection
  method: 'openings' | 'payload-keys'
}

export type DisclosureResultEvent = {
  type: 'disclosureResult'
  requestId: string
  packageJson: string
  preview: string
  verification: string
}

export type BridgeCommand =
  | ExportDisclosureCommand
  | DeriveKeysCommand
  | WithdrawCommand
  | InitCommand
  | StartSyncCommand
  | StopSyncCommand
  | GetBalancesCommand
  | GetAddressCommand
  | GetEphemeralAddressCommand
  | GetTransparentAddressCommand
  | PlanTransactionCommand
  | BuildTransactionCommand
  | BroadcastTransactionCommand
  | GetSyncStatusCommand
  | ClearDataCommand
  | GetAddressOwnershipCommand

// =============================================================================
// Events (WebView → RN)
// =============================================================================

/** WebView is loaded and ready for init. */
export type ReadyEvent = {
  type: 'ready'
}

/** Response to init command. */
export type InitResultEvent = {
  type: 'initResult'
  requestId: string
  success: boolean
  error?: string
}

/** Response to startSync — fires once sync loop begins. */
export type SyncStartedEvent = {
  type: 'syncStarted'
  requestId: string
}

/** Periodic sync progress updates (fire-and-forget, no requestId match needed). */
export type SyncProgressEvent = {
  type: 'syncProgress'
  currentHeight: number
  targetHeight: number
  isSynced: boolean
}

/** Notes were found during sync. */
export type NoteActivity = {
  /** 'received' = new unspent note, 'spent' = nullifier matched an existing note */
  action: 'received' | 'spent'
  /** Asset ID (base64) */
  assetId: string
  /** Raw amount as string bigint */
  amount: string
  /** Block height */
  height: number
  /** Resolved symbol (e.g. "BRL", "EUR") — may be empty if unknown */
  symbol?: string
  /** Decimal places for this asset */
  decimals?: number
  /** Block timestamp (ISO string) */
  timestamp?: string
}

export type NotesFoundEvent = {
  type: 'notesFound'
  count: number
  height: number
  /** Detailed note activity for building transaction history */
  activity?: NoteActivity[]
}

/** Response to stopSync. */
export type SyncStoppedEvent = {
  type: 'syncStopped'
  requestId: string
}

/** Response to getBalances. */
export type BalancesResultEvent = {
  type: 'balancesResult'
  requestId: string
  balances: PenumbraBridgeBalance[]
}

/** A single balance entry from the bridge. */
export type PenumbraBridgeBalance = {
  /** Asset ID as hex string */
  assetIdHex: string
  /** Amount as string (bigint serialized) */
  amount: string
  /** Account index */
  accountIndex: number
  /** Asset metadata (if known) */
  metadata?: {
    symbol: string
    name: string
    decimals: number
    /** Base denom string */
    baseDenom: string
  }
}

/** Response to getAddress. */
export type AddressResultEvent = {
  type: 'addressResult'
  requestId: string
  /** Bech32m-encoded address */
  address: string
  /** Account index */
  accountIndex: number
}

/** Response to getEphemeralAddress. */
export type EphemeralAddressResultEvent = {
  type: 'ephemeralAddressResult'
  requestId: string
  /** Bech32m-encoded ephemeral shielded address */
  address: string
  /** Account index */
  accountIndex: number
}

/** Response to getTransparentAddress. */
export type TransparentAddressResultEvent = {
  type: 'transparentAddressResult'
  requestId: string
  /** Bech32m-encoded transparent address */
  address: string
}

/** Response to planTransaction. */
export type PlanResultEvent = {
  type: 'planResult'
  requestId: string
  success: boolean
  /** TransactionPlan as JSON */
  plan?: string
  error?: string
}

/** Response to buildTransaction. */
export type BuildResultEvent = {
  type: 'buildResult'
  requestId: string
  success: boolean
  /** Transaction as base64-encoded binary */
  transaction?: string
  /** Transaction ID (hash) */
  transactionId?: string
  error?: string
}

/** Response to broadcastTransaction. */
export type BroadcastResultEvent = {
  type: 'broadcastResult'
  requestId: string
  success: boolean
  hash?: string
  height?: number
  error?: string
}

/** Response to getSyncStatus. */
export type SyncStatusResultEvent = {
  type: 'syncStatusResult'
  requestId: string
  isRunning: boolean
  currentHeight: number
  targetHeight: number
  isSynced: boolean
}

/** Response to clearData. */
export type ClearDataResultEvent = {
  type: 'clearDataResult'
  requestId: string
  success: boolean
  error?: string
}

/** Response to withdraw command. */
export type WithdrawResultEvent = {
  type: 'withdrawResult'
  requestId: string
  success: boolean
  txHash?: string
  height?: number
  error?: string
}

/** Response to send command. */
export type SendResultEvent = {
  type: 'sendResult'
  requestId: string
  success: boolean
  txHash?: string
  error?: string
}

/** Progress update for multi-step operations (send, withdraw). */
export type TxProgressEvent = {
  type: 'txProgress'
  requestId: string
  step: 'planning' | 'authorizing' | 'building' | 'broadcasting' | 'confirming' | 'syncing'
  message: string
}

/** Response to deriveKeys. */
export type DeriveKeysResultEvent = {
  type: 'deriveKeysResult'
  requestId: string
  success: boolean
  /** FVK as base64-encoded inner bytes */
  fvk?: string
  /** Spend key as base64-encoded inner bytes */
  spendKey?: string
  /** Penumbra bech32m address for account 0 */
  address?: string
  /** Transparent (IBC-compatible) address */
  transparentAddress?: string
  error?: string
}

/** Generic error event. */
export type ComputeAssetIdsResultEvent = {
  type: 'computeAssetIdsResult'
  requestId: string
  /** Map of baseDenom → base64 asset ID */
  assetIds: Record<string, string>
}

export type ErrorEvent = {
  type: 'error'
  requestId?: string
  message: string
  stack?: string
}

/** Response to getAddressOwnership command. */
export type AddressOwnershipResultEvent = {
  type: 'addressOwnershipResult'
  requestId: string
  belongsToWallet: boolean
  accountIndex?: number
  isEphemeral?: boolean
  /** Randomizer bytes as base64 (empty string for default addresses). */
  randomizerBase64?: string
}

export type BridgeEvent =
  | DisclosureResultEvent
  | ReadyEvent
  | InitResultEvent
  | SyncStartedEvent
  | SyncProgressEvent
  | NotesFoundEvent
  | SyncStoppedEvent
  | BalancesResultEvent
  | AddressResultEvent
  | EphemeralAddressResultEvent
  | TransparentAddressResultEvent
  | PlanResultEvent
  | BuildResultEvent
  | BroadcastResultEvent
  | SyncStatusResultEvent
  | ClearDataResultEvent
  | WithdrawResultEvent
  | SendResultEvent
  | TxProgressEvent
  | DeriveKeysResultEvent
  | ComputeAssetIdsResultEvent
  | AddressOwnershipResultEvent
  | ErrorEvent

// =============================================================================
// Helpers
// =============================================================================

/** Generate a unique request ID. */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
