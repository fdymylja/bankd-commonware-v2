import assert from 'node:assert/strict'
import test from 'node:test'

import { type Hex, hexToBytes, keccak256, recoverAddress, toHex } from 'viem'
import { privateKeyToAddress } from 'viem/accounts'

import { concatSignatures, signSafeTxHash } from './sign'

// Deterministic test keys.
const PK_A =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex
const PK_B =
  '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex
const HASH = keccak256(toHex('safe-tx'))

test('signSafeTxHash: 65-byte r||s||v, v in {27,28}, recovers signer', async () => {
  const sig = await signSafeTxHash(HASH, PK_A)
  const bytes = hexToBytes(sig)
  assert.equal(bytes.length, 65)
  const v = bytes[64]
  assert.ok(v === 27 || v === 28, `v was ${v}`)

  // Raw hash, no EIP-191 prefix - recovers to the signer.
  const recovered = await recoverAddress({ hash: HASH, signature: sig })
  assert.equal(recovered.toLowerCase(), privateKeyToAddress(PK_A).toLowerCase())
})

test('concatSignatures: ascending owner-address order', async () => {
  const addrA = privateKeyToAddress(PK_A)
  const addrB = privateKeyToAddress(PK_B)
  const sigA = await signSafeTxHash(HASH, PK_A)
  const sigB = await signSafeTxHash(HASH, PK_B)

  const combined = concatSignatures({ [addrA]: sigA, [addrB]: sigB })
  // 2 sigs * 65 bytes = 130 bytes = 260 hex chars + '0x'.
  assert.equal(combined.length, 2 + 260)

  const lower = [addrA, addrB].sort((x, y) =>
    x.toLowerCase() < y.toLowerCase() ? -1 : 1
  )
  const firstSig = lower[0] === addrA ? sigA : sigB
  // The lowest-address signer's sig leads the blob.
  assert.ok(combined.startsWith(firstSig))
})

test('concatSignatures: insertion order does not matter', async () => {
  const addrA = privateKeyToAddress(PK_A)
  const addrB = privateKeyToAddress(PK_B)
  const sigA = await signSafeTxHash(HASH, PK_A)
  const sigB = await signSafeTxHash(HASH, PK_B)

  const one = concatSignatures({ [addrA]: sigA, [addrB]: sigB })
  const two = concatSignatures({ [addrB]: sigB, [addrA]: sigA })
  assert.equal(one, two)
})
