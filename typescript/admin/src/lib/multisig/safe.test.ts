import assert from 'node:assert/strict'
import test from 'node:test'

import { toBase64 } from '@cosmjs/encoding'

import { aminoDeploySafe, encodeMsgDeploySafe } from './safe'

// MsgDeploySafe now carries only the sender; the chain reads members + threshold
// off the sender account's recorded multisig pubkey. Keep these vectors in
// lockstep with the Go side (x/safe/types) - a mismatch means members would sign
// bytes the chain rejects.
const SENDER = 'wallet1abc'

// proto: field 1 (sender, string) = tag 0x0A, len 10, "wallet1abc".
const PROTO_B64 = 'Cgp3YWxsZXQxYWJj'

test('encodeMsgDeploySafe matches the chain proto bytes', () => {
  assert.equal(toBase64(encodeMsgDeploySafe(SENDER)), PROTO_B64)
})

test('aminoDeploySafe matches the chain amino JSON', () => {
  assert.deepEqual(aminoDeploySafe(SENDER), {
    type: 'safe/MsgDeploySafe',
    value: { sender: SENDER },
  })
})
