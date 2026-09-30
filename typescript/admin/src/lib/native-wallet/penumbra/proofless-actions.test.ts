import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MsgRegisterAsset,
  MsgRegisterUser,
} from '@mizufinance/protobuf/shieldd/core/component/compliance/v1/compliance_pb'
import { ActionPlan } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'

import { buildProoflessAction } from './proofless-actions'

test('copies an asset-registration plan into a proofless action', () => {
  const message = new MsgRegisterAsset({ isRegulated: true })
  const plan = new ActionPlan({
    action: { case: 'complianceRegisterAsset', value: message },
  })

  const action = buildProoflessAction(plan)

  assert.equal(action?.action.case, 'complianceRegisterAsset')
  assert.deepEqual(action?.action.value.toBinary(), message.toBinary())
})

test('copies a user-registration plan into a proofless action', () => {
  const message = new MsgRegisterUser()
  const plan = new ActionPlan({
    action: { case: 'complianceRegisterUser', value: message },
  })

  const action = buildProoflessAction(plan)

  assert.equal(action?.action.case, 'complianceRegisterUser')
  assert.deepEqual(action?.action.value.toBinary(), message.toBinary())
})

test('leaves proof-bearing plans for the browser prover', () => {
  assert.equal(buildProoflessAction(new ActionPlan()), undefined)
})
