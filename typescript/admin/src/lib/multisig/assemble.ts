// src/lib/multisig/assemble.ts
/**
 * Hand-build the final multisig `TxRaw` from member signatures. Everything is
 * assembled with cosmjs-types so the pubkey typeUrl stays eth_secp256k1 and the
 * signatures stay raw `[R||S]` - none of cosmjs's `makeMultisignedTxBytes`.
 */

import { fromBase64 } from '@cosmjs/encoding'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { CompactBitArray , MultiSignature } from 'cosmjs-types/cosmos/crypto/multisig/v1beta1/multisig'
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import {
  AuthInfo,
  ModeInfo_Multi,
  SignerInfo,
  TxRaw,
} from 'cosmjs-types/cosmos/tx/v1beta1/tx'

import { legacyAminoPubkeyAny, sortMembers } from './pubkey'
import type { MultisigMember } from './types'

/** Inputs for {@link combineAndEncodeTx}. */
export interface CombineTxInput {
  members: MultisigMember[]
  threshold: number
  /** proto-encoded TxBody bytes. */
  bodyBytes: Uint8Array
  fee: { amount: string; gas: string; denom: string }
  sequence: number
  /** memberAddress -> base64 `[R||S]` signature. */
  signatures: Record<string, string>
}

/** Space-efficient bit array marking which members signed (MSB-first). */
function buildBitArray(signed: boolean[]): CompactBitArray {
  const n = signed.length
  const elems = new Uint8Array(Math.ceil(n / 8))
  for (let i = 0; i < n; i++) {
    if (signed[i]) {
      elems[i >> 3] |= 0x80 >> i % 8
    }
  }
  return CompactBitArray.fromPartial({ extraBitsStored: n % 8, elems })
}

/**
 * Combine member signatures into a broadcast-ready `TxRaw`. Members are sorted
 * to match the derived address; signatures and mode-infos follow that order.
 */
export function combineAndEncodeTx(input: CombineTxInput): Uint8Array {
  const sorted = sortMembers(input.members)
  const signed = sorted.map((m) => Boolean(input.signatures[m.address]))
  const orderedSigs = sorted
    .filter((m) => input.signatures[m.address])
    .map((m) => fromBase64(input.signatures[m.address]))

  const multi = ModeInfo_Multi.fromPartial({
    bitarray: buildBitArray(signed),
    modeInfos: orderedSigs.map(() => ({
      single: { mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON },
    })),
  })

  const signerInfo = SignerInfo.fromPartial({
    publicKey: legacyAminoPubkeyAny(input.members, input.threshold),
    modeInfo: { multi },
    sequence: BigInt(input.sequence),
  })

  const authInfo = AuthInfo.fromPartial({
    signerInfos: [signerInfo],
    fee: {
      amount: [Coin.fromPartial({ denom: input.fee.denom, amount: input.fee.amount })],
      gasLimit: BigInt(input.fee.gas),
    },
  })

  const multiSignature = MultiSignature.fromPartial({ signatures: orderedSigs })

  return TxRaw.encode(
    TxRaw.fromPartial({
      bodyBytes: input.bodyBytes,
      authInfoBytes: AuthInfo.encode(authInfo).finish(),
      signatures: [MultiSignature.encode(multiSignature).finish()],
    })
  ).finish()
}
