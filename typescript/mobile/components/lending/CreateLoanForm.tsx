import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { type Hex, parseUnits } from 'viem'

import {
  createCreateLoanMemo,
  formatBasisPointsAsPercent,
  formatDuration as sharedFormatDuration,
  validateCollateralRatio,
} from '@bankd/shared/evm/simpleLending'
import { formatAmount } from '@bankd/shared/utils'
import { ProgressStepper } from '@/components/transfer'
import { PRIVATE_EXEC_STEPS } from '@/components/transfer/ProgressStepper'
import { Button, Card, Input } from '@/components/ui'
import { usePenumbraBalances } from '@/hooks'
import { usePrivateExec } from '@/hooks/usePrivateExec'
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

export interface CreateLoanFormProps {
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
// Duration presets (seconds)
// ---------------------------------------------------------------------------

const DURATION_PRESETS = [
  { label: '7 Days', value: 7n * 24n * 60n * 60n },
  { label: '30 Days', value: 30n * 24n * 60n * 60n },
  { label: '90 Days', value: 90n * 24n * 60n * 60n },
  { label: 'Custom', value: 0n },
] as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateLoanForm({ contractAddress }: CreateLoanFormProps) {
  const queryClient = useQueryClient()

  // Private balances from Penumbra
  const { data: privateBalances } = usePenumbraBalances()
  const { state: execState, execute: privateExec } = usePrivateExec()

  const execStepMap: Record<string, number> = {
    planning: 0, authorizing: 0, building: 1, broadcasting: 2,
    confirming: 3, syncing: 3, relaying: 4, confirmed: 5,
  }
  const stepIndex = execState.status in execStepMap ? execStepMap[execState.status] : null

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

  // Form state
  const [selectedCollateralIndex, setSelectedCollateralIndex] = useState<
    number | null
  >(null)
  const [collateralAmount, setCollateralAmount] = useState('')
  const [selectedLoanTokenIndex, setSelectedLoanTokenIndex] = useState<
    number | null
  >(null)
  const [loanAmount, setLoanAmount] = useState('')
  const [interestRate, setInterestRate] = useState('1000') // 10% default (basis points)
  const [selectedDuration, setSelectedDuration] = useState(
    DURATION_PRESETS[1].value
  )
  const [customDuration, setCustomDuration] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCustom = selectedDuration === 0n

  // Auto-select first tokens when balances load
  useEffect(() => {
    if (tokenBalances.length > 0 && selectedCollateralIndex === null) setSelectedCollateralIndex(0)
    if (tokenBalances.length > 1 && selectedLoanTokenIndex === null) setSelectedLoanTokenIndex(1)
    else if (tokenBalances.length > 0 && selectedLoanTokenIndex === null) setSelectedLoanTokenIndex(0)
  }, [tokenBalances.length])

  const selectedCollateral =
    selectedCollateralIndex !== null
      ? tokenBalances[selectedCollateralIndex]
      : null
  const selectedLoanToken =
    selectedLoanTokenIndex !== null
      ? tokenBalances[selectedLoanTokenIndex]
      : null

  // Collateral ratio
  const collateralRatio = useMemo(() => {
    if (!collateralAmount || !loanAmount || !selectedCollateral || !selectedLoanToken)
      return null
    try {
      const collateralWei = parseUnits(
        collateralAmount,
        selectedCollateral.decimals
      )
      const loanWei = parseUnits(loanAmount, selectedLoanToken.decimals)
      return validateCollateralRatio(collateralWei, loanWei)
    } catch {
      return null
    }
  }, [collateralAmount, loanAmount, selectedCollateral, selectedLoanToken])

  const effectiveDuration = isCustom
    ? BigInt(customDuration || '0')
    : selectedDuration

  if (!contractAddress) {
    return (
      <Card title="Create Loan">
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No contract configured</Text>
          <Text style={styles.emptyHint}>
            Set a lending contract address above to get started.
          </Text>
        </View>
      </Card>
    )
  }

  const handleCreate = async () => {
    if (!selectedCollateral || !selectedLoanToken) {
      Alert.alert('Error', 'Please select both collateral and loan tokens')
      return
    }
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      Alert.alert('Error', 'Invalid collateral amount')
      return
    }
    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      Alert.alert('Error', 'Invalid loan amount')
      return
    }

    const collateralWei = parseUnits(
      collateralAmount,
      selectedCollateral.decimals
    )
    const loanWei = parseUnits(loanAmount, selectedLoanToken.decimals)
    const interestRateBp = BigInt(interestRate || '0')

    // Validate collateral ratio
    const ratioCheck = validateCollateralRatio(collateralWei, loanWei)
    if (!ratioCheck.isValid) {
      Alert.alert(
        'Invalid Ratio',
        `Collateral ratio ${ratioCheck.formatted} is below 150% minimum`
      )
      return
    }

    // Validate interest rate
    if (interestRateBp <= 0n || interestRateBp > 5000n) {
      Alert.alert('Error', 'Interest rate must be between 0.01% and 50%')
      return
    }

    if (effectiveDuration <= 0n) {
      Alert.alert('Error', 'Invalid duration')
      return
    }

    const memo = createCreateLoanMemo(
      contractAddress,
      selectedCollateral.address,
      collateralWei,
      selectedLoanToken.address,
      loanWei,
      interestRateBp,
      effectiveDuration,
    )

    setIsSubmitting(true)
    const success = await privateExec({
      amount: collateralWei.toString(),
      denom: selectedCollateral.denom,
      memo,
      sourceChannel: selectedCollateral.sourceChannel,
      destinationChannel: selectedCollateral.destinationChannel,
      addressIndex: selectedCollateral.addressIndex,
      purpose: 'eem-loan-create',
      relatedKind: 'simple-lending-loan',
    })

