/**
 * Mobile secure storage adapter.
 * Replaces IndexedDB with expo-secure-store for hardware-backed key storage.
 *
 * Storage strategy:
 * - Sensitive data (encrypted seed, key print) → expo-secure-store (hardware keychain)
 * - Wallet metadata (label, FVK, timestamps) → expo-secure-store (still secure)
 * - Biometric key → expo-secure-store with requireAuthentication (OS-level biometric gate)
 *
 * Note: expo-secure-store has a 2KB value limit per key on some platforms,
 * so we split the wallet config across multiple keys.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

import type { EphemeralAddressRecord } from '@bankd/shared/penumbra'

import type {
  AccountRecord,
  EncryptedBox,
  EncryptedCustody,
  KeyPrint,
  WalletConfig,
} from './types'
import { type MobileWalletConfig, SECURE_STORE_KEYS } from './types'

// =============================================================================
// Low-Level Helpers
// =============================================================================

/**
 * Save a JSON-serializable value to secure store.
 */
async function setJSON<T>(key: string, value: T): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value))
}

/**
 * Read a JSON value from secure store.
 * Returns null if the key doesn't exist.
 */
async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Delete a key from secure store.
 */
async function remove(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key)
}

// =============================================================================
// Wallet Config Operations
// =============================================================================

/**
 * Check if a wallet exists in secure storage.
 */
export async function hasWallet(): Promise<boolean> {
  const config = await SecureStore.getItemAsync(
    SECURE_STORE_KEYS.WALLET_CONFIG
  )
  return config !== null
}

/**
 * Save the full wallet config to secure storage.
 * Splits across multiple keys to stay within storage limits.
 */
export async function saveWalletConfig(config: WalletConfig): Promise<void> {
  // Store encrypted custody separately (can be large)
  await setJSON(SECURE_STORE_KEYS.ENCRYPTED_CUSTODY, config.encryptedCustody)

  // Store key print separately
  await setJSON(SECURE_STORE_KEYS.KEY_PRINT, config.keyPrint)

  // Store FVK separately
  await SecureStore.setItemAsync(
    SECURE_STORE_KEYS.PENUMBRA_FVK,
    config.penumbraFVK
  )

  // Store the rest of the config (without large fields)
  const metadata = {
    id: config.id,
    label: config.label,
    createdAt: config.createdAt,
    authMethod: config.authMethod,
  }
  await setJSON(SECURE_STORE_KEYS.WALLET_CONFIG, metadata)
}

/**
 * Read the full wallet config from secure storage.
 * Reconstructs from multiple keys.
 */
export async function getWalletConfig(): Promise<WalletConfig | null> {
  const metadata = await getJSON<{
    id: string
    label: string
    createdAt: number
    authMethod?: string
  }>(SECURE_STORE_KEYS.WALLET_CONFIG)

  if (!metadata) return null

  const encryptedCustody = await getJSON<EncryptedCustody>(
    SECURE_STORE_KEYS.ENCRYPTED_CUSTODY
  )
  const keyPrint = await getJSON<KeyPrint>(SECURE_STORE_KEYS.KEY_PRINT)
  const penumbraFVK =
    (await SecureStore.getItemAsync(SECURE_STORE_KEYS.PENUMBRA_FVK)) ?? ''

  if (!encryptedCustody || !keyPrint) {
    console.warn(
      '[Storage] Wallet config found but encrypted custody or key print missing'
    )
    return null
  }

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

/**
 * Delete all wallet data from secure storage.
 */
export async function deleteWallet(): Promise<void> {
  const keys = Object.values(SECURE_STORE_KEYS)
  await Promise.all(keys.map((key) => remove(key)))
}

// =============================================================================
// Encrypted Custody Operations
// =============================================================================

/**
 * Get the encrypted seed phrase box.
 */
export async function getEncryptedCustody(): Promise<EncryptedCustody | null> {
  return getJSON<EncryptedCustody>(SECURE_STORE_KEYS.ENCRYPTED_CUSTODY)
}

/**
 * Get the key print for password verification.
 */
export async function getKeyPrint(): Promise<KeyPrint | null> {
  return getJSON<KeyPrint>(SECURE_STORE_KEYS.KEY_PRINT)
}

/**
 * Get the Penumbra Full Viewing Key.
 */
export async function getPenumbraFVK(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.PENUMBRA_FVK)
}

/**
 * Save the Penumbra Full Viewing Key.
 */
export async function savePenumbraFVK(fvk: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.PENUMBRA_FVK, fvk)
}

// =============================================================================
// Biometric Key Operations
// =============================================================================

/**
 * Store the derived encryption key for biometric unlock.
 * Uses expo-secure-store's requireAuthentication option which triggers
 * OS-level biometric authentication before releasing the value.
 */
export async function saveBiometricKey(
  keyBase64: string
): Promise<void> {
  await SecureStore.setItemAsync(
    SECURE_STORE_KEYS.BIOMETRIC_KEY,
    keyBase64,
    {
      requireAuthentication: true,
      authenticationPrompt: 'Authenticate to enable biometric unlock',
    }
  )
}

