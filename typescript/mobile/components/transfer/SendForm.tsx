import React, { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Button, Card, Input } from '@/components/ui'
import { QRCodeScannerModal } from './QRCodeScannerModal'
import { usePenumbraBalances } from '@/hooks'
import { formatAmount } from '@bankd/shared'
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

interface TokenOption {
  symbol: string
  name: string
  amount: string
  amountFormatted: string
  decimals: number
  source: 'private'
  assetId: string
}

export interface SendFormState {
  selectedToken: TokenOption | null
  amount: string
  recipient: string
}

export interface SendFormProps {
  onSend?: (token: TokenOption, amount: string, recipient: string) => void
  /** Disable the form (e.g. while a transfer is in progress) */
  disabled?: boolean
  /** Controlled form state (persisted by parent) */
  formState?: SendFormState
  /** Called when form fields change */
  onFormStateChange?: (state: SendFormState) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SendForm({ onSend, disabled, formState, onFormStateChange }: SendFormProps) {
  const { data: privateBalances } = usePenumbraBalances()

  const selectedToken = formState?.selectedToken ?? null
  const amount = formState?.amount ?? ''
  const recipient = formState?.recipient ?? ''
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const setSelectedToken = (token: TokenOption | null) =>
    onFormStateChange?.({ selectedToken: token, amount, recipient })
  const setAmount = (v: string) =>
    onFormStateChange?.({ selectedToken, amount: v, recipient })
  const setRecipient = (v: string) =>
    onFormStateChange?.({ selectedToken, amount, recipient: v })

  // Only show private (Penumbra) balances
  const tokens = useMemo<TokenOption[]>(() => {
    if (!privateBalances) return []
    return privateBalances
      .filter((b) => BigInt(b.amount) > 0n)
      .map((b) => ({
        symbol: b.symbol,
        name: b.name || b.symbol,
        amount: b.amount,
        amountFormatted: formatAmount(b.amountFormatted),
        decimals: b.decimals,
        source: 'private' as const,
        assetId: b.assetId,
      }))
  }, [privateBalances])

  const canSend = !!selectedToken && !!amount && !!recipient && !disabled

  const handleSend = () => {
    if (!canSend || !selectedToken) return
    onSend?.(selectedToken, amount, recipient)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Token Picker */}
      <Text style={styles.label}>Token</Text>
      <Pressable
        style={styles.picker}
        onPress={() => setPickerOpen(!pickerOpen)}
      >
        <Text
          style={
            selectedToken ? styles.pickerText : styles.pickerPlaceholder
          }
        >
          {selectedToken
            ? `${selectedToken.symbol} (Private)`
            : 'Select a token'}
        </Text>
        <Text style={styles.pickerChevron}>{pickerOpen ? '▲' : '▼'}</Text>
      </Pressable>

      {pickerOpen && (
        <Card style={styles.pickerDropdown}>
          {tokens.length === 0 ? (
            <Text style={styles.emptyText}>No tokens available</Text>
          ) : (
            tokens.map((token, i) => (
              <Pressable
                key={`${token.symbol}-${token.source}-${i}`}
                style={({ pressed }) => [
                  styles.tokenRow,
                  pressed && styles.tokenRowPressed,
                  i < tokens.length - 1 && styles.tokenRowBorder,
                ]}
                onPress={() => {
                  setSelectedToken(token)
                  setPickerOpen(false)
                }}
              >
                <View style={styles.tokenInfo}>
                  <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                  <Text style={styles.tokenSource}>
                    <Ionicons name="lock-closed" size={12} color={colors.gray[400]} />{' '}
                    Private
                  </Text>
                </View>
                <Text style={styles.tokenAmount}>{token.amountFormatted}</Text>
              </Pressable>
            ))
          )}
        </Card>
      )}

      {/* Amount Input */}
      <Input
        label="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        right={
          selectedToken ? (
            <Text style={styles.inputUnit}>{selectedToken.symbol}</Text>
          ) : undefined
        }
      />
      {selectedToken && (
        <View style={styles.balanceRow}>
          <Text style={styles.balanceValue}>
            {selectedToken.amountFormatted} {selectedToken.symbol} available
          </Text>
          <Pressable onPress={() => setAmount(selectedToken.amount)}>
            <Text style={styles.balanceMax}>Use max</Text>
          </Pressable>
        </View>
      )}

      {/* Recipient Address */}
      <View style={styles.recipientHeader}>
        <Text style={styles.label}>Recipient Address</Text>
        <Pressable
          style={({ pressed }) => [
            styles.scanButton,
            pressed && styles.scanButtonPressed,
            disabled && styles.scanButtonDisabled,
          ]}
          onPress={() => setScannerOpen(true)}
          disabled={disabled}
        >
          <Ionicons name="qr-code-outline" size={16} color={colors.primary[400]} />
          <Text style={styles.scanButtonText}>Scan</Text>
        </Pressable>
      </View>
      <Input
        placeholder="penumbra1..."
        value={recipient}
        onChangeText={setRecipient}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.recipientHint}>
        Only private addresses (penumbra1…) are supported
      </Text>

      {/* Estimated Fee */}
      <View style={styles.feeRow}>
        <Text style={styles.feeLabel}>Estimated Fee</Text>
        <Text style={styles.feeValue}>None (penumbra)</Text>
      </View>

      {/* Send Button */}
      <Button
        title="Send"
        onPress={handleSend}
        disabled={!canSend}
        variant="primary"
        size="lg"
        style={styles.sendButton}
      />

      <QRCodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onAddressScanned={setRecipient}
      />
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  },
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -spacing.sm,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  scanButtonPressed: {
    opacity: 0.75,
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonText: {
    color: colors.primary[600],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  pickerText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.gray[900],
  },
  pickerPlaceholder: {
    fontSize: fontSize.md,
    color: colors.gray[400],
  },
  pickerChevron: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  pickerDropdown: {
    marginTop: -spacing.sm,
    marginBottom: 0,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  tokenRowPressed: {
    backgroundColor: colors.gray[50],
  },
  tokenRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  tokenInfo: {
    gap: spacing.xs,
  },
  tokenSymbol: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
  },
  tokenSource: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  tokenAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
  },
  inputUnit: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
    paddingHorizontal: spacing.xs,
  },
  balanceValue: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  balanceMax: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  feeLabel: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
  feeValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
  },
  recipientHint: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sendButton: {
    marginTop: spacing.md,
  },
})
