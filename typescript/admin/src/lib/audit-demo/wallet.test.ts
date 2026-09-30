import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TransactionPlan,
  Transaction,
} from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import { prepareAuditPackages } from './wallet'

test('shared browser build skips an unconfigured demo but rejects configuration outages', async () => {
  const flag = process.env.NEXT_PUBLIC_ORBIS_AUDIT_DEMO
  const originalFetch = globalThis.fetch
  process.env.NEXT_PUBLIC_ORBIS_AUDIT_DEMO = 'true'
  const plan = TransactionPlan.fromJson({ actions: [{ transfer: {} }] })
  try {
    globalThis.fetch = async () => new Response(null, { status: 204 })
    await prepareAuditPackages(plan, new Transaction())
    globalThis.fetch = async () => new Response(null, { status: 503 })
    await assert.rejects(
      prepareAuditPackages(plan, new Transaction()),
      /configuration unavailable/
    )
  } finally {
    globalThis.fetch = originalFetch
    if (flag === undefined) delete process.env.NEXT_PUBLIC_ORBIS_AUDIT_DEMO
    else process.env.NEXT_PUBLIC_ORBIS_AUDIT_DEMO = flag
  }
})
