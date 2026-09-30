import assert from 'node:assert/strict'
import { test } from 'node:test'

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'

import { verifyBlockSignature } from './signature'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)))
}

// rootHex encodes an arbitrary label as the hex "merkle root" the generator signs.
function rootHex(label: string): string {
  return toHex(new TextEncoder().encode(label))
}

// signer builds a deterministic secp256k1 keypair plus a helper that signs a
// merkle root exactly like the Shinzo generator: hex-DER ECDSA over sha256(root).
function signer(seed: number) {
  const priv = new Uint8Array(32)
  priv[31] = seed
  const identity = toHex(secp256k1.getPublicKey(priv, true))
  return {
    identity,
    sign(hexRoot: string) {
      const digest = sha256(fromHex(hexRoot))
      return secp256k1.sign(digest, priv).toDERHex()
    },
  }
}

const s1 = signer(7)
const s2 = signer(9)
const root = rootHex('merkle-root-of-block-100')
const otherRoot = rootHex('merkle-root-of-block-101')
const valid = s1.sign(root)

const cases: Array<{
  name: string
  identity: string
  signatureValue: string
  merkleRoot: string
  want: boolean
}> = [
  { name: 'positive fixture', identity: s1.identity, signatureValue: valid, merkleRoot: root, want: true },
  { name: '0x-prefixed identity and signature', identity: '0x' + s1.identity, signatureValue: '0x' + valid, merkleRoot: root, want: true },
  { name: 'empty signature', identity: s1.identity, signatureValue: '', merkleRoot: root, want: false },
  { name: 'empty merkle root', identity: s1.identity, signatureValue: valid, merkleRoot: '', want: false },
  { name: 'random bytes signature', identity: s1.identity, signatureValue: toHex(new TextEncoder().encode('not a der signature!!')), merkleRoot: root, want: false },
  { name: 'non-hex signature', identity: s1.identity, signatureValue: 'zzzz', merkleRoot: root, want: false },
  { name: 'substituted identity', identity: s2.identity, signatureValue: valid, merkleRoot: root, want: false },
  { name: 'malformed identity', identity: '02abcd', signatureValue: valid, merkleRoot: root, want: false },
  { name: 'mixed commit / different root', identity: s1.identity, signatureValue: s1.sign(otherRoot), merkleRoot: root, want: false },
  { name: 'replayed sig checked against another block', identity: s1.identity, signatureValue: valid, merkleRoot: otherRoot, want: false },
]

for (const tc of cases) {
  test(`verifyBlockSignature: ${tc.name}`, () => {
    assert.equal(
      verifyBlockSignature({
        identity: tc.identity,
        signatureValue: tc.signatureValue,
        merkleRoot: tc.merkleRoot,
      }),
      tc.want
    )
  })
}
