// src/lib/safe/tx.ts
/**
 * SafeTx builders. Each returns a fully-formed {@link SafeTx} against a given
 * Safe nonce; the caller computes the on-chain hash (see chain.ts) and stores
 * it. No secrets touch this file - it's pure encoding.
 *
 * Targets:
 *  - native send   -> to=recipient, data=0x
 *  - cosmos msg     -> to=MSGEXEC precompile, data=execute(typeUrl, protoBytes)
 *  - authority exec -> same, but the inner msg is wrapped in authority MsgExec
 *  - owner mgmt     -> to=Safe self, data=addOwnerWithThreshold|changeThreshold
 * All use operation=0 (CALL) and zero gas refund fields.
 */

import { BinaryReader, BinaryWriter } from 'cosmjs-types/binary'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { type Hex, concatHex, encodeFunctionData, encodePacked, size, toHex } from 'viem'

import {
  AUTHORITY_MODULE_ADDRESS,
  AUTHORITY_MSGEXEC_TYPE,
  CREATE_CALL_ABI,
  CREATE_CALL_ADDRESS,
  MSGEXEC_ABI,
  MSGEXEC_PRECOMPILE_ADDRESS,
  MULTISEND_ABI,
  MULTISEND_CALL_ONLY_ADDRESS,
  SAFE_ABI,
  ZERO_ADDRESS,
} from './abi'
import type { SafeTx } from './types'

const MSG_SEND_TYPE = '/cosmos.bank.v1beta1.MsgSend'

/** Fill the fixed no-refund defaults around a target + calldata. operation is 0
 * (CALL) for everything except a MultiSend batch, which needs 1 (DELEGATECALL). */
function baseSafeTx(input: {
  to: Hex
  value: string
  data: Hex
  nonce: string
  operation?: number
}): SafeTx {
  return {
    to: input.to,
    value: input.value,
    data: input.data,
    operation: input.operation ?? 0,
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce: input.nonce,
  }
}

/** One inner call for a MultiSend batch. */
export interface SafeCall {
  to: Hex
  /** wei, decimal string. */
  value: string
  data: Hex
}

/**
 * Pack calls into MultiSend's `transactions` blob. Each entry is
 * `operation(1) ++ to(20) ++ value(32) ++ dataLen(32) ++ data`, operation always
 * 0 (CALL) - MultiSendCallOnly rejects anything else.
 */
export function encodeMultiSendTransactions(calls: SafeCall[]): Hex {
  return concatHex(
    calls.map((c) =>
      encodePacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [0, c.to, BigInt(c.value), BigInt(size(c.data)), c.data]
      )
    )
  )
}

/**
 * Batch several calls into one atomic Safe tx via MultiSendCallOnly. The Safe
 * delegatecalls (operation=1) the library, which runs each sub-call with
 * msg.sender = the Safe. This is how a multi-step feature (approve + call)
 * becomes a single proposal / signing round.
 */
export function buildMultiSend(input: {
  calls: SafeCall[]
  nonce: string
}): SafeTx {
  const data = encodeFunctionData({
    abi: MULTISEND_ABI,
    functionName: 'multiSend',
    args: [encodeMultiSendTransactions(input.calls)],
  })
  return baseSafeTx({
    to: MULTISEND_CALL_ONLY_ADDRESS,
    value: '0',
    data,
    nonce: input.nonce,
    operation: 1,
  })
}

/**
 * Deploy a contract from the Safe via CreateCall.performCreate. The deployed
 * address isn't known until execution - read it from the ContractCreation event
 * on the execTransaction receipt.
 */
export function buildDeploy(input: {
  bytecode: Hex
  /** constructor value in wei, decimal string. */
  value: string
  nonce: string
}): SafeTx {
  const data = encodeFunctionData({
    abi: CREATE_CALL_ABI,
    functionName: 'performCreate',
    args: [BigInt(input.value), input.bytecode],
  })
  return baseSafeTx({
    to: CREATE_CALL_ADDRESS,
    value: '0',
    data,
    nonce: input.nonce,
  })
}

/**
 * Wrap an already-encoded EVM call (`to`/`value`/`data`) into a SafeTx. Used by
 * the app-wide signer abstraction (executeTx) which has already ABI-encoded a
 * feature step and just needs the fixed CALL / no-refund wrapper around it.
 */
export function buildRawSafeTx(input: {
  to: Hex
  /** wei, decimal string. */
  value: string
  data: Hex
  nonce: string
}): SafeTx {
  return baseSafeTx(input)
}

/** Native value transfer out of the Safe: plain send, no calldata. */
export function buildNativeSend(input: {
  to: Hex
  /** wei, decimal string. */
  valueWei: string
  nonce: string
}): SafeTx {
  return baseSafeTx({
    to: input.to,
    value: input.valueWei,
    data: '0x',
    nonce: input.nonce,
  })
}

/** Wrap an arbitrary proto-encoded cosmos msg into a `msgexec.execute` call. */
export function buildCosmosMsg(input: {
  typeUrl: string
  protoValue: Uint8Array
  nonce: string
}): SafeTx {
  const data = encodeFunctionData({
    abi: MSGEXEC_ABI,
    functionName: 'execute',
    args: [input.typeUrl, toHex(input.protoValue)],
  })
  return baseSafeTx({
    to: MSGEXEC_PRECOMPILE_ADDRESS as Hex,
    value: '0',
    data,
    nonce: input.nonce,
  })
}

