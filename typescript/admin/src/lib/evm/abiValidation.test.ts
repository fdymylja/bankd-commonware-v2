import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalFunctionSignature, parseUntrustedAbi } from './abiValidation'

test('rejects malformed and structurally invalid ABIs', () => {
  assert.throws(() => parseUntrustedAbi('{'), /valid JSON/)
  assert.throws(() => parseUntrustedAbi('{}'), /ABI array/)
  assert.throws(() => parseUntrustedAbi('[{"type":"function","inputs":[],"outputs":[]} ]'), /name/)
  assert.throws(() => parseUntrustedAbi('[{"type":"function","name":"f","inputs":[{"type":"tuple"}],"outputs":[],"stateMutability":"view"}]'), /components/)
  assert.throws(() => parseUntrustedAbi('[{"type":"function","name":"f","inputs":[{"type":"tuple","components":[{"type":"wat"}]}],"outputs":[],"stateMutability":"view"}]'), /Solidity type/)
  assert.throws(() => parseUntrustedAbi('[{"type":"function","name":"f","inputs":[{"type":"uint7"}],"outputs":[],"stateMutability":"view"}]'), /Solidity type/)
  assert.throws(() => parseUntrustedAbi('[{"type":"function","name":"f","inputs":[{"type":"uint256[0]"}],"outputs":[],"stateMutability":"view"}]'), /greater than zero/)
  assert.throws(() => parseUntrustedAbi('[{"type":"function","name":"f","inputs":[],"outputs":[],"stateMutability":"unknown"}]'), /stateMutability/)
})

test('accepts standard ABI constructs and computes tuple canonical signatures', () => {
  const abi = parseUntrustedAbi(JSON.stringify([
    { type: 'function', name: 'f', stateMutability: 'view', inputs: [{ type: 'tuple[]', components: [{ name: 'n', type: 'uint256' }, { name: 'a', type: 'address' }] }, { type: 'bytes32' }], outputs: [] },
    { type: 'event', name: 'Changed', inputs: [{ name: 'n', type: 'uint256', indexed: true }], anonymous: false },
    { type: 'error', name: 'Bad', inputs: [{ name: 'why', type: 'string' }] },
    { type: 'constructor', stateMutability: 'nonpayable', inputs: [] },
    { type: 'fallback', stateMutability: 'payable' },
    { type: 'receive', stateMutability: 'payable' },
  ]))
  assert.equal(abi.length, 6)
  assert.equal(canonicalFunctionSignature(abi[0]), 'f((uint256,address)[],bytes32)')
})

test('accepts compiler artifacts without trusting their objects', () => {
  const source = { abi: [{ type: 'function', name: 'x', stateMutability: 'pure', inputs: [], outputs: [{ type: 'bool' }] }] }
  const abi = parseUntrustedAbi(JSON.stringify(source))
  source.abi[0].name = 'mutated'
  assert.equal(canonicalFunctionSignature(abi[0]), 'x()')
})
