// src/lib/native-wallet/core/wallet.ts
/**
 * Unified wallet operations.
 * One seed phrase, multiple address types (EVM + Penumbra).
 * 
 * SECURITY ARCHITECTURE:
 * - Seed phrase is stored ENCRYPTED in IndexedDB (AES-256-GCM)
 * - Encryption key (derived via PBKDF2) is kept in memory, NOT the mnemonic
 * - When mnemonic is needed (account switching), it's decrypted on-demand,
 *   used immediately, then goes out of scope (not retained in memory)
 * - Derived keys (EVM HDAccount, Penumbra SpendKey/FVK) are kept in memory
 *   for signing operations
 * - Session auto-unlock stores encrypted password in sessionStorage with
 *   a memory-only decryption key (lost on hard reload)
 * - Rate limiting prevents brute force password attacks
 */

import {
  deleteWallet,
  ensureDefaultAccount,
  getWalletConfig,
  hasWallet,
  saveWalletConfig,
} from './db'
import {
  base64ToUint8Array,
  decrypt,
  decryptSeedPhrase,
  deriveKey,
  encrypt,
  encryptSeedPhrase,
  verifyPassword,
} from './encryption'
import {
  authenticateWithPasskey,
  isWebAuthnSupported,
  registerPasskey,
} from './passkey'
import {
  clearSession,
  createSession,
  hasSession,
  restoreSession,
} from './session'
import {
  type AccountAddresses,
  AuthMethod,
  SESSION_KEY,
  type WalletConfig,
  type WalletInitState,
} from './types'
import {
  clearEVMKeys,
  getEVMAddressInfo,
  hasEVMKeys,
  initializeEVMKeys,
  signMessage as signEVMMessage,
  signTransaction as signEVMTransaction,
  signTypedData as signEVMTypedData,
  switchEVMAccount as switchEVMAccountKeys,
} from '../evm/keys'
import {
  clearPenumbraKeys,
  derivePenumbraKeys,
  getFullViewingKey,
  getPenumbraAddressInfo,
  getPenumbraTransparentAddressInfo,
  getSpendKey,
  getWalletId,
  hasPenumbraKeys,
  initializePenumbraKeys,
  serializeFVK,
} from '../penumbra/keys'

// =============================================================================
// Wallet State
// SECURITY: We store the derived encryption key, NOT the mnemonic.
// The mnemonic is decrypted on-demand from IndexedDB when needed.
// =============================================================================

let encryptionKey: CryptoKey | null = null
let currentAccountIndex: number = 0

/**
 * Decrypt and return the mnemonic on-demand.
 * SECURITY: Mnemonic is NOT stored in memory - decrypted only when needed,
 * then goes out of scope after use.
 */
async function decryptMnemonicOnDemand(): Promise<string | null> {
  if (!encryptionKey) {
    return null
  }
  const config = await getWalletConfig()
  if (!config) {
    return null
  }
  try {
    return await decrypt(config.encryptedCustody.box, encryptionKey)
  } catch {
    return null
  }
}

// =============================================================================
// Unlock Rate Limiting
// SECURITY: Prevent brute force password attacks
// =============================================================================

const MAX_UNLOCK_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 60_000 // 1 minute

let unlockAttempts = 0

function e2eDebug(message: string): void {
  if (typeof window !== 'undefined' && (window as any).__BANKD_NATIVE_WALLET_E2E_DEBUG) {
    console.log(`[native-wallet-core] ${message}`)
  }
}
let lockoutUntil: number | null = null

function checkRateLimit(): void {
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000)
    throw new Error(`Too many failed attempts. Try again in ${remainingSeconds} seconds.`)
  }
  // Reset if lockout has expired
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

// =============================================================================
// Initialization State
// =============================================================================

/**
 * Get the current wallet initialization state.
 */
