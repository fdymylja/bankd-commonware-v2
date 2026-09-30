import assert from 'node:assert/strict'
import test from 'node:test'

import { LegacyAminoPubKey } from 'cosmjs-types/cosmos/crypto/multisig/keys'

import { deriveMultisigAddress, legacyAminoPubkeyAny } from './pubkey'
import {
  ETH_SECP256K1_PUBKEY_TYPE,
  LEGACY_AMINO_PUBKEY_TYPE,
  type MultisigMember,
} from './types'

// Golden vector from `bankd keys add ms --multisig k1,k2 --multisig-threshold 1`.
// Settles the LegacyAminoPubKey amino-marshal question empirically.
const K1: MultisigMember = {
  address: 'wallet1ceexaxnqn4j7spguvg3uzn83das7jqs349ah3x',
  pubkeyBase64: 'AwVvi0vlqc1Ki0j2WjpVeXeWvn7Mou/bfus6L27oXOCJ',
}
const K2: MultisigMember = {
  address: 'wallet1kr8jqg7ccukf9kaew73ccnf3rr6szn9plnk0ua',
  pubkeyBase64: 'AoHoZ0xFAuw3DnWb9/fV3d4zzJrfgezIcfvvP7OA+Pc/',
}
const GOLDEN_ADDR = 'wallet1gggcge52h74up04dlrldccwplwqjgxz094dpvx'

test('deriveMultisigAddress matches the CLI golden vector', () => {
  assert.equal(deriveMultisigAddress([K1, K2], 1), GOLDEN_ADDR)
})

test('deriveMultisigAddress is order-independent (sorts members like the CLI)', () => {
  assert.equal(deriveMultisigAddress([K2, K1], 1), GOLDEN_ADDR)
  assert.equal(deriveMultisigAddress([K1, K2], 1), deriveMultisigAddress([K2, K1], 1))
})

test('legacyAminoPubkeyAny wraps eth_secp256k1 members with the right typeUrls', () => {
  const any = legacyAminoPubkeyAny([K1, K2], 1)
  assert.equal(any.typeUrl, LEGACY_AMINO_PUBKEY_TYPE)
  const decoded = LegacyAminoPubKey.decode(any.value)
  assert.equal(decoded.threshold, 1)
  assert.equal(decoded.publicKeys.length, 2)
  for (const pk of decoded.publicKeys) {
    assert.equal(pk.typeUrl, ETH_SECP256K1_PUBKEY_TYPE)
  }
})
