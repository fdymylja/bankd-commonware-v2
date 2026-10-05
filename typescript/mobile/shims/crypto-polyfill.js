/**
 * Ensure crypto.getRandomValues is available everywhere.
 *
 * Uses expo-crypto's native implementation which is always available
 * in Expo managed/dev builds.
 */

const { getRandomValues } = require('expo-crypto')

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {}
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto.getRandomValues = getRandomValues
}

// Also set on global for libraries that check there
if (typeof global.crypto === 'undefined') {
  global.crypto = globalThis.crypto
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = getRandomValues
}
