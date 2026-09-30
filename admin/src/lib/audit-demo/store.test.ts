import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  attachPackages,
  clearAuditHistory,
  readState,
  updateState,
  type DemoState,
  type StoredPackage,
} from './store'

test('attachment is idempotent, rejects conflicts, and serializes atomic writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orbis-state-'))
  const file = join(directory, 'state.json')
  const state = {
    version: 1,
    delivery: {},
    users: [],
    packages: [],
    runs: [],
  } as unknown as DemoState
  const row = {
    height: 1,
    objectId: 'one',
    bankdTxHash: 'bankd',
    package: {
      binding: {
        chain_id: 'chain',
        transaction_id: 'tx',
        action: 0,
        output: 0,
        field: 'amount',
      },
    },
  } as StoredPackage
  try {
    await writeFile(file, JSON.stringify(state))
    await Promise.all(
      Array.from({ length: 5 }, () =>
        updateState((state) => attachPackages(state, [row]), file)
      )
    )
    assert.equal((await readState(file)).packages.length, 1)
    await assert.rejects(
      updateState(
        (state) => attachPackages(state, [{ ...row, objectId: 'other' }]),
        file
      ),
      /Conflicting/
    )
    assert.equal((await readState(file)).packages[0]!.objectId, 'one')
  } finally {
    await rm(directory, { recursive: true })
  }
})

test('clearing audit history persists without changing packages or participants', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orbis-clear-'))
  const file = join(directory, 'state.json')
  const state = {
    version: 1,
    delivery: { policy: 'policy' },
    users: [{ name: 'Alice' }],
    packages: [{ objectId: 'sealed' }],
    runs: [{ status: 'completed' }, { status: 'failed' }],
  }
  try {
    await writeFile(file, JSON.stringify(state))
    await clearAuditHistory(file)
    assert.deepEqual(await readState(file), { ...state, runs: [] })
    await clearAuditHistory(file)
    assert.deepEqual(await readState(file), { ...state, runs: [] })
  } finally {
    await rm(directory, { recursive: true })
  }
})
