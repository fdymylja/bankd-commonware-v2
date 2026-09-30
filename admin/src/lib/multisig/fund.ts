// src/lib/multisig/fund.ts
/**
 * Fund a multisig from the connected personal (native-wallet) account. This is a
 * plain single-signer bank send - the personal account signs for itself - so a
 * fresh multisig can be topped up from the UI before it can pay for anything
 * (deploy fees, sends). Assembled by hand like the multisig path so the pubkey
 * stays eth_secp256k1 and the signature stays raw [R||S].
 */

import { fromBase64, toBech32 } from '@cosmjs/encoding'
import type { EncodeObject } from '@cosmjs/proto-signing'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import { AuthInfo, SignerInfo, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { hexToBytes, toHex } from 'viem'

import { chainConfig } from '@/lib/config'
import { getStargateClient } from '@/lib/cosmos'
import { getEVMAccount } from '@/lib/native-wallet/evm'

import { DEFAULT_FEE_AMOUNT, DEFAULT_GAS, broadcast } from './cosmos'
import { memberPubkeyAny } from './pubkey'
import { buildAminoSignDoc, signAsMember } from './sign'

const MSG_SEND_TYPE = '/cosmos.bank.v1beta1.MsgSend'

/** Inputs for {@link fundFromPersonal}. */
export interface FundInput {
  /** bech32 recipient (the multisig). */
  toAddress: string
  /** amount in base units (e.g. ubrl). */
  amount: string
}

/**
 * Send `amount` base-denom from the personal account to `toAddress`, signed with
 * the native wallet's key. Returns the delivery result (check `.code`).
 */
export async function fundFromPersonal(input: FundInput) {
  const account = getEVMAccount()
  const hdKey = account.getHdKey()
  if (!hdKey.privateKey || !hdKey.publicKey) {
    throw new Error('No signing key available - unlock your wallet first')
  }
  const privHex = toHex(hdKey.privateKey)
  const pubkeyBytes = hdKey.publicKey // 33-byte compressed secp256k1
  const fromAddress = toBech32(
    chainConfig.bech32Prefix,
    hexToBytes(account.address as `0x${string}`)
  )

  const client = await getStargateClient()
  const acct = await client.getAccount(fromAddress)
  if (!acct) {
    throw new Error(
      'Your personal account is not on chain yet - it needs to be funded first'
    )
  }

  const denom = chainConfig.denom
  const sendMsg: MsgSend = {
    fromAddress,
    toAddress: input.toAddress,
    amount: [{ denom, amount: input.amount }],
  }
  const msgs: EncodeObject[] = [{ typeUrl: MSG_SEND_TYPE, value: sendMsg }]

  const memo = ''
  const fee = {
    amount: [{ denom, amount: DEFAULT_FEE_AMOUNT }],
    gas: DEFAULT_GAS,
  }
  const { signBytes } = buildAminoSignDoc({
    msgs,
    fee,
    memo,
    chainId: chainConfig.chainId,
    accountNumber: acct.accountNumber,
    sequence: acct.sequence,
  })
  const signatureB64 = await signAsMember(signBytes, privHex)

  const msgAny = Any.fromPartial({
    typeUrl: MSG_SEND_TYPE,
    value: MsgSend.encode(sendMsg).finish(),
  })
  const bodyBytes = TxBody.encode(
    TxBody.fromPartial({ messages: [msgAny], memo })
  ).finish()

  const signerInfo = SignerInfo.fromPartial({
    publicKey: memberPubkeyAny(pubkeyBytes),
    modeInfo: { single: { mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON } },
    sequence: BigInt(acct.sequence),
  })
  const authInfo = AuthInfo.fromPartial({
    signerInfos: [signerInfo],
    fee: {
      amount: [Coin.fromPartial({ denom, amount: DEFAULT_FEE_AMOUNT })],
      gasLimit: BigInt(DEFAULT_GAS),
    },
  })

  const txRaw = TxRaw.encode(
    TxRaw.fromPartial({
      bodyBytes,
      authInfoBytes: AuthInfo.encode(authInfo).finish(),
      signatures: [fromBase64(signatureB64)],
    })
  ).finish()

  return broadcast(txRaw)
}
