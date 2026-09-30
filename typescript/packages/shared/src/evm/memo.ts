import { type Hex, encodeFunctionData } from 'viem'

import { ATOMIC_SWAP_ABI, ERC20_ABI } from './atomicSwap'

interface EvmExecEntry {
  contract: string
  calldata: string
  is_payable: boolean
}

/**
 * Creates an EEM (EVM Execution Middleware) memo for IBC transfers.
 * This memo format is intercepted by the EEM middleware to execute EVM contracts.
 */
export function createEEMMemo(entries: EvmExecEntry[]): string {
  return JSON.stringify({ evm_exec: entries })
}

/**
 * Creates a memo for placing an order via IBC.
 * Encodes two contract calls: approve + placeOrder
 */
export function createPlaceOrderMemo(
  swapContract: Hex,
  sellToken: Hex,
  sellAmount: bigint,
  buyToken: Hex,
  buyAmount: bigint,
  whitelistedBuyer: Hex
): string {
  const approveCalldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [swapContract, sellAmount],
  })

  const placeOrderCalldata = encodeFunctionData({
    abi: ATOMIC_SWAP_ABI,
    functionName: 'placeOrder',
    args: [sellAmount, sellToken, buyAmount, buyToken, whitelistedBuyer],
  })

  return createEEMMemo([
    { contract: sellToken, calldata: approveCalldata, is_payable: false },
    { contract: swapContract, calldata: placeOrderCalldata, is_payable: false },
  ])
}

/**
 * Creates a memo for executing an order via IBC.
 * Encodes two contract calls: approve + executeOrder
 */
export function createExecuteOrderMemo(
  swapContract: Hex,
  buyToken: Hex,
  buyAmount: bigint,
  orderId: bigint
): string {
  const approveCalldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [swapContract, buyAmount],
  })

  const executeCalldata = encodeFunctionData({
    abi: ATOMIC_SWAP_ABI,
    functionName: 'executeOrder',
    args: [orderId],
  })

  return createEEMMemo([
    { contract: buyToken, calldata: approveCalldata, is_payable: false },
    { contract: swapContract, calldata: executeCalldata, is_payable: false },
  ])
}
