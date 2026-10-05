/**
 * Mobile transaction executor using viem directly (no wagmi).
 *
 * Mirrors the admin's executeTx API but:
 * - Uses viem walletClient/publicClient instead of wagmi
 * - Uses progress callbacks instead of react-hot-toast
 * - Shares MsgExec precompile encoding from @bankd/shared
 * - Shares Cosmos TX lookup from @bankd/shared
 */

import { MSGEXEC_ABI, MSGEXEC_PRECOMPILE_ADDRESS } from '@bankd/shared/evm/precompile'
import { MsgEthereumTxResponse } from '@bankd/shared/proto/cosmos/evm/vm/v1/tx'
import { queries } from '@bankd/shared/cosmos'
import { IndexedTx } from '@cosmjs/stargate'
import { QueryClient } from '@tanstack/react-query'
import {
  Abi,
  bytesToHex,
  decodeAbiParameters,
  hexToBytes,
  type WaitForTransactionReceiptReturnType,
} from 'viem'
import type { HDAccount } from 'viem/accounts'

import { getPublicClient, createMobileWalletClient } from './client'

// =============================================================================
// Types
// =============================================================================

/**
 * A protobuf message encoder for x/msgexec precompile.
 */
export type MsgExecProtoEncoder<TMsg> = {
  typeUrl: string
  fromPartial: (partial: Partial<TMsg>) => TMsg
  toProto: (message: TMsg) => Uint8Array
}

/**
 * A protobuf response decoder for x/msgexec precompile.
 */
export type MsgExecProtoResponseDecoder<T = unknown> = {
  typeUrl: string
  decode: (data: Uint8Array) => T
}

/**
 * An EVM contract call step.
 */
export type EvmTransactionStep = {
  address: `0x${string}`
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  value?: bigint
  successMessage: string
  confirmations?: number
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
  msgExecResponseDecoder?: MsgExecProtoResponseDecoder
}

/**
 * A MsgExec step for Cosmos SDK message execution via the EVM precompile.
 */
export type MsgExecStep<TMsg = any, TResponse = unknown> = {
  msg: MsgExecProtoEncoder<TMsg>
  values: Partial<TMsg>
  response?: MsgExecProtoResponseDecoder<TResponse>
  successMessage: string
  confirmations?: number
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
}

/**
 * A batch message in a MsgExecBatch step.
 */
export type MsgExecBatchMessage<TMsg = any, TResponse = unknown> = {
  msg: MsgExecProtoEncoder<TMsg>
  values: Partial<TMsg>
  response?: MsgExecProtoResponseDecoder<TResponse>
}

/**
 * A batched MsgExec step for multiple Cosmos SDK messages in one EVM tx.
 */
export type MsgExecBatchStep = {
  msgs: MsgExecBatchMessage[]
  successMessage: string
  confirmations?: number
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
}

/**
 * A deploy contract step.
 */
export type DeployContractStep = {
  abi: Abi | readonly unknown[]
  bytecode: `0x${string}`
  args?: readonly unknown[]
  successMessage: string
  confirmations?: number
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
  onContractDeployed?: (address: `0x${string}`) => void
}

/**
 * Union of all supported transaction step types.
 */
export type TransactionStep =
  | EvmTransactionStep
  | MsgExecStep
  | MsgExecBatchStep
  | DeployContractStep

/**
 * Result of an executed transaction.
 */
export type ExecuteTransactionResult = WaitForTransactionReceiptReturnType & {
  cosmosTx?: IndexedTx | null
  msgExecReturnData?: Uint8Array
  decodedMsgResponse?: unknown
}

/**
 * Result of a batch executed transaction.
 */
export type ExecuteBatchTransactionResult = WaitForTransactionReceiptReturnType & {
  cosmosTx?: IndexedTx | null
  msgExecReturnData?: Uint8Array[]
  decodedMsgResponses?: unknown[]
}

/**
 * Result of a deployed contract.
 */
export type DeployTransactionResult = WaitForTransactionReceiptReturnType & {
  cosmosTx?: IndexedTx | null
  contractAddress: `0x${string}`
}

/**
 * Progress callback for UI updates.
 */
export type TransactionProgressCallback = (progress: {
  step: 'preparing' | 'signing' | 'broadcasting' | 'confirming' | 'confirmed' | 'error'
  message: string
  txHash?: `0x${string}`
  /** Index of the current step (0-based) in multi-step transactions */
  stepIndex?: number
}) => void

// =============================================================================
// Type Guards
// =============================================================================

const isMsgExecStep = (step: TransactionStep): step is MsgExecStep =>
  'msg' in step && 'values' in step && !('msgs' in step)

const isMsgExecBatchStep = (step: TransactionStep): step is MsgExecBatchStep =>
  'msgs' in step && Array.isArray((step as MsgExecBatchStep).msgs)

