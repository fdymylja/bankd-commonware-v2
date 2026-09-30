import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { loadAbi, loadAbiStore, purgeLegacyAbis, removeAbi, saveAbiFromJson } from './contractAbiStorage'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}
const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage })
Object.defineProperty(globalThis, 'window', { value: { dispatchEvent() {} } })

const address = '0x00000000000000000000000000000000000000aA'
const other = '0x00000000000000000000000000000000000000bB'
const abi = '[{"type":"function","name":"x","stateMutability":"view","inputs":[],"outputs":[]}]'

beforeEach(() => storage.data.clear())

test('stores validated local ABIs by normalized chain and address', () => {
  saveAbiFromJson(9001, address, abi, ' X ')
  saveAbiFromJson(9002, address, abi)
  assert.equal(loadAbi(9001, address)?.label, 'X')
  assert.equal(loadAbi(9001, address)?.source, 'local-unverified')
  assert.equal(Object.keys(loadAbiStore(9001).records)[0], address.toLowerCase())
  assert.equal(Object.keys(loadAbiStore(9002).records).length, 1)
})

test('isolates corrupt entries and allows removing them', () => {
  storage.setItem('bankd-contract-abis-v2', JSON.stringify({ version: 2, entries: {
    [`9001:${address.toLowerCase()}`]: { chainId: 9001, address, source: 'local-unverified', abi: JSON.parse(abi) },
    [`9001:${other.toLowerCase()}`]: { chainId: 9001, address: other, source: 'local-unverified', abi: [{ type: 'function' }] },
  }}))
  const loaded = loadAbiStore(9001)
  assert.equal(Object.keys(loaded.records).length, 1)
  assert.equal(loaded.errors[0].address, other.toLowerCase())
  removeAbi(9001, other)
  assert.equal(loadAbiStore(9001).errors.length, 0)
})

test('recovers from malformed root and ignores ambiguous legacy data', () => {
  storage.setItem('bankd-contract-abis-v2', 'null')
  storage.setItem('bankd-contract-abis-v1', JSON.stringify({ [address]: { address, abi: [] } }))
  const loaded = loadAbiStore(9001)
  assert.equal(loaded.errors[0].kind, 'store')
  assert.equal(loaded.legacy.status, 'ignored-ambiguous')
  assert.equal(loadAbi(9001, address), undefined)
  purgeLegacyAbis()
  assert.equal(storage.getItem('bankd-contract-abis-v1'), null)
})
