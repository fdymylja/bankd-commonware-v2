import assert from 'node:assert/strict'
import test from 'node:test'
import { bytesToHex, fromRlp, hexToBytes } from 'viem'
import {
  decodeGrpcRequest,
  encodeGrpcResponses,
  rewriteShielddQueryUrl,
  shielddQueryUrl,
  wrapShielddTransaction,
} from './index'

test('Shieldd wire envelope is the node TxShielded EIP-2718 format', () => {
  assert.equal(
    bytesToHex(wrapShielddTransaction(new Uint8Array([1, 2, 3, 4]))),
    '0x77c58401020304'
  )
  const payload = new Uint8Array(256).fill(42)
  const encoded = wrapShielddTransaction(payload)
  assert.equal(encoded[0], 0x77)
  assert.deepEqual(fromRlp(bytesToHex(encoded.subarray(1)), 'bytes'), [payload])
  assert.throws(() => wrapShielddTransaction(new Uint8Array()), /Empty/)
})

test('native SDK queries route to the embedded wallet gateway', () => {
  assert.equal(
    rewriteShielddQueryUrl(
      'https://node/shieldd.core.component.compliance.v1.QueryService/ComplianceUserLeaf',
      '/api/shieldd'
    ),
    '/api/shieldd/query/ComplianceUserLeaf'
  )
  assert.equal(
    rewriteShielddQueryUrl('/api/account/txs', '/api/shieldd'),
    '/api/account/txs'
  )
  assert.throws(
    () => shielddQueryUrl('/api/shieldd', 'DeliverTx'),
    /Unsupported/
  )
})

test('gRPC frames reject compressed, truncated, oversized and multiple requests', () => {
  assert.deepEqual(
    decodeGrpcRequest(hexToBytes('0x0000000003010203')),
    new Uint8Array([1, 2, 3])
  )
  for (const bytes of [
    '0x',
    '0x0100000000',
    '0x00000000030102',
    '0x0000100001',
    '0x00000000000000000000',
  ])
    assert.throws(() => decodeGrpcRequest(hexToBytes(bytes)))
})

test('gRPC replies carry each protobuf response and a real status trailer', () => {
  const response = encodeGrpcResponses([
    new Uint8Array([3]),
    new Uint8Array([4, 5]),
  ])
  assert.deepEqual(
    [...response.subarray(0, 13)],
    [0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 2, 4, 5]
  )
  assert.equal(response[13], 0x80)
  assert.match(
    new TextDecoder().decode(response.subarray(18)),
    /grpc-status: 0/
  )
  assert.match(
    new TextDecoder().decode(
      encodeGrpcResponses([], 13, 'query failed').subarray(5)
    ),
    /grpc-status: 13\r\ngrpc-message: query%20failed/
  )
})
