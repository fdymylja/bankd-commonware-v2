import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { BinaryWriter } from '@bufbuild/protobuf'
import { TxRaw, TxBody } from '@mizufinance/protobuf/cosmos/tx/v1beta1/tx_pb'
import { Transaction } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import { commitShieldd } from './transactions.mjs'

test('confirmation uses submitted bytes and accepted chain state without a browser response event', async () => {
  const transaction = Transaction.fromJson({ body: { actions: [{ transfer: {} }] } }).toBinary()
  const value = new BinaryWriter().uint32(10).bytes(transaction).finish()
  const bodyBytes = new TxBody({ messages: [{ typeUrl: '/mizufinance.shieldd.v1.MsgDeliverTx', value }] }).toBinary()
  const bytes = new TxRaw({ bodyBytes }).toBinary()
  const hash = createHash('sha256').update(bytes).digest('hex').toUpperCase()
  const request = { method: () => 'GET', url: () => `http://localhost:27657/broadcast_tx_sync?tx=0x${Buffer.from(bytes).toString('hex')}` }
  let clicked = false
  const page = {
    waitForRequest: async predicate => { assert.ok(predicate(request)); return request },
    waitForResponse: () => { throw new Error('Browser response event was not delivered') },
  }
  const fetch = globalThis.fetch
  globalThis.fetch = async url => {
    assert.ok(clicked)
    assert.ok(String(url).endsWith(`/tx?hash=0x${hash}`))
    return Response.json({ result: { height: '7', tx: Buffer.from(bytes).toString('base64'), tx_result: { code: 0 } } })
  }
  try {
    const result = await commitShieldd(page, { click: async () => { clicked = true } }, 'transfer')
    assert.equal(result.hash, hash)
    assert.equal(result.height, '7')
    assert.equal(result.actionIndex, 0)
  } finally { globalThis.fetch = fetch }
})
