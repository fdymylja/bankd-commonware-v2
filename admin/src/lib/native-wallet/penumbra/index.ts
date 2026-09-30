// src/lib/native-wallet/penumbra/index.ts
/**
 * Penumbra key derivation and services.
 */

// Keys
export {
  derivePenumbraKeys,
  initializePenumbraKeys,
  clearPenumbraKeys,
  hasPenumbraKeys,
  getFullViewingKey,
  getSpendKey,
  getWalletId,
  getPenumbraAddress,
  getPenumbraAddressInfo,
  getPenumbraEphemeralAddress,
  getPenumbraEphemeralAddressInfo,
  getPenumbraTransparentAddressInfo,
  serializeFVK,
  deserializeFVK,
  getWalletIdString,
} from './keys'

// Services
export {
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
} from './services'

// WASM loader is imported dynamically to avoid SSR issues
// const { generateSpendKey } = await import('./wasm-loader')
