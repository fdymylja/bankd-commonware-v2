// src/lib/native-wallet/penumbra/keys.ts
/**
 * Penumbra key derivation.
 * Derives Penumbra keys from BIP39 mnemonic using WASM.
 */

import type {
  Address,
  FullViewingKey,
  SpendKey,
  WalletId,
} from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'

import { bech32mAddress } from './shieldd-address'
import { base64ToUint8Array, uint8ArrayToBase64 } from '../core/encryption'
import type { PenumbraAddressInfo, PenumbraTransparentAddressInfo } from '../core/types'

// Dynamic imports for WASM functions to avoid SSR bundling
async function loadWasmFunctions() {
  const wasm = await import('./wasm-loader')
  return {
    generateSpendKey: wasm.generateSpendKey,
    getFullViewingKey: wasm.getFullViewingKey,
    getAddressByIndex: wasm.getAddressByIndex,
    getEphemeralByIndex: wasm.getEphemeralByIndex,
    getWalletId: wasm.getWalletId,
    getTransparentAddress: wasm.getTransparentAddress,
  }
}

// =============================================================================
// In-memory state
// =============================================================================

interface PenumbraKeyState {
  spendKey: SpendKey
  fullViewingKey: FullViewingKey
  walletId: WalletId
}

let keyState: PenumbraKeyState | null = null

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive all Penumbra keys from a mnemonic.
 */
export async function derivePenumbraKeys(mnemonic: string): Promise<{
  spendKey: SpendKey
  fullViewingKey: FullViewingKey
  walletId: WalletId
}> {
  const wasm = await loadWasmFunctions()
  const spendKey = await wasm.generateSpendKey(mnemonic)
  const fullViewingKey = await wasm.getFullViewingKey(spendKey)
  const walletId = await wasm.getWalletId(fullViewingKey)
  return { spendKey, fullViewingKey, walletId }
}

/**
 * Initialize Penumbra keys from a mnemonic.
 * Call this after unlocking the wallet.
 */
export async function initializePenumbraKeys(mnemonic: string): Promise<void> {
  keyState = await derivePenumbraKeys(mnemonic)
}

/**
 * Clear Penumbra keys from memory.
 * Call this when locking the wallet.
 */
export function clearPenumbraKeys(): void {
  keyState = null
}

/**
 * Check if Penumbra keys are initialized.
 */
export function hasPenumbraKeys(): boolean {
  return keyState !== null
}

// =============================================================================
// Key Access
// =============================================================================

/**
 * Get the Full Viewing Key.
 */
export function getFullViewingKey(): FullViewingKey {
  if (!keyState) {
    throw new Error('Shieldd keys not initialized')
  }
  return keyState.fullViewingKey
}

/**
 * Get the Spend Key.
 * Use with caution - this is sensitive data.
 */
export function getSpendKey(): SpendKey {
  if (!keyState) {
    throw new Error('Shieldd keys not initialized')
  }
  return keyState.spendKey
}

/**
 * Get the Wallet ID.
 */
export function getWalletId(): WalletId {
  if (!keyState) {
    throw new Error('Shieldd keys not initialized')
  }
  return keyState.walletId
}

// =============================================================================
// Address Derivation
// =============================================================================

/**
 * Get a Penumbra shielded address for an account index.
 */
export async function getPenumbraAddress(accountIndex: number): Promise<Address> {
  const fvk = getFullViewingKey()
  const wasm = await loadWasmFunctions()
  return wasm.getAddressByIndex(fvk, accountIndex)
}

/**
 * Get Penumbra address info for an account index.
 */
export async function getPenumbraAddressInfo(accountIndex: number): Promise<PenumbraAddressInfo> {
  const address = await getPenumbraAddress(accountIndex)
  return {
    address,
    bech32: bech32mAddress(address),
  }
}

/**
 * Generate a fresh ephemeral shielded address for an account index.
 *
 * Ephemeral addresses are regular Penumbra shielded addresses with a randomizer
 * in their AddressIndex. They are intended for one-time IBC deposit/return use
 * so public IBC packets do not link repeated transfers to the same account.
 */
export async function getPenumbraEphemeralAddress(accountIndex: number): Promise<Address> {
  const fvk = getFullViewingKey()
  const wasm = await loadWasmFunctions()
  return wasm.getEphemeralByIndex(fvk, accountIndex)
}

/**
 * Generate a fresh ephemeral shielded address info for an account index.
 */
export async function getPenumbraEphemeralAddressInfo(accountIndex: number): Promise<PenumbraAddressInfo> {
  const address = await getPenumbraEphemeralAddress(accountIndex)
  return {
    address,
    bech32: bech32mAddress(address),
  }
}

/**
 * Get the Penumbra transparent address.
 * Note: Transparent address is derived from FVK, not per-account.
 */
export async function getPenumbraTransparentAddressInfo(): Promise<PenumbraTransparentAddressInfo> {
  const fvk = getFullViewingKey()
  const wasm = await loadWasmFunctions()
  const result = await wasm.getTransparentAddress(fvk)
  return {
    address: result.address,
    bech32: result.encoding,
  }
}

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serialize FullViewingKey to JSON-safe string.
 */
export function serializeFVK(fvk: FullViewingKey): string {
  return uint8ArrayToBase64(fvk.inner)
}

/**
 * Deserialize FullViewingKey from JSON-safe string.
 */
export function deserializeFVK(serialized: string): FullViewingKey {
  // Dynamic import to avoid circular dependency
  const { FullViewingKey } = require('@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb')
  return new FullViewingKey({ inner: base64ToUint8Array(serialized) })
}

/**
 * Get wallet ID as base64 string.
 */
export function getWalletIdString(): string {
  const walletId = getWalletId()
  return uint8ArrayToBase64(walletId.inner)
}
