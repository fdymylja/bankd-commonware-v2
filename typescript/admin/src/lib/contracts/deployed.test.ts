import assert from 'node:assert/strict'
import test from 'node:test'

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'
import { getAddress, getContractAddress } from 'viem'

import policy from '@/generated/supervisor-indexer-policy.json'
import { chainDefinition } from '@/lib/config'

import { InventoryUnavailableError, listDeployedContracts } from './deployed'

const wallet = '0x00000000000000000000000000000000000000aa'
const hash = `0x${'12'.repeat(32)}`
const blockHash = `0x${'34'.repeat(32)}`
const originalFetch = globalThis.fetch
const originalUrls = process.env.SHINZO_GRAPHQL_URLS

// The registered policy pubkeys have no private keys in-repo, so we can't forge
// valid BlockSignature values for them. Swap in three test-controlled keypairs
// (deterministic) and make the served attestations real signatures over a fixed
// merkle root, matching the live generator scheme (hex-DER secp256k1 over
// sha256(root)). deployed.ts and this test share the same imported policy
// object, so the swap keeps the registered set and endpoint binding consistent.
const MERKLE_ROOT = 'aa'.repeat(32)
function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function fromHex(hex: string) {
  return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)))
}
function makeSigner(seed: number) {
  const priv = new Uint8Array(32)
  priv[31] = seed
  const identity = toHex(secp256k1.getPublicKey(priv, true))
  return { identity, sign: (rootHex: string) => secp256k1.sign(sha256(fromHex(rootHex)), priv).toDERHex() }
}
const signers = [makeSigner(11), makeSigner(12), makeSigner(13)]
policy.indexers[0].identity = signers[0].identity
policy.indexers[1].identity = signers[1].identity
policy.indexers[2].identity = signers[2].identity
const signerByIdentity = new Map(signers.map((s) => [s.identity.toLowerCase(), s]))
// attest returns a valid signature for a known signer, or a non-verifying value
// for an unknown identity (which the identity-binding check rejects first).
function attest(identity: string, root: string = MERKLE_ROOT) {
  return signerByIdentity.get(identity.toLowerCase())?.sign(root) ?? 'unregistered-no-valid-signature'
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalUrls === undefined) delete process.env.SHINZO_GRAPHQL_URLS
  else process.env.SHINZO_GRAPHQL_URLS = originalUrls
})

type Served = { from: string; nonce: string; blockNumber: number }
type Options = {
  pages?: (offset: number, url: string) => unknown[]
  identities?: Record<string, string>
  rpcChainId?: number
  rpcHead?: number
  receipt?: (txHash: string, served: Served | undefined) => unknown
  queries?: string[]
  badSignature?: boolean
  roots?: Record<string, string>
}
function installFetch(options: Options = {}) {
  process.env.SHINZO_GRAPHQL_URLS = 'https://one/graphql,https://two/graphql,https://three/graphql'
  const identities = options.identities ?? { one: policy.indexers[0].identity, two: policy.indexers[1].identity, three: policy.indexers[2].identity }
  // Remember the successful CREATEs each source served so the RPC anchor mock can
  // hand back a receipt that matches what the indexer path derived for that row.
  const served = new Map<string, Served>()
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const body = JSON.parse(String(init?.body)) as { method?: string; params?: unknown[]; query?: string }
    if (!url.includes('/graphql')) {
      if (body.method === 'eth_chainId') return Response.json({ result: `0x${(options.rpcChainId ?? chainDefinition.id).toString(16)}` })
      if (body.method === 'eth_blockNumber') return Response.json({ result: `0x${(options.rpcHead ?? 1000).toString(16)}` })
      if (body.method === 'eth_getTransactionReceipt') {
        const txHash = String((body.params ?? [])[0]).toLowerCase()
        const s = served.get(txHash)
        if (options.receipt) return Response.json({ result: options.receipt(txHash, s) })
        if (!s) return Response.json({ result: null })
        return Response.json({ result: { status: '0x1', from: s.from, to: null, contractAddress: getContractAddress({ from: getAddress(s.from), nonce: BigInt(s.nonce) }), blockNumber: `0x${s.blockNumber.toString(16)}` } })
      }
      return Response.json({ result: null })
    }
    const query = body.query ?? ''
    options.queries?.push(query)
    const offset = Number(/offset: (\d+)/.exec(query)?.[1] ?? 0)
    const key = url.includes('one') ? 'one' : url.includes('two') ? 'two' : 'three'
    const txs = options.pages?.(offset, key) ?? [{ hash, from: wallet, to: '', nonce: '1', status: true, blockNumber: 10 }]
    for (const t of txs as Array<Record<string, unknown>>) {
      if (typeof t.hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(t.hash) && typeof t.nonce === 'string' && t.status === true && t.to === '' && typeof t.from === 'string') served.set(t.hash.toLowerCase(), { from: t.from, nonce: t.nonce, blockNumber: Number(t.blockNumber) })
    }
    return Response.json({ data: {
      txs,
      latest: [{ hash: blockHash, number: 10, timestamp: '2026-08-03T00:00:00Z' }],
      oldest: [{ hash: `0x${'56'.repeat(32)}`, number: 1, timestamp: '2026-01-01T00:00:00Z' }],
      signatures: [{ blockNumber: 10, blockHash, merkleRoot: options.roots?.[key] ?? MERKLE_ROOT, signatureIdentity: identities[key], signatureType: 'ES256K', signatureValue: options.badSignature ? '' : attest(identities[key], options.roots?.[key] ?? MERKLE_ROOT) }],
    } })
  }
}

