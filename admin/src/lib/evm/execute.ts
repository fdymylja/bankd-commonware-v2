'use client'

import { MSGEXEC_ABI, MSGEXEC_PRECOMPILE_ADDRESS } from '@bankd/shared/evm/precompile'
import { MsgEthereumTxResponse } from '@bankd/shared/proto/cosmos/evm/vm/v1/tx'
import { IndexedTx } from '@cosmjs/stargate'
import { QueryClient } from '@tanstack/react-query'
import {
  WaitForTransactionReceiptReturnType,
  WriteContractParameters,
} from '@wagmi/core'
import toast from 'react-hot-toast'
import {
  Abi,
  ContractFunctionArgs,
  ContractFunctionName,
  Hex,
  Narrow,
  bytesToHex,
  decodeAbiParameters,
  encodeFunctionData,
  hexToBytes,
  recoverAddress,
  toHex,
} from 'viem'

import { useCoSignModal } from '@/store/coSignModal'

import { makeWagmiConfig } from './wagmi'
import { DeployContractResult, writeEthContractAndWait } from './write'
import { chainConfig } from '../config'
import { queries } from '../cosmos'
import { getActiveWallet } from '../multisig/active-store'
import { savePendingSafeTx } from '../multisig/db'
import { getEVMAccount } from '../native-wallet/evm'
import {
  CREATE_CALL_ABI,
  CREATE_CALL_ADDRESS,
  type PendingSafeTx,
  type ProposedTransactionResult,
  type SafeCall,
  buildMultiSend,
  buildRawSafeTx,
  encodeInitCode,
  getSafeInfo,
  getSafeTxHash,
  predictCreate2Address,
  randomSalt,
  signSafeTxHash,
} from '../safe'
import { getErrorMessage } from '../utils'


type WagmiConfig = ReturnType<typeof makeWagmiConfig>

/**
 * A protobuf message type with decode capability.
 */
export type MsgExecProtoResponseDecoder<T = unknown> = {
  typeUrl: string
  decode: (data: Uint8Array) => T
}

/**
 * A protobuf message type with encoding capability for use with x/msgexec.
 */
export type MsgExecProtoEncoder<TMsg> = {
  typeUrl: string
  fromPartial: (partial: Partial<TMsg>) => TMsg
  toProto: (message: TMsg) => Uint8Array
}

// ============================================================================
// EVM Transaction Step (for direct contract calls)
// ============================================================================

/**
 * A transaction step for direct EVM contract calls with full type safety
 * for the ABI, function name, and args.
 */
export type EvmTransactionStep<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<
    TAbi,
    'nonpayable' | 'payable'
  > = ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  > = ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName>,
  TMsgExecParsed = unknown,
> = WriteContractParameters<TAbi, TFunctionName, TArgs, WagmiConfig> & {
  /**
   * The message to display when the TX is successful.
   */
  successMessage: string
  /**
   * How many confirmations to wait for. Defaults to 3 for the last transaction 
    (or if there is only one), and 1 for all preceding.
   */
  confirmations?: number
  /**
   * An optional callback with the transaction hash and index.
   */
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
  /**
   * Existing toast ID to update.
   */
  toastId?: string
  /**
   * If using x/msgexec precompile directly, provide a protobuf decoder to automatically
   * parse the response data.
   */
  msgExecResponseDecoder?: MsgExecProtoResponseDecoder<TMsgExecParsed>
}

// ============================================================================
// Deploy Contract Step (for contract deployments)
// ============================================================================

/**
 * A transaction step for deploying a new contract.
 */
export type DeployContractStep<
  TAbi extends Abi | readonly unknown[] = Abi,
  TArgs extends readonly unknown[] = readonly unknown[],
> = {
  /**
   * The contract ABI.
   */
  abi: TAbi
  /**
   * The contract bytecode.
   */
  bytecode: `0x${string}`
  /**
   * Constructor arguments for the contract.
   */
  args?: TArgs
  /**
   * Optional CREATE2 salt. Provide it (with `predictCreate2Address`) when a
   * later step in the same batch needs the address up front - e.g. deploy +
   * register in one Safe MultiSend. Omitted, a random salt is used.
   */
  salt?: `0x${string}`
  /**
   * The message to display when the TX is successful.
   */
  successMessage: string
  /**
   * How many confirmations to wait for.
   */
  confirmations?: number
  /**
   * An optional callback with the transaction hash and index.
   */
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
  /**
   * An optional callback with the deployed contract address.
   */
  onContractDeployed?: (address: `0x${string}`) => void
  /**
   * Existing toast ID to update.
   */
  toastId?: string
}

