import assert from 'node:assert/strict'
import { test } from 'node:test'
import { candidates } from './index'

test('timestamp selection uses Shinzo inclusive integer filter operators', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const { query } = JSON.parse(String(init?.body))
    // These are the inclusive operators exposed by Shinzo's IntFilterArg.
    assert.match(query, /block_time_unix: \{ _geq: 100 \}/)
    assert.match(query, /block_time_unix: \{ _leq: 200 \}/)
    return Response.json({ data: { rows: [] } })
  }
  try {
    assert.deepEqual(await candidates({ kind: 'time_range', startUnix: 100, endUnix: 200 }), [])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('transaction selection uses the lowercase hash stored by the feeder', async () => {
  const originalFetch = globalThis.fetch
  const txId = 'AB'.repeat(32)
  globalThis.fetch = async (_url, init) => {
    const { query } = JSON.parse(String(init?.body))
    assert.ok(query.includes(`bankd_tx_hash: { _eq: "${txId.toLowerCase()}" }`))
    return Response.json({ data: { rows: [] } })
  }
  try {
    assert.deepEqual(await candidates({ kind: 'tx_id', txId }), [])
  } finally {
    globalThis.fetch = originalFetch
  }
})
