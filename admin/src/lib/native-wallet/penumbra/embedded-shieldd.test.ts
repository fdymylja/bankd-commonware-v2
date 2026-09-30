import assert from 'node:assert/strict'
import test from 'node:test'

import { bytesToHex } from 'viem'

import { rewriteShielddQueryUrl, wrapShielddTransaction } from './embedded-shieldd'

test('embedded SDK queries use the Commonware gateway', () => {
  assert.equal(rewriteShielddQueryUrl('http://localhost:11317/shieldd.core.component.compliance.v1.QueryService/ComplianceUserLeaf'), '/api/shieldd/query/ComplianceUserLeaf')
})
test('wallet submits the EIP-2718 Shieldd transaction envelope', () => {
  assert.equal(bytesToHex(wrapShielddTransaction(new Uint8Array([1, 2, 3, 4]))), '0x77c58401020304')
})
