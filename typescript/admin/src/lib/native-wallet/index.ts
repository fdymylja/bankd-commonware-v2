// src/lib/native-wallet/index.ts
/**
 * Unified Native Wallet
 *
 * One wallet, one seed phrase, multiple address types (EVM + Penumbra).
 *
 * Architecture:
 * - core/     - Shared wallet infrastructure, context, database
 * - evm/      - EVM key derivation & signing
 * - penumbra/ - Penumbra key derivation & services (sync, transactions)
 */

// =============================================================================
// Core (main exports)
// =============================================================================

export {
  // Types
  type EncryptedBox,
  type KeyPrint,
  type WalletConfig,
  type AccountRecord,
  type EVMAddressInfo,
  type PenumbraAddressInfo,
  type PenumbraTransparentAddressInfo,
  type AccountAddresses,
  type WalletInitState,
  type SyncProgress,
  type WalletState,
  type WalletActions,
  type WalletContextType,
  type SyncState,
  type SpendableNoteRecord,
  type TransactionRecord,
  type IBCDenomRecord,
  type PrivateTransferJobRecord,
  type PrivateTransferJobStatus,
  type PrivateTransferJobType,

  // Constants
  DB_NAME,
  DB_VERSION,
  SESSION_KEY,
  PBKDF2_ITERATIONS,
  ETH_DERIVATION_PATH,
  IDB_TABLES,

  // Encryption
  uint8ArrayToBase64,
  base64ToUint8Array,
  encryptSeedPhrase,
  decryptSeedPhrase,

  // Session
  createSession,
  restoreSession,
  hasSession,
  clearSession,

  // Database
  getDB,
  closeDB,
  getWalletConfig,
  hasWallet,
  deleteWallet,
  getAccounts,
  getAccount,
  addAccount,
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

  // Wallet operations
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
  // NOTE: getSpendKey intentionally NOT exported - internal use only
  getWalletId,

  // Passkey
  isPasskeySupported,
  isPRFSupported,
  registerPasskey,
  authenticateWithPasskey,
  type AuthMethod,
  type PasskeyCredential,

  // React context
  WalletProvider,
  useNativeWallet,
  useNativeWalletOptional,
  useNativeEVMAddress,
  useNativePenumbraAddress,
} from './core'

// =============================================================================
// EVM utilities
// =============================================================================

export {
  generateNewMnemonic,
  validateMnemonic,
  getEVMAddressInfo,
  getEVMAddressInfoForIndex,
  // NOTE: getEVMAccount intentionally NOT exported - internal use only (connector.ts)
  // Wagmi connector
  nativeWallet,
  nativeWalletConnectorType,
  type NativeWalletConnectorParameters,
} from './evm'

// =============================================================================
// Penumbra utilities
// =============================================================================

export {
  // Keys (NOTE: getSpendKey intentionally NOT exported - security sensitive)
  derivePenumbraKeys,
  getPenumbraAddress,
  getPenumbraAddressInfo,
  getPenumbraEphemeralAddress,
  getPenumbraEphemeralAddressInfo,
  getPenumbraTransparentAddressInfo,
  serializeFVK,
  deserializeFVK,

  // Services
  LocalViewService,
  createLocalViewService,
  type LocalViewServiceConfig,
  LocalCustodyService,
  createLocalCustodyService,
  type LocalCustodyServiceConfig,
  addressByIndex,
  ephemeralAddressByIndex,
  transparentAddress,
  getAddressString,
  getEphemeralAddressString,
  isOwnAddress,
  getOwnAddressInfo,
  balances,
  getTotalBalance,
  getAccountBalance,
  TransactionService,
  createTransactionService,
  planTransaction,
  authorizePlan,
  getWitness,
  buildTransaction,
  broadcastTransaction,
  getStateCommitmentTree,
  getIdbConstants,
  getGasFeeToken,
  getComplianceAssetStatus,
  isComplianceUserRegistered,
  registerRegulatedAsset,
  registerRegulatedUser,
  type ComplianceAssetStatus,
  type RegisterAssetInput,
  type TransactionServiceConfig,
  type PlanAndBuildResult,
  type BroadcastResult,
  generateAndSaveEphemeralAddressRecord,
  isOwnExternalPenumbraAddress,
  findOwnIntermediateRecords,
  exportAdminEphemeralAddressRegistry,
  importAdminEphemeralAddressRegistry,
  type GenerateEphemeralAddressInput,
} from './penumbra'