// ============================================================================
// MsgExec Transaction Step (for Cosmos SDK message execution)
// ============================================================================

/**
 * A simplified transaction step for x/msgexec precompile calls.
 * Automatically handles encoding and wraps with the precompile address/ABI.
 *
 * @example
 * {
 *   msg: MsgTransfer,
 *   values: {
 *     sourcePort: 'transfer',
 *     sourceChannel: 'channel-0',
 *     token: { denom: 'uatom', amount: '1000000' },
 *     sender: 'cosmos1...',
 *     receiver: 'cosmos1...',
 *   },
 *   response: MsgTransferResponse,
 *   successMessage: 'IBC transfer initiated!',
 * }
 */
export type MsgExecStep<TMsg = unknown, TResponse = unknown> = {
  /**
   * The protobuf message encoder (e.g., MsgTransfer, MsgSend).
   */
  msg: MsgExecProtoEncoder<TMsg>
  /**
   * The values to encode into the message. Typed based on the msg encoder.
   */
  values: Partial<TMsg>
  /**
   * Optional protobuf decoder for the response message.
   */
  response?: MsgExecProtoResponseDecoder<TResponse>
  /**
   * The message to display when the TX is successful.
   */
  successMessage: string
  /**
   * How many confirmations to wait for.
   */
  confirmations?: number
  /**
   * An optional callback with the transaction hash and index.
   */
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
  /**
   * Existing toast ID to update.
   */
  toastId?: string
}

// ============================================================================
// MsgExec Batch Transaction Step (for batched Cosmos SDK message execution)
// ============================================================================

/**
 * A single message in a batch execution.
 */
export type MsgExecBatchMessage<TMsg = unknown, TResponse = unknown> = {
  /**
   * The protobuf message encoder (e.g., MsgTransfer, MsgSend).
   */
  msg: MsgExecProtoEncoder<TMsg>
  /**
   * The values to encode into the message. Typed based on the msg encoder.
   */
  values: Partial<TMsg>
  /**
   * Optional protobuf decoder for the response message.
   */
  response?: MsgExecProtoResponseDecoder<TResponse>
}

/**
 * A transaction step for batched x/msgexec precompile calls.
 * Executes multiple Cosmos SDK messages in a single EVM transaction.
 *
 * @example
 * {
 *   msgs: [
 *     {
 *       msg: MsgSend,
 *       values: { fromAddress: '...', toAddress: '...', amount: [...] },
 *       response: MsgSendResponse,
 *     },
 *     {
 *       msg: MsgTransfer,
 *       values: { sourcePort: 'transfer', ... },
 *       response: MsgTransferResponse,
 *     },
 *   ],
 *   successMessage: 'Batch executed!',
 * }
 */
export type MsgExecBatchStep<
  TMsgs extends MsgExecBatchMessage[] = MsgExecBatchMessage[],
> = {
  /**
   * The messages to execute in a batch.
   */
  msgs: TMsgs
  /**
   * The message to display when the TX is successful.
   */
  successMessage: string
  /**
   * How many confirmations to wait for.
   */
  confirmations?: number
  /**
   * An optional callback with the transaction hash and index.
   */
  onTransactionSent?: (hash: `0x${string}`, index: number) => void
  /**
   * Existing toast ID to update.
   */
  toastId?: string
}

/**
 * Union type for all supported transaction step formats.
 */
export type TransactionStep =
  | EvmTransactionStep
  | MsgExecStep
  | MsgExecBatchStep
  | DeployContractStep

/**
 * Type guard to check if a step is a MsgExecStep (single message).
 */
const isMsgExecStep = (step: TransactionStep): step is MsgExecStep =>
  'msg' in step && 'values' in step && !('msgs' in step)

/**
 * Type guard to check if a step is a MsgExecBatchStep (multiple messages).
 */
const isMsgExecBatchStep = (step: TransactionStep): step is MsgExecBatchStep =>
  'msgs' in step && Array.isArray((step as MsgExecBatchStep).msgs)

/**
 * Type guard to check if a step is a DeployContractStep.
 */
const isDeployContractStep = (
  step: TransactionStep
): step is DeployContractStep =>
  'bytecode' in step && !('address' in step)

/**
 * Convert a MsgExecStep to the EVM call format.
 */
