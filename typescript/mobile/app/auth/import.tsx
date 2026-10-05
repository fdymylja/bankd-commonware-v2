/**
 * Import Wallet Screen — Import from existing seed phrase.
 *
 * Steps:
 * 1. Enter/paste 24-word seed phrase
 * 2. Set password + optional biometric
 * 3. Importing → Done → navigate to tabs
 */

import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'

import { Button, Input } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/theme'
import {
  isBiometricAvailable,
  useNativeWallet,
  validateMnemonic,
  coreEnableBiometric,
} from '@/lib/native-wallet'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'seed' | 'password' | 'importing'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportWalletScreen() {
  const router = useRouter()
  const { importWallet } = useNativeWallet()

  const [step, setStep] = useState<Step>('seed')
  const [seedInput, setSeedInput] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [enableBiometric, setEnableBiometric] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate seed phrase
  const seedWords = useMemo(
    () => seedInput.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [seedInput]
  )

  const seedValid = useMemo(() => {
    if (seedWords.length !== 24 && seedWords.length !== 12) return false
    return validateMnemonic(seedWords.join(' '))
  }, [seedWords])

  const seedError = useMemo(() => {
    if (seedInput.length === 0) return null
    if (seedWords.length > 0 && seedWords.length !== 24 && seedWords.length !== 12) {
      return `Expected 12 or 24 words, got ${seedWords.length}`
    }
    if (seedWords.length >= 12 && !seedValid) {
      return 'Invalid seed phrase — check your words'
    }
    return null
  }, [seedInput, seedWords, seedValid])

  // Password validation
  const passwordError = useMemo(() => {
    if (password.length > 0 && password.length < 8) {
      return 'Password must be at least 8 characters'
    }
    return null
  }, [password])

  const confirmError = useMemo(() => {
    if (confirmPassword.length > 0 && confirmPassword !== password) {
      return 'Passwords do not match'
    }
    return null
  }, [password, confirmPassword])

  const canImport =
    password.length >= 8 && confirmPassword === password && !passwordError

  // Move to password step
  const goToPasswordStep = useCallback(async () => {
    const available = await isBiometricAvailable()
    setBiometricAvailable(available)
    setEnableBiometric(available)
    setStep('password')
  }, [])

  // Import wallet
  const handleImport = useCallback(async () => {
    if (!canImport) return
    setStep('importing')
    setError(null)

    try {
      await importWallet(seedWords.join(' '), password)

      if (enableBiometric) {
        try {
          await coreEnableBiometric()
        } catch {
          console.warn('Failed to enable biometric, skipping')
        }
      }

      router.replace('/(tabs)')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import wallet'
      setError(message)
      setStep('password')
    }
  }, [canImport, importWallet, seedWords, password, enableBiometric, router])

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => {
            if (step === 'password') setStep('seed')
            else router.back()
          }}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Import Wallet</Text>
          <Text style={styles.stepIndicator}>
            {step === 'seed' ? '1/2' : '2/2'}
          </Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Seed Phrase Input */}
          {step === 'seed' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Enter Recovery Phrase</Text>
              <Text style={styles.stepDescription}>
                Enter your 12 or 24-word recovery phrase. You can paste the
                entire phrase at once.
              </Text>

              <Input
                label="Recovery Phrase"
                placeholder="Enter your seed phrase words separated by spaces..."
                value={seedInput}
                onChangeText={setSeedInput}
                multiline
                numberOfLines={4}
                error={seedError ?? undefined}
                hint={
                  seedWords.length > 0 && !seedError
                    ? `${seedWords.length} words entered`
                    : undefined
                }
                autoCapitalize="none"
                autoCorrect={false}
                inputStyle={styles.seedInput}
              />

              <Button
                title="Continue"
                onPress={goToPasswordStep}
                disabled={!seedValid}
                size="lg"
                style={styles.actionButton}
              />
            </View>
          )}

          {/* Step 2: Password */}
          {step === 'password' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Set Password</Text>
              <Text style={styles.stepDescription}>
                Create a password to encrypt your wallet on this device.
              </Text>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Input
                label="Password"
                placeholder="Enter password (min 8 characters)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                error={passwordError ?? undefined}
                autoCapitalize="none"
              />

              <Input
                label="Confirm Password"
                placeholder="Re-enter password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={confirmError ?? undefined}
                autoCapitalize="none"
              />

              {biometricAvailable && (
                <View style={styles.biometricRow}>
                  <View style={styles.biometricText}>
                    <Text style={styles.biometricLabel}>
                      Enable Biometric Unlock
                    </Text>
                    <Text style={styles.biometricHint}>
                      Use Face ID or fingerprint to unlock your wallet
                    </Text>
                  </View>
                  <Switch
                    value={enableBiometric}
                    onValueChange={setEnableBiometric}
                    trackColor={{
                      true: colors.primary[500],
                      false: colors.gray[300],
                    }}
                  />
                </View>
              )}

              <Button
                title="Import Wallet"
                onPress={handleImport}
                disabled={!canImport}
                size="lg"
                style={styles.actionButton}
              />
            </View>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <View style={styles.importingContainer}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
              <Text style={styles.importingText}>Importing your wallet...</Text>
              <Text style={styles.importingHint}>
                Verifying seed phrase and deriving keys
              </Text>
            </View>
          )}
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  backButton: {
    fontSize: fontSize.md,
    color: colors.primary[600],
    fontWeight: fontWeight.medium,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
  },
  stepIndicator: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    fontWeight: fontWeight.medium,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  stepContainer: {
    gap: spacing.xl,
  },
  stepTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  stepDescription: {
    fontSize: fontSize.md,
    color: colors.gray[600],
    lineHeight: 22,
  },
  seedInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 24,
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
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray[50],
    borderRadius: 10,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  biometricText: {
    flex: 1,
    gap: spacing.xs,
  },
  biometricLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.gray[800],
  },
  biometricHint: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  actionButton: {
    marginTop: spacing.md,
  },
  importingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  importingText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
  },
  importingHint: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
})