/** A cosmos bank MsgSend from the Safe's own cosmos address, via msgexec. */
export function buildCosmosSend(input: {
  fromBech32: string
  toBech32: string
  denom: string
  /** base units, decimal string. */
  amount: string
  nonce: string
}): SafeTx {
  const msg: MsgSend = {
    fromAddress: input.fromBech32,
    toAddress: input.toBech32,
    amount: [{ denom: input.denom, amount: input.amount }],
  }
  return buildCosmosMsg({
    typeUrl: MSG_SEND_TYPE,
    protoValue: MsgSend.encode(msg).finish(),
    nonce: input.nonce,
  })
}

/**
 * Hand-encode an `authority.MsgExec`: field 1 = sender (string), field 2 = msg
 * (Any). No telescope binding for x/authority, so this is built by hand like
 * multisig/safe.ts's MsgDeploySafe. The inner msg's own signer field must be the
 * authority module address (see {@link AUTHORITY_MODULE_ADDRESS}).
 */
export function encodeAuthorityMsgExec(input: {
  sender: string
  innerTypeUrl: string
  innerValue: Uint8Array
}): Uint8Array {
  const anyBytes = Any.encode(
    Any.fromPartial({ typeUrl: input.innerTypeUrl, value: input.innerValue })
  ).finish()
  return new BinaryWriter()
    .uint32(10) // field 1, wire type 2
    .string(input.sender)
    .uint32(18) // field 2, wire type 2
    .bytes(anyBytes)
    .finish()
}

/** Decode an `authority.MsgExec` back to its parts. Used in tests. */
export function decodeAuthorityMsgExec(bytes: Uint8Array): {
  sender: string
  inner: Any
} {
  const r = new BinaryReader(bytes)
  let sender = ''
  let inner: Any | undefined
  while (r.pos < r.len) {
    const tag = r.uint32()
    switch (tag >>> 3) {
      case 1:
        sender = r.string()
        break
      case 2:
        inner = Any.decode(r.bytes())
        break
      default:
        r.skipType(tag & 7)
    }
  }
  if (!inner) throw new Error('MsgExec has no inner msg')
  return { sender, inner }
}

/**
 * Authority exec: run an inner SDK msg as the authority module, driven by the
 * Safe. Wraps the inner msg in `authority.MsgExec{sender: safeBech32}` then in a
 * `msgexec.execute` call. The inner msg must already carry the authority module
 * address as its signer.
 */
export function buildAuthorityExec(input: {
  safeBech32: string
  innerTypeUrl: string
  innerValue: Uint8Array
  nonce: string
}): SafeTx {
  const msgExecBytes = encodeAuthorityMsgExec({
    sender: input.safeBech32,
    innerTypeUrl: input.innerTypeUrl,
    innerValue: input.innerValue,
  })
  return buildCosmosMsg({
    typeUrl: AUTHORITY_MSGEXEC_TYPE,
    protoValue: msgExecBytes,
    nonce: input.nonce,
  })
}

/**
 * Authority exec demo: a bank MsgSend out of the authority module account,
 * proving the Safe can drive x/authority. Inner MsgSend.fromAddress is the
 * authority module address (its signer), so x/authority executes it as itself.
 */
export function buildAuthoritySend(input: {
  safeBech32: string
  toBech32: string
  denom: string
  /** base units, decimal string. */
  amount: string
  nonce: string
}): SafeTx {
  const inner: MsgSend = {
    fromAddress: AUTHORITY_MODULE_ADDRESS,
    toAddress: input.toBech32,
    amount: [{ denom: input.denom, amount: input.amount }],
  }
  return buildAuthorityExec({
    safeBech32: input.safeBech32,
    innerTypeUrl: MSG_SEND_TYPE,
    innerValue: MsgSend.encode(inner).finish(),
    nonce: input.nonce,
  })
}

/** Add an owner and set a new threshold, as a self-call on the Safe. */
export function buildAddOwner(input: {
  safeAddress: Hex
  owner: Hex
  threshold: number
  nonce: string
}): SafeTx {
  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'addOwnerWithThreshold',
    args: [input.owner, BigInt(input.threshold)],
  })
  return baseSafeTx({
    to: input.safeAddress,
    value: '0',
    data,
    nonce: input.nonce,
  })
}

/** Change the confirmation threshold, as a self-call on the Safe. */
export function buildChangeThreshold(input: {
  safeAddress: Hex
  threshold: number
  nonce: string
}): SafeTx {
  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'changeThreshold',
    args: [BigInt(input.threshold)],
  })
  return baseSafeTx({
    to: input.safeAddress,
    value: '0',
    data,
    nonce: input.nonce,
  })
}

/** The 10-tuple args for `getTransactionHash` / hashing, from a SafeTx. */
export function safeTxHashArgs(
  tx: SafeTx
): [Hex, bigint, Hex, number, bigint, bigint, bigint, Hex, Hex, bigint] {
  return [
    tx.to,
    BigInt(tx.value),
    tx.data,
    tx.operation,
    BigInt(tx.safeTxGas),
    BigInt(tx.baseGas),
    BigInt(tx.gasPrice),
    tx.gasToken,
    tx.refundReceiver,
    BigInt(tx.nonce),
  ]
}

/** The `execTransaction` args from a SafeTx plus concatenated signatures. */
export function safeTxExecArgs(
  tx: SafeTx,
  signatures: Hex
): [Hex, bigint, Hex, number, bigint, bigint, bigint, Hex, Hex, Hex] {
  return [
    tx.to,
    BigInt(tx.value),
    tx.data,
    tx.operation,
    BigInt(tx.safeTxGas),
    BigInt(tx.baseGas),
    BigInt(tx.gasPrice),
    tx.gasToken,
    tx.refundReceiver,
    signatures,
  ]
}
