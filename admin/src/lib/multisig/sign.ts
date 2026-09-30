// src/lib/multisig/sign.ts
/**
 * Amino sign-doc construction and eth_secp256k1 member signing.
 *
 * The eth_secp256k1 fix lives in `signAsMember`: the chain's ante verifies with
 * ECDSA over keccak256(signBytes) and raw `[R||S]` - NOT sha256, and no
 * trailing recovery byte. cosmjs's default signers hash with sha256, so we sign
 * by hand with viem.
 */

import type { AminoMsg, StdFee, StdSignDoc } from '@cosmjs/amino'
import { makeSignDoc, serializeSignDoc } from '@cosmjs/amino'
import { toBase64 } from '@cosmjs/encoding'
import type { EncodeObject } from '@cosmjs/proto-signing'
import { type Hex, hexToBytes, keccak256 } from 'viem'
import { sign } from 'viem/accounts'

import { getAminoTypes } from '@/lib/cosmos'

/** Inputs for {@link buildAminoSignDoc}. */
export interface BuildAminoSignDocInput {
  msgs: EncodeObject[]
  fee: StdFee
  memo: string
  chainId: string
  accountNumber: number
  sequence: number
}

/**
 * Build the amino StdSignDoc every member signs, plus its serialized bytes.
 * Uses the amino converters already registered in the shared cosmos client.
 */
export function buildAminoSignDoc(input: BuildAminoSignDocInput): {
  signDoc: StdSignDoc
  signBytes: Uint8Array
} {
  const aminoTypes = getAminoTypes()
  const aminoMsgs: AminoMsg[] = input.msgs.map((m) => aminoTypes.toAmino(m))
  const signDoc = makeSignDoc(
    aminoMsgs,
    input.fee,
    input.chainId,
    input.memo,
    input.accountNumber,
    input.sequence
  )
  return { signDoc, signBytes: serializeSignDoc(signDoc) }
}

/**
 * Sign the given sign-bytes as one multisig member.
 *
 * hash = keccak256(signBytes); {r,s} = ECDSA(hash, privKey); return base64(r||s).
 * The recovery byte (v) is dropped - the ante only wants the 64-byte [R||S].
 */
export async function signAsMember(
  signBytes: Uint8Array,
  privKeyHex: Hex
): Promise<string> {
  const hash = keccak256(signBytes)
  const signature = await sign({ hash, privateKey: privKeyHex })
  const r = hexToBytes(signature.r) // 32 bytes
  const s = hexToBytes(signature.s) // 32 bytes
  const rs = new Uint8Array(64)
  rs.set(r, 0)
  rs.set(s, 32)
  return toBase64(rs)
}
