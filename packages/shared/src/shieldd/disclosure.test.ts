import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeDisclosureResponse, disclosureRequest, validateDisclosureSelection } from './disclosure'

const selection = { transactionId: 'ab'.repeat(32), height: '10', action: 0, output: 0 }
function frame(flags: number, bytes: Uint8Array) {
  const result = new Uint8Array(bytes.length + 5)
  result[0] = flags
  new DataView(result.buffer).setUint32(1, bytes.length, false)
  result.set(bytes, 5)
  return result
}
const payload = frame(0, new Uint8Array([8, 10]))
const trailer = (status: string) => frame(128, new TextEncoder().encode(`grpc-status: ${status}\r\n`))
const join = (...parts: Uint8Array[]) => new Uint8Array(parts.flatMap(part => [...part]))

test('requires bounded unambiguous unary success, not just HTTP success', () => {
  assert.deepEqual(decodeDisclosureResponse(join(payload, trailer('0')), null), new Uint8Array([8, 10]))
  for (const raw of [payload, join(payload, trailer('13')), join(payload, payload, trailer('0')), join(payload, trailer('0'), payload), payload.subarray(0, 6), frame(0, new Uint8Array(96 * 1024 + 17)), join(frame(1, new Uint8Array()), trailer('0'))]) {
    assert.throws(() => decodeDisclosureResponse(raw, null))
  }
  assert.throws(() => decodeDisclosureResponse(join(payload, trailer('0')), '13'))
  assert.throws(() => decodeDisclosureResponse(join(payload, frame(128, new TextEncoder().encode('grpc-status: 0\r\ngrpc-status: 0\r\n'))), null))
})

test('selector errors fail before custody or node access and memo capability is explicit', () => {
  validateDisclosureSelection(selection)
  for (const change of [{ height: '9007199254740992' }, { height: '0' }, { height: '01' }, { action: -1 }, { output: 2 ** 32 }, { action: NaN }, { action: 0.5 }, { transactionId: 'AB'.repeat(32) }]) {
    assert.throws(() => disclosureRequest('chain', { ...selection, ...change }, 'openings'))
  }
  assert.equal(JSON.parse(disclosureRequest('chain', selection, 'openings')).outputs[0].memo, false)
  assert.equal(JSON.parse(disclosureRequest('chain', selection, 'payload-keys')).outputs[0].memo, true)
})

test('invalid selectors and node failures never produce accepted transaction bytes', async context => {
  const { committedDisclosureTransaction } = await import('./disclosure')
  let calls = 0
  const fetch = context.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response(join(payload, trailer('13')), { status: 200 })
  })
  await assert.rejects(committedDisclosureTransaction('http://node', 'chain', { ...selection, output: -1 }), /selector/)
  assert.equal(calls, 0)
  await assert.rejects(committedDisclosureTransaction('http://node', 'chain', selection), /unavailable/)
  fetch.mock.mockImplementation(async () => new Response(null, { status: 503 }))
  await assert.rejects(committedDisclosureTransaction('http://node', 'chain', selection), /HTTP 503/)
  fetch.mock.mockImplementation(async () => new Response(new Uint8Array(96 * 1024 + 16 + 4097)))
  await assert.rejects(committedDisclosureTransaction('http://node', 'chain', selection), /size limit/)
})

test('wrong chain, wrong height and absent transactions fail independently of evidence', async context => {
  const { committedDisclosureTransaction } = await import('./disclosure')
  const { AppParametersResponse, AppParameters, CommittedTransactionResponse } = await import('@mizufinance/protobuf/shieldd/core/app/v1/app_pb')
  const response = (bytes: Uint8Array) => new Response(join(frame(0, bytes), trailer('0')))
  const fetch = context.mock.method(globalThis, 'fetch', async () => response(new AppParametersResponse({ appParameters: new AppParameters({ chainId: 'another-chain' }) }).toBinary()))
  await assert.rejects(committedDisclosureTransaction('http://node', 'chain', selection), /chain/)
  for (const height of [9n, 10n]) {
    fetch.mock.mockImplementation(async (url: string | URL | Request) => {
      if (String(url).endsWith('/AppParameters')) return response(new AppParametersResponse({ appParameters: new AppParameters({ chainId: 'chain' }) }).toBinary())
      return response(new CommittedTransactionResponse({ blockHeight: height }).toBinary())
    })
    await assert.rejects(committedDisclosureTransaction('http://node', 'chain', selection), /not accepted/)
  }
})

test('query headers fit the Bankd API CORS allowance', async context => {
  const { committedDisclosureTransaction } = await import('./disclosure')
  const { AppParametersResponse, AppParameters, CommittedTransactionResponse } = await import('@mizufinance/protobuf/shieldd/core/app/v1/app_pb')
  const { Transaction } = await import('@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb')
  const transaction = new Transaction()
  let calls = 0
  context.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    // Cosmos SDK's API server permits Content-Type plus CORS-safelisted headers.
    const headers = new Headers(init?.headers)
    for (const name of headers.keys()) assert.ok(['accept', 'content-type'].includes(name), `Bankd preflight rejects ${name}`)
    assert.equal(headers.get('content-type'), 'application/grpc-web+proto')
    const request = init?.body as Uint8Array
    assert.equal(request[0], 0)
    assert.equal(new DataView(request.buffer, request.byteOffset + 1, 4).getUint32(0), request.length - 5)
    calls++
    const message = String(url).endsWith('/AppParameters')
      ? new AppParametersResponse({ appParameters: new AppParameters({ chainId: 'chain' }) })
      : new CommittedTransactionResponse({ blockHeight: 10n, transaction })
    return new Response(join(frame(0, message.toBinary()), trailer('0')))
  })
  assert.equal(await committedDisclosureTransaction('http://node', 'chain', selection), Buffer.from(transaction.toBinary()).toString('base64'))
  assert.equal(calls, 2)
})
