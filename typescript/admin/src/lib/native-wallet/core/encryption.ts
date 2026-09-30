// src/lib/native-wallet/core/encryption.ts
/**
 * Shared encryption utilities for native wallets.
 * Uses Web Crypto API for secure encryption.
 * 
 * Security:
 * - PBKDF2 with 210,000 iterations for password derivation (~500ms)
 * - AES-256-GCM for authenticated encryption
 * - Constant-time comparison to prevent timing attacks
 */

import { type EncryptedBox, type KeyPrint, PBKDF2_ITERATIONS } from './types'

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
 * This is intentionally slow (~500ms) to resist brute force attacks.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable for creating key print
    ['encrypt', 'decrypt']
  )
}

/**
 * Create a KeyPrint from a derived key.
 * The key print contains a hash of the key (for password verification)
 * and the salt used for derivation.
 */
export async function createKeyPrint(
  key: CryptoKey,
  salt: Uint8Array
): Promise<KeyPrint> {
  const rawKey = await crypto.subtle.exportKey('raw', key)
  const keyHash = await crypto.subtle.digest('SHA-256', rawKey)

  return {
    hash: uint8ArrayToBase64(new Uint8Array(keyHash)),
    salt: uint8ArrayToBase64(salt),
  }
}

/**
 * Constant-time comparison of two Uint8Arrays.
 * Returns true only if both arrays have the same length and contents.
 * Uses bitwise OR accumulation to avoid early-exit timing leaks.
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
): Promise<CryptoKey | null> {
  try {
    const salt = base64ToUint8Array(keyPrint.salt)
    const key = await deriveKey(password, salt)
    const rawKey = await crypto.subtle.exportKey('raw', key)
    const keyHash = await crypto.subtle.digest('SHA-256', rawKey)
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
 * Returns an EncryptedBox containing nonce and ciphertext.
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedBox> {
  const encoder = new TextEncoder()
  const nonce = crypto.getRandomValues(new Uint8Array(12)) // 96-bit nonce for AES-GCM

  const cipherText = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    encoder.encode(plaintext)
  )

  return {
    nonce: uint8ArrayToBase64(nonce),
    cipherText: uint8ArrayToBase64(new Uint8Array(cipherText)),
  }
}

/**
 * Decrypt an EncryptedBox using AES-256-GCM.
 * Returns the plaintext string, or throws if decryption fails.
 */
export async function decrypt(
  box: EncryptedBox,
  key: CryptoKey
): Promise<string> {
  const nonce = base64ToUint8Array(box.nonce)
  const cipherText = base64ToUint8Array(box.cipherText)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    key,
    new Uint8Array(cipherText)
  )

  return new TextDecoder().decode(plaintext)
}

// =============================================================================
// High-Level API
// =============================================================================

/**
 * Encrypt a seed phrase with a password.
 * Returns the encrypted box and key print for storage.
 */
export async function encryptSeedPhrase(
  seedPhrase: string,
  password: string
): Promise<{ box: EncryptedBox; keyPrint: KeyPrint }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt)
  const keyPrint = await createKeyPrint(key, salt)
  const box = await encrypt(seedPhrase, key)

  return { box, keyPrint }
}

/**
 * Decrypt a seed phrase using a password.
 * Returns the seed phrase, or throws if password is incorrect.
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