/**
 * Retrieve the encryption key using biometric authentication.
 * The OS will prompt for biometric (fingerprint/face) before releasing the value.
 * Returns null if biometric auth fails or key doesn't exist.
 */
export async function getBiometricKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SECURE_STORE_KEYS.BIOMETRIC_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock your wallet',
    })
  } catch {
    // Biometric auth failed or was cancelled
    return null
  }
}

/**
 * Check if a biometric key is stored.
 * Note: We can't check without triggering auth, so we check the mobile config flag.
 */
export async function hasBiometricKey(): Promise<boolean> {
  const config = await getMobileConfig()
  return config?.biometricEnabled ?? false
}

/**
 * Remove the biometric key.
 */
export async function removeBiometricKey(): Promise<void> {
  await remove(SECURE_STORE_KEYS.BIOMETRIC_KEY)
}

// =============================================================================
// Mobile Config Operations
// =============================================================================

/**
 * Get mobile-specific configuration.
 */
export async function getMobileConfig(): Promise<MobileWalletConfig | null> {
  return getJSON<MobileWalletConfig>(SECURE_STORE_KEYS.MOBILE_CONFIG)
}

/**
 * Save mobile-specific configuration.
 */
export async function saveMobileConfig(
  config: MobileWalletConfig
): Promise<void> {
  await setJSON(SECURE_STORE_KEYS.MOBILE_CONFIG, config)
}

/**
 * Update specific fields in mobile config.
 */
export async function updateMobileConfig(
  updates: Partial<MobileWalletConfig>
): Promise<void> {
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

/**
 * Get all account records.
 */
export async function getAccounts(): Promise<AccountRecord[]> {
  const accounts = await getJSON<AccountRecord[]>(SECURE_STORE_KEYS.ACCOUNTS)
  return accounts ?? []
}

/**
 * Get a specific account by index.
 */
export async function getAccount(
  index: number
): Promise<AccountRecord | undefined> {
  const accounts = await getAccounts()
  return accounts.find((a) => a.index === index)
}

/**
 * Add a new account.
 */
export async function addAccount(
  index: number,
  label: string
): Promise<void> {
  const accounts = await getAccounts()
  const existing = accounts.find((a) => a.index === index)
  if (existing) {
    // Update label
    existing.label = label
  } else {
    accounts.push({ index, label, createdAt: Date.now() })
  }
  await setJSON(SECURE_STORE_KEYS.ACCOUNTS, accounts)
}

/**
 * Ensure the default account (index 0) exists.
 */
export async function ensureDefaultAccount(): Promise<void> {
  const accounts = await getAccounts()
  if (!accounts.find((a) => a.index === 0)) {
    await addAccount(0, 'Default Account')
  }
}

// =============================================================================
// Ephemeral Address Registry Operations (AsyncStorage — NOT SecureStore)
// =============================================================================

/**
 * Get all ephemeral address records from AsyncStorage.
 */
export async function getAllEphemeralAddressRecords(): Promise<EphemeralAddressRecord[]> {
  const raw = await AsyncStorage.getItem(SECURE_STORE_KEYS.EPHEMERAL_ADDRESS_REGISTRY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as EphemeralAddressRecord[]
  } catch {
    return []
  }
}

/** Normalize a record's intermediateHex to lowercase. */
function normalizeRecord(record: EphemeralAddressRecord): EphemeralAddressRecord {
  return {
    ...record,
    intermediateHex: record.intermediateHex?.toLowerCase() as EphemeralAddressRecord['intermediateHex'],
  }
}

/** Upsert records by id into an existing array (mutates). */
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

/**
 * Save a single ephemeral address record (upsert by id).
 * Normalizes intermediateHex to lowercase.
 */
export async function saveEphemeralAddressRecord(record: EphemeralAddressRecord): Promise<void> {
  const records = upsertById(await getAllEphemeralAddressRecords(), [record])
  await AsyncStorage.setItem(
    SECURE_STORE_KEYS.EPHEMERAL_ADDRESS_REGISTRY,
    JSON.stringify(records)
  )
}

/**
 * Save multiple ephemeral address records (upsert by id).
 * Normalizes intermediateHex to lowercase.
 */
export async function saveEphemeralAddressRecords(newRecords: EphemeralAddressRecord[]): Promise<void> {
  const records = upsertById(await getAllEphemeralAddressRecords(), newRecords)
  await AsyncStorage.setItem(
    SECURE_STORE_KEYS.EPHEMERAL_ADDRESS_REGISTRY,
    JSON.stringify(records)
  )
}

/**
 * Find ephemeral address records by Penumbra address.
 */
export async function findEphemeralAddressRecordsByPenumbraAddress(
  address: string
): Promise<EphemeralAddressRecord[]> {
  const records = await getAllEphemeralAddressRecords()
  return records.filter((r) => r.penumbraAddress === address)
}

/**
 * Find ephemeral address records by intermediate hex address (case-insensitive).
 */
export async function findEphemeralAddressRecordsByIntermediateHex(
  address: string
): Promise<EphemeralAddressRecord[]> {
  const normalized = address.toLowerCase()
  const records = await getAllEphemeralAddressRecords()
  return records.filter((r) => r.intermediateHex?.toLowerCase() === normalized)
}
