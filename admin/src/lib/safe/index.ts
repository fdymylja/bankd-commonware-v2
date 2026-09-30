// src/lib/safe/index.ts
/**
 * Native EVM-Safe host surface for the admin UI: propose -> collect owner sigs
 * (paste-blob) -> `execTransaction`. Mirrors the cosmos-multisig flow but runs
 * against the chain's own EVM RPC (this chain isn't on app.safe.global).
 */

export * from './types'
export {
  SAFE_ABI,
  MSGEXEC_ABI,
  MSGEXEC_PRECOMPILE_ADDRESS,
  AUTHORITY_MSGEXEC_TYPE,
  AUTHORITY_MODULE_ADDRESS,
  ZERO_ADDRESS,
  MULTISEND_ABI,
  MULTISEND_CALL_ONLY_ADDRESS,
  CREATE_CALL_ABI,
  CREATE_CALL_ADDRESS,
} from './abi'
export {
  buildRawSafeTx,
  buildNativeSend,
  buildCosmosMsg,
  buildCosmosSend,
  buildAuthorityExec,
  buildAuthoritySend,
  buildAddOwner,
  buildChangeThreshold,
  buildMultiSend,
  buildDeploy,
  encodeMultiSendTransactions,
  encodeAuthorityMsgExec,
  decodeAuthorityMsgExec,
  safeTxHashArgs,
  safeTxExecArgs,
} from './tx'
export type { SafeCall } from './tx'
export {
  encodeInitCode,
  randomSalt,
  predictCreate2Address,
} from './deploy'
export { signSafeTxHash, concatSignatures } from './sign'
export { getSafeInfo, getSafeNonce, getSafeTxHash } from './chain'
export type { SafeInfo } from './chain'
export { executeSafeTx } from './submit'
export type { SafeExecResult } from './submit'
// Pending Safe tx persistence lives in the shared multisig DB (version 2).
export {
  getPendingSafeTxs,
  getPendingSafeTx,
  savePendingSafeTx,
  deletePendingSafeTx,
} from '../multisig/db'
