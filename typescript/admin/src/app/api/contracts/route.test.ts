import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest, NextResponse } from 'next/server'

import { type ContractInventory, InventoryUnavailableError } from '@/lib/contracts/deployed'

import { createCapabilitiesGET , createContractsGET } from './handlers'

const wallet = '0x00000000000000000000000000000000000000AA' as const
const granted = async () => ({ granted: true as const, access: { subject: 'admin', wallet, canRead: true as const, canWrite: true as const } })
const denied = async () => ({ granted: false as const, response: NextResponse.json({ error: 'denied' }, { status: 401 }) })
const inventory = { contracts: [], identity: { wallet, chainId: 9001 }, provenance: { source: 'Shinzo', signerIds: [], requiredSigners: 2, latestHeight: 1, latestHash: '0x', latestTime: '', indexedStartHeight: 0, rpcAgreement: true, collectionPrefix: 'X' }, coverage: { complete: true, indexedRangeComplete: true, truncated: false }, limitations: { topLevelCreate: true, internalCreate: false, create2: false, ownershipNotEstablished: true } } as ContractInventory

test('denies unauthenticated inventory requests before listing', async () => {
  let called = false
  const response = await createContractsGET({ authorize: denied, list: async () => { called = true; return inventory } })(new NextRequest('http://test/api/contracts'))
  assert.equal(response.status, 401); assert.equal(called, false)
})
test('rejects arbitrary deployer/scope and binds listing to trusted wallet', async () => {
  const wallets: string[] = []
  const handler = createContractsGET({ authorize: granted, list: async (value) => { wallets.push(value); return inventory } })
  assert.equal((await handler(new NextRequest('http://test/api/contracts?deployer=0x1'))).status, 400)
  assert.equal((await handler(new NextRequest('http://test/api/contracts?scope=all'))).status, 400)
  assert.equal((await handler(new NextRequest('http://test/api/contracts'))).status, 200)
  assert.deepEqual(wallets, [wallet])
})
test('maps provenance failures to 503 and other inventory failures to 502', async () => {
  const unavailable = createContractsGET({ authorize: granted, list: async () => { throw new InventoryUnavailableError('no quorum') } })
  const broken = createContractsGET({ authorize: granted, list: async () => { throw new Error('bad response') } })
  assert.equal((await unavailable(new NextRequest('http://test/api/contracts'))).status, 503)
  assert.equal((await broken(new NextRequest('http://test/api/contracts'))).status, 502)
})
test('capabilities returns trusted identity and no-store semantics', async () => {
  const response = await createCapabilitiesGET({ authorize: granted, chainId: 9001 })(new NextRequest('http://test/api/contracts/capabilities'))
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { subject: 'admin', wallet, chainId: 9001, canRead: true, canWrite: true })
  assert.equal((await createCapabilitiesGET({ authorize: denied, chainId: 9001 })(new NextRequest('http://test'))).status, 401)
})
