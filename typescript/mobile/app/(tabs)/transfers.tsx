import { useLocalSearchParams } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { amountInBaseUnits } from '@/lib/commonware/transactions'
import { parseScannedPenumbraAddress } from '@/lib/penumbra-address'

import { useGlobalTransfer } from '@/providers/TransferProvider'
import { ProgressStepper, ReceiveView, SendForm } from '@/components/transfer'
import { PRIVATE_TX_STEPS } from '@/components/transfer/ProgressStepper'
import type { SendFormState } from '@/components/transfer/SendForm'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from '@/lib/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'send' | 'receive'

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function normalizeTransferTab(tab: string | string[] | undefined): Tab {
  const value = Array.isArray(tab) ? tab[0] : tab
  return value === 'receive' ? 'receive' : 'send'
}

export default function TransfersScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>()
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    normalizeTransferTab(params.tab)
  )
  const [sendFormState, setSendFormState] = useState<SendFormState>({
    selectedToken: null,
    amount: '',
    recipient: '',
  })
  const bridge = usePenumbraBridge()
  const transfer = useGlobalTransfer()
  const [isSending, setIsSending] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [sendError, setSendError] = useState('')
  const [stepIndex, setStepIndex] = useState<number | null>(null)

  useEffect(() => {
    setActiveTab(normalizeTransferTab(params.tab))
  }, [params.tab])

  const handleSend = useCallback(
    async (
      token: { symbol: string; amount: string; decimals: number; source: 'private' | 'public'; assetId: string; baseDenom: string },
      amount: string,
      recipient: string
    ) => {
      const stepMap: Record<string, number> = {
        planning: 0,
        authorizing: 1,
        building: 2,
        broadcasting: 3,
        confirming: 4,
        syncing: 5,
      }

      setSendError('')
      setIsSending(true)
      setStepIndex(0)
      setProgressMessage('Planning transaction…')
      try {
        const baseAmount = amountInBaseUnits(amount, token.decimals)
        if (baseAmount > BigInt(token.amount)) throw new Error('Insufficient balance')
        if (token.source === 'public') {
          const success = await transfer.sendSameChain({ recipient, amount, denom: token.baseDenom, decimals: token.decimals })
          if (success) setSendFormState({ selectedToken: null, amount: '', recipient: '' })
          return
        }
        if (!parseScannedPenumbraAddress(recipient)) throw new Error('Enter a valid shieldd1 receive address')
        const result = await bridge.send({
          amount: baseAmount.toString(),
          assetId: token.assetId,
          recipientAddress: recipient,
          onProgress: (step, message) => {
            setProgressMessage(message)
            if (step in stepMap) setStepIndex(stepMap[step])
          },
        })

        if (result.success) {
          setStepIndex(PRIVATE_TX_STEPS.length - 1) // "Done"
          setSendFormState({ selectedToken: null, amount: '', recipient: '' })
        } else {
          setSendError([result.error || 'Send failed', result.txHash ? `Transaction: ${result.txHash}` : ''].filter(Boolean).join(' '))
        }
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Send failed')
      } finally {
        setTimeout(() => {
          setIsSending(false)
          setProgressMessage(null)
          setStepIndex(null)
        }, 3000)
      }
    },
    [bridge, transfer]
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transfers</Text>
        <Text style={styles.subtitle}>Send and receive tokens</Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentWrapper}>
        <View style={styles.segmentRow}>
          <Pressable
            style={[
              styles.segment,
              activeTab === 'send' && styles.segmentActive,
            ]}
            onPress={() => setActiveTab('send')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'send' && styles.segmentTextActive,
              ]}
            >
              Send
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segment,
              activeTab === 'receive' && styles.segmentActive,
            ]}
            onPress={() => setActiveTab('receive')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'receive' && styles.segmentTextActive,
              ]}
            >
              Receive
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Progress Stepper */}
      {stepIndex !== null && (
        <View style={styles.stepperWrapper}>
          <ProgressStepper currentStep={stepIndex} steps={PRIVATE_TX_STEPS} />
        </View>
      )}

      {!!sendError && <Text style={{ color: colors.red[500], marginHorizontal: spacing.xl }}>{sendError}</Text>}

      {/* Tab Content */}
      <View style={styles.body}>
        {activeTab === 'send' ? (
          <>
            <SendForm
              onSend={handleSend}
              disabled={isSending}
              formState={sendFormState}
              onFormStateChange={setSendFormState}
            />
          </>
        ) : (
          <ReceiveView />
        )}
      </View>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.gray[500],
  },
  segmentWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  segmentActive: {
    backgroundColor: colors.white,
  },
  segmentText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[500],
  },
  segmentTextActive: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },
  body: {
    flex: 1,
  },
  stepperWrapper: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
})