const isDeployContractStep = (step: TransactionStep): step is DeployContractStep =>
  'bytecode' in step && !('address' in step)

// =============================================================================
// MsgExec Conversion
// =============================================================================

/**
 * Convert a MsgExecStep to an EVM contract call.
 */
function convertMsgExecStep(step: MsgExecStep): EvmTransactionStep {
  const { msg, values, response, ...rest } = step
  const encodedMsg = msg.toProto(msg.fromPartial(values))

  return {
    address: MSGEXEC_PRECOMPILE_ADDRESS,
    abi: MSGEXEC_ABI,
    functionName: 'execute',
    args: [msg.typeUrl, bytesToHex(encodedMsg)],
    msgExecResponseDecoder: response,
    ...rest,
  }
}

/**
 * Convert a MsgExecBatchStep to an EVM contract call.
 */
function convertMsgExecBatchStep(step: MsgExecBatchStep): EvmTransactionStep & {
  _batchMsgs: MsgExecBatchMessage[]
} {
  const { msgs, ...rest } = step

  const typeUrls: string[] = []
  const encodedValues: `0x${string}`[] = []

  for (const { msg, values } of msgs) {
    typeUrls.push(msg.typeUrl)
    encodedValues.push(bytesToHex(msg.toProto(msg.fromPartial(values))))
  }

  return {
    address: MSGEXEC_PRECOMPILE_ADDRESS,
    abi: MSGEXEC_ABI,
    functionName: 'executeBatch',
    args: [typeUrls, encodedValues],
    _batchMsgs: msgs,
    ...rest,
  }
}

// =============================================================================
// Execute Transaction
// =============================================================================

/**
 * Execute one or more transactions sequentially.
 *
 * Mobile equivalent of admin's executeTx — uses viem directly with progress callbacks.
 *
 * @example
 * // EVM contract call
 * const results = await executeTx(
 *   account,
 *   queryClient,
 *   [{ abi, address, functionName: 'transfer', args: [to, amount], successMessage: 'Sent!' }],
 *   (p) => setProgress(p.message)
 * )
 *
 * @example
 * // MsgExec call
 * const results = await executeTx(
 *   account,
 *   queryClient,
 *   [{
 *     msg: MsgTransfer,
 *     values: { sourcePort: 'transfer', sourceChannel: 'channel-0', ... },
 *     response: MsgTransferResponse,
 *     successMessage: 'IBC transfer initiated!',
 *   }],
 *   (p) => setProgress(p.message)
 * )
 */
