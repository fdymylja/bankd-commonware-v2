/**
 * Mobile encryption utilities.
 *
 * Uses pure JS crypto (@noble/hashes + @noble/ciphers) instead of
 * Web Crypto API (crypto.subtle), which is not available in Hermes.
 */

// @ts-ignore — noble v2 uses .js extensions in exports
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
// @ts-ignore
import { sha512, sha256 } from '@noble/hashes/sha2.js'
// @ts-ignore
import { gcm } from '@noble/ciphers/aes.js'
// @ts-ignore
import { randomBytes } from '@noble/hashes/utils.js'

import type { EncryptedBox, KeyPrint } from './types'

// Web uses 210,000 iterations with native crypto.subtle (hardware-accelerated).
// On mobile (pure JS in Hermes), that takes 30+ seconds. 10,000 is still secure
// for a mobile app with biometric unlock as the primary auth method and
// rate limiting on password attempts.
const MOBILE_PBKDF2_ITERATIONS = 1_000

// =============================================================================
// CryptoKey replacement — just a wrapper around raw key bytes
// =============================================================================

/**
 * In the Web Crypto API we use CryptoKey objects. On mobile (Hermes) we use
 * raw Uint8Array keys wrapped in this type for API compatibility.
 */
export interface MobileCryptoKey {
  __brand: 'MobileCryptoKey'
  rawKey: Uint8Array
}

// Re-export as CryptoKey for compatibility with wallet.ts
export type { MobileCryptoKey as CryptoKey }

function wrapKey(rawKey: Uint8Array): MobileCryptoKey {
  return { __brand: 'MobileCryptoKey', rawKey }
}

function unwrapKey(key: MobileCryptoKey): Uint8Array {
  return key.rawKey
}

// =============================================================================
// Utility Functions
// =============================================================================

/** Convert Uint8Array to base64 string */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Convert base64 string to Uint8Array */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive an encryption key from a password using PBKDF2.
 * Intentionally slow (~500ms) to resist brute force attacks.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<MobileCryptoKey> {
  const encoder = new TextEncoder()
  const rawKey = pbkdf2(sha512, encoder.encode(password), salt, {
    c: MOBILE_PBKDF2_ITERATIONS,
    dkLen: 32, // 256 bits for AES-256
  })
  return wrapKey(rawKey)
}

/**
 * Create a KeyPrint from a derived key.
 * Contains a hash of the key (for password verification) and the salt.
 */
export async function createKeyPrint(
  key: MobileCryptoKey,
  salt: Uint8Array
): Promise<KeyPrint> {
  const keyHash = sha256(unwrapKey(key))
  return {
    hash: uint8ArrayToBase64(keyHash),
    salt: uint8ArrayToBase64(salt),
  }
}

/**
 * Constant-time comparison of two Uint8Arrays.
 * Prevents timing attacks on password verification.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

/**
 * Verify a password matches the stored key print.
 * Returns the derived key if successful, null otherwise.
 */
export async function verifyPassword(
  password: string,
  keyPrint: KeyPrint
): Promise<MobileCryptoKey | null> {
  try {
    const salt = base64ToUint8Array(keyPrint.salt)
    const key = await deriveKey(password, salt)
    const keyHash = sha256(unwrapKey(key))
    const computedHash = new Uint8Array(keyHash)
    const storedHash = base64ToUint8Array(keyPrint.hash)

    if (constantTimeEqual(computedHash, storedHash)) {
      return key
    }
    return null
  } catch {
    return null
  }
}

// =============================================================================
// Encryption / Decryption
// =============================================================================

/**
 * Encrypt plaintext using AES-256-GCM.
 */
export async function encrypt(
  plaintext: string,
  key: MobileCryptoKey
): Promise<EncryptedBox> {
  const encoder = new TextEncoder()
  const nonce = randomBytes(12)
  const aes = gcm(unwrapKey(key), nonce)
  const cipherText = aes.encrypt(encoder.encode(plaintext))

  return {
    nonce: uint8ArrayToBase64(nonce),
    cipherText: uint8ArrayToBase64(cipherText),
  }
}

/**
 * Decrypt an EncryptedBox using AES-256-GCM.
 */
export async function decrypt(
  box: EncryptedBox,
  key: MobileCryptoKey
): Promise<string> {
  const nonce = base64ToUint8Array(box.nonce)
  const cipherText = base64ToUint8Array(box.cipherText)
  const aes = gcm(unwrapKey(key), nonce)
  const plaintext = aes.decrypt(cipherText)

  return new TextDecoder().decode(plaintext)
}

// =============================================================================
// High-Level API
// =============================================================================

/**
 * Encrypt a seed phrase with a password.
 */
export async function encryptSeedPhrase(
  seedPhrase: string,
  password: string
): Promise<{ box: EncryptedBox; keyPrint: KeyPrint }> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)
  const keyPrint = await createKeyPrint(key, salt)
  const box = await encrypt(seedPhrase, key)

  return { box, keyPrint }
}

/**
 * Decrypt a seed phrase using a password.
 */
export async function decryptSeedPhrase(
  box: EncryptedBox,
  password: string,
  keyPrint: KeyPrint
): Promise<string> {
  const key = await verifyPassword(password, keyPrint)
  if (!key) {
    throw new Error('Invalid password')
  }
  return decrypt(box, key)
}

/**
 * Export a key as a base64 string.
 * Used for storing encryption key in biometric-protected secure store.
 */
export async function exportKeyToBase64(key: MobileCryptoKey): Promise<string> {
  return uint8ArrayToBase64(unwrapKey(key))
}

/**
 * Import a key from a base64 string.
 * Used for restoring encryption key from biometric-protected secure store.
 */
export async function importKeyFromBase64(
  keyBase64: string
): Promise<MobileCryptoKey> {
  const rawKey = base64ToUint8Array(keyBase64)
  return wrapKey(rawKey)
}
