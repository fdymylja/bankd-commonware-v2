// src/lib/multisig/index.ts
/**
 * Cosmos-SDK multisig wallet (+ Safe watch-only) support for the admin UI.
 * Additive to the native wallet - see context.tsx.
 */

export * from './types'
export {
  deriveMultisigAddress,
  memberPubkeyAny,
  legacyAminoPubkeyAny,
  sortMembers,
} from './pubkey'
export { buildAminoSignDoc, signAsMember } from './sign'
export { combineAndEncodeTx } from './assemble'
export { fetchMemberPubkey } from './queries'
export {
  type MultisigShareBlob,
  buildShareBlob,
  parseShareBlob,
} from './share'
export {
  buildUnsignedSend,
  broadcast,
  DEFAULT_GAS,
  DEFAULT_FEE_AMOUNT,
} from './cosmos'
export {
  getMultisigWallets,
  saveMultisigWallet,
  deleteMultisigWallet,
  getPendingMultisigTxs,
  savePendingMultisigTx,
  deletePendingMultisigTx,
} from './db'
export {
  getPendingSafeTxs,
  savePendingSafeTx,
  deletePendingSafeTx,
} from './db'
export { MultisigProvider, useMultisig } from './context'
export type { CreateSafeTxInput } from './context'
export { useActiveAccount } from './use-active-account'
export type { ActiveAccount } from './use-active-account'
export {
  getActiveWallet,
  isSafeActive,
  guardSafeUnsupported,
} from './active-store'
export type { ActiveWalletKind } from './active-store'
