/**
 * Mobile wallet operations.
 * One seed phrase, multiple address types (EVM + Penumbra).
 *
 * SECURITY ARCHITECTURE:
 * - Seed phrase stored ENCRYPTED in expo-secure-store (hardware-backed)
 * - Encryption key (derived via PBKDF2) kept in memory, NOT the mnemonic
 * - Biometric unlock stores encryption key with requireAuthentication
 * - Rate limiting prevents brute force password attacks
 * - Auto-lock after 5 minutes in background (via session.ts)
 *
 * PENUMBRA NOTE:
 * Penumbra key derivation requires WASM which runs in a WebView.
 * This module handles EVM keys directly. Penumbra keys are deferred
 * to the WebView bridge (Task 18). The wallet can be "unlocked" with
 * only EVM keys — Penumbra sync starts asynchronously when the WebView is ready.
 */

import {
  deleteWallet,
  ensureDefaultAccount,
  getKeyPrint,
  getWalletConfig,
  hasWallet,
  saveBiometricKey,
  getBiometricKey,
  hasBiometricKey,
  removeBiometricKey,
  saveWalletConfig,
  updateMobileConfig,
} from './storage'
import {
  decrypt,
  deriveKey,
  encrypt,
  encryptSeedPhrase,
  exportKeyToBase64,
  importKeyFromBase64,
  verifyPassword,
  base64ToUint8Array,
} from './encryption'
import type { MobileCryptoKey } from './encryption'
import {
  clearEVMKeys,
  getEVMAddressInfo,
  getEVMAddressForAccountIndex,
  hasEVMKeys,
  initializeEVMKeys,
  signMessage as signEVMMessage,
  signTransaction as signEVMTransaction,
  signTypedData as signEVMTypedData,
  switchEVMAccount,
} from './evm-keys'
import { startSessionTimer, stopSessionTimer } from './session'
import type {
  AccountAddresses,
  EVMAddressInfo,
  WalletConfig,
  WalletInitState,
} from './types'

// =============================================================================
// Wallet State
// SECURITY: We store the derived encryption key, NOT the mnemonic.
// =============================================================================

let encryptionKey: MobileCryptoKey | null = null
let currentAccountIndex: number = 0

/**
 * Decrypt and return the mnemonic on-demand.
 * SECURITY: Mnemonic is NOT stored in memory — decrypted only when needed.
 */
async function decryptMnemonicOnDemand(): Promise<string | null> {
  if (!encryptionKey) return null
  const config = await getWalletConfig()
  if (!config) return null
  try {
    return await decrypt(config.encryptedCustody.box, encryptionKey)
  } catch {
    return null
  }
}

// =============================================================================
// Unlock Rate Limiting
// =============================================================================

const MAX_UNLOCK_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 60_000 // 1 minute

let unlockAttempts = 0
let lockoutUntil: number | null = null

function checkRateLimit(): void {
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000)
    throw new Error(
      `Too many failed attempts. Try again in ${remainingSeconds} seconds.`
    )
  }
  if (lockoutUntil && Date.now() >= lockoutUntil) {
    unlockAttempts = 0
    lockoutUntil = null
  }
}

function recordFailedAttempt(): void {
  unlockAttempts++
  if (unlockAttempts >= MAX_UNLOCK_ATTEMPTS) {
    lockoutUntil = Date.now() + LOCKOUT_DURATION_MS
  }
}

function resetUnlockAttempts(): void {
  unlockAttempts = 0
  lockoutUntil = null
}

/**
 * Get rate limit info for display in the UI.
 */
export function getRateLimitInfo(): {
  attempts: number
  maxAttempts: number
  lockedUntil: number | null
} {
  return {
    attempts: unlockAttempts,
    maxAttempts: MAX_UNLOCK_ATTEMPTS,
    lockedUntil: lockoutUntil,
  }
}

// =============================================================================
// Initialization State
// =============================================================================

/**
 * Get the current wallet initialization state.
 */
export async function getWalletInitState(): Promise<WalletInitState> {
  if (encryptionKey && hasEVMKeys()) {
    return 'unlocked'
  }
  const exists = await hasWallet()
  if (exists) {
    return 'locked'
  }
  return 'uninitialized'
}

