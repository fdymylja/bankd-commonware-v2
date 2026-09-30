// src/lib/native-wallet/core/session.ts
/**
 * Session management for native wallets.
 * 
 * SECURITY DESIGN:
 * Provides auto-unlock capability across page refreshes within the same tab.
 * The password is encrypted with a key stored only in memory, so:
 * - Survives soft refreshes (same tab)
 * - Lost on hard reload / new tab (requires re-entering password)
 * - Lost when browser is closed
 * 
 * THREAT MODEL:
 * - sessionStorage is accessible to same-origin scripts, but encrypted
 * - Encryption key is in memory only (not persisted)
 * - Without the memory key, the encrypted password is useless
 * - A malicious script would need BOTH sessionStorage access AND memory dump
 * 
 * This balances convenience with security for a browser-based wallet.
 *
 * PERSISTENT SESSIONS (opt in, off by default):
 * NEXT_PUBLIC_WALLET_PERSIST_SESSION=true moves the token to localStorage and
 * keeps the AES key in IndexedDB, so one unlock covers every tab and survives a
 * reload. The key is still generated non-extractable, so its bytes never reach
 * JS, but it outlives the page: any same-origin script can then ask it to
 * decrypt for as long as the session is valid. That is a real weakening of the
 * threat model above, which is why it is a flag and not the default. It exists
 * for the localnet demo stack and the video capture, where the alternative is
 * retyping the password on every navigation.
 */

/**
 * Session token stored in sessionStorage.
 */
interface SessionToken {
  /** Timestamp when session was created */
  createdAt: number
  /** Timestamp when session expires */
  expiresAt: number
  /** Encrypted password (for auto-unlock) */
  encryptedPassword: string
  /** Nonce used for encryption */
  nonce: string
}

/** Session duration in milliseconds (default: 24 hours) */
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

/** Map of session keys stored in memory (one per wallet type) */
const sessionKeys = new Map<string, CryptoKey>()

/** Opt in to one unlock covering every tab. See the security note above. */
export function persistSessions(): boolean {
  return process.env.NEXT_PUBLIC_WALLET_PERSIST_SESSION === 'true'
}

/** Where the encrypted token lives. localStorage is shared across tabs. */
function store(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return persistSessions() ? localStorage : sessionStorage
  } catch {
    return null
  }
}

/**
 * Check if we're in a browser environment with sessionStorage.
 */
function hasSessionStorage(): boolean {
  return store() !== null
}

// The AES key is non-extractable, so it cannot be written to localStorage. It
// can be structured-cloned into IndexedDB, which keeps the bytes out of JS while
// still letting the next tab use it.
const KEY_DB = 'native-wallet-session-keys'
const KEY_STORE = 'keys'

function keyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(KEY_STORE)) {
        req.result.createObjectStore(KEY_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withKeyStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await keyDb()
    const result = await new Promise<T | null>((resolve, reject) => {
      const req = run(db.transaction(KEY_STORE, mode).objectStore(KEY_STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result
  } catch {
    return null
  }
}

const putSessionKey = (k: string, key: CryptoKey) =>
  withKeyStore<void>('readwrite', s => s.put(key, k))
const getSessionKey = (k: string) => withKeyStore<CryptoKey>('readonly', s => s.get(k))
const deleteSessionKey = (k: string) => withKeyStore<void>('readwrite', s => s.delete(k))

/**
 * Generate a random session encryption key.
 */
async function generateSessionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
}

/**
 * Create a session for auto-unlock.
 * 
 * @param sessionKey - Unique key for this wallet type (e.g., 'evm-wallet-session', 'penumbra-wallet-session')
 * @param password - The password to store encrypted
 */
export async function createSession(sessionKey: string, password: string): Promise<void> {
  if (!hasSessionStorage()) {
    return
  }

  // Generate a new encryption key for this session
  const cryptoKey = await generateSessionKey()
  sessionKeys.set(sessionKey, cryptoKey)
  if (persistSessions()) {
    await putSessionKey(sessionKey, cryptoKey)
  }

  // Encrypt the password
  const encoder = new TextEncoder()
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    encoder.encode(password)
  )

  const token: SessionToken = {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
    encryptedPassword: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    nonce: btoa(String.fromCharCode(...nonce)),
  }

  store()?.setItem(sessionKey, JSON.stringify(token))
}

/**
 * Try to restore session and get the stored password.
 * Returns null if session is invalid or expired.
 * 
 * @param sessionKey - Unique key for this wallet type
 */
export async function restoreSession(sessionKey: string): Promise<string | null> {
  if (!hasSessionStorage()) {
    return null
  }

  // In memory first; with persistence on, fall back to the key IndexedDB kept,
  // which is what makes a reload or a second tab unlock without the password.
  let cryptoKey = sessionKeys.get(sessionKey)
  if (!cryptoKey && persistSessions()) {
    cryptoKey = (await getSessionKey(sessionKey)) ?? undefined
    if (cryptoKey) sessionKeys.set(sessionKey, cryptoKey)
  }
  if (!cryptoKey) {
    // No key in memory - happens after full page reload
    return null
  }

  try {
    const tokenJson = store()?.getItem(sessionKey)
    if (!tokenJson) {
      return null
    }

    const token: SessionToken = JSON.parse(tokenJson)

    // Check if session has expired
    if (Date.now() > token.expiresAt) {
      clearSession(sessionKey)
      return null
    }

    // Decrypt password
    const nonce = Uint8Array.from(atob(token.nonce), (c) => c.charCodeAt(0))
    const encrypted = Uint8Array.from(atob(token.encryptedPassword), (c) =>
      c.charCodeAt(0)
    )

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      cryptoKey,
      encrypted
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    clearSession(sessionKey)
    return null
  }
}

/**
 * Check if a valid session exists.
 * 
 * @param sessionKey - Unique key for this wallet type
 */
export function hasSession(sessionKey: string): boolean {
  if (!hasSessionStorage()) {
    return false
  }

  // With persistence on the key lives in IndexedDB, which cannot be read
  // synchronously; restoreSession does that and returns null if it is gone.
  if (!persistSessions() && !sessionKeys.has(sessionKey)) {
    return false
  }

  try {
    const tokenJson = store()?.getItem(sessionKey)
    if (!tokenJson) {
      return false
    }

    const token: SessionToken = JSON.parse(tokenJson)
    return Date.now() < token.expiresAt
  } catch {
    return false
  }
}

/**
 * Clear a session.
 * 
 * @param sessionKey - Unique key for this wallet type
 */
export function clearSession(sessionKey: string): void {
  sessionKeys.delete(sessionKey)
  store()?.removeItem(sessionKey)
  if (persistSessions()) {
    void deleteSessionKey(sessionKey)
  }
}

/**
 * Extend a session's expiration time.
 * 
 * @param sessionKey - Unique key for this wallet type
 */
export function extendSession(sessionKey: string): void {
  if (!hasSessionStorage()) {
    return
  }

  try {
    const tokenJson = store()?.getItem(sessionKey)
    if (!tokenJson) {
      return
    }

    const token: SessionToken = JSON.parse(tokenJson)
    token.expiresAt = Date.now() + SESSION_DURATION_MS
    store()?.setItem(sessionKey, JSON.stringify(token))
  } catch {
    // Ignore errors
  }
}

/**
 * Get session info for debugging/display purposes.
 * 
 * @param sessionKey - Unique key for this wallet type
 */
export function getSessionInfo(sessionKey: string): {
  hasSession: boolean
  expiresAt: Date | null
  hasKey: boolean
} {
  const hasKey = sessionKeys.has(sessionKey)

  if (!hasSessionStorage()) {
    return { hasSession: false, expiresAt: null, hasKey }
  }

  try {
    const tokenJson = store()?.getItem(sessionKey)
    if (!tokenJson) {
      return { hasSession: false, expiresAt: null, hasKey }
    }

    const token: SessionToken = JSON.parse(tokenJson)
    return {
      hasSession: Date.now() < token.expiresAt,
      expiresAt: new Date(token.expiresAt),
      hasKey,
    }
  } catch {
    return { hasSession: false, expiresAt: null, hasKey }
  }
}
