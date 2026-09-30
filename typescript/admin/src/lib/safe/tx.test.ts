import assert from 'node:assert/strict'
import test from 'node:test'

import { BANK_SEND_ABI, BANK_SEND_ADDRESS } from '@bankd/shared/evm/bankd'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { type Hex, decodeFunctionData, getAddress } from 'viem'

import { hexToBech32 } from '@/lib/utils'

import {
  AUTHORITY_MODULE_ADDRESS,
  CREATE_CALL_ADDRESS,
  MULTISEND_ABI,
  MULTISEND_CALL_ONLY_ADDRESS,
  ZERO_ADDRESS,
} from './abi'
import {
  buildAuthoritySend,
  buildChangeThreshold,
  buildCosmosSend,
  buildDeploy,
  buildMultiSend,
  buildNativeSend,
  decodeAuthorityMsgExec,
  encodeAuthorityMsgExec,
  encodeMultiSendTransactions,
  safeTxExecArgs,
  safeTxHashArgs,
} from './tx'

const SAFE = '0x1111111111111111111111111111111111111111'
const SAFE_BECH32 = 'wallet1zg3g2eqzm3twzefsmakn6t7fjuedqmt3qm5z3r'
const TO_HEX = '0x00000000000000000000000000000000000000aa'
const TO_BECH32 = 'wallet1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq2tq6ku'

test('buildNativeSend: raw value transfer, CALL, no refund', () => {
  const tx = buildNativeSend({ to: TO_HEX, valueWei: '1000000000000', nonce: '5' })
  assert.equal(tx.to, TO_HEX)
  assert.equal(tx.value, '1000000000000')
  assert.equal(tx.data, '0x')
  assert.equal(tx.operation, 0)
  assert.equal(tx.safeTxGas, '0')
  assert.equal(tx.baseGas, '0')
  assert.equal(tx.gasPrice, '0')
  assert.equal(tx.gasToken, ZERO_ADDRESS)
  assert.equal(tx.refundReceiver, ZERO_ADDRESS)
  assert.equal(tx.nonce, '5')
})

test('legacy native send intent uses the BankSend precompile', () => {
  const tx = buildCosmosSend({ fromBech32: SAFE_BECH32, toBech32: hexToBech32(TO_HEX), denom: 'abrl', amount: '1000000000000000000', nonce: '0' })
  assert.equal(tx.to, BANK_SEND_ADDRESS)
  assert.equal(tx.value, '0')
  const decoded = decodeFunctionData({ abi: BANK_SEND_ABI, data: tx.data })
  assert.equal(decoded.functionName, 'send')
  assert.deepEqual(decoded.args, [getAddress(TO_HEX), 1000000000000000000n])
  assert.throws(() => buildCosmosSend({ fromBech32: SAFE_BECH32, toBech32: TO_BECH32, denom: 'ubrl', amount: '1', nonce: '0' }))
})

test('encodeAuthorityMsgExec round-trips sender + inner Any', () => {
  const innerValue = MsgSend.encode({
    fromAddress: AUTHORITY_MODULE_ADDRESS,
    toAddress: TO_BECH32,
    amount: [{ denom: 'ubrl', amount: '7' }],
  }).finish()
  const bytes = encodeAuthorityMsgExec({
    sender: SAFE_BECH32,
    innerTypeUrl: '/cosmos.bank.v1beta1.MsgSend',
    innerValue,
  })
  const { sender, inner } = decodeAuthorityMsgExec(bytes)
  assert.equal(sender, SAFE_BECH32)
  assert.equal(inner.typeUrl, '/cosmos.bank.v1beta1.MsgSend')
  assert.deepEqual(inner.value, innerValue)
})

test('removed authority-module send cannot produce a proposal', () => {
  assert.throws(() => buildAuthoritySend({ safeBech32: SAFE_BECH32, toBech32: TO_BECH32, denom: 'abrl', amount: '42', nonce: '3' }), /unavailable on Commonware/)
})

test('buildChangeThreshold: self-call on the Safe', () => {
  const tx = buildChangeThreshold({ safeAddress: SAFE, threshold: 3, nonce: '1' })
  assert.equal(tx.to, SAFE)
  assert.equal(tx.value, '0')
  // changeThreshold(uint256) selector.
  assert.ok(tx.data.startsWith('0x694e80c3'))
})

test('safeTxHashArgs / safeTxExecArgs: 10-tuple with bigints', () => {
  const tx = buildNativeSend({ to: TO_HEX, valueWei: '10', nonce: '2' })
  const hashArgs = safeTxHashArgs(tx)
  assert.equal(hashArgs.length, 10)
  assert.equal(hashArgs[1], 10n)
  assert.equal(hashArgs[9], 2n)

  const execArgs = safeTxExecArgs(tx, '0xdeadbeef')
  assert.equal(execArgs.length, 10)
  assert.equal(execArgs[9], '0xdeadbeef')
})

test('encodeMultiSendTransactions: packs operation/to/value/dataLen/data', () => {
  const packed = encodeMultiSendTransactions([
    { to: TO_HEX, value: '5', data: '0xabcd' },
  ])
  // op=00, to(20)=..aa, value(32)=..05, dataLen(32)=..02, data=abcd
  const expected =
    '0x00' +
    '00000000000000000000000000000000000000aa' +
    '0000000000000000000000000000000000000000000000000000000000000005' +
    '0000000000000000000000000000000000000000000000000000000000000002' +
    'abcd'
  assert.equal(packed.toLowerCase(), expected.toLowerCase())
})

test('buildMultiSend: delegatecall (operation=1) to MultiSendCallOnly', () => {
  const tx = buildMultiSend({
    calls: [
      { to: TO_HEX, value: '0', data: '0x1234' },
      { to: SAFE, value: '1', data: '0x' },
    ],
    nonce: '7',
  })
  assert.equal(tx.to, MULTISEND_CALL_ONLY_ADDRESS)
  assert.equal(tx.operation, 1)
  assert.equal(tx.value, '0')
  assert.equal(tx.nonce, '7')
  // multiSend(bytes) selector.
  assert.ok(tx.data.startsWith('0x8d80ff0a'))
  const { args } = decodeFunctionData({ abi: MULTISEND_ABI, data: tx.data })
  assert.equal(
    (args as readonly Hex[])[0].toLowerCase(),
    encodeMultiSendTransactions([
      { to: TO_HEX, value: '0', data: '0x1234' },
      { to: SAFE, value: '1', data: '0x' },
    ]).toLowerCase()
  )
})

test('buildDeploy: CreateCall.performCreate call (operation=0)', () => {
  const tx = buildDeploy({ bytecode: '0x6003', value: '0', nonce: '4' })
  assert.equal(tx.to, CREATE_CALL_ADDRESS)
  assert.equal(tx.operation, 0)
  // performCreate(uint256,bytes) selector.
  assert.ok(tx.data.startsWith('0x4c8c9ea1'))
})
