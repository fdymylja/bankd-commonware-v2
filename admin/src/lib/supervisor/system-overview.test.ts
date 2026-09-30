import assert from 'node:assert/strict'
import { test } from 'node:test'

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'

import { buildRegionExposure, resolveQuorum } from './system-overview'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)))
}
function rootHex(label: string): string {
  return toHex(new TextEncoder().encode(label))
}

// signer mirrors the generator: hex-DER ECDSA over sha256(merkleRoot bytes).
function signer(seed: number) {
  const priv = new Uint8Array(32)
  priv[31] = seed
  const identity = toHex(secp256k1.getPublicKey(priv, true))
  return {
    identity,
    sign(hexRoot: string) {
      return secp256k1.sign(sha256(fromHex(hexRoot)), priv).toDERHex()
    },
  }
}

type Sig = {
  blockNumber?: number
  blockHash?: string
  merkleRoot?: string
  signatureIdentity?: string
  signatureType?: string
  signatureValue?: string
}

const s1 = signer(11)
const s2 = signer(12)
const s3 = signer(13)
const s4 = signer(14)
const HEIGHT = 100
const HASH = '0xblock100'
const rootA = rootHex('root-A')
const rootB = rootHex('root-B')

// signed builds a well-formed, genuinely-signed BlockSignature for a signer.
function signed(
  who: ReturnType<typeof signer>,
  root: string,
  overrides: Partial<Sig> = {}
): Sig {
  return {
    blockNumber: HEIGHT,
    blockHash: HASH,
    merkleRoot: root,
    signatureIdentity: who.identity,
    signatureType: 'ES256K',
    signatureValue: who.sign(root),
    ...overrides,
  }
}

const registered = new Map(
  [s1, s2, s3, s4].map((s) => [s.identity, { signatureType: 'ES256K' }])
)

function quorum(sources: { expectedSigner?: string; signatures: Sig[] }[]) {
  return resolveQuorum({
    sources,
    latestNumber: HEIGHT,
    latestHash: HASH,
    registered,
    requiredSignerCount: 2,
  })
}

test('resolveQuorum: two distinct signers over the same root -> verified', () => {
  const result = quorum([
    { expectedSigner: s1.identity, signatures: [signed(s1, rootA)] },
    { expectedSigner: s2.identity, signatures: [signed(s2, rootA)] },
  ])
  assert.equal(result.verified, true)
  assert.equal(result.agreedSignatures.length, 2)
})

test('resolveQuorum: 3-of-3 over the same root -> verified', () => {
  const result = quorum([
    { expectedSigner: s1.identity, signatures: [signed(s1, rootA)] },
    { expectedSigner: s2.identity, signatures: [signed(s2, rootA)] },
    { expectedSigner: s3.identity, signatures: [signed(s3, rootA)] },
  ])
  assert.equal(result.verified, true)
  assert.equal(result.agreedSignatures.length, 3)
})

test('resolveQuorum: single valid signer -> not verified', () => {
  const result = quorum([
    { expectedSigner: s1.identity, signatures: [signed(s1, rootA)] },
  ])
  assert.equal(result.verified, false)
  assert.equal(result.agreedSignatures.length, 0)
})

test('resolveQuorum: two qualifying conflicting roots -> fail closed', () => {
  const result = quorum([
    { expectedSigner: s1.identity, signatures: [signed(s1, rootA)] },
    { expectedSigner: s2.identity, signatures: [signed(s2, rootA)] },
    { expectedSigner: s3.identity, signatures: [signed(s3, rootB)] },
    { expectedSigner: s4.identity, signatures: [signed(s4, rootB)] },
  ])
  assert.equal(result.verified, false)
  assert.equal(result.agreedSignatures.length, 0)
})

test('resolveQuorum: endpoint substitution (foreign genuine sig) is dropped', () => {
  // Endpoint bound to s1 serves s2's genuine attestation; only s2's own endpoint
  // counts, leaving a single signer -> not verified.
  const result = quorum([
    { expectedSigner: s1.identity, signatures: [signed(s2, rootA)] },
    { expectedSigner: s2.identity, signatures: [signed(s2, rootA)] },
  ])
  assert.equal(result.verified, false)
})

test('resolveQuorum: only the bound signer is taken from a multi-entry response', () => {
  // Endpoint bound to s1 lists a foreign sig first, then its own. limit: 1 is
  // not trusted; the bound signer is still selected, so quorum with s2 holds.
  const result = quorum([
    { expectedSigner: s1.identity, signatures: [signed(s2, rootA), signed(s1, rootA)] },
    { expectedSigner: s2.identity, signatures: [signed(s2, rootA)] },
  ])
  assert.equal(result.verified, true)
  assert.equal(result.agreedSignatures.length, 2)
})

