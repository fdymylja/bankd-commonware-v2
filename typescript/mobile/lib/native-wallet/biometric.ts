/**
 * Web fallback for biometric authentication.
 * Biometrics are not available on web — all functions return safe defaults.
 */

import type { BiometricType } from './types'

export async function isBiometricAvailable(): Promise<boolean> {
  return false
}

export async function getBiometricType(): Promise<BiometricType> {
  return 'none'
}

export async function authenticateBiometric(
  _prompt?: string
): Promise<boolean> {
  return false
}
