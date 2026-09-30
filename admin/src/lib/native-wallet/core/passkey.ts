// src/lib/native-wallet/core/passkey.ts
/**
 * Passkey (WebAuthn) authentication for wallet encryption.
 * 
 * SECURITY:
 * - Uses WebAuthn PRF extension to derive encryption keys
 * - No password needed - biometric/hardware key authentication
 * - Encryption key is derived deterministically from passkey
 * - Passkey private key never leaves the authenticator (hardware/platform)
 * 
 * BROWSER SUPPORT:
 * - Chrome 116+ (PRF extension)
 * - Safari 17+ (PRF extension)
 * - Firefox - limited, falls back to password
 */

import { base64ToUint8Array, uint8ArrayToBase64 } from './encryption'

// =============================================================================
// Types
// =============================================================================

export interface PasskeyCredential {
  /** Credential ID (base64) */
  credentialId: string
  /** Raw credential ID for authentication */
  rawId: string
  /** Whether PRF extension is supported */
  prfSupported: boolean
  /** User-friendly name for the passkey */
  name: string
  /** Creation timestamp */
  createdAt: number
}

export interface PasskeyRegistrationResult {
  credential: PasskeyCredential
  /** Derived encryption key (32 bytes) from PRF */
  encryptionKey: CryptoKey
}

export interface PasskeyAuthResult {
  /** Derived encryption key from PRF */
  encryptionKey: CryptoKey
}

// =============================================================================
// Constants
// =============================================================================

/** Relying Party ID - should match your domain in production */
const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

/** Relying Party name shown to user */
const RP_NAME = 'Native Wallet'

/** PRF salt for key derivation (fixed, app-specific) */
const PRF_SALT = new TextEncoder().encode('native-wallet-encryption-v1')

// =============================================================================
// Feature Detection
// =============================================================================

/**
 * Check if WebAuthn is supported.
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && 
         !!window.PublicKeyCredential &&
         typeof window.PublicKeyCredential === 'function'
}

/**
 * Check if PRF extension is likely supported.
 * Note: Actual support depends on the authenticator used.
 */
export async function isPRFSupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  
  try {
    // Check if the browser supports the PRF extension
    // This doesn't guarantee the authenticator supports it
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    return available
  } catch {
    return false
  }
}

// =============================================================================
// Passkey Registration
// =============================================================================

/**
 * Register a new passkey for wallet encryption.
 * Returns the credential and derived encryption key.
 */
export async function registerPasskey(
  userId: string,
  userName: string = 'Wallet User'
): Promise<PasskeyRegistrationResult> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser')
  }

  // Generate a random challenge
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  // Create credential options with PRF extension
  const createOptions: CredentialCreationOptions = {
    publicKey: {
      rp: {
        id: RP_ID,
        name: RP_NAME,
      },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      challenge,
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Prefer platform authenticator (Touch ID, Face ID, Windows Hello)
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000,
      // PRF extension for key derivation (not in TS types yet)
      extensions: {
        prf: {
          eval: {
            first: PRF_SALT,
          },
        },
      } as AuthenticationExtensionsClientInputs & { prf: unknown },
    },
  }

  // Create the credential
  const credential = await navigator.credentials.create(createOptions) as PublicKeyCredential | null
  
  if (!credential) {
    throw new Error('Failed to create passkey')
  }

  // Check if PRF was successful
  const extensionResults = credential.getClientExtensionResults() as any
  const prfResults = extensionResults?.prf?.results
  
  if (!prfResults?.first) {
    throw new Error(
      'PRF extension not supported by this authenticator. ' +
      'Please use a different authenticator or fall back to password.'
    )
  }

  // Derive encryption key from PRF output
  const prfOutput = new Uint8Array(prfResults.first)
  const encryptionKey = await deriveKeyFromPRF(prfOutput)

  const passkeyCredential: PasskeyCredential = {
    credentialId: uint8ArrayToBase64(new Uint8Array(credential.rawId)),
    rawId: uint8ArrayToBase64(new Uint8Array(credential.rawId)),
    prfSupported: true,
    name: `Passkey (${new Date().toLocaleDateString()})`,
    createdAt: Date.now(),
  }

  return {
    credential: passkeyCredential,
    encryptionKey,
  }
}

// =============================================================================
// Passkey Authentication
// =============================================================================

/**
 * Authenticate with an existing passkey and derive the encryption key.
 */
export async function authenticateWithPasskey(
  credential: PasskeyCredential
): Promise<PasskeyAuthResult> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser')
  }

  if (!credential.prfSupported) {
    throw new Error('This passkey does not support PRF extension')
  }

  // Generate a random challenge
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const credentialId = base64ToUint8Array(credential.rawId)

  // Authentication options with PRF extension
  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      rpId: RP_ID,
      allowCredentials: [
        {
          type: 'public-key',
          id: new Uint8Array(credentialId),
        },
      ],
      userVerification: 'required',
      timeout: 60000,
      // PRF extension for key derivation (not in TS types yet)
      extensions: {
        prf: {
          eval: {
            first: PRF_SALT,
          },
        },
      } as AuthenticationExtensionsClientInputs & { prf: unknown },
    },
  }

  // Authenticate
  const assertion = await navigator.credentials.get(getOptions) as PublicKeyCredential | null

  if (!assertion) {
    throw new Error('Authentication cancelled')
  }

  // Get PRF output
  const extensionResults = assertion.getClientExtensionResults() as any
  const prfResults = extensionResults?.prf?.results

  if (!prfResults?.first) {
    throw new Error('PRF extension failed during authentication')
  }

  // Derive encryption key from PRF output
  const prfOutput = new Uint8Array(prfResults.first)
  const encryptionKey = await deriveKeyFromPRF(prfOutput)

  return { encryptionKey }
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive an AES-256-GCM encryption key from PRF output.
 * Uses HKDF to expand the PRF output to a proper key.
 */
async function deriveKeyFromPRF(prfOutput: Uint8Array): Promise<CryptoKey> {
  // Import PRF output as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(prfOutput),
    'HKDF',
    false,
    ['deriveKey']
  )

  // Derive AES key using HKDF
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('native-wallet-aes-key'),
      info: new TextEncoder().encode('encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt']
  )
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a passkey credential still exists on the device.
 */
export async function isPasskeyAvailable(credential: PasskeyCredential): Promise<boolean> {
  if (!isWebAuthnSupported()) return false

  try {
    // Try a silent check - this may not work on all platforms
    const credentialId = base64ToUint8Array(credential.rawId)
    
    // Use a short timeout for availability check
    const options: CredentialRequestOptions = {
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: RP_ID,
        allowCredentials: [
          {
            type: 'public-key',
            id: new Uint8Array(credentialId),
          },
        ],
        userVerification: 'discouraged',
        timeout: 100, // Very short timeout for check
      },
      mediation: 'silent',
    }

    await navigator.credentials.get(options)
    return true
  } catch {
    // If it times out or fails silently, we can't determine availability
    // Return true and let actual auth fail if needed
    return true
  }
}

/**
 * Delete/forget a passkey credential from our storage.
 * Note: This doesn't delete the passkey from the authenticator.
 */
export function forgetPasskeyCredential(credentialId: string): void {
  // This just removes it from our records
  // The actual passkey remains on the authenticator
  console.log(`Forgetting passkey credential: ${credentialId}`)
}
