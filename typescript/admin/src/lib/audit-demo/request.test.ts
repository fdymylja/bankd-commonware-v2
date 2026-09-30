import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRequest } from './request'

test('requests validate scope, fields, participant and expiry', () => {
  const body = {
    fields: ['amount'],
    subject: 'Charlie',
    scope: { kind: 'time_range', startUnix: 1, endUnix: 2 },
  }
  assert.equal(normalizeRequest('audit-subject', body).mode, 'subject')
  for (const changed of [
    { ...body, fields: ['private_key'] },
    { ...body, subject: '' },
    { ...body, scope: { ...body.scope, endUnix: 0 } },
    { ...body, expiresAt: '2000-01-01' },
  ]) {
    assert.throws(() => normalizeRequest('audit-subject', changed))
  }
  assert.throws(() => normalizeRequest('audit-transaction', body))
})
