/**
 * Web fallback for secure storage.
 * Uses localStorage instead of expo-secure-store (which is native-only).
 *
 * ⚠️ NOT SECURE — for development/demo only.
 */

import type { EphemeralAddressRecord } from '@bankd/shared/penumbra'

import type {
  AccountRecord,
  EncryptedCustody,
  KeyPrint,
  WalletConfig,
} from './types'
import { type MobileWalletConfig, SECURE_STORE_KEYS } from './types'

// =============================================================================
// Low-Level Helpers
// =============================================================================

function setJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function getJSON<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function remove(key: string): void {
  localStorage.removeItem(key)
}

// =============================================================================
// Wallet Config Operations
// =============================================================================

export async function hasWallet(): Promise<boolean> {
  return localStorage.getItem(SECURE_STORE_KEYS.WALLET_CONFIG) !== null
}

export async function saveWalletConfig(config: WalletConfig): Promise<void> {
  setJSON(SECURE_STORE_KEYS.ENCRYPTED_CUSTODY, config.encryptedCustody)
  setJSON(SECURE_STORE_KEYS.KEY_PRINT, config.keyPrint)
  localStorage.setItem(SECURE_STORE_KEYS.PENUMBRA_FVK, config.penumbraFVK)
  setJSON(SECURE_STORE_KEYS.WALLET_CONFIG, {
    id: config.id,
    label: config.label,
    createdAt: config.createdAt,
    authMethod: config.authMethod,
  })
}

export async function getWalletConfig(): Promise<WalletConfig | null> {
  const metadata = getJSON<{
    id: string
    label: string
    createdAt: number
    authMethod?: string
  }>(SECURE_STORE_KEYS.WALLET_CONFIG)
  if (!metadata) return null

  const encryptedCustody = getJSON<EncryptedCustody>(SECURE_STORE_KEYS.ENCRYPTED_CUSTODY)
  const keyPrint = getJSON<KeyPrint>(SECURE_STORE_KEYS.KEY_PRINT)
  const penumbraFVK = localStorage.getItem(SECURE_STORE_KEYS.PENUMBRA_FVK) ?? ''

  if (!encryptedCustody || !keyPrint) return null

  return {
    id: metadata.id,
    label: metadata.label,
    encryptedCustody,
    keyPrint,
    penumbraFVK,
    createdAt: metadata.createdAt,
    authMethod: (metadata.authMethod as 'password' | 'passkey') ?? 'password',
  }
}

export async function deleteWallet(): Promise<void> {
  Object.values(SECURE_STORE_KEYS).forEach((key) => remove(key))
}

// =============================================================================
// Encrypted Custody Operations
// =============================================================================

export async function getEncryptedCustody(): Promise<EncryptedCustody | null> {
  return getJSON<EncryptedCustody>(SECURE_STORE_KEYS.ENCRYPTED_CUSTODY)
}

export async function getKeyPrint(): Promise<KeyPrint | null> {
  return getJSON<KeyPrint>(SECURE_STORE_KEYS.KEY_PRINT)
}

export async function getPenumbraFVK(): Promise<string | null> {
  return localStorage.getItem(SECURE_STORE_KEYS.PENUMBRA_FVK)
}

export async function savePenumbraFVK(fvk: string): Promise<void> {
  localStorage.setItem(SECURE_STORE_KEYS.PENUMBRA_FVK, fvk)
}

// =============================================================================
// Biometric Key Operations (no-op on web)
// =============================================================================

export async function saveBiometricKey(_keyBase64: string): Promise<void> {
  console.warn('[Storage.web] Biometric key storage not available on web')
}

export async function getBiometricKey(): Promise<string | null> {
  return null
}

export async function hasBiometricKey(): Promise<boolean> {
  return false
}

export async function removeBiometricKey(): Promise<void> {
  // no-op
}

// =============================================================================
// Mobile Config Operations
// =============================================================================