/**
 * Check if the wallet is currently unlocked.
 */
export function isWalletUnlocked(): boolean {
  return encryptionKey !== null && hasEVMKeys()
}

// =============================================================================
// Wallet Creation & Import
// =============================================================================

/**
 * Create a new wallet.
 * Derives EVM keys from the seed phrase. Penumbra keys are derived
 * asynchronously by the WebView bridge after unlock.
 */
export async function createWallet(
  seedPhrase: string,
  password: string,
  label: string = 'My Wallet'
): Promise<void> {
  if (await hasWallet()) {
    throw new Error('Wallet already exists. Delete existing wallet first.')
  }

  const normalizedMnemonic = seedPhrase.trim().toLowerCase()

  // Encrypt seed phrase
  const { box, keyPrint } = await encryptSeedPhrase(
    normalizedMnemonic,
    password
  )

  // Create wallet config
  // Note: penumbraFVK will be populated by the WebView bridge after Penumbra keys are derived
  const config: WalletConfig = {
    id: `mobile-${Date.now()}`,
    label,
    encryptedCustody: {
      type: 'encryptedSeedPhrase',
      box,
    },
    keyPrint,
    penumbraFVK: '', // Populated by WebView bridge
    createdAt: Date.now(),
    authMethod: 'password',
  }

  // Save to secure store
  await saveWalletConfig(config)
  await ensureDefaultAccount()

  // Store encryption key (NOT mnemonic) for on-demand decryption
  const salt = base64ToUint8Array(keyPrint.salt)
  encryptionKey = await deriveKey(password, salt)
  currentAccountIndex = 0

  // Initialize EVM keys in memory
  initializeEVMKeys(normalizedMnemonic, 0, decryptMnemonicOnDemand)
}

/**
 * Import an existing wallet from seed phrase.
 */
export async function importWallet(
  seedPhrase: string,
  password: string,
  label: string = 'Imported Wallet'
): Promise<void> {
  return createWallet(seedPhrase, password, label)
}

// =============================================================================
// Lock / Unlock
// =============================================================================

/**
 * Unlock the wallet with password.
 * SECURITY: Rate-limited to prevent brute force attacks.
 */
export async function unlockWallet(password: string): Promise<void> {
  checkRateLimit()

  const config = await getWalletConfig()
  if (!config) {
    throw new Error('No wallet found')
  }

  let key: MobileCryptoKey | null
  try {
    key = await verifyPassword(password, config.keyPrint)
    if (!key) {
      throw new Error('Invalid password')
    }
  } catch (err) {
    recordFailedAttempt()
    throw err
  }

  // Success
  resetUnlockAttempts()
  encryptionKey = key

  // Decrypt mnemonic temporarily for key initialization
  const seedPhrase = await decrypt(config.encryptedCustody.box, encryptionKey)

  currentAccountIndex = 0
  initializeEVMKeys(seedPhrase, 0, decryptMnemonicOnDemand)
  // seedPhrase goes out of scope — not retained

  // Update last unlock time
  await updateMobileConfig({ lastUnlockAt: Date.now() })
}

/**
 * Unlock the wallet using biometric authentication.
 * The OS prompts for biometric before releasing the stored encryption key.
 */
export async function unlockWithBiometric(): Promise<void> {
  const isBioAvailable = await hasBiometricKey()
  if (!isBioAvailable) {
    throw new Error('Biometric unlock not enabled')
  }

  // This triggers the OS biometric prompt via expo-secure-store's requireAuthentication
  const keyBase64 = await getBiometricKey()
  if (!keyBase64) {
    throw new Error('Biometric authentication failed')
  }

  // Import the encryption key
  encryptionKey = await importKeyFromBase64(keyBase64)

  // Decrypt mnemonic temporarily for key initialization
  const config = await getWalletConfig()
  if (!config) {
    throw new Error('No wallet found')
  }

  const seedPhrase = await decrypt(config.encryptedCustody.box, encryptionKey)

  currentAccountIndex = 0
  initializeEVMKeys(seedPhrase, 0, decryptMnemonicOnDemand)
  // seedPhrase goes out of scope — not retained

  resetUnlockAttempts()
  await updateMobileConfig({ lastUnlockAt: Date.now() })
}

