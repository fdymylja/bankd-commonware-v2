import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { bech32m } from 'bech32'
import { decodeFunctionData, encodeFunctionData, hexToBytes } from 'viem'
import { amountInBaseUnits, publicTransferCall, shieldDepositCall, ibcTransferCall } from './transactions'

const recipient = '0x1111111111111111111111111111111111111111'
const privateAddress = bech32m.encode('shieldd', bech32m.toWords(new Uint8Array(48).fill(3)), 1023)

test('BRL preserves all 18 fractional digits and single base units', () => {
  assert.equal(amountInBaseUnits('1.123456789012345678', 18), 1123456789012345678n)
  assert.equal(amountInBaseUnits('0.000000000000000001', 18), 1n)
})
test('invalid, zero and excessive precision amounts fail before signing', () => {
  for (const amount of ['0', '-1', 'NaN', '1e3', ' 1', '1.0000000000000000001']) assert.throws(() => amountInBaseUnits(amount, 18))
  assert.throws(() => amountInBaseUnits('1', -1))
})
test('native send encodes BankSend recipient and exact integer amount', () => {
  const call = publicTransferCall(recipient, '0.000000000000000123', 'abrl', 18)
  if (call.functionName !== 'send') throw new Error('Expected BankSend')
  const decoded = decodeFunctionData({ abi: call.abi, data: encodeFunctionData(call) })
  assert.equal(decoded.functionName, 'send')
  assert.deepEqual(decoded.args, [recipient, 123n])
  assert.equal('value' in call, false)
})
test('ordinary ERC20 sends remain EVM transfers', () => {
  const call = publicTransferCall(recipient, '1.25', `erc20:${recipient}`, 6)
  assert.equal(call.functionName, 'transfer')
  assert.deepEqual(call.args, [recipient, 1250000n])
})
test('unsupported public token and old BRL decimals are rejected', () => {
  assert.throws(() => publicTransferCall(recipient, '1', 'ubrl', 6))
  assert.throws(() => publicTransferCall(recipient, '1', 'abrl', 6))
})
test('Shield deposit is payable native BRL and uses a Shieldd address', () => {
  const call = shieldDepositCall(privateAddress, '0.1', 'abrl', 18)
  assert.equal(call.value, 100000000000000000n)
  assert.deepEqual(decodeFunctionData({ abi: call.abi, data: encodeFunctionData(call) }).args, [privateAddress])
})
test('Shield rejects ERC20 and malformed private addresses', () => {
  assert.throws(() => shieldDepositCall(privateAddress, '1', `erc20:${recipient}`, 18))
  assert.throws(() => shieldDepositCall('shieldd1badchecksum', '1', 'abrl', 18))
})
test('IBC timeout uses seconds with native adapter value', () => {
  const call = ibcTransferCall('bankd-hub', 'cosmos1recipient', '0.5', 'abrl', 18, 'memo', 1_700_000_000_000)
  assert.deepEqual(call.args, ['bankd-hub', 'cosmos1recipient', 1700000600n, 'memo'])
  assert.equal(call.value, 500000000000000000n)
  assert.ok(hexToBytes(encodeFunctionData(call)).length > 4)
})
test('unconfigured IBC clients and ERC20 conversion fail before submission', () => {
  assert.throws(() => ibcTransferCall('', recipient, '1', 'abrl', 18))
  assert.throws(() => ibcTransferCall('bankd-hub', recipient, '1', `erc20:${recipient}`, 18))
})
