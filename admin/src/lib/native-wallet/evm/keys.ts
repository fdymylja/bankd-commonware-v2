// src/lib/native-wallet/evm/keys.ts
/**
 * EVM key derivation and signing.
 * Derives secp256k1 keys from BIP39 mnemonic using BIP44 path.
 * 
 * SECURITY: This module stores derived keys in memory, NOT the mnemonic.
 * The mnemonic is only passed in during initialization and not retained.
 */

import type { HDAccount } from 'viem/accounts'
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'

import { hexToBech32 } from '@/lib/utils'

import type { EVMAddressInfo } from '../core/types'

// =============================================================================
// In-memory state
// SECURITY: Only store derived account, NOT the mnemonic
// =============================================================================

let currentAccount: HDAccount | null = null
let currentAccountIndex: number = 0

// Async callback to decrypt mnemonic on-demand from wallet.ts
let getMnemonicCallback: (() => Promise<string | null>) | null = null

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Generate a new BIP39 mnemonic phrase.
 */
export function generateNewMnemonic(): string {
  return generateMnemonic(english)
}

/**
 * Validate a BIP39 mnemonic phrase.
 */
export function validateMnemonic(mnemonic: string): boolean {
  try {
    mnemonicToAccount(mnemonic.trim().toLowerCase())
    return true
  } catch {
    return false
  }
}

/**
 * Derive an HD account from a mnemonic at a specific index.
 * Uses standard Ethereum path: m/44'/60'/0'/0/{index}
 */
function deriveAccount(mnemonic: string, accountIndex: number = 0): HDAccount {
  return mnemonicToAccount(mnemonic, {
    addressIndex: accountIndex,
  })
}

/**
 * Initialize EVM keys from a mnemonic.
 * Call this after unlocking the wallet.
 * 
 * SECURITY: The mnemonic is used to derive the account but NOT stored.
 * For account switching, an async callback decrypts the mnemonic on-demand.
 * 
 * @param mnemonic - The seed phrase (used immediately, not stored)
 * @param accountIndex - Account index to derive
 * @param getMnemonic - Async callback to decrypt mnemonic for account switches
 */
export function initializeEVMKeys(
  mnemonic: string,
  accountIndex: number = 0,
  getMnemonic?: () => Promise<string | null>
): void {
  currentAccountIndex = accountIndex
  currentAccount = deriveAccount(mnemonic, accountIndex)
  getMnemonicCallback = getMnemonic ?? null
  // NOTE: mnemonic is NOT stored - it goes out of scope after this function
}

/**
 * Clear EVM keys from memory.
 * Call this when locking the wallet.
 */
export function clearEVMKeys(): void {
  currentAccount = null
  currentAccountIndex = 0
  getMnemonicCallback = null
}

/**
 * Check if EVM keys are initialized.
 */
export function hasEVMKeys(): boolean {
  return currentAccount !== null
}

/**
 * Switch to a different account index.
 * SECURITY: Decrypts mnemonic on-demand, uses it immediately, doesn't store it.
 */
export async function switchEVMAccount(accountIndex: number): Promise<void> {
  if (!getMnemonicCallback) {
    throw new Error('EVM keys not initialized')
  }
  const mnemonic = await getMnemonicCallback()
  if (!mnemonic) {
    throw new Error('Wallet is locked')
  }
  currentAccountIndex = accountIndex
  currentAccount = deriveAccount(mnemonic, accountIndex)
  // NOTE: mnemonic goes out of scope here - not retained
}

/**
 * Get current account index.
 */
export function getEVMAccountIndex(): number {
  return currentAccountIndex
}

// =============================================================================
// Address Derivation
// =============================================================================

/**
 * Get EVM address info for the current account.
 */
export function getEVMAddressInfo(): EVMAddressInfo {
  if (!currentAccount) {
    throw new Error('EVM keys not initialized')
  }

  return {
    hex: currentAccount.address,
    bech32: hexToBech32(currentAccount.address),
  }
}

/**
 * Get EVM address info for a specific account index.
 * Does not change the current account.
 */
export function getEVMAddressInfoForIndex(mnemonic: string, accountIndex: number): EVMAddressInfo {
  const account = deriveAccount(mnemonic, accountIndex)
  return {
    hex: account.address,
    bech32: hexToBech32(account.address),
  }
}

/**
 * Get EVM address info for a specific account index.
 * Does not change the current account. Returns null if keys not initialized.
 * SECURITY: Decrypts mnemonic on-demand, uses it immediately, doesn't store it.
 */
export async function getEVMAddressForAccountIndex(accountIndex: number): Promise<EVMAddressInfo | null> {
  if (!getMnemonicCallback) {
    return null
  }
  const mnemonic = await getMnemonicCallback()
  if (!mnemonic) {
    return null
  }
  const account = deriveAccount(mnemonic, accountIndex)
  // NOTE: account and mnemonic go out of scope here - not retained
  return {
    hex: account.address,
    bech32: hexToBech32(account.address),
  }
}

// =============================================================================
// Signing
// =============================================================================

/**
 * Sign a message with the current EVM account.
 */
export async function signMessage(message: string): Promise<`0x${string}`> {
  if (!currentAccount) {
    throw new Error('EVM keys not initialized')
  }
  return currentAccount.signMessage({ message })
}

/**
 * Sign typed data (EIP-712) with the current EVM account.
 */
export async function signTypedData(typedData: any): Promise<`0x${string}`> {
  if (!currentAccount) {
    throw new Error('EVM keys not initialized')
  }
  return currentAccount.signTypedData(typedData)
}

/**
 * Sign a transaction with the current EVM account.
 */
export async function signTransaction(transaction: any): Promise<`0x${string}`> {
  if (!currentAccount) {
    throw new Error('EVM keys not initialized')
  }
  return currentAccount.signTransaction(transaction)
}

/**
 * Get the raw HD account for advanced use cases.
 * Use with caution - prefer the higher-level signing methods.
 */
export function getEVMAccount(): HDAccount {
  if (!currentAccount) {
    throw new Error('EVM keys not initialized')
  }
  return currentAccount
}