export async function getMobileConfig(): Promise<MobileWalletConfig | null> {
  return getJSON<MobileWalletConfig>(SECURE_STORE_KEYS.MOBILE_CONFIG)
}

export async function saveMobileConfig(config: MobileWalletConfig): Promise<void> {
  setJSON(SECURE_STORE_KEYS.MOBILE_CONFIG, config)
}

export async function updateMobileConfig(updates: Partial<MobileWalletConfig>): Promise<void> {
  const existing = (await getMobileConfig()) ?? {
    biometricEnabled: false,
    biometricType: 'none' as const,
    lastUnlockAt: 0,
  }
  await saveMobileConfig({ ...existing, ...updates })
}

// =============================================================================
// Account Operations
// =============================================================================

export async function getAccounts(): Promise<AccountRecord[]> {
  return getJSON<AccountRecord[]>(SECURE_STORE_KEYS.ACCOUNTS) ?? []
}

export async function getAccount(index: number): Promise<AccountRecord | undefined> {
  const accounts = await getAccounts()
  return accounts.find((a) => a.index === index)
}

export async function addAccount(index: number, label: string): Promise<void> {
  const accounts = await getAccounts()
  const existing = accounts.find((a) => a.index === index)
  if (existing) {
    existing.label = label
  } else {
    accounts.push({ index, label, createdAt: Date.now() })
  }
  setJSON(SECURE_STORE_KEYS.ACCOUNTS, accounts)
}

export async function ensureDefaultAccount(): Promise<void> {
  const accounts = await getAccounts()
  if (!accounts.find((a) => a.index === 0)) {
    await addAccount(0, 'Default Account')
  }
}

// =============================================================================
// Ephemeral Address Registry Operations (localStorage)
// =============================================================================

export async function getAllEphemeralAddressRecords(): Promise<EphemeralAddressRecord[]> {
  return getJSON<EphemeralAddressRecord[]>(SECURE_STORE_KEYS.EPHEMERAL_ADDRESS_REGISTRY) ?? []
}

function normalizeRecord(record: EphemeralAddressRecord): EphemeralAddressRecord {
  return {
    ...record,
    intermediateHex: record.intermediateHex?.toLowerCase() as EphemeralAddressRecord['intermediateHex'],
  }
}

function upsertById(
  existing: EphemeralAddressRecord[],
  incoming: EphemeralAddressRecord[]
): EphemeralAddressRecord[] {
  for (const record of incoming) {
    const normalized = normalizeRecord(record)
    const idx = existing.findIndex((r) => r.id === normalized.id)
    if (idx >= 0) {
      existing[idx] = normalized
    } else {
      existing.push(normalized)
    }
  }
  return existing
}

export async function saveEphemeralAddressRecord(record: EphemeralAddressRecord): Promise<void> {
  const records = upsertById(await getAllEphemeralAddressRecords(), [record])
  setJSON(SECURE_STORE_KEYS.EPHEMERAL_ADDRESS_REGISTRY, records)
}

export async function saveEphemeralAddressRecords(newRecords: EphemeralAddressRecord[]): Promise<void> {
  const records = upsertById(await getAllEphemeralAddressRecords(), newRecords)
  setJSON(SECURE_STORE_KEYS.EPHEMERAL_ADDRESS_REGISTRY, records)
}

export async function findEphemeralAddressRecordsByPenumbraAddress(
  address: string
): Promise<EphemeralAddressRecord[]> {
  const records = await getAllEphemeralAddressRecords()
  return records.filter((r) => r.penumbraAddress === address)
}

export async function findEphemeralAddressRecordsByIntermediateHex(
  address: string
): Promise<EphemeralAddressRecord[]> {
  const normalized = address.toLowerCase()
  const records = await getAllEphemeralAddressRecords()
  return records.filter((r) => r.intermediateHex?.toLowerCase() === normalized)
}
