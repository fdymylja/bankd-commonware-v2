import assert from 'node:assert/strict'
import test from 'node:test'

import { type AbiFunction } from 'viem'

import { parseAbiValue, parsePayableValue, prepareContractCall } from './contractCall'

const param = (type: string, components?: readonly unknown[]) => ({ type, components }) as never

test('parses bounded integers without precision loss', () => {
  assert.equal(parseAbiValue(param('uint256'), '340282366920938463463374607431768211455'), 340282366920938463463374607431768211455n)
  assert.equal(parseAbiValue(param('int8'), '-128'), -128n)
  assert.throws(() => parseAbiValue(param('uint8'), '-1'), /range/)
  assert.throws(() => parseAbiValue(param('int8'), '128'), /range/)
  assert.throws(() => parseAbiValue(param('uint256'), '1.2'), /decimal integer/)
})

test('strictly parses booleans, addresses, and byte strings', () => {
  assert.equal(parseAbiValue(param('bool'), 'true'), true)
  assert.throws(() => parseAbiValue(param('bool'), '1'), /true or false/)
  assert.equal(parseAbiValue(param('address'), '0x00000000000000000000000000000000000000aa'), '0x00000000000000000000000000000000000000AA')
  assert.throws(() => parseAbiValue(param('address'), '0xaa'), /address/)
  assert.equal(parseAbiValue(param('bytes'), '0x1234'), '0x1234')
  assert.throws(() => parseAbiValue(param('bytes4'), '0x1234'), /4 bytes/)
})

test('recursively parses tuple arrays and fixed/dynamic arrays', () => {
  const tupleArray = param('tuple[]', [{ name: 'n', type: 'uint256' }, { name: 'ok', type: 'bool' }])
  assert.deepEqual(parseAbiValue(tupleArray, '[["340282366920938463463374607431768211455",true]]'), [[340282366920938463463374607431768211455n, true]])
  assert.deepEqual(parseAbiValue(param('uint8[2][]'), '[["1","2"],["3","4"]]'), [[1n, 2n], [3n, 4n]])
  assert.throws(() => parseAbiValue(param('uint8[2]'), '["1"]'), /exactly 2/)
  assert.throws(() => parseAbiValue(tupleArray, '[[1,true]]'), /decimal string/)
  assert.throws(() => parseAbiValue(param('tuple', [{ name: 'n', type: 'uint8' }]), '{}'), /n/)
})

test('parses payable value and rejects value for nonpayable calls', () => {
  assert.equal(parsePayableValue('1.25', true, 18), 1250000000000000000n)
  assert.equal(parsePayableValue('', true, 18), 0n)
  assert.throws(() => parsePayableValue('1', false, 18), /not payable/)
})

test('prepares overload-safe narrowed calls and distinct calldata', () => {
  const uintFn = { type: 'function', name: 'foo', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] } as AbiFunction
  const addressFn = { type: 'function', name: 'foo', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] } as AbiFunction
  const target = '0x00000000000000000000000000000000000000aa'
  const a = prepareContractCall(target, uintFn, ['1'])
  const b = prepareContractCall(target, addressFn, ['0x00000000000000000000000000000000000000aa'])
  assert.equal(a.signature, 'foo(uint256)')
  assert.equal(b.signature, 'foo(address)')
  assert.notEqual(a.calldata, b.calldata)
  assert.deepEqual(a.abi, [uintFn])
})
