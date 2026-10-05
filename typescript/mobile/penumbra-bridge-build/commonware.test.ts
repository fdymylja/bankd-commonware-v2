import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { bytesToHex, hexToBytes, fromRlp } from 'viem'
import { encodeGrpcResponses } from '@bankd/shieldd-web'
import { KeyValueResponse } from '@mizufinance/protobuf/shieldd/cnidarium/v1/cnidarium_pb'
import { createShielddFetch, rpc, broadcast, waitForConfirmation, assertCommittedAnchor } from './commonware'
const url = 'http://127.0.0.1:8545'
const hash = ('0x' + 'aa'.repeat(32)) as `0x${string}`
const json = (result: unknown) => Response.json({ jsonrpc: '2.0', id: 1, result })

test('binary gRPC-web maps protobuf payloads to bankd_shieldQuery', async () => {
  let called: any
  const fetcher = createShielddFetch(() => url, async (input, init) => {
    assert.equal(input, url)
    called = JSON.parse(String(init?.body))
    return json(['0x0102', '0x03'])
  })
  const response = await fetcher(`${url}/shieldd.core.component.compact_block.v1.QueryService/CompactBlockRange`, {
    method: 'POST', headers: { 'content-type': 'application/grpc-web+proto' }, body: new Uint8Array([0,0,0,0,2,8,1]),
  })
  assert.deepEqual(called.params, ['CompactBlockRange', '0x0801'])
  assert.equal(called.method, 'bankd_shieldQuery')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), encodeGrpcResponses([new Uint8Array([1,2]),new Uint8Array([3])]))
})
test('text gRPC-web returns base64-framed protobuf and trailers', async () => {
  const fetcher = createShielddFetch(() => url, async () => json(['0x04']))
  const response = await fetcher(`${url}/query/KeyValue`, { method:'POST', headers:{'content-type':'application/grpc-web-text'},body:btoa(String.fromCharCode(0,0,0,0,0)) })
  assert.equal(await response.text(), Buffer.from(encodeGrpcResponses([new Uint8Array([4])])).toString('base64'))
})
test('unknown methods and malformed gRPC frames are rejected without RPC submission', async () => {
  let calls = 0
  const fetcher = createShielddFetch(() => url, async () => { calls++; return json([]) })
  await assert.rejects(fetcher(`${url}/query/Deposit`, { method:'POST' }), /Unsupported/)
  await assert.rejects(fetcher(`${url}/query/KeyValue`, { method:'POST', body:new Uint8Array([0,0,0,0,8,1]) }))
  assert.equal(calls, 0)
})
test('normal prover requests pass through the query adapter unchanged', async () => {
  const init = { method: 'POST', body: 'witness' }
  const fetcher = createShielddFetch(() => url, async (input, options) => { assert.equal(input, 'http://127.0.0.1:8090/prove');assert.equal(options, init);return new Response('proof') })
  assert.equal(await (await fetcher('http://127.0.0.1:8090/prove', init)).text(), 'proof')
})
test('RPC and HTTP failures propagate to the wallet', async () => {
  await assert.rejects(rpc(url,'eth_chainId',[],async () => Response.json({error:{message:'wrong chain'}})), /wrong chain/)
  await assert.rejects(rpc(url,'eth_chainId',[],async () => new Response('',{status:503})), /503/)
  await assert.rejects(rpc(url,'eth_chainId',[],async () => Response.json({})), /no result/)
})
test('broadcast wraps protobuf in the native 0x77 RLP envelope', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body))
    assert.equal(request.method,'eth_sendRawTransaction')
    const raw = hexToBytes(request.params[0])
    assert.equal(raw[0],0x77)
    assert.deepEqual(fromRlp(bytesToHex(raw.slice(1))), ['0x010203'])
    return json(hash)
  }
  try { assert.equal(await broadcast(url,new Uint8Array([1,2,3])),hash) }
  finally { globalThis.fetch = saved }
})
test('confirmation waits for a successful receipt and finalized height', async () => {
  const saved = globalThis.fetch
  let heightCalls=0
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body))
    return json(request.method === 'eth_getTransactionReceipt' ? {status:'0x1',blockNumber:'0xa'} : {number: ++heightCalls > 1 ? '0xa' : '0x9'})
  }
  try { assert.equal(await waitForConfirmation(url,hash,1000,1),10);assert.equal(heightCalls,2) }
  finally { globalThis.fetch = saved }
})
test('reverted and missing receipts never report success', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = async () => json({status:'0x0',blockNumber:'0xa'})
  try { await assert.rejects(waitForConfirmation(url,hash,1000,1), /reverted/) }
  finally { globalThis.fetch = saved }
  globalThis.fetch = async () => json(null)
  try { await assert.rejects(waitForConfirmation(url,hash,3,1), /check transaction/) }
  finally { globalThis.fetch = saved }
})
test('uncommitted SCT anchors block proving/submission and query errors fail closed', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = async () => json([bytesToHex(new KeyValueResponse().toBinary())])
  try { await assert.rejects(assertCommittedAnchor(url,new Uint8Array(32)), /out of sync/) }
  finally { globalThis.fetch = saved }
  globalThis.fetch = async () => Response.json({error:{message:'snapshot unavailable'}})
  try { await assert.rejects(assertCommittedAnchor(url,new Uint8Array(32)), /snapshot unavailable/) }
  finally { globalThis.fetch = saved }
})
