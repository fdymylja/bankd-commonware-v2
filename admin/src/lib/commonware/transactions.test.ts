import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BANK_SEND_ABI,
  BANK_SEND_ADDRESS,
  COMPLIANCE_ABI,
  COMPLIANCE_ADDRESS,
  SHIELD_ADDRESS,
} from '@bankd/shared/evm/bankd'
import { type Hex, decodeFunctionData, encodeFunctionData } from 'viem'

import {
  MsgFreeze,
  MsgSeize,
  MsgSetGlobalPause,
  exec,
} from '@/lib/compliance/msgs'
import { hexToBech32 } from '@/lib/utils'

import { bankdMessageCall } from './transactions'

const from = '0x1111111111111111111111111111111111111111'
const to = '0x2222222222222222222222222222222222222222'
const coin = { denom: 'abrl', amount: '1234567891234567890' }

test('public BRL send uses EVM BankSend and preserves all 18 decimals', () => {
  const call = bankdMessageCall('/cosmos.bank.v1beta1.MsgSend', {
    fromAddress: from,
    toAddress: hexToBech32(to),
    amount: [coin],
  })
  assert.equal(call.address, BANK_SEND_ADDRESS)
  const decoded = decodeFunctionData({
    abi: BANK_SEND_ABI,
    data: encodeFunctionData(call) as Hex,
  })
  assert.deepEqual(decoded.args, [to, 1234567891234567890n])
})

test('shielding sends native value to Shield.deposit, never a Cosmos envelope', () => {
  const call = bankdMessageCall('/mizufinance.shieldd.v1.MsgDeposit', {
    recipient: 'shieldd1recipient',
    amount: coin,
  })
  assert.equal(call.address, SHIELD_ADDRESS)
  assert.equal(call.value, 1234567891234567890n)
  assert.equal(call.functionName, 'deposit')
})

test('retained compliance form fields produce the actual freeze and seize ABI', () => {
  for (const intent of [
    exec(from, MsgFreeze, {
      address: to,
      reason: 'case',
      ref: 'local annotation',
    }),
    exec(from, MsgSeize, { from, to, amount: [coin], reason: 'case' }),
  ]) {
    const call = bankdMessageCall(intent.msg.typeUrl, intent.values)
    assert.equal(call.address, COMPLIANCE_ADDRESS)
    const decoded = decodeFunctionData({
      abi: COMPLIANCE_ABI,
      data: encodeFunctionData(call) as Hex,
    })
    assert.equal(
      decoded.functionName,
      intent.values.msg.typeUrl.endsWith('MsgFreeze') ? 'freeze' : 'seize'
    )
    if (decoded.functionName === 'seize')
      assert.deepEqual(decoded.args, [from, to, 1234567891234567890n])
  }
})

test('unsupported denoms, zero amounts and absent base actions fail before signing', () => {
  for (const amount of [
    [{ denom: 'ubrl', amount: '1' }],
    [{ denom: 'abrl', amount: '0' }],
    [coin, coin],
  ])
    assert.throws(() =>
      bankdMessageCall('/cosmos.bank.v1beta1.MsgSend', {
        toAddress: to,
        amount,
      })
    )
  const pause = exec(from, MsgSetGlobalPause, { paused: true })
  assert.throws(
    () => bankdMessageCall(pause.msg.typeUrl, pause.values),
    /unavailable/
  )
})
