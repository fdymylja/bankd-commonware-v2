// src/lib/native-wallet/core/types.ts
/**
 * Unified native wallet types.
 * One wallet, one seed phrase, multiple address types.
 */

import type {
  FullViewingKey,
  Address as PenumbraAddress,
  WalletId,
} from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'

// =============================================================================
// Encryption Types
// =============================================================================

/** Encrypted ciphertext container */
export interface EncryptedBox {
  /** Base64-encoded nonce (12 bytes for AES-GCM) */
  nonce: string
  /** Base64-encoded ciphertext */
  cipherText: string
}

/** Key derivation metadata for password verification */
export interface KeyPrint {
  /** Base64-encoded SHA-256 hash of derived key */
  hash: string
  /** Base64-encoded PBKDF2 salt (16 bytes) */
  salt: string
}

/** Encrypted custody storage */
export interface EncryptedCustody {
  type: 'encryptedSeedPhrase'
  box: EncryptedBox
}

/** Passkey credential for WebAuthn authentication */
export interface PasskeyCredential {
  /** Credential ID (base64) */
  credentialId: string
  /** Raw credential ID for authentication */
  rawId: string
  /** Whether PRF extension is supported */
  prfSupported: boolean
  /** User-friendly name for the passkey */
  name: string
  /** Creation timestamp */
  createdAt: number
}

/** Authentication method for the wallet */
export type AuthMethod = 'password' | 'passkey'

// =============================================================================
// Wallet Configuration
// =============================================================================

/** Unified wallet configuration stored in IndexedDB */
export interface WalletConfig {
  /** Wallet ID (derived from Penumbra wallet ID for consistency) */
  id: string
  /** User-defined label */
  label: string
  /** Encrypted seed phrase */
  encryptedCustody: EncryptedCustody
  /** Key derivation metadata (for password auth) */
  keyPrint: KeyPrint
  /** JSON-serialized Penumbra FullViewingKey (safe to store unencrypted) */
  penumbraFVK: string
  /** Timestamp when wallet was created */
  createdAt: number
  /** Authentication method */
  authMethod?: AuthMethod
  /** Passkey credential (if using passkey auth) */
  passkey?: PasskeyCredential
}

/** Account record for multi-account support */
export interface AccountRecord {
  /** Account index (0-based) */
  index: number
  /** User-defined label */
  label: string
  /** Timestamp when account was added */
  createdAt: number
}

// =============================================================================
// Address Types
// =============================================================================

/** EVM address info */
export interface EVMAddressInfo {
  /** Hex address (0x...) */
  hex: `0x${string}`
  /** Bech32 address (wallet1...) */
  bech32: string
}

/** Penumbra address info */
export interface PenumbraAddressInfo {
  /** Protobuf Address object */
  address: PenumbraAddress
  /** Bech32m encoded address */
  bech32: string
}

/** Penumbra transparent address info */
export interface PenumbraTransparentAddressInfo {
  /** Protobuf Address object */
  address: PenumbraAddress
  /** Bech32m encoded transparent address */
  bech32: string
}

/** All addresses for an account */
export interface AccountAddresses {
  /** Account index */
  accountIndex: number
  /** EVM address */
  evm: EVMAddressInfo
  /** Penumbra shielded address */
  penumbra: PenumbraAddressInfo
  /** Penumbra transparent address (for IBC) */
  penumbraTransparent: PenumbraTransparentAddressInfo
}

// =============================================================================
// Wallet State Types
// =============================================================================

/** Wallet initialization state */
export type WalletInitState =
  | 'uninitialized' // No wallet exists
  | 'locked' // Wallet exists but locked
  | 'unlocked' // Wallet is unlocked and ready

/** Sync progress for Penumbra */
export interface SyncProgress {
  current: bigint
  target: bigint
  percentage: number
}

/** Chain identity attached to Penumbra IndexedDB sync state. */
export interface PenumbraChainFingerprint {
  chainId: string
  marker: string
  lastObservedHeight: number
}

// =============================================================================
// Context Types
// =============================================================================

/** Unified wallet context state */
export interface WalletState {
  /** Current wallet initialization state */
  initState: WalletInitState

  /** Whether the wallet is still initializing (loading from DB) */
  isInitializing: boolean

  /** Current account index */
  currentAccount: number

  /** All addresses for the current account (null if locked) */
  addresses: AccountAddresses | null

  /** Penumbra Full Viewing Key (null if locked) */
  fullViewingKey: FullViewingKey | null

  /** Penumbra Wallet ID (null if locked) */
  walletId: WalletId | null

  /** Whether Penumbra sync is running */
  isSyncing: boolean

  /** Penumbra sync progress */
  syncProgress: SyncProgress | null

  /** Error message if any */
  error: string | null

  /** Authentication method used by the wallet */
  authMethod: AuthMethod | null

  /** Whether passkey is available for this wallet */
  hasPasskey: boolean
}

/** Unified wallet context actions */
export interface WalletActions {
  /** Create a new wallet with seed phrase and password */
  createWallet: (
    seedPhrase: string,
    password: string,
    label?: string
  ) => Promise<void>

  /** Create a new wallet with seed phrase and passkey (no password) */
  createWalletWithPasskey: (
    seedPhrase: string,
    label?: string
  ) => Promise<void>

  /** Import existing wallet from seed phrase */
  importWallet: (
    seedPhrase: string,
    password: string,
    label?: string
  ) => Promise<void>

  /** Unlock wallet with password */
  unlock: (password: string) => Promise<void>

  /** Unlock wallet with passkey (biometric/hardware key) */
  unlockWithPasskey: () => Promise<void>

  /** Lock wallet and clear session */
  lock: () => void

  /** Reset wallet (delete all data) */
  reset: () => Promise<void>

  /** Clear Penumbra scan cache and resync from genesis, preserving wallet/account metadata. */
  resetCacheAndResync: () => Promise<void>

  /** Export seed phrase (password for password-auth, omit for passkey-auth) */
  exportSeedPhrase: (password?: string) => Promise<string>

  /** Switch to different account index */
  switchAccount: (accountIndex: number) => Promise<void>

  /** Start Penumbra block sync */
  startSync: () => Promise<void>

  /** Stop Penumbra block sync */
  stopSync: () => void

  /** Clear error */
  clearError: () => void

  // =========================================================================
  // EVM Signing
  // =========================================================================

  /** Sign an EVM message */
  signMessage: (message: string) => Promise<`0x${string}`>

  /** Sign EVM typed data (EIP-712) */
  signTypedData: (typedData: any) => Promise<`0x${string}`>

  /** Sign an EVM transaction */
  signTransaction: (transaction: any) => Promise<`0x${string}`>

  /** Get EVM address for a specific account index (without switching) */
  getEVMAddressForIndex: (accountIndex: number) => Promise<EVMAddressInfo | null>
}

/** Complete unified wallet context type */
export type WalletContextType = WalletState & WalletActions

// =============================================================================
// Constants
// =============================================================================

/** Database name for unified wallet */
export const DB_NAME = 'native-wallet'

/** Database version */
export const DB_VERSION = 4

/** Session storage key */
export const SESSION_KEY = 'native-wallet-session'

/** PBKDF2 iterations for key derivation (intentionally slow ~500ms) */
export const PBKDF2_ITERATIONS = 210_000

/** Standard Ethereum BIP44 derivation path */
export const ETH_DERIVATION_PATH = "m/44'/60'/0'/0" as const
