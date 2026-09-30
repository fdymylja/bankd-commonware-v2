import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AuthInfo,
  TxBody,
  TxRaw,
} from '@mizufinance/protobuf/cosmos/tx/v1beta1/tx_pb'

import {
  rewriteShielddQueryUrl,
  wrapShielddTransaction,
} from './embedded-shieldd'

test('rewrites Shieldd query paths through Bankd', () => {
  assert.equal(
    rewriteShielddQueryUrl(
      'http://localhost:11317/shieldd.core.component.compliance.v1.QueryService/ComplianceUserLeaf'
    ),
    'http://localhost:11317/mizufinance.shieldd.v1.Query/ComplianceUserLeaf'
  )
})

test('wraps a Shieldd transaction in the Bankd delivery envelope', () => {
  const shielddTransaction = new Uint8Array([1, 2, 3, 4])
  const raw = TxRaw.fromBinary(wrapShielddTransaction(shielddTransaction))
  const body = TxBody.fromBinary(raw.bodyBytes)
  const authInfo = AuthInfo.fromBinary(raw.authInfoBytes)

  assert.equal(body.messages.length, 1)
  assert.equal(body.messages[0].typeUrl, '/mizufinance.shieldd.v1.MsgDeliverTx')
  assert.deepEqual(
    body.messages[0].value,
    new Uint8Array([0x0a, shielddTransaction.length, ...shielddTransaction])
  )
  assert.equal(body.extensionOptions.length, 1)
  assert.equal(
    body.extensionOptions[0].typeUrl,
    '/mizufinance.shieldd.v1.ExtensionOptionsShielddTx'
  )
  assert.equal(authInfo.fee?.amount.length, 0)
  assert.equal(raw.signatures.length, 0)
})
