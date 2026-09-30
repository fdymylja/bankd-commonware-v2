// src/lib/native-wallet/services/index.ts

export {
  LocalViewService,
  createLocalViewService,
  type LocalViewServiceConfig,
} from './view-service'

export {
  LocalCustodyService,
  createLocalCustodyService,
  type LocalCustodyServiceConfig,
} from './custody-service'

export {
  addressByIndex,
  ephemeralAddressByIndex,
  transparentAddress,
  getAddressString,
  getEphemeralAddressString,
  isOwnAddress,
  getOwnAddressInfo,
} from './address'

export { balances, getTotalBalance, getAccountBalance } from './balances'

export {
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
  type TransactionServiceConfig,
  type PlanAndBuildResult,
  type BroadcastResult,
  type ConfirmationConfig,
} from './transaction'

export {
  getComplianceAssetStatus,
  isComplianceUserRegistered,
  registerRegulatedAsset,
  registerRegulatedUser,
  type ComplianceAssetStatus,
  type RegisterAssetInput,
} from './compliance'

export {
  generateAndSaveEphemeralAddressRecord,
  isOwnExternalPenumbraAddress,
  findOwnIntermediateRecords,
  exportAdminEphemeralAddressRegistry,
  importAdminEphemeralAddressRegistry,
  type GenerateEphemeralAddressInput,
} from './ephemeral-address-registry'

// ViewServer sync is exported separately to allow dynamic import
// This avoids loading WASM during SSR
// export {
//   ViewServerSyncController,
//   createViewServerSyncController,
//   type ViewServerSyncConfig,
//   type SyncStatus,
// } from './view-server-sync'
