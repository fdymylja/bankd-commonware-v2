/**
 * Welcome Screen — First screen for new users.
 *
 * Full-screen with branding, tagline, and two CTAs:
 * "Create Wallet" and "Import Wallet".
 */

import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/theme'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Branding + Features — centered vertically */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.title}>Bankd</Text>
          <Text style={styles.subtitle}>
            Sovereign digital payments with privacy
          </Text>

          <View style={styles.features}>
            <FeatureRow icon="lock-closed" text="Privacy-preserving transactions" />
            <FeatureRow icon="flash" text="Instant finality (~2s settlement)" />
            <FeatureRow icon="globe" text="Cross-chain interoperability" />
          </View>
        </View>

        {/* CTAs — anchored to bottom */}
        <View style={styles.actions}>
          <Button
            title="Create New Wallet"
            onPress={() => router.push('/auth/create' as any)}
            size="lg"
          />
          <Button
            title="Import Existing Wallet"
            onPress={() => router.push('/auth/import' as any)}
            variant="secondary"
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon} size={22} color={colors.primary[600]} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
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
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxxl,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureText: {
    fontSize: fontSize.md,
    color: colors.gray[700],
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
})