const anchorAndCryptoCases: Array<{ name: string; sig: Sig }> = [
  { name: 'wrong height (replay to another block)', sig: signed(s2, rootA, { blockNumber: 999 }) },
  { name: 'wrong block hash', sig: signed(s2, rootA, { blockHash: '0xdeadbeef' }) },
  { name: 'wrong signature type', sig: signed(s2, rootA, { signatureType: 'ES256' }) },
  { name: 'empty signature value', sig: signed(s2, rootA, { signatureValue: '' }) },
  { name: 'truncated signature value', sig: signed(s2, rootA, { signatureValue: s2.sign(rootA).slice(0, 20) }) },
  { name: 'signature over a different root', sig: signed(s2, rootA, { signatureValue: s2.sign(rootB) }) },
  { name: 'missing merkle root', sig: signed(s2, rootA, { merkleRoot: undefined }) },
]

for (const tc of anchorAndCryptoCases) {
  test(`resolveQuorum: bad second attestation dropped - ${tc.name}`, () => {
    // s1 is a clean valid signer; the s2 endpoint carries the bad attestation.
    // The bad one must not count, leaving quorum unmet.
    const result = quorum([
      { expectedSigner: s1.identity, signatures: [signed(s1, rootA)] },
      { expectedSigner: s2.identity, signatures: [tc.sig] },
    ])
    assert.equal(result.verified, false)
    assert.equal(result.agreedSignatures.length, 0)
  })
}

test('resolveQuorum: unbound endpoint (no registered signer) contributes nothing', () => {
  const result = resolveQuorum({
    sources: [
      { expectedSigner: undefined, signatures: [signed(s1, rootA)] },
      { expectedSigner: s2.identity, signatures: [signed(s2, rootA)] },
    ],
    latestNumber: HEIGHT,
    latestHash: HASH,
    registered,
    requiredSignerCount: 2,
  })
  assert.equal(result.verified, false)
})

const regions = [
  {
    id: 'br-sp',
    label: 'São Paulo',
    chainId: 'regional-sp-1',
    ibcChannelToCentral: 'channel-0',
  },
  {
    id: 'br-rj',
    label: 'Rio de Janeiro',
    chainId: 'regional-rj-1',
    ibcChannelToCentral: 'channel-1',
  },
]

test('buildRegionExposure: federal keeps idle regions zeroed', () => {
  const result = buildRegionExposure({
    channels: [
      {
        channelId: 'channel-0',
        state: 'STATE_OPEN',
        pendingPacketCount: 3,
        balances: [{ denom: 'ubrl', amount: '1000' }],
      },
    ],
    regions,
    role: 'federal',
    nativeDenom: 'ubrl',
  })
  assert.equal(result.length, 2)

  const sp = result[0]
  assert.equal(sp.regionId, 'br-sp')
  assert.equal(sp.channelOpen, true)
  assert.equal(sp.pendingSettlements, 3)
  assert.equal(sp.escrowedNative.amount, '1000')

  // br-rj has no matching channel -> idle, everything zeroed.
  const rj = result[1]
  assert.equal(rj.regionId, 'br-rj')
  assert.equal(rj.channelState, 'STATE_UNINITIALIZED_UNSPECIFIED')
  assert.equal(rj.channelOpen, false)
  assert.equal(rj.pendingSettlements, 0)
  assert.equal(rj.escrowedNative.amount, '0')
})

test('buildRegionExposure: regional scopes to its own region only', () => {
  const result = buildRegionExposure({
    channels: [
      {
        channelId: 'channel-0',
        state: 'STATE_OPEN',
        pendingPacketCount: 1,
        balances: [{ denom: 'ubrl', amount: '500' }],
      },
      {
        channelId: 'channel-1',
        state: 'STATE_OPEN',
        pendingPacketCount: 2,
        balances: [{ denom: 'ubrl', amount: '700' }],
      },
    ],
    regions,
    role: 'regional',
    nativeDenom: 'ubrl',
    regionId: 'br-sp',
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].regionId, 'br-sp')
  assert.equal(result[0].escrowedNative.amount, '500')
})

test('buildRegionExposure: unmatched channel is not surfaced as a region', () => {
  const result = buildRegionExposure({
    channels: [
      {
        channelId: 'channel-99',
        state: 'STATE_OPEN',
        pendingPacketCount: 5,
        balances: [{ denom: 'ubrl', amount: '9999' }],
      },
    ],
    regions,
    role: 'federal',
    nativeDenom: 'ubrl',
  })
  // Only the two registered regions, both idle; the hub-side channel-99 is not
  // an entry.
  assert.equal(result.length, 2)
  assert.ok(result.every((entry) => entry.escrowedNative.amount === '0'))
})

test('buildRegionExposure: escrowedNative sums only the native denom', () => {
  const result = buildRegionExposure({
    channels: [
      {
        channelId: 'channel-0',
        state: 'STATE_OPEN',
        pendingPacketCount: 0,
        balances: [
          { denom: 'ubrl', amount: '100' },
          { denom: 'ibc/ABC', amount: '5000' },
          { denom: 'ubrl', amount: '25' },
        ],
      },
    ],
    regions,
    role: 'regional',
    nativeDenom: 'ubrl',
    regionId: 'br-sp',
  })
  assert.equal(result[0].escrowedNative.amount, '125')
})
