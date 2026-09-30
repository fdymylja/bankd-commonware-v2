import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { Transaction } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import { noteSnapshot } from '../../tests/e2e/browser-diagnostics.mjs'

/** Wait for both outputs and spent inputs of the fixture's self-transfer. */
export async function waitForSelfTransferNotes(page, database, accepted, before, timeout = 180_000) {
  const transaction = Transaction.fromBinary(Buffer.from(accepted.transaction, 'base64'))
  const action = transaction.body?.actions[accepted.actionIndex]?.action
  assert.equal(action?.case, 'transfer')
  const transfer = action.value.body
  const created = transfer.outputs.map(output => Buffer.from(output.notePayload.noteCommitment.inner).toString('base64'))
  const inputs = new Set(transfer.inputs.map(input => Buffer.from(input.nullifier.inner).toString('base64')))
  // Padded inputs have no wallet note; require only the owned inputs we observed.
  const spent = before.filter(note => inputs.has(note.nullifier?.inner)).map(note => note.nullifier.inner)
  assert.ok(created.length > 0 && spent.length > 0, 'Self-transfer must create outputs and spend owned notes')
  const height = BigInt(accepted.height)
  // Poll from Node: waitForFunction treats an IndexedDB Promise as truthy before
  // its boolean resolves. The sync height also precedes spent-note persistence.
  await expect.poll(async () => {
    const notes = JSON.parse(await noteSnapshot(page, database))
    return created.every(commitment => notes.some(note =>
      note.noteCommitment?.inner === commitment && BigInt(note.heightCreated ?? -1) === height)) &&
      spent.every(nullifier => notes.some(note =>
        note.nullifier?.inner === nullifier && BigInt(note.heightSpent ?? -1) === height))
  }, { timeout, message: 'Accepted self-transfer outputs and spent inputs must be persisted before disclosure' }).toBe(true)
}
