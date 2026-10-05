/**
 * Mobile session management.
 * Handles auto-lock when the app goes to background.
 *
 * Unlike the admin's sessionStorage-based approach, mobile uses:
 * - AppState listener to detect background/foreground transitions
 * - A configurable grace period (default: 5 minutes) before auto-locking
 * - No encrypted password storage — biometric or password re-entry on lock
 */

import { AppState, type AppStateStatus } from 'react-native'

// =============================================================================
// Configuration
// =============================================================================

/** Grace period in milliseconds before auto-locking (5 minutes) */
const BACKGROUND_GRACE_MS = 5 * 60 * 1000

// =============================================================================
// State
// =============================================================================

/** Timestamp when the app went to background */
let backgroundTimestamp: number | null = null

/** Current lock callback */
let onLockCallback: (() => void) | null = null

/** AppState subscription */
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null

// =============================================================================
// Session Management
// =============================================================================

/**
 * Start the session timer.
 * Listens for app state changes and auto-locks after the grace period.
 *
 * @param onLock - Callback to invoke when session expires (should lock wallet)
 */
export function startSessionTimer(onLock: () => void): void {
  // Clean up any existing subscription
  stopSessionTimer()

  onLockCallback = onLock
  backgroundTimestamp = null

  appStateSubscription = AppState.addEventListener(
    'change',
    handleAppStateChange
  )
}

/**
 * Stop the session timer and remove listeners.
 */
export function stopSessionTimer(): void {
  if (appStateSubscription) {
    appStateSubscription.remove()
    appStateSubscription = null
  }
  onLockCallback = null
  backgroundTimestamp = null
}

/**
 * Check if the session is still active (i.e., not timed out).
 */
export function isSessionActive(): boolean {
  if (backgroundTimestamp === null) return true
  return Date.now() - backgroundTimestamp < BACKGROUND_GRACE_MS
}

/**
 * Get the remaining grace period in milliseconds.
 * Returns null if the app is in the foreground.
 */
export function getGraceRemaining(): number | null {
  if (backgroundTimestamp === null) return null
  const elapsed = Date.now() - backgroundTimestamp
  const remaining = BACKGROUND_GRACE_MS - elapsed
  return remaining > 0 ? remaining : 0
}

// =============================================================================
// Internal
// =============================================================================

function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'background' || nextState === 'inactive') {
    // App went to background — record timestamp
    if (backgroundTimestamp === null) {
      backgroundTimestamp = Date.now()
    }
  } else if (nextState === 'active') {
    // App came to foreground — check if grace period expired
    if (backgroundTimestamp !== null) {
      const elapsed = Date.now() - backgroundTimestamp
      if (elapsed >= BACKGROUND_GRACE_MS) {
        // Grace period expired — lock the wallet
        onLockCallback?.()
      }
      backgroundTimestamp = null
    }
  }
}
