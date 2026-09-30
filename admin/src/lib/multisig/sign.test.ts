import assert from 'node:assert/strict'
import test from 'node:test'

import { fromBase64, toBase64 } from '@cosmjs/encoding'
import { LegacyAminoPubKey } from 'cosmjs-types/cosmos/crypto/multisig/keys'
import { MultiSignature } from 'cosmjs-types/cosmos/crypto/multisig/v1beta1/multisig'
import { AuthInfo, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { keccak256, sha256, toBytes } from 'viem'
import { sign } from 'viem/accounts'

import { combineAndEncodeTx } from './assemble'
import { signAsMember } from './sign'
import { ETH_SECP256K1_PUBKEY_TYPE, type MultisigMember } from './types'

// Fixed, hermetic vectors - no chain needed.
const PRIV = '0x1111111111111111111111111111111111111111111111111111111111111111'
const SIGN_BYTES = toBytes('0xdeadbeefcafe')

test('signAsMember hashes with keccak256 (not sha256) and returns 64-byte [R||S]', async () => {
  const got = fromBase64(await signAsMember(SIGN_BYTES, PRIV))
  assert.equal(got.length, 64)

  // Independently reproduce with keccak - must match.
  const keccakSig = await sign({ hash: keccak256(SIGN_BYTES), privateKey: PRIV })
  const expected = new Uint8Array(64)
  expected.set(toBytes(keccakSig.r), 0)
  expected.set(toBytes(keccakSig.s), 32)
  assert.deepEqual(got, expected)

  // sha256 would produce a different signature - proves keccak is used.
  const shaSig = await sign({ hash: sha256(SIGN_BYTES), privateKey: PRIV })
  const shaBytes = new Uint8Array(64)
  shaBytes.set(toBytes(shaSig.r), 0)
  shaBytes.set(toBytes(shaSig.s), 32)
  assert.notDeepEqual(got, shaBytes)
})

const K1: MultisigMember = {
  address: 'wallet1ceexaxnqn4j7spguvg3uzn83das7jqs349ah3x',
  pubkeyBase64: 'AwVvi0vlqc1Ki0j2WjpVeXeWvn7Mou/bfus6L27oXOCJ',
}
const K2: MultisigMember = {
  address: 'wallet1kr8jqg7ccukf9kaew73ccnf3rr6szn9plnk0ua',
  pubkeyBase64: 'AoHoZ0xFAuw3DnWb9/fV3d4zzJrfgezIcfvvP7OA+Pc/',
}

test('combineAndEncodeTx builds a TxRaw with eth_secp256k1 multisig pubkey + raw sigs', () => {
  const sig64 = toBase64(new Uint8Array(64).fill(7))
  const txBytes = combineAndEncodeTx({
    members: [K1, K2],
    threshold: 1,
    bodyBytes: new Uint8Array([1, 2, 3]),
    fee: { amount: '5000', gas: '200000', denom: 'ubrl' },
    sequence: 0,
    signatures: { [K1.address]: sig64 },
  })

  const txRaw = TxRaw.decode(txBytes)
  const authInfo = AuthInfo.decode(txRaw.authInfoBytes)
  assert.equal(authInfo.signerInfos.length, 1)

  const pk = authInfo.signerInfos[0].publicKey
  assert.ok(pk)
  const legacy = LegacyAminoPubKey.decode(pk!.value)
  assert.equal(legacy.threshold, 1)
  for (const member of legacy.publicKeys) {
    assert.equal(member.typeUrl, ETH_SECP256K1_PUBKEY_TYPE)
  }

  // exactly one member signed, with a 64-byte [R||S] signature
  const multiSig = MultiSignature.decode(txRaw.signatures[0])
  assert.equal(multiSig.signatures.length, 1)
  assert.equal(multiSig.signatures[0].length, 64)
})
