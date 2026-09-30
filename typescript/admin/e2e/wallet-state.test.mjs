import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Transaction } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import { waitForSelfTransferNotes } from './wallet-state.mjs'

const before = [{ noteCommitment: { inner: 'AQ==' }, nullifier: { inner: 'Ag==' }, heightCreated: '13' }]
const output = { noteCommitment: { inner: 'Aw==' }, heightCreated: '105' }
const accepted = {
  actionIndex: 0, height: '105',
  transaction: Buffer.from(Transaction.fromJson({ body: { actions: [{ transfer: { body: {
    inputs: [{ nullifier: { inner: 'Ag==' } }, { nullifier: { inner: 'BA==' } }],
    outputs: [{ notePayload: { noteCommitment: { inner: 'Aw==' } } }],
  } } }] } }).toBinary()).toString('base64'),
}

test('disclosure waits for asynchronous note creation and the later spent-note write', async () => {
  const states = [before, [...before, output], [{ ...before[0], heightSpent: '105' }, output]]
  let reads = 0
  const page = { evaluate: async (_read, database) => {
    assert.equal(database, 'native-wallet')
    await new Promise(resolve => setTimeout(resolve, 5))
    return JSON.stringify(states[Math.min(reads++, states.length - 1)])
  } }
  await waitForSelfTransferNotes(page, 'native-wallet', accepted, before, 2000)
  assert.ok(reads >= 3, 'An asynchronous false result must keep polling')
})

test('disclosure refuses to snapshot when an owned input remains unspent', async () => {
  const page = { evaluate: async () => JSON.stringify([...before, output]) }
  await assert.rejects(waitForSelfTransferNotes(page, 'native-wallet', accepted, before, 150),
    /Timeout 150ms exceeded while waiting on the predicate/)
})
