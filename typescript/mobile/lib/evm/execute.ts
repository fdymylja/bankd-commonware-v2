/** Direct Commonware EVM calls with the wallet's existing progress interface. */
import type { QueryClient } from '@tanstack/react-query'
import type { Abi, TransactionReceipt } from 'viem'
import type { HDAccount } from 'viem/accounts'
import { getPublicClient, createMobileWalletClient } from './client'

type StepOptions = {
  successMessage: string
  confirmations?: number
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
}
export type EvmTransactionStep = StepOptions & {
  address: `0x${string}`
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  value?: bigint
}
export type DeployContractStep = StepOptions & {
  abi: Abi | readonly unknown[]
  bytecode: `0x${string}`
  args?: readonly unknown[]
  onContractDeployed?: (address: `0x${string}`) => void
}
export type TransactionStep = EvmTransactionStep | DeployContractStep
export type ExecuteTransactionResult = TransactionReceipt
export type DeployTransactionResult = TransactionReceipt & { contractAddress: `0x${string}` }
export type TransactionProgressCallback = (progress: {
  step: 'preparing' | 'signing' | 'broadcasting' | 'confirming' | 'confirmed' | 'error'
  message: string
  txHash?: `0x${string}`
  stepIndex?: number
}) => void

export async function executeTx(
  account: HDAccount,
  queryClient: QueryClient,
  steps: TransactionStep[],
  onProgress?: TransactionProgressCallback,
): Promise<(ExecuteTransactionResult | DeployTransactionResult)[]> {
  const client = getPublicClient()
  const wallet = createMobileWalletClient(account)
  const results: TransactionReceipt[] = []
  for (const [stepIndex, step] of steps.entries()) {
    let txHash: `0x${string}` | undefined
    const progress = (phase: Parameters<TransactionProgressCallback>[0]['step'], message: string) =>
      onProgress?.({ step: phase, message, stepIndex, txHash })
    try {
      progress('preparing', 'Preparing transaction...')
      progress('signing', 'Signing transaction...')
      if ('bytecode' in step) {
        txHash = await wallet.deployContract({ abi: step.abi as Abi, bytecode: step.bytecode, args: step.args })
      } else {
        const call = { address: step.address, abi: step.abi as Abi, functionName: step.functionName, args: step.args, value: step.value }
        const gas = await client.estimateContractGas({ ...call, account: account.address })
        txHash = await wallet.writeContract({ ...call, gas: gas * 130n / 100n })
      }
      step.onTransactionSent?.(txHash, stepIndex)
      progress('broadcasting', 'Transaction submitted...')
      progress('confirming', 'Waiting for finality...')
      const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: step.confirmations ?? 1 })
      if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${txHash}`)
      const deadline = Date.now() + 60_000
      while ((await client.getBlock({ blockTag: 'finalized' })).number! < receipt.blockNumber) {
        if (Date.now() > deadline) throw new Error(`Finality timed out; check transaction ${txHash} before retrying`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      if ('bytecode' in step) {
        if (!receipt.contractAddress) throw new Error('Deployment returned no contract address')
        step.onContractDeployed?.(receipt.contractAddress)
      }
      results.push(receipt)
      await queryClient.invalidateQueries()
      progress('confirmed', step.successMessage)
    } catch (error) {
      progress('error', error instanceof Error ? error.message : 'Transaction failed')
      throw error
    }
  }
  return results
}
