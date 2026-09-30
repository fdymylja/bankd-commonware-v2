// src/lib/native-wallet/core/index.ts
/**
 * Core unified wallet module.
 */

// Types
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
  PasskeyCredential,
} from './types'

export {
  DB_NAME,
  DB_VERSION,
  SESSION_KEY,
  PBKDF2_ITERATIONS,
  ETH_DERIVATION_PATH,
} from './types'

// Encryption
export {
  uint8ArrayToBase64,
  base64ToUint8Array,
  deriveKey,
  createKeyPrint,
  verifyPassword,
  encrypt,
  decrypt,
  encryptSeedPhrase,
  decryptSeedPhrase,
} from './encryption'

// Session
export {
  createSession,
  restoreSession,
  hasSession,
  clearSession,
  extendSession,
  getSessionInfo,
} from './session'

// Database
export {
  getDB,
  closeDB,
  getWalletConfig,
  saveWalletConfig,
  hasWallet,
  deleteWallet,
  getAccounts,
  getAccount,
  addAccount,
  ensureDefaultAccount,
  getSyncState,
  saveSyncState,
  getLastSyncedHeight,
  updateSyncHeight,
  savePenumbraChainFingerprint,
  clearPenumbraSyncTables,
  saveSpendableNote,
  saveSpendableNotes,
  getSpendableNote,
  getSpendableNotes,
  getAllSpendableNotes,
  getUnspentNotes,
  getUnspentNotesByAsset,
  markNoteSpent,
  hasNullifier,
  getAssetMetadata,
  saveAssetMetadata,
  getAllAssetMetadata,
  saveTransaction,
  getTransaction,
  getAllTransactions,
  saveIBCDenom,
  saveIBCDenoms,
  getIBCDenom,
  getAllIBCDenoms,
  getIBCDenomsMap,
  registerKnownIBCDenoms,
  enqueuePrivateTransferJob,
  getPrivateTransferJobs,
  updatePrivateTransferJob,
  nextRunnablePrivateTransferJob,
  saveEphemeralAddressRecord,
  saveEphemeralAddressRecords,
  getEphemeralAddressRecord,
  getAllEphemeralAddressRecords,
  findEphemeralAddressRecordsByPenumbraAddress,
  findEphemeralAddressRecordsByIntermediateHex,
  clearEphemeralAddressRecords,
  KNOWN_IBC_DENOMS,
  IDB_TABLES,
  type SyncState,
  type SpendableNoteRecord,
  type TransactionRecord,
  type IBCDenomRecord,
  type PrivateTransferJobRecord,
  type PrivateTransferJobStatus,
  type PrivateTransferJobType,
} from './db'

// Wallet operations
export {
  getWalletInitState,
  isWalletUnlocked,
  createWallet,
  createWalletWithPasskey,
  importWallet,
  replaceWallet,
  unlockWallet,
  unlockWithPasskey,
  tryAutoUnlock,
  lockWallet,
  getCurrentAccountIndex,
  switchAccount,
  getAccountAddresses,
  getCurrentAccountAddresses,
  exportSeedPhrase,
  destroyWallet,
  getWalletLabel,
  getWalletCreatedAt,
  getWalletAuthMethod,
  hasPasskeyAuth,
  isWebAuthnSupported,
  signMessage,
  signTypedData,
  signTransaction,
  getFullViewingKey,
  getSpendKey,
  getWalletId,
} from './wallet'

// Passkey
export {
  isWebAuthnSupported as isPasskeySupported,
  isPRFSupported,
  registerPasskey,
  authenticateWithPasskey,
} from './passkey'

// React context
export {
  WalletProvider,
  useNativeWallet,
  useNativeWalletOptional,
  useNativeEVMAddress,
  useNativePenumbraAddress,
} from './context'