const convertMsgExecStep = (step: MsgExecStep): EvmTransactionStep => {
  const { msg, values, ...rest } = step
  const encodedMsg = msg.toProto(msg.fromPartial(values))

  return {
    address: MSGEXEC_PRECOMPILE_ADDRESS,
    abi: MSGEXEC_ABI,
    functionName: 'execute',
    args: [msg.typeUrl, bytesToHex(encodedMsg)],
    ...rest,
  }
}

/**
 * Convert a MsgExecBatchStep to the EVM call format.
 */
const convertMsgExecBatchStep = (
  step: MsgExecBatchStep
): EvmTransactionStep & { _batchMsgs: MsgExecBatchMessage[] } => {
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
    // Store the original msgs for response decoding
    _batchMsgs: msgs,
    ...rest,
  }
}

/**
 * The result of an executed transaction.
 */
export type ExecuteTransactionResult<TMsgExecParsed = unknown> =
  WaitForTransactionReceiptReturnType<WagmiConfig> & {
    /**
     * The Cosmos transaction that was executed as a result of the EVM transaction.
     */
    cosmosTx?: IndexedTx | null
    /**
     * The return data from x/msgexec precompile execution, if any.
     */
    msgExecReturnData?: Uint8Array
    /**
     * The decoded message response type from x/msgexec precompile execution.
     * Only present if `response`/`msgExecResponseDecoder` was provided and decoding succeeded.
     */
    decodedMsgResponse?: TMsgExecParsed
  }

/**
 * The result of a batch executed transaction.
 */
export type ExecuteBatchTransactionResult<
  TDecodedResponses extends unknown[] = unknown[],
> = WaitForTransactionReceiptReturnType<WagmiConfig> & {
  /**
   * The Cosmos transaction that was executed as a result of the EVM transaction.
   */
  cosmosTx?: IndexedTx | null
  /**
   * The return data array from x/msgexec batch precompile execution.
   */
  msgExecReturnData?: Uint8Array[]
  /**
   * The decoded message responses from x/msgexec batch precompile execution.
   * Each element corresponds to the response of the message at the same index.
   */
  decodedMsgResponses?: TDecodedResponses
}

/**
 * The result of a deployed contract.
 */
export type DeployTransactionResult = DeployContractResult & {
  /**
   * The Cosmos transaction that was executed as a result of the EVM transaction.
   */
  cosmosTx?: IndexedTx | null
}

/**
 * Extracts the decoded response types from a batch step's msgs array.
 */
type ExtractBatchResponseTypes<TMsgs extends readonly unknown[]> =
  TMsgs extends readonly [...infer TItems]
    ? {
        [K in keyof TItems]: TItems[K] extends {
          response: MsgExecProtoResponseDecoder<infer TResponse>
        }
          ? TResponse
          : unknown
      }
    : unknown[]

/**
 * Maps a tuple of steps to their corresponding result types,
 * extracting the parsed type from each step's response/msgExecResponseDecoder.
 */
type MapStepsToResults<T extends readonly unknown[]> = {
  [K in keyof T]: T[K] extends { bytecode: `0x${string}` }
    ? DeployTransactionResult
    : T[K] extends { msgs: infer TMsgs extends readonly unknown[] }
      ? ExecuteBatchTransactionResult<ExtractBatchResponseTypes<TMsgs>>
      : T[K] extends
            | { response: MsgExecProtoResponseDecoder<infer TParsed> }
            | { msgExecResponseDecoder: MsgExecProtoResponseDecoder<infer TParsed> }
        ? ExecuteTransactionResult<TParsed>
        : ExecuteTransactionResult
}

/**
 * Validates EVM steps - extracts ABI to constrain functionName and args.
 */
type ValidateEvmStep<T> = T extends {
  abi: infer TAbi extends Abi | readonly unknown[]
}
  ? EvmTransactionStep<
      TAbi,
      T extends { functionName: infer TFn }
        ? TFn extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>
          ? TFn
          : ContractFunctionName<TAbi, 'nonpayable' | 'payable'>
        : ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
      T extends { args: infer TArgs }
        ? TArgs extends ContractFunctionArgs<
            TAbi,
            'nonpayable' | 'payable',
            T extends { functionName: infer TFn }
              ? TFn extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>
                ? TFn
                : never
              : never
          >
          ? TArgs
          : ContractFunctionArgs<
              TAbi,
              'nonpayable' | 'payable',
              ContractFunctionName<TAbi, 'nonpayable' | 'payable'>
            >
        : ContractFunctionArgs<
            TAbi,
            'nonpayable' | 'payable',
            ContractFunctionName<TAbi, 'nonpayable' | 'payable'>
          >
    >
  : EvmTransactionStep