export async function getWalletInitState(): Promise<WalletInitState> {
  if (encryptionKey && hasEVMKeys() && hasPenumbraKeys()) {
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
  return encryptionKey !== null && hasEVMKeys() && hasPenumbraKeys()
}

// =============================================================================
// Wallet Creation & Import
// =============================================================================

/**
 * Create a new unified wallet.
 * Derives both EVM and Penumbra keys from the same seed phrase.
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

  // Derive Penumbra keys first
  e2eDebug('deriving penumbra keys')
  const { fullViewingKey } = await derivePenumbraKeys(normalizedMnemonic)
  e2eDebug('derived penumbra keys')

  // Encrypt seed phrase
  e2eDebug('encrypting seed phrase')
  const { box, keyPrint } = await encryptSeedPhrase(normalizedMnemonic, password)
  e2eDebug('encrypted seed phrase')

  // Create wallet config
  const config: WalletConfig = {
    id: serializeFVK(fullViewingKey).slice(0, 32), // Use part of FVK as ID
    label,
    encryptedCustody: {
      type: 'encryptedSeedPhrase',
      box,
    },
    keyPrint,
    penumbraFVK: serializeFVK(fullViewingKey),
    createdAt: Date.now(),
    authMethod: 'password',
  }

  // Save to IndexedDB
  e2eDebug('saving wallet config')
  await saveWalletConfig(config)
  e2eDebug('saved wallet config')
  e2eDebug('ensuring default account')
  await ensureDefaultAccount()
  e2eDebug('default account ready')

  // Store encryption key (NOT mnemonic) for on-demand decryption
  const salt = base64ToUint8Array(keyPrint.salt)
  e2eDebug('deriving encryption key')
  encryptionKey = await deriveKey(password, salt)
  e2eDebug('derived encryption key')
  currentAccountIndex = 0

  // Initialize derived keys in memory
  // SECURITY: Mnemonic used here then goes out of scope
  e2eDebug('initializing evm keys')
  initializeEVMKeys(normalizedMnemonic, 0, decryptMnemonicOnDemand)
  e2eDebug('initializing penumbra keys')
  await initializePenumbraKeys(normalizedMnemonic)
  e2eDebug('initialized keys')

  // Create session for persistence
  e2eDebug('creating session')
  await createSession(SESSION_KEY, password)
  e2eDebug('session created')
}

/**
 * Create a new unified wallet with PASSKEY authentication.
 * Uses WebAuthn PRF extension - no password needed.
 */
export async function createWalletWithPasskey(
  seedPhrase: string,
  label: string = 'My Wallet'
): Promise<void> {
  if (await hasWallet()) {
    throw new Error('Wallet already exists. Delete existing wallet first.')
  }

  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser')
  }

  const normalizedMnemonic = seedPhrase.trim().toLowerCase()

  // Derive Penumbra keys first
  const { fullViewingKey } = await derivePenumbraKeys(normalizedMnemonic)

  // Register passkey and get encryption key from PRF
  const walletId = serializeFVK(fullViewingKey).slice(0, 32)
  const { credential: passkey, encryptionKey: passkeyEncryptionKey } = await registerPasskey(
    walletId,
    label
  )

  // Encrypt seed phrase with passkey-derived key
  const box = await encrypt(normalizedMnemonic, passkeyEncryptionKey)

  // Create wallet config (no keyPrint needed for passkey)
  const config: WalletConfig = {
    id: walletId,
    label,
    encryptedCustody: {
      type: 'encryptedSeedPhrase',
      box,
    },
    keyPrint: { hash: '', salt: '' }, // Empty for passkey auth
    penumbraFVK: serializeFVK(fullViewingKey),
    createdAt: Date.now(),
    authMethod: 'passkey',
    passkey,
  }

  // Save to IndexedDB
  await saveWalletConfig(config)
  await ensureDefaultAccount()

  // Store encryption key for on-demand decryption
  encryptionKey = passkeyEncryptionKey
  currentAccountIndex = 0

  // Initialize derived keys in memory
  initializeEVMKeys(normalizedMnemonic, 0, decryptMnemonicOnDemand)
  await initializePenumbraKeys(normalizedMnemonic)

  // Note: No session for passkey - user authenticates with biometric each time
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

/**
 * Import a seed phrase, replacing any existing wallet. Custody holds a single
 * seed, so importing swaps the active account. Multisig data lives in a separate
 * IndexedDB (see lib/multisig/db.ts), so it - and any signatures already
 * collected on a pending tx - survives the swap. Handy for signing a multisig
 * tx as one member, then swapping to another member's seed to add their sig.
 */
export async function replaceWallet(
  seedPhrase: string,
  password: string,
  label: string = 'Imported Wallet'
): Promise<void> {
  if (await hasWallet()) {
    await destroyWallet()
  }
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
  // Check rate limit before attempting
  checkRateLimit()

  const config = await getWalletConfig()
  if (!config) {
    throw new Error('No wallet found')
  }

  // Verify password and get encryption key
  let key: CryptoKey | null
  try {
    key = await verifyPassword(password, config.keyPrint)
    if (!key) {
      throw new Error('Invalid password')
    }
  } catch (err) {
    recordFailedAttempt()
    throw err
  }

  // Success - reset attempts and store encryption key
  resetUnlockAttempts()
  encryptionKey = key

  // Decrypt mnemonic temporarily for key initialization
  // SECURITY: Mnemonic decrypted, used, then goes out of scope
  const seedPhrase = await decrypt(config.encryptedCustody.box, encryptionKey)
  
  currentAccountIndex = 0
  initializeEVMKeys(seedPhrase, 0, decryptMnemonicOnDemand)
  await initializePenumbraKeys(seedPhrase)
  // seedPhrase goes out of scope here - not retained

  // Create session for persistence
  await createSession(SESSION_KEY, password)
}

/**
 * Unlock the wallet with PASSKEY (biometric/hardware key).
 * No password needed - uses WebAuthn PRF extension.
 */
export async function unlockWithPasskey(): Promise<void> {
  const config = await getWalletConfig()
  if (!config) {
    throw new Error('No wallet found')
  }

  if (config.authMethod !== 'passkey' || !config.passkey) {
    throw new Error('This wallet does not use passkey authentication')
  }

  // Authenticate with passkey and derive encryption key
  const { encryptionKey: passkeyEncryptionKey } = await authenticateWithPasskey(config.passkey)

  // Decrypt mnemonic temporarily for key initialization
  const seedPhrase = await decrypt(config.encryptedCustody.box, passkeyEncryptionKey)

  // Store encryption key (NOT mnemonic)
  encryptionKey = passkeyEncryptionKey
  currentAccountIndex = 0

  // Initialize derived keys
  initializeEVMKeys(seedPhrase, 0, decryptMnemonicOnDemand)
  await initializePenumbraKeys(seedPhrase)
  // seedPhrase goes out of scope here - not retained

  // Note: No session for passkey - user authenticates each time
}

/**
 * Try to auto-unlock from persisted session.
 * Note: Only works for password-based wallets.
 */
export async function tryAutoUnlock(): Promise<boolean> {
  const config = await getWalletConfig()
  
  // Passkey wallets don't auto-unlock (require biometric each time)
  if (config?.authMethod === 'passkey') {
    return false
  }

  if (!hasSession(SESSION_KEY)) {
    return false
  }

  const password = await restoreSession(SESSION_KEY)
  if (!password) {
    return false
  }

  try {
    await unlockWallet(password)
    return true
  } catch {
    clearSession(SESSION_KEY)
    return false
  }
}

/**
 * Lock the wallet and clear all sensitive data.
 */
export function lockWallet(): void {
  encryptionKey = null
  currentAccountIndex = 0
  clearEVMKeys()
  clearPenumbraKeys()
  clearSession(SESSION_KEY)
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
  await switchEVMAccountKeys(accountIndex)
  // Penumbra address is derived on-demand, no state update needed
}

/**
 * Get all addresses for an account.
 */
export async function getAccountAddresses(accountIndex: number): Promise<AccountAddresses> {
  if (!isWalletUnlocked()) {
    throw new Error('Wallet is locked')
  }

  const [evm, penumbra, penumbraTransparent] = await Promise.all([
    Promise.resolve(getEVMAddressInfo()),
    getPenumbraAddressInfo(accountIndex),
    getPenumbraTransparentAddressInfo(),
  ])

  return {
    accountIndex,
    evm,
    penumbra,
    penumbraTransparent,
  }
}

/**
 * Get addresses for the current account.
 */
export async function getCurrentAccountAddresses(): Promise<AccountAddresses> {
  return getAccountAddresses(currentAccountIndex)
}

// =============================================================================
// Seed Phrase Export
// =============================================================================

/**
 * Export seed phrase.
 * - For password-auth wallets: requires password
 * - For passkey-auth wallets: re-authenticates with passkey (password ignored)
 */
export async function exportSeedPhrase(password?: string): Promise<string> {
  const config = await getWalletConfig()
  if (!config) {
    throw new Error('No wallet found')
  }

  if (config.authMethod === 'passkey' && config.passkey) {
    // Passkey auth: re-authenticate to get encryption key
    const { encryptionKey: passkeyKey } = await authenticateWithPasskey(config.passkey)
    return decrypt(config.encryptedCustody.box, passkeyKey)
  } else {
    // Password auth: verify password
    if (!password) {
      throw new Error('Password required')
    }
    return decryptSeedPhrase(
      config.encryptedCustody.box,
      password,
      config.keyPrint
    )
  }
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
// Re-export key access functions
// =============================================================================

export {
  // EVM
  signEVMMessage as signMessage,
  signEVMTypedData as signTypedData,
  signEVMTransaction as signTransaction,
  
  // Penumbra
  getFullViewingKey,
  getSpendKey,
  getWalletId,
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
 * Get wallet authentication method without unlocking.
 */
export async function getWalletAuthMethod(): Promise<AuthMethod | null> {
  const config = await getWalletConfig()
  return config?.authMethod ?? 'password' // Default to password for legacy wallets
}

/**
 * Check if wallet uses passkey authentication.
 */
export async function hasPasskeyAuth(): Promise<boolean> {
  const config = await getWalletConfig()
  return config?.authMethod === 'passkey' && !!config?.passkey
}

/**
 * Check if WebAuthn/Passkey is supported in this browser.
 */
export { isWebAuthnSupported }
