// src/lib/safe/sign.ts
/**
 * Safe owner signing. Unlike the cosmos multisig path (multisig/sign.ts, which
 * drops the recovery byte), Safe's `checkSignatures` verifies with
 * `ecrecover(hash, v, r, s)` on the RAW hash - so we sign the hash directly (no
 * EIP-191 prefix) and KEEP v in {27,28}. Mirrors scripts/safe-exec.sh.
 */

import { type Hex, serializeSignature } from 'viem'
import { sign } from 'viem/accounts'

/**
 * Sign a Safe tx hash as one owner. Returns a 65-byte `r||s||v` signature hex,
 * v in {27,28} - the direct-ecrecover case `checkSignatures` accepts.
 */
export async function signSafeTxHash(
  safeTxHash: Hex,
  privKeyHex: Hex
): Promise<Hex> {
  const signature = await sign({ hash: safeTxHash, privateKey: privKeyHex })
  return serializeSignature(signature)
}

/**
 * Concatenate owner signatures for `execTransaction`. Safe requires them in
 * ascending owner-address order (case-insensitive), exactly like
 * safe-exec.sh:44-49. Each value is a 65-byte hex sig; the result is one
 * `0x`-prefixed blob.
 */
export function concatSignatures(sigsByOwner: Record<string, Hex>): Hex {
  const owners = Object.keys(sigsByOwner).sort((a, b) =>
    a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0
  )
  const body = owners.map((o) => sigsByOwner[o].slice(2)).join('')
  return `0x${body}`
}
