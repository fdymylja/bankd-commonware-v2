import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  projectTransfer,
  type AddressComponents,
  type DecodedField,
} from './projection'
import type { AuditRequest } from './types'

const address = (n: number): AddressComponents => ({
  diversified_generator: Array(32).fill(n),
  transmission_key: Array(32).fill(n + 1),
})
const alice = address(1),
  bob = address(3)
const people = [
  { name: 'Alice', slug: 'alice', addresses: [alice] },
  { name: 'Bob', slug: 'bob', addresses: [bob] },
]
const reference = {
  height: 1,
  bankd_tx_hash: 'AB',
  action_index: 0,
  output_index: 0,
}
const request = (subject?: string): AuditRequest => ({
  requestId: 'test',
  mode: subject ? 'subject' : 'investigation',
  subject,
  fields: ['amount'],
  scope: { kind: 'time_range', startUnix: 1, endUnix: 2 },
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60000).toISOString(),
})
const decoded = (sender = alice, receiver = bob): DecodedField[] => [
  { reference, field: 'amount', value: { kind: 'amount', base_units: '42' } },
  {
    reference,
    field: 'sender',
    value: { kind: 'address_components', ...sender },
  },
  {
    reference,
    field: 'receiver',
    value: { kind: 'address_components', ...receiver },
  },
]

test('regular reveals only the matching role and amount, for either participant', () => {
  for (const [subject, role] of [
    ['Alice', 'sender'],
    ['Bob', 'receiver'],
  ]) {
    const rows = projectTransfer(request(subject), decoded(), people)
    assert.deepEqual(
      rows.map((row) => row.field),
      ['amount', role]
    )
    assert.equal(rows[1].alias, subject)
  }
  assert.deepEqual(
    projectTransfer(request('Alice'), decoded(bob, bob), people),
    []
  )
  assert.deepEqual(
    projectTransfer(request('Alice'), decoded(alice, alice), people).map(
      (row) => row.field
    ),
    ['amount', 'sender', 'receiver']
  )
})

test('extended and unrestricted release exactly their allowed fields', () => {
  const extended = {
    ...request('Alice'),
    fields: ['amount', 'sender', 'receiver'] as const,
  }
  assert.equal(
    projectTransfer(
      { ...extended, fields: [...extended.fields] },
      decoded(),
      people
    ).length,
    3
  )
  for (const field of ['amount', 'sender', 'receiver'] as const) {
    assert.deepEqual(
      projectTransfer({ ...request(), fields: [field] }, decoded(), people).map(
        (row) => row.field
      ),
      [field]
    )
  }
})

test('missing, malformed and expired input fails rather than appearing as a non-match', () => {
  assert.throws(
    () => projectTransfer(request('Alice'), decoded().slice(0, 2), people),
    /unavailable/
  )
  assert.throws(
    () =>
      projectTransfer(
        { ...request(), expiresAt: new Date(0).toISOString() },
        decoded(),
        people
      ),
    /expired/
  )
  assert.throws(
    () =>
      projectTransfer(
        request('Alice'),
        decoded({ diversified_generator: [1], transmission_key: [2] }),
        people
      ),
    /Malformed/
  )
  assert.throws(
    () => projectTransfer(request(), [...decoded(), decoded()[0]], people),
    /Duplicate/
  )
  assert.throws(
    () =>
      projectTransfer(
        request(),
        [
          {
            reference,
            field: 'amount',
            value: { kind: 'amount', base_units: 'not-an-amount' },
          },
        ],
        people
      ),
    /Malformed/
  )
  assert.throws(
    () =>
      projectTransfer(
        request(),
        [
          {
            reference,
            field: 'amount',
            value: { kind: 'amount', base_units: (1n << 128n).toString() },
          },
        ],
        people
      ),
    /Malformed/
  )
})
