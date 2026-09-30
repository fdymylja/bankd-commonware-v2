import { type Abi, type Address, getAddress } from 'viem'

import { parseUntrustedAbi } from './abiValidation'

const STORAGE_KEY = 'bankd-contract-abis-v2'
const LEGACY_STORAGE_KEY = 'bankd-contract-abis-v1'
export const ABIS_CHANGED_EVENT = 'bankd:contract-abis-changed'

export type StoredAbi = {
  chainId: number
  address: Address
  label?: string
  abi: Abi
  source: 'local-unverified'
}
export type AbiStoreError = { kind: 'store' | 'entry'; message: string; address?: string }
export type LoadedAbiStore = {
  records: Record<string, StoredAbi>
  errors: AbiStoreError[]
  legacy: { status: 'none' | 'ignored-ambiguous' }
}

type StoreRoot = { version: 2; entries: Record<string, unknown> }

function browserStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}
function normalizedAddress(address: string): Address {
  return getAddress(address.toLowerCase())
}
function entryKey(chainId: number, address: string) {
  return `${chainId}:${normalizedAddress(address).toLowerCase()}`
}
function notify() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(ABIS_CHANGED_EVENT))
}
function readRoot(): { root: StoreRoot; error?: AbiStoreError } {
  const storage = browserStorage()
  if (!storage) return { root: { version: 2, entries: {} } }
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return { root: { version: 2, entries: {} } }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('root must be an object')
    const candidate = parsed as Record<string, unknown>
    if (candidate.version !== 2 || candidate.entries === null || typeof candidate.entries !== 'object' || Array.isArray(candidate.entries)) throw new Error('unsupported storage schema')
    return { root: { version: 2, entries: candidate.entries as Record<string, unknown> } }
  } catch (error) {
    return { root: { version: 2, entries: {} }, error: { kind: 'store', message: `Stored ABI data is corrupt: ${error instanceof Error ? error.message : 'invalid data'}` } }
  }
}
function validateStored(value: unknown, expectedKey: string): StoredAbi {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('entry must be an object')
  const item = value as Record<string, unknown>
  if (!Number.isSafeInteger(item.chainId) || Number(item.chainId) <= 0) throw new Error('chainId is invalid')
  if (typeof item.address !== 'string') throw new Error('address is invalid')
  const address = normalizedAddress(item.address)
  if (entryKey(Number(item.chainId), address) !== expectedKey) throw new Error('entry key does not match chain and address')
  if (item.source !== 'local-unverified') throw new Error('source is invalid')
  if (item.label !== undefined && typeof item.label !== 'string') throw new Error('label is invalid')
  return { chainId: Number(item.chainId), address, source: 'local-unverified', label: item.label as string | undefined, abi: parseUntrustedAbi(item.abi) }
}
function writeRoot(root: StoreRoot) {
  const storage = browserStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEY, JSON.stringify(root))
  notify()
}

export function loadAbiStore(chainId: number): LoadedAbiStore {
  const { root, error } = readRoot()
  const records: Record<string, StoredAbi> = {}
  const errors = error ? [error] : []
  for (const [key, value] of Object.entries(root.entries)) {
    if (!key.startsWith(`${chainId}:`)) continue
    const address = key.slice(key.indexOf(':') + 1)
    try { records[address] = validateStored(value, key) } catch (cause) {
      errors.push({ kind: 'entry', address, message: cause instanceof Error ? cause.message : 'Invalid stored ABI' })
    }
  }
  return { records, errors, legacy: { status: browserStorage()?.getItem(LEGACY_STORAGE_KEY) ? 'ignored-ambiguous' : 'none' } }
}
export function loadAllAbis(chainId: number): Record<string, StoredAbi> { return loadAbiStore(chainId).records }
export function loadAbi(chainId: number, address: string): StoredAbi | undefined { return loadAbiStore(chainId).records[normalizedAddress(address).toLowerCase()] }
export function saveAbiFromJson(chainId: number, addressInput: string, json: string, label?: string): StoredAbi {
  const address = normalizedAddress(addressInput)
  const record: StoredAbi = { chainId, address, abi: parseUntrustedAbi(json), label: label?.trim() || undefined, source: 'local-unverified' }
  const { root } = readRoot()
  root.entries[entryKey(chainId, address)] = record
  writeRoot(root)
  return record
}
export function removeAbi(chainId: number, address: string): void {
  const { root } = readRoot()
  delete root.entries[entryKey(chainId, address)]
  writeRoot(root)
}
export function purgeLegacyAbis(): void { browserStorage()?.removeItem(LEGACY_STORAGE_KEY); notify() }