export async function executeTx(
  account: HDAccount,
  queryClient: QueryClient,
  steps: TransactionStep[],
  onProgress?: TransactionProgressCallback
): Promise<(ExecuteTransactionResult | ExecuteBatchTransactionResult | DeployTransactionResult)[]> {
  const publicClient = getPublicClient()
  const walletClient = createMobileWalletClient(account)

  const results: (ExecuteTransactionResult | ExecuteBatchTransactionResult | DeployTransactionResult)[] = []

  for (const [index, step] of steps.entries()) {
    const isBatchStep = isMsgExecBatchStep(step)
    const isDeployStep = isDeployContractStep(step)

    // Convert MsgExec steps to EVM format
    const evmStep = isBatchStep
      ? convertMsgExecBatchStep(step as MsgExecBatchStep)
      : isMsgExecStep(step)
        ? convertMsgExecStep(step as MsgExecStep)
        : (step as EvmTransactionStep | DeployContractStep)

    const batchMsgs = isBatchStep
      ? (evmStep as ReturnType<typeof convertMsgExecBatchStep>)._batchMsgs
      : undefined

    const confirmations = evmStep.confirmations ?? 1

    onProgress?.({
      step: 'preparing',
      message: 'Preparing transaction...',
      stepIndex: index,
    })

    try {
      let txHash: `0x${string}`

      if (isDeployStep) {
        // Deploy contract
        const deployStep = evmStep as DeployContractStep
        onProgress?.({
          step: 'signing',
          message: 'Signing deployment...',
          stepIndex: index,
        })

        txHash = await walletClient.deployContract({
          abi: deployStep.abi as Abi,
          bytecode: deployStep.bytecode,
          args: deployStep.args as any,
        })
      } else {
        // Regular contract call
        const callStep = evmStep as EvmTransactionStep
        onProgress?.({
          step: 'signing',
          message: 'Signing transaction...',
          stepIndex: index,
        })

        const estimatedGas = await publicClient.estimateContractGas({
          address: callStep.address,
          abi: callStep.abi as Abi,
          functionName: callStep.functionName,
          args: callStep.args as any,
          value: callStep.value,
          account: account.address,
        })

        txHash = await walletClient.writeContract({
          address: callStep.address,
          abi: callStep.abi as Abi,
          functionName: callStep.functionName,
          args: callStep.args as any,
          value: callStep.value,
          gas: estimatedGas * 130n / 100n,
        })
      }

      step.onTransactionSent?.(txHash, index)
      onProgress?.({
        step: 'broadcasting',
        message: `Transaction sent. Waiting for confirmation...`,
        txHash,
        stepIndex: index,
      })

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations,
      })

      if (receipt.status === 'reverted') {
        // Try to get revert reason via simulation
        const callStep = evmStep as EvmTransactionStep
        let revertReason = 'Unknown reason'
        try {
          if (!isDeployStep) {
            await publicClient.simulateContract({
              address: callStep.address,
              abi: callStep.abi as Abi,
              functionName: callStep.functionName,
              args: callStep.args as any,
              value: callStep.value,
              account: account.address,
            })
          }
        } catch (simError: any) {
          revertReason = simError?.message || simError?.toString() || 'Unknown reason'
          console.error(`[executeTx] step ${index} revert reason:`, revertReason)
        }
        throw new Error(`Transaction reverted at step ${index} (${isDeployStep ? 'deploy' : (evmStep as EvmTransactionStep).functionName}): ${revertReason}`)
      }

      // Build result
      let txResult: ExecuteTransactionResult | ExecuteBatchTransactionResult | DeployTransactionResult

      if (isDeployStep) {
        if (!receipt.contractAddress) {
          throw new Error('Contract deployment failed: no contract address')
        }
        ;(step as DeployContractStep).onContractDeployed?.(receipt.contractAddress)
        txResult = {
          ...receipt,
          contractAddress: receipt.contractAddress,
          cosmosTx: null,
        } as DeployTransactionResult
      } else {
        txResult = { ...receipt, cosmosTx: null } as ExecuteTransactionResult
      }

      // Signal confirmed immediately — Cosmos lookup is best-effort and non-blocking
      results.push(txResult)
      onProgress?.({
        step: 'confirmed',
        message: step.successMessage,
        txHash,
        stepIndex: index,
      })

      // Best-effort Cosmos TX lookup + MsgExec decode (non-blocking)
      queryClient
        .fetchQuery({
          ...queries.tx.byEthereumHash(txHash),
          retry: 2,
          retryDelay: 500,
        })
        .then((cosmosTx) => {
          if (!cosmosTx) return
          txResult.cosmosTx = cosmosTx

          if (!isDeployStep) {
            const { msgExecResponseDecoder, address } = evmStep as EvmTransactionStep
            try {
              if (address === MSGEXEC_PRECOMPILE_ADDRESS) {
                const txResponse = cosmosTx.msgResponses.find(
                  (r: { typeUrl: string; value: Uint8Array }) => r.typeUrl === MsgEthereumTxResponse.typeUrl
                )
                if (txResponse) {
                  const ethTxResponse = MsgEthereumTxResponse.decode(txResponse.value)

                  if (isBatchStep && batchMsgs) {
                    try {
                      const [decodedResults] = decodeAbiParameters(
                        [{ type: 'bytes[]' }],
                        bytesToHex(ethTxResponse.ret)
                      ) as [`0x${string}`[]]

                      const returnDataArray = decodedResults.map((hex) => hexToBytes(hex))
                      ;(txResult as ExecuteBatchTransactionResult).msgExecReturnData = returnDataArray

                      const decodedResponses: unknown[] = []
                      for (let i = 0; i < batchMsgs.length; i++) {
                        const msg = batchMsgs[i]
                        const returnData = returnDataArray[i]
                        if (msg.response && returnData) {
                          try {
                            decodedResponses.push(msg.response.decode(returnData))
                          } catch {
                            decodedResponses.push(undefined)
                          }
                        } else {
                          decodedResponses.push(undefined)
                        }
                      }
                      ;(txResult as ExecuteBatchTransactionResult).decodedMsgResponses = decodedResponses
                    } catch (e) {
                      console.error('Failed to ABI-decode batch results:', e)
                    }
                  } else {
                    ;(txResult as ExecuteTransactionResult).msgExecReturnData = ethTxResponse.ret

                    if (msgExecResponseDecoder && ethTxResponse.ret) {
                      try {
                        ;(txResult as ExecuteTransactionResult).decodedMsgResponse =
                          msgExecResponseDecoder.decode(ethTxResponse.ret)
                      } catch (e) {
                        console.error('Failed to decode msgExec response:', e)
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Failed to decode msgExec results:', e)
            }
          }
        })
        .catch(() => { /* best-effort */ })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'
      onProgress?.({
        step: 'error',
        message,
        stepIndex: index,
      })
      throw err
    }
  }

  return results
}