/**
 * Enable biometric unlock for this wallet.
 * Must be called while the wallet is unlocked.
 * Stores the encryption key in biometric-protected secure store.
 */
export async function enableBiometric(): Promise<void> {
  if (!encryptionKey) {
    throw new Error('Wallet must be unlocked to enable biometric')
  }

  const keyBase64 = await exportKeyToBase64(encryptionKey)
  await saveBiometricKey(keyBase64)
  await updateMobileConfig({ biometricEnabled: true })
}

/**
 * Disable biometric unlock.
 */
export async function disableBiometric(): Promise<void> {
  await removeBiometricKey()
  await updateMobileConfig({ biometricEnabled: false })
}

/**
 * Lock the wallet and clear all sensitive data from memory.
 */
export function lockWallet(): void {
  encryptionKey = null
  currentAccountIndex = 0
  clearEVMKeys()
  stopSessionTimer()
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Start the auto-lock session timer.
 * Should be called after unlock.
 */
export function startAutoLockTimer(): void {
  startSessionTimer(() => {
    lockWallet()
  })
}

// =============================================================================
// Account Management
// =============================================================================

/**
 * Get current account index.
 */
export function getCurrentAccountIndex(): number {
  return currentAccountIndex
}

/**
 * Switch to a different account.
 */
export async function switchAccount(accountIndex: number): Promise<void> {
  if (!isWalletUnlocked()) {
    throw new Error('Wallet is locked')
  }
  currentAccountIndex = accountIndex
  await switchEVMAccount(accountIndex)
}

/**
 * Get addresses for the current account.
 * Returns EVM addresses immediately. Penumbra addresses are null
 * until the WebView bridge derives them.
 */
export function getCurrentAccountAddresses(): Partial<AccountAddresses> {
  if (!isWalletUnlocked()) {
    throw new Error('Wallet is locked')
  }

  const evm = getEVMAddressInfo()

  return {
    accountIndex: currentAccountIndex,
    evm,
    // Penumbra addresses are set by the WebView bridge
    penumbra: undefined,
    penumbraTransparent: undefined,
  }
}

// =============================================================================
// Seed Phrase Export
// =============================================================================

/**
 * Export seed phrase. Requires password re-verification.
 */
export async function exportSeedPhrase(password: string): Promise<string> {
  const config = await getWalletConfig()
  if (!config) {
    throw new Error('No wallet found')
  }

  const key = await verifyPassword(password, config.keyPrint)
  if (!key) {
    throw new Error('Invalid password')
  }
  return decrypt(config.encryptedCustody.box, key)
}

// =============================================================================
// Wallet Deletion
// =============================================================================

/**
 * Delete the wallet and all data.
 */
export async function destroyWallet(): Promise<void> {
  lockWallet()
  await deleteWallet()
}

// =============================================================================
// Re-exports
// =============================================================================

export {
  signEVMMessage as signMessage,
  signEVMTypedData as signTypedData,
  signEVMTransaction as signTransaction,
  getEVMAddressForAccountIndex,
}

// =============================================================================
// Read-only operations (work when locked)
// =============================================================================

/**
 * Get wallet label without unlocking.
 */
export async function getWalletLabel(): Promise<string | null> {
  const config = await getWalletConfig()
  return config?.label ?? null
}

/**
 * Get wallet creation time without unlocking.
 */
export async function getWalletCreatedAt(): Promise<number | null> {
  const config = await getWalletConfig()
  return config?.createdAt ?? null
}

/**
 * Check if biometric unlock is enabled.
 */
/**
 * Get the mnemonic for Penumbra key derivation.
 * SECURITY: Only call this when the wallet is unlocked and immediately pass to the WebView bridge.
 */
export async function getMnemonicForBridge(): Promise<string | null> {
  return decryptMnemonicOnDemand()
}

export async function isBiometricEnabled(): Promise<boolean> {
  return hasBiometricKey()
}
