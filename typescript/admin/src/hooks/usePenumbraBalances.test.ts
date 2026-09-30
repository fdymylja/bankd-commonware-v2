import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AssetId, Metadata, ValueView } from '@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb'
import { Amount } from '@mizufinance/protobuf/shieldd/core/num/v1/num_pb'
import { BalancesResponse } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'
import { extractRawBalance } from './usePenumbraBalances'

test('known-asset balance reads the current Shieldd metadata identifier', () => {
  const id = new Uint8Array(32).fill(7)
  const response = new BalancesResponse({ balanceView: new ValueView({ valueView: {
    case: 'knownAssetId', value: {
      amount: new Amount({ lo: 22456n }),
      metadata: new Metadata({ shielddAssetId: new AssetId({ inner: id }), base: 'ubrl', symbol: 'BRL' }),
    },
  } }) })
  const balance = extractRawBalance(response)
  assert.ok(balance)
  assert.equal(balance.amount, 22456n)
  assert.equal(balance.assetId, `0x${Buffer.from(id).toString('hex')}`)
})