    if (success) {
      Alert.alert('Success', 'Loan created successfully!')
      // Reset form
      setCollateralAmount('')
      setLoanAmount('')
      setSelectedCollateralIndex(null)
      setSelectedLoanTokenIndex(null)
      queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
      queryClient.invalidateQueries({ queryKey: ['penumbra'] })
    } else if (execState.error) {
      Alert.alert('Failed', execState.error)
    }

    setIsSubmitting(false)
  }

  const isValid =
    selectedCollateral !== null &&
    selectedLoanToken !== null &&
    Number(collateralAmount) > 0 &&
    Number(loanAmount) > 0 &&
    Number(interestRate) > 0 &&
    effectiveDuration > 0n

  return (
    <Card title="Create Loan">
      <View style={styles.form}>
        {/* Collateral Token Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Collateral Token</Text>
          <View style={styles.tokenRow}>
            {tokenBalances.length === 0 ? (
              <Text style={styles.emptyHint}>
                No tokens found in your private wallet.
              </Text>
            ) : (
              tokenBalances.map((token, index) => (
                <Pressable
                  key={token.address}
                  style={[
                    styles.tokenChip,
                    selectedCollateralIndex === index &&
                      styles.tokenChipActive,
                  ]}
                  onPress={() => setSelectedCollateralIndex(index)}
                >
                  <Text
                    style={[
                      styles.tokenChipText,
                      selectedCollateralIndex === index &&
                        styles.tokenChipTextActive,
                    ]}
                  >
                    {token.symbol}
                  </Text>
                  <Text
                    style={[
                      styles.tokenChipBalance,
                      selectedCollateralIndex === index &&
                        styles.tokenChipTextActive,
                    ]}
                  >
                    {formatAmount(token.balanceFormatted)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <Input
          label="Collateral Amount"
          placeholder="0.00"
          value={collateralAmount}
          onChangeText={setCollateralAmount}
          keyboardType="decimal-pad"
          hint={
            selectedCollateral
              ? `Balance: ${formatAmount(selectedCollateral.balanceFormatted)}`
              : undefined
          }
        />

        {/* Loan Token Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Borrow Token</Text>
          <View style={styles.tokenRow}>
            {tokenBalances.length === 0 ? (
              <Text style={styles.emptyHint}>
                No tokens found in your private wallet.
              </Text>
            ) : (
              tokenBalances.map((token, index) => (
                <Pressable
                  key={token.address}
                  style={[
                    styles.tokenChip,
                    selectedLoanTokenIndex === index &&
                      styles.tokenChipActive,
                  ]}
                  onPress={() => setSelectedLoanTokenIndex(index)}
                >
                  <Text
                    style={[
                      styles.tokenChipText,
                      selectedLoanTokenIndex === index &&
                        styles.tokenChipTextActive,
                    ]}
                  >
                    {token.symbol}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <Input
          label="Loan Amount"
          placeholder="0.00"
          value={loanAmount}
          onChangeText={setLoanAmount}
          keyboardType="decimal-pad"
        />

        {/* Collateral Ratio Display */}
        {collateralRatio && (
          <View
            style={[
              styles.ratioBox,
              collateralRatio.isValid
                ? styles.ratioBoxValid
                : styles.ratioBoxInvalid,
            ]}
          >
            <Text
              style={[
                styles.ratioText,
                collateralRatio.isValid
                  ? styles.ratioTextValid
                  : styles.ratioTextInvalid,
              ]}
            >
              Collateral Ratio: {collateralRatio.formatted}
              {!collateralRatio.isValid && ' (min 150%)'}
            </Text>
          </View>
        )}

        {/* Interest Rate */}
        <Input
          label="Interest Rate (basis points)"
          placeholder="1000"
          value={interestRate}
          onChangeText={setInterestRate}
          keyboardType="number-pad"
          hint={`${formatBasisPointsAsPercent(BigInt(interestRate || '0'))} APR`}
        />

        {/* Duration */}
        <View style={styles.durationSection}>
          <Text style={styles.durationLabel}>Duration</Text>
          <View style={styles.durationRow}>
            {DURATION_PRESETS.map((preset) => (
              <Pressable
                key={preset.label}
                style={[
                  styles.durationChip,
                  selectedDuration === preset.value &&
                    styles.durationChipActive,
                ]}
                onPress={() => setSelectedDuration(preset.value)}
              >
                <Text
                  style={[
                    styles.durationChipText,
                    selectedDuration === preset.value &&
                      styles.durationChipTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {isCustom && (
            <Input
              placeholder="Seconds"
              value={customDuration}
              onChangeText={setCustomDuration}
              keyboardType="number-pad"
              hint={
                customDuration
                  ? sharedFormatDuration(BigInt(customDuration || '0'))
                  : 'Enter duration in seconds'
              }
            />
          )}
        </View>

        {/* Progress */}
        {isSubmitting && stepIndex !== null && (
          <ProgressStepper currentStep={stepIndex} steps={PRIVATE_EXEC_STEPS} />
        )}

        <Button
          title={isSubmitting ? 'Creating…' : 'Create Loan'}
          onPress={handleCreate}
          disabled={!isValid || isSubmitting}
          style={styles.createButton}
        />
      </View>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
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
  ratioBox: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  ratioBoxValid: {
    backgroundColor: colors.green[50],
  },
  ratioBoxInvalid: {
    backgroundColor: colors.red[50],
  },
  ratioText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  ratioTextValid: {
    color: colors.green[600],
  },
  ratioTextInvalid: {
    color: colors.red[600],
  },
  durationSection: {
    gap: spacing.sm,
  },
  durationLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  durationChipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  durationChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
  },
  durationChipTextActive: {
    color: colors.primary[600],
  },
  createButton: {
    marginTop: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
  },
})
