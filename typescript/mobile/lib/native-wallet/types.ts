/**
 * Mobile-specific wallet types.
 * Re-exports shared types and adds mobile-specific additions.
 */

// Re-export all shared wallet types
export type {
  EncryptedBox,
  KeyPrint,
  EncryptedCustody,
  WalletConfig,
  AccountRecord,
  EVMAddressInfo,
  PenumbraAddressInfo,
  PenumbraTransparentAddressInfo,
  AccountAddresses,
  WalletInitState,
  SyncProgress,
  WalletState,
  WalletActions,
  WalletContextType,
  AuthMethod,
} from '@bankd/shared/wallet/types'

export {
  DB_NAME,
  DB_VERSION,
  SESSION_KEY,
  PBKDF2_ITERATIONS,
  ETH_DERIVATION_PATH,
} from '@bankd/shared/wallet/types'

// =============================================================================
// Mobile-Specific Types
// =============================================================================

/** Biometric authentication type */
export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none'

/** Mobile wallet storage config */
export interface MobileWalletConfig {
  /** Whether biometric unlock is enabled */
  biometricEnabled: boolean
  /** Type of biometric available on this device */
  biometricType: BiometricType
  /** Last unlock timestamp (for session management) */
  lastUnlockAt: number
}

/** Secure store key names */
export const SECURE_STORE_KEYS = {
  /** Wallet config JSON (non-sensitive metadata) */
  WALLET_CONFIG: 'bankd_wallet_config',
  /** Encrypted seed phrase box JSON */
  ENCRYPTED_CUSTODY: 'bankd_encrypted_custody',
  /** Key print JSON (for password verification) */
  KEY_PRINT: 'bankd_key_print',
  /** Penumbra Full Viewing Key (safe to store unencrypted) */
  PENUMBRA_FVK: 'bankd_penumbra_fvk',
  /** Biometric-protected encryption key (raw bytes, base64) */
  BIOMETRIC_KEY: 'bankd_biometric_key',
  /** Mobile-specific config JSON */
  MOBILE_CONFIG: 'bankd_mobile_config',
  /** Account records JSON array */
  ACCOUNTS: 'bankd_accounts',
  /** Ephemeral address registry JSON array (non-sensitive, uses AsyncStorage on native) */
  EPHEMERAL_ADDRESS_REGISTRY: 'bankd_ephemeral_address_registry',
} as const
