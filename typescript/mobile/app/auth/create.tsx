/**
 * Create Wallet Screen — Multi-step wallet creation flow.
 *
 * Steps:
 * 1. Generate & display seed phrase
 * 2. Verify 3 random words
 * 3. Set password + optional biometric
 * 4. Creating → Done → navigate to tabs
 */

import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { SeedPhraseDisplay, WordVerify } from '@/components/wallet'
import { colors, fontSize, fontWeight, spacing } from '@/lib/theme'
import {
  generateNewMnemonic,
  isBiometricAvailable,
  useNativeWallet,
  coreEnableBiometric,
} from '@/lib/native-wallet'

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type Step = 'seed' | 'verify' | 'password' | 'creating'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateWalletScreen() {
  const router = useRouter()
  const { createWallet } = useNativeWallet()

  const [step, setStep] = useState<Step>('seed')
  const [verified, setVerified] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [enableBiometric, setEnableBiometric] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate mnemonic once
  const mnemonic = useMemo(() => generateNewMnemonic(), [])
  const words = useMemo(() => mnemonic.split(' '), [mnemonic])

  // Check biometric availability when reaching password step
  const goToPasswordStep = useCallback(async () => {
    const available = await isBiometricAvailable()
    setBiometricAvailable(available)
    setEnableBiometric(available) // default on if available
    setStep('password')
  }, [])

  // Validate password
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

  const canCreate =
    password.length >= 8 && confirmPassword === password && !passwordError

  // Create wallet
  const handleCreate = useCallback(async () => {
    if (!canCreate) return
    setStep('creating')
    setError(null)

    try {
      await createWallet(mnemonic, password)

      // Enable biometric if requested
      if (enableBiometric) {
        try {
          await coreEnableBiometric()
        } catch {
          // Non-critical — wallet is created, biometric can be enabled later
          console.warn('Failed to enable biometric, skipping')
        }
      }

      // Navigate to main app
      router.replace('/(tabs)')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create wallet'
      setError(message)
      setStep('password')
    }
  }, [canCreate, createWallet, mnemonic, password, enableBiometric, router])

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => {
            if (step === 'verify') setStep('seed')
            else if (step === 'password') setStep('verify')
            else router.back()
          }}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Create Wallet</Text>
          <Text style={styles.stepIndicator}>
            {step === 'seed' ? '1/3' : step === 'verify' ? '2/3' : '3/3'}
          </Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Seed Phrase */}
          {step === 'seed' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Your Recovery Phrase</Text>
              <Text style={styles.stepDescription}>
                Write down these 24 words in order and keep them safe.
                This is the only way to recover your wallet.
              </Text>

              <View style={styles.warningBox}>
                <Ionicons name="warning" size={20} color={colors.yellow[600]} />
                <Text style={styles.warningText}>
                  Never share your recovery phrase with anyone. Anyone with
                  these words can access your funds.
                </Text>
              </View>

              <SeedPhraseDisplay words={words} />

              <Button
                title="I've Written It Down"
                onPress={() => setStep('verify')}
                size="lg"
                style={styles.actionButton}
              />
            </View>
          )}

          {/* Step 2: Verify */}
          {step === 'verify' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Verify Recovery Phrase</Text>
              <Text style={styles.stepDescription}>
                Confirm you've saved your recovery phrase by entering the
                requested words.
              </Text>

              <WordVerify
                words={words}
                onVerified={() => setVerified(true)}
                onStateChange={setVerified}
              />

              <Button
                title="Continue"
                onPress={goToPasswordStep}
                disabled={!verified}
                size="lg"
                style={styles.actionButton}
              />
            </View>
          )}

          {/* Step 3: Password */}
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
                title="Create Wallet"
                onPress={handleCreate}
                disabled={!canCreate}
                size="lg"
                style={styles.actionButton}
              />
            </View>
          )}

          {/* Step 4: Creating */}
          {step === 'creating' && (
            <View style={styles.creatingContainer}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
              <Text style={styles.creatingText}>Creating your wallet...</Text>
              <Text style={styles.creatingHint}>
                Deriving keys and encrypting your seed phrase
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.yellow[50],
    borderWidth: 1,
    borderColor: colors.yellow[500],
    borderRadius: 10,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xl,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.yellow[600],
    lineHeight: 20,
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
  creatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  creatingText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
  },
  creatingHint: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
})
