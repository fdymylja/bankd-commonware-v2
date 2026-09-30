// src/lib/multisig/cosmos.ts
/**
 * Thin orchestration used by the multisig context: build an unsigned MsgSend
 * and broadcast an assembled tx. All raw tx assembly is hand-rolled with
 * cosmjs-types - the native wallet's EVM path is untouched.
 */

import { makeSignDoc, serializeSignDoc } from '@cosmjs/amino'
import { toBase64 } from '@cosmjs/encoding'
import type { EncodeObject } from '@cosmjs/proto-signing'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { Any } from 'cosmjs-types/google/protobuf/any'

import { chainConfig } from '@/lib/config'
import { getStargateClient } from '@/lib/cosmos'
import { hexToBech32, isValidHexAddress } from '@/lib/utils'

import {
  MSG_DEPLOY_SAFE_TYPE,
  aminoDeploySafe,
  encodeMsgDeploySafe,
} from './safe'
import { buildAminoSignDoc } from './sign'
import type { MultisigConfig, PendingMultisigTx } from './types'

/** Fixed fee/gas defaults (see plan: fixed, not editable in v1). */
export const DEFAULT_GAS = '200000'
export const DEFAULT_FEE_AMOUNT = '5000'
/**
 * DeploySafe runs the Gnosis Safe `setup()` inside the EVM, which is far heavier
 * than a plain bank send. 200k gas runs dry (broadcast code 11 = out of gas), so
 * the deploy tx gets its own generous limit - matches the CLI's `--gas 2000000`.
 */
export const DEPLOY_SAFE_GAS = '3000000'
const MSG_SEND_TYPE = '/cosmos.bank.v1beta1.MsgSend'

/** Inputs for {@link buildUnsignedSend}. */
export interface BuildUnsignedSendInput {
  multisig: MultisigConfig
  toAddress: string
  /** amount in base units (e.g. ubrl). */
  amount: string
  memo?: string
}

/**
 * Build a pending MsgSend from the multisig account. Reads accountNumber +
 * sequence from chain state - the multisig must be funded (exist on chain)
 * first, otherwise there is no account to sign for.
 */
export async function buildUnsignedSend(
  input: BuildUnsignedSendInput
): Promise<PendingMultisigTx> {
  const { multisig, amount } = input
  if (multisig.type !== 'cosmos-multisig' || !multisig.cosmosAddress) {
    throw new Error('Not a cosmos multisig wallet')
  }

  // bank MsgSend needs a bech32 recipient; accept a 0x EVM address too and
  // convert it (same 20 bytes) so a hex recipient doesn't fail as "invalid
  // to address" on broadcast.
  const toAddress = isValidHexAddress(input.toAddress.trim())
    ? hexToBech32(input.toAddress.trim() as `0x${string}`)
    : input.toAddress.trim()

  const client = await getStargateClient()
  const account = await client.getAccount(multisig.cosmosAddress)
  if (!account) {
    throw new Error(
      'Multisig account not found on chain - fund the multisig address first'
    )
  }

  const denom = chainConfig.denom
  const sendMsg: MsgSend = {
    fromAddress: multisig.cosmosAddress,
    toAddress,
    amount: [{ denom, amount }],
  }
  const msgs: EncodeObject[] = [{ typeUrl: MSG_SEND_TYPE, value: sendMsg }]

  const msgAny = Any.fromPartial({
    typeUrl: MSG_SEND_TYPE,
    value: MsgSend.encode(sendMsg).finish(),
  })
  const memo = input.memo ?? ''
  const bodyBytes = TxBody.encode(
    TxBody.fromPartial({ messages: [msgAny], memo })
  ).finish()

  const fee = {
    amount: [{ denom, amount: DEFAULT_FEE_AMOUNT }],
    gas: DEFAULT_GAS,
  }
  const { signDoc } = buildAminoSignDoc({
    msgs,
    fee,
    memo,
    chainId: chainConfig.chainId,
    accountNumber: account.accountNumber,
    sequence: account.sequence,
  })

  return {
    id: crypto.randomUUID(),
    multisigId: multisig.id,
    chainId: chainConfig.chainId,
    accountNumber: account.accountNumber,
    sequence: account.sequence,
    bodyBytesB64: toBase64(bodyBytes),
    fee: { amount: DEFAULT_FEE_AMOUNT, gas: DEFAULT_GAS },
    signDocJson: JSON.stringify(signDoc),
    signatures: {},
    summary: `Send ${amount}${denom} to ${toAddress}`,
    createdAt: Date.now(),
  }
}

/**
 * Build a pending MsgDeploySafe from the multisig account. The multisig is both
 * the sender and the address the Safe lands at, so this signs like any other
 * multisig tx. The account must exist on chain (be funded) first.
 */
export async function buildUnsignedDeploySafe(
  multisig: MultisigConfig
): Promise<PendingMultisigTx> {
  if (multisig.type !== 'cosmos-multisig' || !multisig.cosmosAddress) {
    throw new Error('Not a cosmos multisig wallet')
  }

  const client = await getStargateClient()
  const account = await client.getAccount(multisig.cosmosAddress)
  if (!account) {
    throw new Error(
      'Multisig account not found on chain - fund the multisig address first'
    )
  }

  const sender = multisig.cosmosAddress
  const msgAny = Any.fromPartial({
    typeUrl: MSG_DEPLOY_SAFE_TYPE,
    value: encodeMsgDeploySafe(sender),
  })
  const memo = ''
  const bodyBytes = TxBody.encode(
    TxBody.fromPartial({ messages: [msgAny], memo })
  ).finish()

  const denom = chainConfig.denom
  const fee = {
    amount: [{ denom, amount: DEFAULT_FEE_AMOUNT }],
    gas: DEPLOY_SAFE_GAS,
  }
  // Hand-build the amino sign-doc: no telescope amino converter for x/safe, so
  // the msg shape comes from ./safe instead of getAminoTypes().
  const aminoMsg = aminoDeploySafe(sender)
  const signDoc = makeSignDoc(
    [aminoMsg],
    fee,
    chainConfig.chainId,
    memo,
    account.accountNumber,
    account.sequence
  )
  // touch serializeSignDoc so an invalid doc fails here, not at sign time.
  serializeSignDoc(signDoc)

  return {
    id: crypto.randomUUID(),
    multisigId: multisig.id,
    chainId: chainConfig.chainId,
    accountNumber: account.accountNumber,
    sequence: account.sequence,
    bodyBytesB64: toBase64(bodyBytes),
    fee: { amount: DEFAULT_FEE_AMOUNT, gas: DEPLOY_SAFE_GAS },
    signDocJson: JSON.stringify(signDoc),
    signatures: {},
    summary: `Deploy Safe at ${sender}`,
    createdAt: Date.now(),
  }
}

/** Broadcast an assembled tx. Returns the delivery result (check `.code`). */
export async function broadcast(txBytes: Uint8Array) {
  const client = await getStargateClient()
  return client.broadcastTx(txBytes)
}
