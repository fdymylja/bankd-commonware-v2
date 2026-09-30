import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { openDB } from 'idb'
import { enqueuePackages, flushPackages } from './outbox'
import type { SealedAuditPackage } from '@mizufinance/wasm/orbis'

test('sealed outbox survives reload, retries failed attachment, and removes only confirmed uploads', async () => {
  const packages = [
    { binding: { chain_id: 'chain', transaction_id: '11'.repeat(32) } },
  ] as SealedAuditPackage[]
  await enqueuePackages(packages)
  await enqueuePackages(packages)
  const originalFetch = globalThis.fetch
  try {
    let requests = 0
    globalThis.fetch = async () => {
      requests++
      return new Response('{}', { status: 503 })
    }
    await flushPackages()
    let db = await openDB('orbis-audit-outbox', 1)
    assert.equal(await db.count('packages'), 1)
    const pending = (await db.getAll('packages'))[0]
    assert.equal(pending.attempts, 1)
    await db.put('packages', { ...pending, retryAt: 0 })
    db.close()
    globalThis.fetch = async (_url, options) => {
      requests++
      assert.deepEqual(JSON.parse(options!.body as string), packages)
      return Response.json({ attached: 1 })
    }
    await Promise.all([flushPackages(), flushPackages()])
    db = await openDB('orbis-audit-outbox', 1)
    assert.equal(await db.count('packages'), 0)
    assert.equal(requests, 2)
    db.close()
  } finally {
    globalThis.fetch = originalFetch
  }
})
