/**
 * Biometric authentication wrapper.
 * Provides a clean API around expo-local-authentication.
 */

import * as LocalAuthentication from 'expo-local-authentication'

import type { BiometricType } from './types'

// =============================================================================
// Availability
// =============================================================================

/**
 * Check if any biometric authentication is available on this device.
 * Returns true if the device has hardware support AND enrolled biometrics.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return false

  const isEnrolled = await LocalAuthentication.isEnrolledAsync()
  return isEnrolled
}

/**
 * Get the type of biometric authentication available.
 */
export async function getBiometricType(): Promise<BiometricType> {
  const available = await isBiometricAvailable()
  if (!available) return 'none'

  const types =
    await LocalAuthentication.supportedAuthenticationTypesAsync()

  if (
    types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    )
  ) {
    return 'facial'
  }
  if (
    types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    return 'fingerprint'
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'iris'
  }

  return 'none'
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Authenticate the user with biometrics.
 * Shows the OS-level biometric prompt.
 *
 * @param prompt - Custom prompt message shown to the user
 * @returns true if authentication succeeded, false otherwise
 */
export async function authenticateBiometric(
  prompt: string = 'Authenticate to continue'
): Promise<boolean> {
  const available = await isBiometricAvailable()
  if (!available) return false

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false, // Allow PIN/password as fallback
  })

  return result.success
}
