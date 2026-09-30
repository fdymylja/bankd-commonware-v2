import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { BinaryReader } from '@bufbuild/protobuf'
import { TxRaw, TxBody } from '@mizufinance/protobuf/cosmos/tx/v1beta1/tx_pb'
import { Transaction } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'

export async function commitShieldd(page, button, expectedAction, afterSubmit) {
  const rpc = process.env.NEXT_PUBLIC_PENUMBRA_RPC_URL ?? 'http://127.0.0.1:27657'
  const submitted = page.waitForRequest(r => r.method() === 'GET' && new URL(r.url()).pathname === '/broadcast_tx_sync', { timeout: 240_000 })
  await button.click({ timeout: 60_000 })
  await afterSubmit?.()
  const encoded = new URL((await submitted).url()).searchParams.get('tx')
  assert.match(encoded ?? '', /^0x[\da-f]+$/i)
  const submittedBytes = Buffer.from(encoded.slice(2), 'hex')
  const hash = createHash('sha256').update(submittedBytes).digest('hex').toUpperCase()
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const result = await fetch(`${rpc}/tx?hash=0x${hash}`, { signal: AbortSignal.timeout(10_000) }).then(r => r.json())
    if (result.result?.tx_result) {
      assert.equal(result.result.tx_result.code, 0, JSON.stringify(result))
      assert.deepEqual(Buffer.from(result.result.tx, 'base64'), submittedBytes)
      const envelope = TxBody.fromBinary(TxRaw.fromBinary(Buffer.from(result.result.tx, 'base64')).bodyBytes)
      assert.equal(envelope.messages.length, 1)
      const message = envelope.messages[0]
      assert.equal(message.typeUrl, '/mizufinance.shieldd.v1.MsgDeliverTx')
      const reader = new BinaryReader(message.value)
      assert.deepEqual(reader.tag(), [1, 2])
      const bytes = reader.bytes()
      const transaction = Transaction.fromBinary(bytes)
      assert.ok(transaction.body?.actions.some(action => action.action.case === expectedAction), `Committed tx lacks ${expectedAction}`)
      return { hash, height: result.result.height, action: expectedAction, transaction: Buffer.from(bytes).toString('base64'), transactionId: createHash('sha256').update(bytes).digest('hex'), actionIndex: transaction.body.actions.findIndex(action => action.action.case === expectedAction) }
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error(`Transaction ${hash} did not commit`)
}
