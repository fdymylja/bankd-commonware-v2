/**
 * Root Layout — App entry point with auth gate.
 *
 * Wraps the app in NativeWalletProvider and routes based on wallet state:
 * - 'uninitialized' → /auth/welcome
 * - 'locked' → /auth/unlock
 * - 'unlocked' → /(tabs)
 */

import { useFonts } from 'expo-font'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import 'react-native-reanimated'

import { colors, fontSize, spacing } from '@/lib/theme'
import {
  NativeWalletProvider,
  useNativeWallet,
} from '@/lib/native-wallet'
import { PenumbraProvider, usePenumbraBridge } from '@/providers/PenumbraProvider'
import { QueryProvider } from '@/providers/QueryProvider'
import { TransferProvider } from '@/providers/TransferProvider'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

// ---------------------------------------------------------------------------
// Inner layout — has access to wallet context
// ---------------------------------------------------------------------------

function InnerLayout() {
  const { initState, isInitializing } = useNativeWallet()
  const bridge = usePenumbraBridge()
  const router = useRouter()

  const bridgeReady = !!bridge.penumbraAddress

  // Navigate based on wallet state — hooks must be called before any return
  useEffect(() => {
    if (isInitializing) return

    if (initState === 'uninitialized') {
      router.replace('/auth/welcome' as any)
    } else if (initState === 'locked') {
      router.replace('/auth/unlock' as any)
    } else if (initState === 'unlocked' && bridgeReady) {
      router.replace('/(tabs)' as any)
    }
  }, [initState, isInitializing, bridgeReady])

  // Show loading while checking wallet state or waiting for bridge
  if (isInitializing || (initState === 'unlocked' && !bridgeReady)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        {initState === 'unlocked' && !bridgeReady && (
          <Text style={styles.loadingText}>Initializing wallet...</Text>
        )}
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="auth"
        options={{ gestureEnabled: false }}
      />
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Root layout — loads fonts, provides wallet context
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  return (
    <QueryProvider>
      <NativeWalletProvider>
        <PenumbraProvider>
          <TransferProvider>
            <InnerLayout />
          </TransferProvider>
        </PenumbraProvider>
      </NativeWalletProvider>
    </QueryProvider>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },
})
