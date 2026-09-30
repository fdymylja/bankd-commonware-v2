import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addressFromBech32m,
  bech32mAddress,
} from './shieldd-address'

const TEST_ADDRESS =
  'shieldd1u29dhz4vxgnek6a3vzxlejg0l83wegpu7hgs3yphdvljcnnnh89dvs6lc9hxxw94w464t7lh5x36cxnxyx0'

test('round-trips the canonical 48-byte Shieldd address format', () => {
  const decoded = addressFromBech32m(TEST_ADDRESS)
  assert.equal(decoded.inner.length, 48)
  assert.equal(bech32mAddress(decoded), TEST_ADDRESS)
})

test('rejects legacy Penumbra-length address bytes', () => {
  assert.throws(
    () => bech32mAddress({ inner: new Uint8Array(80) }),
    /expected 48, got 80/
  )
})
