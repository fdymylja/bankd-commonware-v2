/**
 * TransferProvider — Global transfer state shared across all screens.
 *
 * Provides useTransfer() hook results via context so the home screen
 * shield/unshield and transfers screen share the same progress state.
 *
 * Renders a floating progress overlay when a transfer is in progress.
 */

import React, { createContext, useContext, useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ProgressStepper } from '@/components/transfer/ProgressStepper'
import { useTransfer, type TransferState } from '@/hooks/useTransfer'

const PUBLIC_TX_STEPS = ['Preparing', 'Signing', 'Broadcasting', 'Confirmed'] as const
import { borderRadius, colors, fontSize, fontWeight, spacing, shadow } from '@/lib/theme'

// =============================================================================
// Context
// =============================================================================

type TransferContextType = ReturnType<typeof useTransfer>

const TransferContext = createContext<TransferContextType | null>(null)

export function useGlobalTransfer(): TransferContextType {
  const ctx = useContext(TransferContext)
  if (!ctx) {
    throw new Error('useGlobalTransfer must be used within TransferProvider')
  }
  return ctx
}

// =============================================================================
// Status → step mapping
// =============================================================================

function statusToStep(status: TransferState['status']): number | null {
  switch (status) {
    case 'preparing':
      return 0
    case 'signing':
      return 1
    case 'broadcasting':
    case 'confirming':
      return 2
    case 'confirmed':
      return 3
    default:
      return null
  }
}

// =============================================================================
// Provider
// =============================================================================

export function TransferProvider({ children }: { children: React.ReactNode }) {
  const transfer = useTransfer()
  const { state, reset } = transfer
  const step = statusToStep(state.status)
  const isActive = state.status !== 'idle'

  // Auto-dismiss after 3 seconds on success
  useEffect(() => {
    if (state.status === 'confirmed') {
      const timer = setTimeout(reset, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.status, reset])

  return (
    <TransferContext.Provider value={transfer}>
      {children}
      {isActive && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={[styles.card, shadow.lg]}>
            {step !== null && <ProgressStepper currentStep={step} steps={PUBLIC_TX_STEPS} />}
            <Text
              style={[
                styles.message,
                state.status === 'error' && styles.messageError,
                state.status === 'confirmed' && styles.messageSuccess,
              ]}
            >
              {state.message}
            </Text>
            {(state.status === 'error' || state.status === 'confirmed') && (
              <Pressable style={styles.dismissButton} onPress={reset}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </TransferContext.Provider>
  )
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.gray[600],
    textAlign: 'center',
  },
  messageError: {
    color: colors.red[600],
  },
  messageSuccess: {
    color: colors.green[600],
    fontWeight: fontWeight.semibold,
  },
  dismissButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
  },
  dismissText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
  },
})
