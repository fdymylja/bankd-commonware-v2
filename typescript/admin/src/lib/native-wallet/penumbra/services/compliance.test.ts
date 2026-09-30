import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerRegulatedUser } from './compliance'

test('invalid address indices are rejected before opening the wallet or calling WASM', async () => {
  for (const addressIndex of [NaN, Infinity, -1, 0.5, 2 ** 32]) {
    await assert.rejects(
      registerRegulatedUser({ denom: 'ubrl', addressIndex, registrationJson: '{}' }),
      /Address index must be/,
    )
  }
})
