import assert from 'node:assert/strict'
import test from 'node:test'

import { type AbiFunction } from 'viem'

import { confirmReviewedWrite, createWriteReview } from './reviewedContractWrite'

const account = '0x00000000000000000000000000000000000000AA'
const fn = { type: 'function', name: 'set', stateMutability: 'payable', inputs: [{ type: 'uint256' }], outputs: [] } as const satisfies AbiFunction
function operations(overrides: Record<string, unknown> = {}) {
  const calls: string[] = []
  const ops = {
    getAccount: async () => ({ address: account, chainId: 9001 }),
    estimateGas: async (request: unknown) => { calls.push('estimate'); return 21000n },
    simulate: async (request: unknown) => { calls.push('simulate'); return { request: { ...(request as object), gas: 21000n } } },
    write: async () => { calls.push('write'); return '0xabc' as const },
    wait: async () => ({ status: 'success' as const }), ...overrides,
  }
  return { calls, ops }
}

test('simulation creates a frozen review without broadcasting', async () => {
  const { calls, ops } = operations()
  const review = await createWriteReview(ops, { address: account, fn, rawArgs: ['7'], nativeValue: '1', chainId: 9001, nativeDecimals: 18 })
  assert.deepEqual(calls, ['estimate', 'simulate'])
  assert.equal(review.display.signature, 'set(uint256)')
  assert.equal(review.request.value, 1000000000000000000n)
  assert.equal(Object.isFrozen(review), true)
})

test('failed simulation blocks review and broadcast', async () => {
  const { calls, ops } = operations({ simulate: async () => { throw new Error('revert') } })
  await assert.rejects(createWriteReview(ops, { address: account, fn, rawArgs: ['7'], chainId: 9001 }), /revert/)
  assert.deepEqual(calls, ['estimate'])
})

test('confirmation uses frozen request and rejects signer changes and reverted receipts', async () => {
  const first = operations()
  const review = await createWriteReview(first.ops, { address: account, fn, rawArgs: ['7'], chainId: 9001 })
  const changed = operations({ getAccount: async () => ({ address: account, chainId: 9002 }) })
  await assert.rejects(confirmReviewedWrite(changed.ops, review), /changed/)
  assert.equal(changed.calls.includes('write'), false)
  const reverted = operations({ wait: async () => ({ status: 'reverted' as const }) })
  await assert.rejects(confirmReviewedWrite(reverted.ops, review), /0xabc.*set\(uint256\)/)
})