test('filters successful creates at source, completes on a short page, and excludes malformed/failed rows', { concurrency: false }, async () => {
  const queries: string[] = []
  installFetch({ queries, pages: () => [
    { hash: `0x${'ab'.repeat(32)}`, from: wallet, to: '', nonce: '2', status: true, blockNumber: 10 },
    { hash, from: wallet, to: '', nonce: '1', status: true, blockNumber: 11 },
    { hash: `0x${'78'.repeat(32)}`, from: wallet, to: '', nonce: '3', status: false, blockNumber: 12 },
    { hash: 'bad', from: wallet, to: '', nonce: '4', status: true, blockNumber: 13 },
  ] })
  const inventory = await listDeployedContracts(wallet)
  assert.ok(queries[0].includes(`from: {_eq: "${getAddress(wallet)}"}`))
  assert.match(queries[0], /to: \{_eq: ""\}/)
  assert.match(queries[0], /status: \{_eq: true\}/)
  assert.match(queries[0], /order: \[\{blockNumber: DESC\}, \{hash: ASC\}\]/)
  assert.match(queries[0], /limit: 500, offset: 0/)
  assert.equal(queries.some((query) => query.includes('offset: 500')), false)
  assert.equal(inventory.contracts.length, 2)
  assert.deepEqual(inventory.contracts.map((row) => row.blockNumber), [11, 10])
  assert.equal(inventory.coverage.complete, false)
  assert.equal(inventory.coverage.indexedRangeComplete, true)
  assert.match(inventory.coverage.reason ?? '', /starting at height 1/)
})

test('paginates at offsets 0/500 and marks exactly twenty full pages truncated', { concurrency: false }, async () => {
  const queries: string[] = []
  const full = Array.from({ length: 500 }, () => ({ hash, from: wallet, to: '', nonce: '1', status: true, blockNumber: 10 }))
  installFetch({ queries, pages: () => full })
  const inventory = await listDeployedContracts(wallet)
  const oneQueries = queries.filter((_, index) => index % 3 === 0)
  assert.match(oneQueries[0], /offset: 0/)
  assert.match(oneQueries[1], /offset: 500/)
  assert.equal(queries.length, 60)
  assert.equal(inventory.coverage.truncated, true)
  assert.match(inventory.coverage.reason ?? '', /10000/)
})

test('accepts a registered two-of-three quorum and ignores an unknown third signer', { concurrency: false }, async () => {
  installFetch({ identities: { one: policy.indexers[0].identity, two: policy.indexers[1].identity, three: 'unknown' } })
  const inventory = await listDeployedContracts(wallet)
  assert.deepEqual(inventory.provenance.signerIds.sort(), ['shinzo-1', 'shinzo-2'])
})

test('rejects disagreement, duplicate signer identities, and no quorum', { concurrency: false }, async () => {
  installFetch({ identities: { one: policy.indexers[0].identity, two: policy.indexers[0].identity, three: 'unknown' } })
  await assert.rejects(listDeployedContracts(wallet), InventoryUnavailableError)
  installFetch({ pages: (_offset, source) => [{ hash: source === 'one' ? hash : source === 'two' ? `0x${'99'.repeat(32)}` : `0x${'88'.repeat(32)}`, from: wallet, to: '', nonce: '1', status: true, blockNumber: 10 }] })
  await assert.rejects(listDeployedContracts(wallet), /quorum/)
})

test('issue #283 repro: registered, tuple-matching endpoints with an invalid signatureValue fail closed', { concurrency: false }, async () => {
  // Two configured, registered endpoints return matching block/tuple fields but
  // an empty (unverifiable) signatureValue. Before signature verification this
  // counted as a 2-of-3 quorum; now every source must drop and no quorum forms.
  installFetch({ badSignature: true })
  await assert.rejects(listDeployedContracts(wallet), InventoryUnavailableError)
})

test('issue #283: distinct valid signatures over different signed roots do not form a quorum', { concurrency: false }, async () => {
  // Every endpoint returns a genuine signature, but each over its own merkle
  // root. The cross-source digest now binds the verified root, so no two sources
  // share a commitment and quorum must not form (previously the root was omitted
  // and different-root signers were miscounted as agreeing).
  installFetch({ roots: { one: MERKLE_ROOT, two: 'bb'.repeat(32), three: 'cc'.repeat(32) } })
  await assert.rejects(listDeployedContracts(wallet), /quorum/)
})

test('fails closed on RPC chain mismatch, a missing receipt, and a mismatched creation', { concurrency: false }, async () => {
  installFetch({ rpcChainId: chainDefinition.id + 1 })
  await assert.rejects(listDeployedContracts(wallet), /chain mismatch/)
  // Indexer reports a deployment the trusted RPC has never seen.
  installFetch({ receipt: () => null })
  await assert.rejects(listDeployedContracts(wallet), /not found/)
  // Receipt exists but its created address doesn't match the reported contract.
  installFetch({ receipt: (_txHash, s) => s && ({ status: '0x1', from: s.from, to: null, contractAddress: `0x${'cd'.repeat(20)}`, blockNumber: `0x${s.blockNumber.toString(16)}` }) })
  await assert.rejects(listDeployedContracts(wallet), /address mismatch/)
})
