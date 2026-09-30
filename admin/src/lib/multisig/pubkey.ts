// src/lib/multisig/pubkey.ts
/**
 * Pure helpers to build eth_secp256k1 multisig pubkeys and derive the on-chain
 * address. All encoding is hand-built for eth_secp256k1 - we never go through
 * cosmjs's default (tendermint secp256k1 + sha256) pubkey helpers.
 *
 * The address derivation reproduces the SDK's `LegacyAminoPubKey.Address()` =
 * `sha256(AminoCdc.MustMarshal(pubkey))[:20]`. That amino-binary layout was
 * confirmed byte-for-byte against `bankd keys add --multisig` (see spike.test).
 */

import { fromBase64, fromBech32, toBech32 } from '@cosmjs/encoding'
import { LegacyAminoPubKey } from 'cosmjs-types/cosmos/crypto/multisig/keys'
import { PubKey as Secp256k1PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { sha256 } from 'viem'

import { chainConfig } from '@/lib/config'

import {
  ETH_SECP256K1_PUBKEY_TYPE,
  LEGACY_AMINO_PUBKEY_TYPE,
  type MultisigMember,
} from './types'

/** go-amino uvarint (used for small values: threshold, byte lengths). */
function uvarint(value: number): number[] {
  const out: number[] = []
  let n = value
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n)
  return out
}

/**
 * Sort members the same way the SDK CLI does: ascending by account address
 * bytes. Ordering must be identical in the address derivation and the AuthInfo
 * we broadcast, otherwise signatures verify against the wrong address.
 */
export function sortMembers(members: MultisigMember[]): MultisigMember[] {
  return [...members].sort((a, b) => {
    const da = fromBech32(a.address).data
    const db = fromBech32(b.address).data
    const len = Math.min(da.length, db.length)
    for (let i = 0; i < len; i++) {
      if (da[i] !== db[i]) return da[i] - db[i]
    }
    return da.length - db.length
  })
}

/**
 * A single member pubkey as a proto `Any`. Same wire layout as
 * `cosmos.crypto.secp256k1.PubKey` (one `bytes` field), only the typeUrl
 * differs - so we reuse the cosmjs-types secp256k1 encoder.
 */
export function memberPubkeyAny(pubkeyBytes: Uint8Array): Any {
  return Any.fromPartial({
    typeUrl: ETH_SECP256K1_PUBKEY_TYPE,
    value: Secp256k1PubKey.encode({ key: pubkeyBytes }).finish(),
  })
}

/**
 * The multisig pubkey as a proto `Any` (`LegacyAminoPubKey`). This is what goes
 * into `AuthInfo.SignerInfo.publicKey`. Members are sorted to match the derived
 * address.
 */
export function legacyAminoPubkeyAny(
  members: MultisigMember[],
  threshold: number
): Any {
  const sorted = sortMembers(members)
  const publicKeys = sorted.map((m) => memberPubkeyAny(fromBase64(m.pubkeyBase64)))
  const value = LegacyAminoPubKey.encode(
    LegacyAminoPubKey.fromPartial({ threshold, publicKeys })
  ).finish()
  return Any.fromPartial({ typeUrl: LEGACY_AMINO_PUBKEY_TYPE, value })
}

/** Amino multisig prefix (`22c1f7e2`) - fixed for tendermint/PubKeyMultisigThreshold. */
const MULTISIG_AMINO_PREFIX = [0x22, 0xc1, 0xf7, 0xe2]

/**
 * The amino-binary bytes the SDK hashes for the multisig address. Layout
 * (confirmed against the CLI):
 *   prefix(4) | 0x08 | uvarint(threshold) | per member: 0x12 uvarint(len) 0x21 key
 */
function multisigAminoBytes(
  members: MultisigMember[],
  threshold: number
): Uint8Array {
  const out: number[] = [...MULTISIG_AMINO_PREFIX, 0x08, ...uvarint(threshold)]
  for (const m of sortMembers(members)) {
    const key = fromBase64(m.pubkeyBase64)
    const body = [...uvarint(key.length), ...key]
    out.push(0x12, ...uvarint(body.length), ...body)
  }
  return Uint8Array.from(out)
}

/**
 * Derive the bech32 multisig address. Equals the address that
 * `bankd keys add --multisig` produces for the same members + threshold.
 */
export function deriveMultisigAddress(
  members: MultisigMember[],
  threshold: number
): string {
  const bytes = multisigAminoBytes(members, threshold)
  const hash = sha256(bytes, 'bytes') // Uint8Array
  return toBech32(chainConfig.bech32Prefix, hash.slice(0, 20))
}
