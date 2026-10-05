import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { type Hex, parseUnits } from 'viem'
import { formatAmount } from '@bankd/shared/utils'

import { Button, Card, Input } from '@/components/ui'
import { usePenumbraBalances, useWallet } from '@/hooks'
import { colors, fontSize, fontWeight, spacing, borderRadius } from '@/lib/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaceOrderFormProps {
  contractAddress: Hex | null
}

interface PrivateToken {
  address: Hex
  symbol: string
  decimals: number
  balance: bigint
  balanceFormatted: string
  denom: string
  sourceChannel: string
  destinationChannel?: string
  addressIndex?: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaceOrderForm({ contractAddress }: PlaceOrderFormProps) {
  const { isConnected } = useWallet()
  const { data: privateBalances } = usePenumbraBalances()

  const [selectedSellIndex, setSelectedSellIndex] = useState<number | null>(null)
  const [sellAmount, setSellAmount] = useState('')
  const [selectedBuyIndex, setSelectedBuyIndex] = useState<number | null>(null)
  const [buyAmount, setBuyAmount] = useState('')
  const [whitelistedBuyer, setWhitelistedBuyer] = useState('')

  // Build token list from private balances
  const tokenBalances = useMemo<PrivateToken[]>(
    () =>
      (privateBalances ?? [])
        .filter((b) => BigInt(b.amount) > 0n && b.erc20Address)
        .map((b) => ({
          address: b.erc20Address as Hex,
          symbol: b.symbol,
          decimals: b.decimals,
          balance: BigInt(b.amount),
          balanceFormatted: b.amountFormatted,
          denom: b.baseDenom,
          sourceChannel: b.sourceChannel || 'channel-0',
          destinationChannel: b.destinationChannel,
          addressIndex: b.addressIndex,
        })),
    [privateBalances],
  )

  // Auto-select first token when balances load
  useEffect(() => {
    if (tokenBalances.length > 0 && selectedSellIndex === null) setSelectedSellIndex(0)
    if (tokenBalances.length > 1 && selectedBuyIndex === null) setSelectedBuyIndex(1)
    else if (tokenBalances.length > 0 && selectedBuyIndex === null) setSelectedBuyIndex(0)
  }, [tokenBalances.length])

  const selectedSellToken = selectedSellIndex !== null ? tokenBalances[selectedSellIndex] ?? null : null
  const selectedBuyToken = selectedBuyIndex !== null ? tokenBalances[selectedBuyIndex] ?? null : null

  if (!contractAddress) {
    return (
      <Card title="Place Order">
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No contract configured</Text>
          <Text style={styles.emptyHint}>
            Enter a swap contract address above to get started.
          </Text>
        </View>
      </Card>
    )
  }

  const canSubmit =
    isConnected &&
    selectedSellToken != null &&
    sellAmount.length > 0 &&
    parseFloat(sellAmount) > 0 &&
    selectedBuyToken != null &&
    buyAmount.length > 0 &&
    parseFloat(buyAmount) > 0

  const handleSubmit = async () => {
    if (!selectedSellToken || !selectedBuyToken) return

    if (whitelistedBuyer && !/^0x[0-9a-fA-F]{40}$/.test(whitelistedBuyer.trim())) {
      Alert.alert('Invalid Address', 'Authorized buyer address is invalid.')
      return
    }

    const sellAmountWei = parseUnits(sellAmount, selectedSellToken.decimals)
    if (sellAmountWei > selectedSellToken.balance) {
      Alert.alert('Insufficient Balance', 'Sell amount exceeds your balance.')
      return
    }

    Alert.alert('Unavailable', 'Swap actions require integration with the AvP precompile and host withdrawals.')
  }

  return (
    <Card title="Place Order">
      {/* Sell token */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>You Sell</Text>
        <View style={styles.tokenRow}>
          {tokenBalances.length === 0 ? (
            <Text style={styles.emptyHint}>No tokens in your private wallet.</Text>
          ) : (
            tokenBalances.map((token, index) => (
              <Pressable
                key={token.address}
                style={[
                  styles.tokenChip,
                  selectedSellIndex === index && styles.tokenChipActive,
                ]}
                onPress={() => setSelectedSellIndex(index)}
              >
                <Text
                  style={[
                    styles.tokenChipText,
                    selectedSellIndex === index && styles.tokenChipTextActive,
                  ]}
                >
                  {token.symbol}
                </Text>
                <Text
                  style={[
                    styles.tokenChipBalance,
                    selectedSellIndex === index && styles.tokenChipTextActive,
                  ]}
                >
                  {formatAmount(token.balanceFormatted)}
                </Text>
              </Pressable>
            ))
          )}
        </View>
        <Input
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={sellAmount}
          onChangeText={setSellAmount}
          inputStyle={styles.amountInput}
          hint={
            selectedSellToken
              ? `Balance: ${formatAmount(selectedSellToken.balanceFormatted)} ${selectedSellToken.symbol}`
              : undefined
          }
        />
      </View>

      <View style={styles.divider} />

      {/* Buy token */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>You Buy</Text>
        <View style={styles.tokenRow}>
          {tokenBalances.length === 0 ? (
            <Text style={styles.emptyHint}>No tokens in your private wallet.</Text>
          ) : (
            tokenBalances.map((token, index) => (
              <Pressable
                key={token.address}
                style={[
                  styles.tokenChip,
                  selectedBuyIndex === index && styles.tokenChipActive,
                ]}
                onPress={() => setSelectedBuyIndex(index)}
              >
                <Text
                  style={[
                    styles.tokenChipText,
                    selectedBuyIndex === index && styles.tokenChipTextActive,
                  ]}
                >
                  {token.symbol}
                </Text>
              </Pressable>
            ))
          )}
        </View>
        <Input
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={buyAmount}
          onChangeText={setBuyAmount}
          inputStyle={styles.amountInput}
        />
      </View>

      <View style={styles.divider} />

      {/* Whitelisted buyer (optional) */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Authorized Buyer (Optional)</Text>
        <Input
          placeholder="0x… or leave empty for open order"
          value={whitelistedBuyer}
          onChangeText={setWhitelistedBuyer}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Progress Stepper */}

      <Button
        title="Place Order"
        onPress={handleSubmit}
        disabled={!canSubmit}

        style={styles.submitButton}
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountInput: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tokenChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  tokenChipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  tokenChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
  },
  tokenChipBalance: {
    fontSize: fontSize.xxs,
    color: colors.gray[400],
    marginTop: 2,
  },
  tokenChipTextActive: {
    color: colors.primary[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.lg,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.gray[600],
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
  },
})
