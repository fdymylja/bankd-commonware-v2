/**
 * Mobile EVM module.
 *
 * Re-exports shared EVM helpers (ABIs, precompile addresses, etc.)
 * and provides mobile-specific client/execute implementations.
 */

// Shared EVM helpers
export {
  ATOMIC_SWAP_ABI,
  type AtomicSwapOrder,
} from '@bankd/shared/evm/atomicSwap'
export {
  SIMPLE_LENDING_ABI,
  type SimpleLendingLoan,
  type SimpleLendingLoanWithId,
  type LoanStatus,
  ERC20_APPROVE_ABI,
} from '@bankd/shared/evm/simpleLending'
export {
  MSGEXEC_ABI,
  MSGEXEC_PRECOMPILE_ADDRESS,
  NATIVE_ABI,
  NATIVE_PRECOMPILE_ADDRESS,
} from '@bankd/shared/evm/precompile'
export { MOCK_ERC20_ABI } from '@bankd/shared/evm/mockERC20'
export { createEEMMemo, createPlaceOrderMemo, createExecuteOrderMemo } from '@bankd/shared/evm/memo'
export { getProvider, parseAmount } from '@bankd/shared/evm/client'

// Mobile-specific
export {
  getPublicClient,
  resetPublicClient,
  createMobileWalletClient,
  bankdChain,
} from './client'
export {
  executeTx,
  type TransactionStep,
  type EvmTransactionStep,
  type MsgExecStep,
  type MsgExecBatchStep,
  type DeployContractStep,
  type ExecuteTransactionResult,
  type ExecuteBatchTransactionResult,
  type DeployTransactionResult,
  type TransactionProgressCallback,
  type MsgExecProtoEncoder,
  type MsgExecProtoResponseDecoder,
} from './execute'