/**
 * Extracts the message type from a MsgExecEncoder.
 */
type ExtractMsgType<T> =
  T extends MsgExecProtoEncoder<infer TMsg> ? TMsg : unknown

/**
 * Validates MsgExec steps - extracts msg type to constrain values.
 */
type ValidateMsgExecStep<T> = T extends { msg: infer TEncoder }
  ? MsgExecStep<
      ExtractMsgType<TEncoder>,
      T extends { response: MsgExecProtoResponseDecoder<infer TResponse> }
        ? TResponse
        : unknown
    >
  : MsgExecStep

/**
 * Validates a single batch message.
 */
type ValidateBatchMessage<T> = T extends { msg: infer TEncoder }
  ? MsgExecBatchMessage<
      ExtractMsgType<TEncoder>,
      T extends { response: MsgExecProtoResponseDecoder<infer TResponse> }
        ? TResponse
        : unknown
    >
  : MsgExecBatchMessage

/**
 * Validates all messages in a batch step.
 */
type ValidateBatchMessages<T extends readonly unknown[]> = {
  [K in keyof T]: ValidateBatchMessage<T[K]>
}

/**
 * Validates MsgExecBatch steps - extracts msg types to constrain values.
 */
type ValidateMsgExecBatchStep<T> = T extends {
  msgs: infer TMsgs extends readonly unknown[]
}
  ? MsgExecBatchStep<ValidateBatchMessages<TMsgs> & MsgExecBatchMessage[]>
  : MsgExecBatchStep

/**
 * Validates deploy contract steps - extracts ABI to constrain constructor args.
 */
type ValidateDeployStep<T> = T extends {
  abi: infer TAbi extends Abi | readonly unknown[]
  args?: infer TArgs extends readonly unknown[]
}
  ? DeployContractStep<TAbi, TArgs>
  : DeployContractStep

/**
 * Validates and narrows each step in a tuple.
 * Handles EVM steps (with abi + address), MsgExec steps (with msg), MsgExecBatch steps (with msgs),
 * and deploy steps (with bytecode).
 */
type ValidateSteps<T extends readonly unknown[]> = {
  [K in keyof T]: T[K] extends { msgs: readonly unknown[] }
    ? ValidateMsgExecBatchStep<T[K]>
    : T[K] extends { msg: { typeUrl: string }; values: unknown }
      ? ValidateMsgExecStep<T[K]>
      : T[K] extends { bytecode: `0x${string}` }
        ? ValidateDeployStep<T[K]>
        : ValidateEvmStep<T[K]>
}

/**
 * Base constraint for transaction steps.
 * Steps can be either EVM contract calls (with `abi`), MsgExec calls (with `msg`),
 * MsgExecBatch calls (with `msgs`), or deploy contract steps (with `bytecode`).
 */
type BaseTransactionStep =
  | {
      abi: Narrow<Abi | readonly unknown[]>
      address: `0x${string}`
      successMessage: string
      confirmations?: number
      onTransactionSent?: (hash: `0x${string}`, index: number) => void
      toastId?: string
      msgExecResponseDecoder?: MsgExecProtoResponseDecoder<unknown>
    }
  | {
      msg: { typeUrl: string }
      values: unknown
      response?: MsgExecProtoResponseDecoder<unknown>
      successMessage: string
      confirmations?: number
      onTransactionSent?: (hash: `0x${string}`, index: number) => void
      toastId?: string
    }
  | {
      msgs: readonly {
        msg: { typeUrl: string }
        values: unknown
        response?: MsgExecProtoResponseDecoder<unknown>
      }[]
      successMessage: string
      confirmations?: number
      onTransactionSent?: (hash: `0x${string}`, index: number) => void
      toastId?: string
    }
  | {
      abi: Narrow<Abi | readonly unknown[]>
      bytecode: `0x${string}`
      args?: readonly unknown[]
      salt?: `0x${string}`
      successMessage: string
      confirmations?: number
      onTransactionSent?: (hash: `0x${string}`, index: number) => void
      onContractDeployed?: (address: `0x${string}`) => void
      toastId?: string
    }

// ============================================================================
// Safe proposal path (app-wide Safe signer abstraction)
// ============================================================================

/**
 * A deploy step as a CreateCall.performCreate2 call. A random salt makes the
 * address deterministic up front (`deployedAddress`), so both signers deploy the
 * same way: the personal path broadcasts `write`, a Safe batches it into a
 * proposal, and either way the address is known before the tx runs. The CREATE2
 * deployer is CreateCall itself (see src/lib/safe/deploy.ts).
 */
