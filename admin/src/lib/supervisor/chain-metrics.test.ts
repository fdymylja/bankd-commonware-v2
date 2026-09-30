import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fromBech32 } from '@cosmjs/encoding'

import { bankAccountBech32, reconcileReserves } from './chain-metrics'

test('reconcileReserves: baseline set, balanced -> consistent true', () => {
  const result = reconcileReserves({
    minterAccounts: [
      { address: 'a', minted_total: '1000', burned_total: '400' },
      { address: 'b', minted_total: '500', burned_total: '100' },
    ],
    // baseline 200 + netMinted (1500 - 500 = 1000) = 1200
    nativeSupplyAmount: '1200',
    genesisBaseline: '200',
  })
  assert.equal(result.netMinted, '1000')
  assert.equal(result.accountedSupply, '1200')
  assert.equal(result.unbackedDelta, '0')
  assert.equal(result.baselineConfigured, true)
  assert.equal(result.consistent, true)
})

test('reconcileReserves: baseline set, drift -> consistent false', () => {
  const result = reconcileReserves({
    minterAccounts: [{ address: 'a', minted_total: '1000', burned_total: '0' }],
    // accounted = 200 + 1000 = 1200, supply 1500 -> delta 300
    nativeSupplyAmount: '1500',
    genesisBaseline: '200',
  })
  assert.equal(result.unbackedDelta, '300')
  assert.equal(result.consistent, false)
})

test('reconcileReserves: baseline unset -> consistent null', () => {
  const result = reconcileReserves({
    minterAccounts: [{ address: 'a', minted_total: '1000', burned_total: '0' }],
    nativeSupplyAmount: '999999',
    genesisBaseline: undefined,
  })
  assert.equal(result.baselineConfigured, false)
  assert.equal(result.genesisBaseline, '0')
  assert.equal(result.consistent, null)
})

test('bankAccountBech32: 0x-prefixed and bare hex round-trip', () => {
  const hex = '0102030405060708090a0b0c0d0e0f1011121314'
  const withPrefix = bankAccountBech32(`0x${hex}`)
  const bare = bankAccountBech32(hex)
  assert.equal(withPrefix, bare)
  const decoded = fromBech32(withPrefix)
  assert.equal(decoded.prefix, 'wallet')
  assert.equal(Buffer.from(decoded.data).toString('hex'), hex)
})
