/**
 * Unlock Screen — Password/biometric unlock for locked wallets.
 *
 * Auto-triggers biometric if available, with password fallback.
 * Shows rate limiting info when too many failed attempts.
 */

import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Button, Input } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/theme'
import { useNativeWallet } from '@/lib/native-wallet'
import { getRateLimitInfo } from '@/lib/native-wallet/wallet'
import { getWalletLabel } from '@/lib/native-wallet/wallet'
import { isBiometricEnabled } from '@/lib/native-wallet/wallet'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UnlockScreen() {
  const router = useRouter()
  const { unlock, unlockWithPasskey, error: walletError, clearError } = useNativeWallet()

  const [password, setPassword] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)

  // DEBUG: Auto-unlock with dev password
  useEffect(() => {
    if (__DEV__) {
      (async () => {
        try { await unlock('12345678'); router.replace('/(tabs)') } catch {}
      })()
    }
  }, [unlock, router])
  const [localError, setLocalError] = useState<string | null>(null)
  const [walletLabel, setWalletLabel] = useState<string>('Your Wallet')
  const [hasBiometric, setHasBiometric] = useState(false)
  const [biometricAttempted, setBiometricAttempted] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState(getRateLimitInfo())

  // Load wallet info and attempt biometric on mount
  useEffect(() => {
    async function init() {
      const label = await getWalletLabel()
      if (label) setWalletLabel(label)

      const bioEnabled = await isBiometricEnabled()
      setHasBiometric(bioEnabled)

      // Auto-trigger biometric on first load
      if (bioEnabled && !biometricAttempted) {
        setBiometricAttempted(true)
        handleBiometricUnlock()
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBiometricUnlock = useCallback(async () => {
    setIsUnlocking(true)
    setLocalError(null)
    clearError()

    try {
      await unlockWithPasskey()
      router.replace('/(tabs)')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Biometric authentication failed'
      setLocalError(message)
    } finally {
      setIsUnlocking(false)
    }
  }, [unlockWithPasskey, clearError, router])

  const handlePasswordUnlock = useCallback(async () => {
    if (!password || isUnlocking) return
    setIsUnlocking(true)
    setLocalError(null)
    clearError()

    try {
      await unlock(password)
      router.replace('/(tabs)')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to unlock wallet'
      setLocalError(message)
      setRateLimitInfo(getRateLimitInfo())
    } finally {
      setIsUnlocking(false)
    }
  }, [password, isUnlocking, unlock, clearError, router])

  const displayError = localError || walletError
  const isLockedOut = rateLimitInfo.lockedUntil !== null && Date.now() < rateLimitInfo.lockedUntil

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Branding */}
          <View style={styles.hero}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <Text style={styles.title}>{walletLabel}</Text>
            <Text style={styles.subtitle}>Enter your password to unlock</Text>
          </View>

          {/* Error */}
          {displayError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

          {/* Rate limit warning */}
          {rateLimitInfo.attempts > 0 && !isLockedOut && (
            <Text style={styles.attemptsText}>
              {rateLimitInfo.maxAttempts - rateLimitInfo.attempts} attempts
              remaining
            </Text>
          )}

          {isLockedOut && (
            <View style={styles.lockoutBox}>
              <Text style={styles.lockoutText}>
                Too many failed attempts. Please wait before trying again.
              </Text>
            </View>
          )}

          {/* Password input */}
          <Input
            label="Password"
            placeholder="Enter your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handlePasswordUnlock}
            autoCapitalize="none"
            editable={!isUnlocking && !isLockedOut}
          />

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={isUnlocking ? 'Unlocking...' : 'Unlock'}
              onPress={handlePasswordUnlock}
              disabled={!password || isUnlocking || isLockedOut}
              loading={isUnlocking}
              size="lg"
            />

            {hasBiometric && (
              <Button
                title="Use Biometric"
                onPress={handleBiometricUnlock}
                variant="secondary"
                disabled={isUnlocking}
                size="lg"
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.gray[500],
  },
  errorBox: {
    backgroundColor: colors.red[50],
    borderWidth: 1,
    borderColor: colors.red[500],
    borderRadius: 10,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.red[600],
    textAlign: 'center',
  },
  attemptsText: {
    fontSize: fontSize.sm,
    color: colors.yellow[600],
    textAlign: 'center',
  },
  lockoutBox: {
    backgroundColor: colors.yellow[50],
    borderWidth: 1,
    borderColor: colors.yellow[500],
    borderRadius: 10,
    padding: spacing.lg,
  },
  lockoutText: {
    fontSize: fontSize.sm,
    color: colors.yellow[600],
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
})