const create2DeployParams = (step: DeployContractStep) => {
  const initCode = encodeInitCode({
    abi: step.abi as Abi,
    bytecode: step.bytecode,
    args: (step.args ?? []) as readonly unknown[],
  })
  const salt = step.salt ?? randomSalt()
  return {
    deployedAddress: predictCreate2Address(initCode, salt),
    write: {
      abi: CREATE_CALL_ABI,
      address: CREATE_CALL_ADDRESS,
      functionName: 'performCreate2' as const,
      args: [0n, initCode, salt] as const,
    },
  }
}

/**
 * Encode any step to a single EVM call the Safe can make. Deploys route through
 * CreateCall.performCreate2 (the address is deterministic up front, returned as
 * `deployedAddress`); MsgExec (single or batch) collapses to one precompile
 * call; plain EVM steps encode directly. The result is one `SafeCall`, so N
 * steps become N calls that get batched into one MultiSend proposal.
 */
const encodeStepToCall = (
  step: TransactionStep
): { call: SafeCall; deployedAddress?: Hex } => {
  if (isDeployContractStep(step)) {
    const { deployedAddress, write } = create2DeployParams(step)
    const data = encodeFunctionData({
      abi: write.abi,
      functionName: write.functionName,
      args: write.args,
    })
    return { call: { to: CREATE_CALL_ADDRESS as Hex, value: '0', data }, deployedAddress }
  }
  const evmStep = isMsgExecBatchStep(step)
    ? convertMsgExecBatchStep(step)
    : isMsgExecStep(step)
      ? convertMsgExecStep(step)
      : (step as EvmTransactionStep)
  const data = encodeFunctionData({
    abi: evmStep.abi as Abi,
    functionName: evmStep.functionName,
    args: evmStep.args as readonly unknown[],
  })
  return {
    call: {
      to: evmStep.address as Hex,
      value: ((evmStep as { value?: bigint }).value ?? 0n).toString(),
      data,
    },
  }
}

/**
 * Best-effort initiator signature over a Safe tx hash, keyed by the recovered
 * owner address (lowercased) so it slots straight into a PendingSafeTx's
 * `signatures` map. Returns `{}` if the wallet is locked / has no key - the
 * initiator can still sign manually from the modal.
 */
const initiatorSignature = async (
  safeTxHash: Hex
): Promise<Record<string, Hex>> => {
  try {
    const key = getEVMAccount().getHdKey().privateKey
    if (!key) return {}
    const signature = await signSafeTxHash(safeTxHash, toHex(key))
    const signer = await recoverAddress({ hash: safeTxHash, signature })
    return { [signer.toLowerCase()]: signature }
  } catch {
    return {}
  }
}

/**
 * A Safe is active: turn one or more steps into a single Safe proposal instead
 * of broadcasting. One step becomes a plain Safe call; several steps batch into
 * one atomic MultiSend so it's still one signing round. Deploys route through
 * CreateCall. Enqueues a PendingSafeTx, opens the global co-sign modal, and
 * returns the `proposed` sentinel.
 */
const proposeViaSafe = async (
  txs: readonly TransactionStep[],
  safe: { safeId: string; safeAddress: Hex },
  toastId: string
): Promise<readonly ProposedTransactionResult[]> => {
  if (txs.length === 0) throw new Error('No transaction to propose')

  const encoded = txs.map(encodeStepToCall)
  const calls = encoded.map((e) => e.call)
  // Live nonce + threshold: nonce anchors the SafeTx (stale-nonce guard at
  // execute), threshold drives the "N signatures needed" toast.
  const info = await getSafeInfo(safe.safeAddress)
  const safeTx =
    calls.length === 1
      ? buildRawSafeTx({ ...calls[0], nonce: info.nonce })
      : buildMultiSend({ calls, nonce: info.nonce })
  const safeTxHash = await getSafeTxHash(safe.safeAddress, safeTx)

  // Auto-sign as the initiator (best-effort), mirroring the /multisig propose
  // card, so the co-sign modal opens at 1/N instead of 0/N. If the wallet is
  // locked we just skip and the initiator signs manually in the modal.
  const signatures = await initiatorSignature(safeTxHash)

  const pending: PendingSafeTx = {
    id: crypto.randomUUID(),
    safeId: safe.safeId,
    safeAddress: safe.safeAddress,
    chainId: chainConfig.evmChainId,
    safeTx,
    safeTxHash,
    nonce: info.nonce,
    summary: txs
      .map((t) => (t as { successMessage?: string }).successMessage)
      .filter(Boolean)
      .join(' + '),
    signatures,
    createdAt: Date.now(),
  }
  // Bypass createPendingSafeTx (a hook) and write straight to the store; the
  // co-sign modal calls refresh() after sign/execute so /multisig catches up.
  await savePendingSafeTx(pending)
  useCoSignModal.getState().open(pending)
  const remaining = Math.max(0, info.threshold - Object.keys(signatures).length)
  toast.success(
    remaining === 0
      ? 'Proposed - ready to execute'
      : `Proposed - ${remaining} more signature${remaining === 1 ? '' : 's'} needed`,
    { id: toastId }
  )
  // One result per input step (same pending tx), so a caller can read a deploy
  // step's predicted address by index just like the broadcast path.
  return encoded.map((e) => ({
    status: 'proposed' as const,
    pendingSafeTxId: pending.id,
    ...(e.deployedAddress ? { contractAddress: e.deployedAddress } : {}),
  }))
}

