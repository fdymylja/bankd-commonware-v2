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
export { BANK_SEND_ABI, BANK_SEND_ADDRESS, SHIELD_ABI, SHIELD_ADDRESS } from '@bankd/shared/evm/bankd'
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
  type DeployContractStep,
  type ExecuteTransactionResult,
  type DeployTransactionResult,
  type TransactionProgressCallback,
} from './execute'