/**
 * True when `executeTx` raised a Safe proposal instead of broadcasting. Handlers
 * that read a broadcast result (deployed address, tx hash, decoded response)
 * should check this first and early-return: the tx executes later from the
 * co-sign modal, so there's no synchronous result to read.
 */
/**
 * Read the deployed contract address from an `executeTx` result at `index`,
 * regardless of path: the broadcast `DeployTransactionResult` and the Safe
 * `ProposedTransactionResult` (predicted CREATE2 address) both carry it. Lets a
 * deploy handler save the address without branching on the active wallet.
 */
export function deployedAddress(
  result: readonly unknown[],
  index = 0
): Hex | undefined {
  const step = result[index] as { contractAddress?: Hex } | undefined
  return step?.contractAddress
}

export function isProposedResult(
  result: readonly unknown[]
): result is readonly ProposedTransactionResult[] {
  return (
    Array.isArray(result) &&
    result.length > 0 &&
    typeof result[0] === 'object' &&
    result[0] !== null &&
    (result[0] as { status?: unknown }).status === 'proposed'
  )
}

/**
 * Narrow an `executeTx` result off the `proposed` sentinel. Class B/C handlers
 * gate on an active Safe before ever calling `executeTx`, so at runtime their
 * results are always the broadcast path - this satisfies tsc (the return type is
 * a union) and throws loudly if a gate is ever missed.
 */
export function assertBroadcast<T>(
  result: T
): asserts result is Exclude<T, ProposedTransactionResult> {
  if (
    typeof result === 'object' &&
    result !== null &&
    (result as { status?: unknown }).status === 'proposed'
  ) {
    throw new Error('Not supported for Safe wallets')
  }
}

/**
 * Execute 1 or more transactions and display toasts as they are pending and execute/fail.
 *
 * Supports four step formats:
 * 1. **EVM steps**: Direct contract calls with `abi`, `address`, `functionName`, `args`
 * 2. **MsgExec steps**: Cosmos SDK messages with `msg` and `values` (auto-wrapped with precompile)
 * 3. **MsgExecBatch steps**: Multiple Cosmos SDK messages with `msgs` array (executed atomically)
 * 4. **Deploy steps**: Contract deployments with `abi`, `bytecode`, and optional `args`
 *
 * @example
 * // EVM contract call
 * executeTx(queryClient, {
 *   abi: erc20Abi,
 *   address: '0x...',
 *   functionName: 'approve',
 *   args: [spender, amount],
 *   successMessage: 'Approved!',
 * })
 *
 * @example
 * // MsgExec call (simplified)
 * executeTx(queryClient, {
 *   msg: MsgTransfer,
 *   values: {
 *     sourcePort: 'transfer',
 *     sourceChannel: 'channel-0',
 *     token: { denom: 'uatom', amount: '1000000' },
 *     sender: 'cosmos1...',
 *     receiver: 'cosmos1...',
 *   },
 *   response: MsgTransferResponse,
 *   successMessage: 'IBC transfer initiated!',
 * })
 *
 * @example
 * // MsgExecBatch call (multiple messages in one tx)
 * const [batchResult] = await executeTx(queryClient, {
 *   msgs: [
 *     {
 *       msg: MsgSend,
 *       values: { fromAddress: '...', toAddress: '...', amount: [...] },
 *       response: MsgSendResponse,
 *     },
 *     {
 *       msg: MsgTransfer,
 *       values: { sourcePort: 'transfer', sourceChannel: 'channel-0', ... },
 *       response: MsgTransferResponse,
 *     },
 *   ],
 *   successMessage: 'Batch executed!',
 * })
 * // batchResult.decodedMsgResponses is [MsgSendResponse, MsgTransferResponse]
 *
 * @example
 * // Deploy contract
 * const [deployResult] = await executeTx(queryClient, {
 *   abi: MyContract.abi,
 *   bytecode: MyContract.bytecode,
 *   args: [constructorArg1, constructorArg2],
 *   successMessage: 'Contract deployed!',
 *   onContractDeployed: (address) => console.log('Deployed at:', address),
 * })
 * console.log('Contract address:', deployResult.contractAddress)
 */
export const executeTx = async <const T extends readonly BaseTransactionStep[]>(
  queryClient: QueryClient,
  ...txs: ValidateSteps<T> & T
): Promise<MapStepsToResults<T> | readonly ProposedTransactionResult[]> => {
  const wagmiConfig = makeWagmiConfig()
  const toastId = txs[0]?.toastId ?? toast.loading('Preparing transaction...')

  // App-wide Safe: if a Safe is the active wallet, propose instead of broadcast.
  const active = getActiveWallet()
  if (active.kind === 'safe') {
    try {
      return await proposeViaSafe(
        txs as unknown as readonly TransactionStep[],
        { safeId: active.safeId, safeAddress: active.safeAddress },
        toastId
      )
    } catch (err) {
      toast.error(getErrorMessage(err, 'Proposal failed'), { id: toastId })
      throw err
    }
  }

  const results: (
    | ExecuteTransactionResult
    | ExecuteBatchTransactionResult
    | DeployTransactionResult
  )[] = []
  for (const [index, step] of txs.entries()) {
    const stepAsTransactionStep = step as TransactionStep
    const isDeployStep = isDeployContractStep(stepAsTransactionStep)
    const isBatchStep = isMsgExecBatchStep(stepAsTransactionStep)

    // Convert MsgExecStep or MsgExecBatchStep to EVM format if needed
    const evmStep: EvmTransactionStep | DeployContractStep = isBatchStep
      ? convertMsgExecBatchStep(stepAsTransactionStep as MsgExecBatchStep)
      : isMsgExecStep(stepAsTransactionStep)
        ? convertMsgExecStep(stepAsTransactionStep as unknown as MsgExecStep)
        : (stepAsTransactionStep as EvmTransactionStep | DeployContractStep)

    // Store batch msgs for later response decoding
    const batchMsgs = isBatchStep
      ? (evmStep as ReturnType<typeof convertMsgExecBatchStep>)._batchMsgs
      : undefined

    const {
      successMessage,
      confirmations: _confirmations,
      onTransactionSent,
      ...rest
    } = evmStep
    const confirmations =
      _confirmations ??
      // On localhost, just wait for 1 confirmation.
      (wagmiConfig.chains.length === 1 && wagmiConfig.chains[0].id === 31337
        ? 1
        : // Use 1 for all preceding transactions, and 1 for the last one.
          index < txs.length - 1
          ? 1
          : 1)

    toast.loading('Waiting for approval...', { id: toastId })

    try {
      let txResult:
        | ExecuteTransactionResult
        | ExecuteBatchTransactionResult
        | DeployTransactionResult

      if (isDeployStep) {
        // Deploy via CreateCall.performCreate2 so the address is deterministic
        // and matches the Safe path (see create2DeployParams). The tx is a plain
        // CALL, so the receipt has no contractAddress - we use the predicted one.
        const { onContractDeployed } = rest as DeployContractStep
        const { deployedAddress, write } = create2DeployParams(
          rest as DeployContractStep
        )
        const receipt = await writeEthContractAndWait(write as any, {
          confirmations,
          onTransactionSent: (hash) => {
            onTransactionSent?.(hash, index)
            toast.loading(
              `Deploying contract. Waiting for ${confirmations} more confirmation${confirmations === 1 ? '' : 's'}...`,
              {
                id: toastId,
              }
            )
          },
          onConfirmation: (confirmed) => {
            const remainingConfirmations = confirmations - confirmed
            toast.loading(
              `Deploying contract. Waiting for ${
                remainingConfirmations
              } more confirmation${remainingConfirmations === 1 ? '' : 's'}...`,
              {
                id: toastId,
              }
            )
          },
        })
        const deployResult = {
          ...receipt,
          contractAddress: deployedAddress,
        } as DeployTransactionResult
        onContractDeployed?.(deployedAddress)
        txResult = deployResult
      } else {
        // Handle regular EVM call step
        txResult = await writeEthContractAndWait(rest as any, {
          confirmations,
          onTransactionSent: (hash) => {
            onTransactionSent?.(hash, index)
            toast.loading(
              `Transaction sent. Waiting for ${confirmations} more confirmation${confirmations === 1 ? '' : 's'}...`,
              {
                id: toastId,
              }
            )
          },
          onConfirmation: (confirmed) => {
            const remainingConfirmations = confirmations - confirmed
            toast.loading(
              `Transaction sent. Waiting for ${
                remainingConfirmations
              } more confirmation${remainingConfirmations === 1 ? '' : 's'}...`,
              {
                id: toastId,
              }
            )
          },
        })
      }

      // Should never happen since write/deploy functions should throw an error if the transaction is reverted.
      if (txResult.status === 'reverted') {
        throw new Error('Transaction reverted')
      }

      // Load Cosmos TX if it exists, silently fail if it doesn't.
      txResult.cosmosTx = await queryClient
        .fetchQuery({
          ...queries.tx.byEthereumHash(txResult.transactionHash),
          retry: 3,
          retryDelay: 500,
        })
        .catch(() => null)

      // Decode x/msgexec precompile execution results for EVM call steps (not deploy)
      if (!isDeployStep) {
        const { msgExecResponseDecoder, address } = rest as Omit<
          EvmTransactionStep,
          'successMessage' | 'confirmations' | 'onTransactionSent'
        >
        try {
          if (txResult.cosmosTx && address === MSGEXEC_PRECOMPILE_ADDRESS) {
            const txResponse = txResult.cosmosTx.msgResponses.find(
              (msgResponse) =>
                msgResponse.typeUrl === MsgEthereumTxResponse.typeUrl
            )
            if (txResponse) {
              const msgEthereumTxResponse = MsgEthereumTxResponse.decode(
                txResponse.value
              )

              if (isBatchStep && batchMsgs) {
                // Handle batch response decoding
                // The return data is ABI-encoded bytes[] which we need to decode
                try {
                  const [decodedResults] = decodeAbiParameters(
                    [{ type: 'bytes[]' }],
                    bytesToHex(msgEthereumTxResponse.ret)
                  ) as [`0x${string}`[]]

                  // Convert hex strings back to Uint8Array
                  const returnDataArray = decodedResults.map((hex) =>
                    hexToBytes(hex)
                  )

                  ;(txResult as ExecuteBatchTransactionResult).msgExecReturnData =
                    returnDataArray

                  // Decode each response using corresponding decoder
                  const decodedResponses: unknown[] = []
                  for (let i = 0; i < batchMsgs.length; i++) {
                    const msg = batchMsgs[i]
                    const returnData = returnDataArray[i]
                    if (msg.response && returnData) {
                      try {
                        decodedResponses.push(msg.response.decode(returnData))
                      } catch (decodeError) {
                        console.error(
                          `Failed to decode batch response at index ${i}:`,
                          decodeError
                        )
                        decodedResponses.push(undefined)
                      }
                    } else {
                      decodedResponses.push(undefined)
                    }
                  }
                  ;(
                    txResult as ExecuteBatchTransactionResult
                  ).decodedMsgResponses = decodedResponses
                } catch (abiDecodeError) {
                  console.error(
                    'Failed to ABI-decode batch results:',
                    abiDecodeError
                  )
                }
              } else {
                // Handle single message response decoding
                ;(txResult as ExecuteTransactionResult).msgExecReturnData =
                  msgEthereumTxResponse.ret

                // If a parser was provided, attempt to decode the return data
                if (
                  msgExecResponseDecoder &&
                  (txResult as ExecuteTransactionResult).msgExecReturnData
                ) {
                  try {
                    ;(txResult as ExecuteTransactionResult).decodedMsgResponse =
                      msgExecResponseDecoder.decode(
                        (txResult as ExecuteTransactionResult).msgExecReturnData!
                      )
                  } catch (error) {
                    console.error(
                      'Failed to decode x/msgexec precompile execution results for tx',
                      txResult.transactionHash,
                      txResult.cosmosTx?.msgResponses,
                      error
                    )
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(
            'Failed to decode x/msgexec precompile execution results for tx',
            txResult.transactionHash,
            txResult.cosmosTx?.msgResponses,
            error
          )
        }
      }

      results.push(txResult)
      toast.success(successMessage, { id: toastId })
    } catch (err) {
      console.error('Transaction failed:', err)
      toast.error(getErrorMessage(err, 'Transaction failed'), {
        id: toastId,
      })
      throw err
    }
  }

  return results as MapStepsToResults<T>
}
