import { useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { type Hex, formatUnits } from 'viem'

import {
  type SimpleLendingLoanWithId,
  calculateTimeRemaining,
  createCancelLoanMemo,
  createFundLoanMemo,
  createLiquidateMemo,
  createRepayLoanMemo,
  formatBasisPointsAsPercent,
  formatDuration,
} from '@bankd/shared/evm/simpleLending'
import { formatAmount } from '@bankd/shared/utils'
import { ProgressStepper } from '@/components/transfer'
import { PRIVATE_EXEC_STEPS } from '@/components/transfer/ProgressStepper'
import { Button } from '@/components/ui'
import {
  useLoanInterest,
  usePenumbraBalances,
  useTokenDecimals,
  useTokenSymbol,
} from '@/hooks'
import { useEphemeralAddressRecords } from '@/hooks/useEphemeralAddressRecords'
import { usePrivateExec } from '@/hooks/usePrivateExec'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import { isOwnPenumbraAddress } from '@bankd/shared/penumbra'
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

export interface LoanDetailSheetProps {
  loan: SimpleLendingLoanWithId
  contractAddress: Hex
  /** Called after a successful action so the parent can close the modal / refresh */
  onDismiss?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

type StatusInfo = { label: string; bg: string; text: string }

function getStatusInfo(loan: SimpleLendingLoanWithId): StatusInfo {
  if (!loan.isActive && !loan.isFunded) {
    return {
      label: 'Cancelled',
      bg: colors.yellow[100],
      text: colors.yellow[600],
    }
  }
  if (!loan.isActive && loan.isFunded) {
    return { label: 'Completed', bg: colors.gray[100], text: colors.gray[600] }
  }
  if (loan.isActive && !loan.isFunded) {
    return {
      label: 'Unfunded',
      bg: colors.primary[100],
      text: colors.primary[600],
    }
  }
  if (loan.isExpired) {
    return { label: 'Expired', bg: colors.red[100], text: colors.red[600] }
  }
  return { label: 'Active', bg: colors.green[100], text: colors.green[600] }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoanDetailSheet({
  loan,
  contractAddress,
  onDismiss,
}: LoanDetailSheetProps) {
  const queryClient = useQueryClient()
  const { penumbraAddress } = usePenumbraBridge()
  const status = getStatusInfo(loan)
  const [isExecuting, setIsExecuting] = useState(false)

  // Private exec
  const { execute: privateExec, state: execState } = usePrivateExec()

  const execStepMap: Record<string, number> = {
    planning: 0, authorizing: 0, building: 1, broadcasting: 2,
    confirming: 3, syncing: 3, relaying: 4, confirmed: 5,
  }
  const stepIndex = execState.status in execStepMap ? execStepMap[execState.status] : null
  const { data: privateBalances } = usePenumbraBalances()

  // Token metadata
  const { data: collateralSymbol } = useTokenSymbol(loan.collateralToken)
  const { data: loanSymbol } = useTokenSymbol(loan.loanToken)
  const { data: collateralDecimals } = useTokenDecimals(loan.collateralToken)
  const { data: loanDecimals } = useTokenDecimals(loan.loanToken)
  const { data: currentInterest } = useLoanInterest(
    contractAddress,
    loan.isFunded && loan.isActive ? loan.id : null
  )

  const { data: registryRecords = [] } = useEphemeralAddressRecords()

  const isBorrower =
    !!penumbraAddress &&
    !!loan.borrowerIBCAddr &&
    (loan.borrowerIBCAddr === penumbraAddress ||
      isOwnPenumbraAddress(loan.borrowerIBCAddr, registryRecords))
  const isLender =
    !!penumbraAddress &&
    !!loan.lenderIBCAddr &&
    (loan.lenderIBCAddr === penumbraAddress ||
      isOwnPenumbraAddress(loan.lenderIBCAddr, registryRecords))

  const isFundable = loan.isActive && !loan.isFunded
  const timeRemaining =
    loan.isFunded && loan.startTime > 0n
      ? calculateTimeRemaining(loan.startTime, loan.duration)
      : null
  const canRepay =
    loan.isActive && loan.isFunded && isBorrower && !timeRemaining?.isExpired
  const canLiquidate =
    loan.isActive && loan.isFunded && isLender && timeRemaining?.isExpired
  const canCancel = loan.isActive && !loan.isFunded && isBorrower

  // Formatted amounts
  const collateralFormatted =
    collateralDecimals != null
      ? formatUnits(loan.collateralAmount, collateralDecimals)
      : '…'
  const loanFormatted =
    loanDecimals != null
      ? formatUnits(loan.loanAmount, loanDecimals)
      : '…'
  const interestFormatted =
    loanDecimals != null && currentInterest != null
      ? formatUnits(currentInterest, loanDecimals)
      : '…'
  const totalRepayment =
    currentInterest != null
      ? loan.loanAmount + currentInterest
      : loan.loanAmount
  const totalRepaymentFormatted =
    loanDecimals != null
      ? formatUnits(totalRepayment, loanDecimals)
      : '…'

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
    queryClient.invalidateQueries({ queryKey: ['penumbra'] })
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleFund = async () => {
    const loanTokenBalance = privateBalances?.find(
      (b) => b.erc20Address?.toLowerCase() === loan.loanToken.toLowerCase()
    )
    if (!loanTokenBalance) {
      Alert.alert('Error', 'Loan token not found in your private wallet')
      return
    }

    const memo = createFundLoanMemo(
      contractAddress,
      loan.loanToken,
      loan.loanAmount,
      loan.id,
    )

    setIsExecuting(true)
    const success = await privateExec({
      amount: loan.loanAmount.toString(),
      denom: loanTokenBalance.baseDenom,
      memo,
      sourceChannel: loanTokenBalance.sourceChannel || 'channel-0',
      destinationChannel: loanTokenBalance.destinationChannel,
      addressIndex: loanTokenBalance.addressIndex,
      purpose: 'eem-loan-fund',
      relatedKind: 'simple-lending-loan',
      relatedId: loan.id.toString(),
    })

    if (success) {
      Alert.alert('Success', 'Loan funded successfully!')
      invalidateAll()
      onDismiss?.()
    } else if (execState.error) {
      Alert.alert('Fund Failed', execState.error)
    }
    setIsExecuting(false)
  }

  const handleRepay = async () => {
    const loanTokenBalance = privateBalances?.find(
      (b) => b.erc20Address?.toLowerCase() === loan.loanToken.toLowerCase()
    )
    if (!loanTokenBalance) {
      Alert.alert('Error', 'Loan token not found in your private wallet')
      return
    }

    // 1% buffer for interest accrual during TX
    const repaymentWithBuffer = (totalRepayment * 101n) / 100n

    const memo = createRepayLoanMemo(
      contractAddress,
      loan.loanToken,
      repaymentWithBuffer,
      loan.id,
    )

    const borrowerRecord = registryRecords.find(
      (record) => record.penumbraAddress === loan.borrowerIBCAddr,
    )
    if (!borrowerRecord) {
      Alert.alert(
        'Error',
        'Missing original borrower address record. Import your address registry to repay this private loan.',
      )
      return
    }

    setIsExecuting(true)
    const success = await privateExec({
      amount: repaymentWithBuffer.toString(),
      denom: loanTokenBalance.baseDenom,
      memo,
      sourceChannel: loanTokenBalance.sourceChannel || 'channel-0',
      destinationChannel: loanTokenBalance.destinationChannel,
      addressIndex: loanTokenBalance.addressIndex,
      purpose: 'eem-loan-repay',
      relatedKind: 'simple-lending-loan',
      relatedId: loan.id.toString(),
      ephemeralRecord: borrowerRecord,
    })

    if (success) {
      Alert.alert('Success', 'Loan repaid successfully!')
      invalidateAll()
      onDismiss?.()
    } else if (execState.error) {
      Alert.alert('Repay Failed', execState.error)
    }
    setIsExecuting(false)
  }

  const handleCancel = async () => {
    const anyToken = privateBalances?.find(
      (b) => BigInt(b.amount) > 0n && b.erc20Address
    )
    if (!anyToken) {
      Alert.alert('Error', 'No tokens available')
      return
    }

    const memo = createCancelLoanMemo(contractAddress, loan.id)

    const borrowerRecord = registryRecords.find(
      (record) => record.penumbraAddress === loan.borrowerIBCAddr,
    )
    if (!borrowerRecord) {
      Alert.alert(
        'Error',
        'Missing original borrower address record. Import your address registry to cancel this private loan.',
      )
      return
    }

    setIsExecuting(true)
    const success = await privateExec({
      amount: '1',
      denom: anyToken.baseDenom,
      memo,
      sourceChannel: anyToken.sourceChannel || 'channel-0',
      destinationChannel: anyToken.destinationChannel,
      addressIndex: anyToken.addressIndex,
      purpose: 'eem-loan-cancel',
      relatedKind: 'simple-lending-loan',
      relatedId: loan.id.toString(),
      ephemeralRecord: borrowerRecord,
    })

    if (success) {
      Alert.alert('Success', 'Loan cancelled! Collateral returned.')
      invalidateAll()
      onDismiss?.()
    } else if (execState.error) {
      Alert.alert('Cancel Failed', execState.error)
    }
    setIsExecuting(false)
  }

  const handleLiquidate = async () => {
    const anyToken = privateBalances?.find(
      (b) => BigInt(b.amount) > 0n && b.erc20Address
    )
    if (!anyToken) {
      Alert.alert('Error', 'No tokens available')
      return
    }

    const memo = createLiquidateMemo(contractAddress, loan.id)

    const lenderRecord = registryRecords.find(
      (record) => record.penumbraAddress === loan.lenderIBCAddr,
    )
    if (!lenderRecord) {
      Alert.alert(
        'Error',
        'Missing original lender address record. Import your address registry to liquidate this private loan.',
      )
      return
    }

    setIsExecuting(true)
    const success = await privateExec({
      amount: '1',
      denom: anyToken.baseDenom,
      memo,
      sourceChannel: anyToken.sourceChannel || 'channel-0',
      destinationChannel: anyToken.destinationChannel,
      addressIndex: anyToken.addressIndex,
      purpose: 'eem-loan-liquidate',
      relatedKind: 'simple-lending-loan',
      relatedId: loan.id.toString(),
      ephemeralRecord: lenderRecord,
    })

    if (success) {
      Alert.alert('Success', 'Loan liquidated! Collateral seized.')
      invalidateAll()
      onDismiss?.()
    } else if (execState.error) {
      Alert.alert('Liquidate Failed', execState.error)
    }
    setIsExecuting(false)
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Loan #{loan.id.toString()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailsCard}>
        <DetailRow
          label="Borrower"
          value={truncateAddress(loan.borrower)}
          mono
        />
        {loan.isFunded && (
          <DetailRow
            label="Lender"
            value={truncateAddress(loan.lender)}
            mono
          />
        )}
        <DetailRow
          label="Collateral Token"
          value={
            collateralSymbol
              ? `${collateralSymbol} (${truncateAddress(loan.collateralToken)})`
              : truncateAddress(loan.collateralToken)
          }
          mono
        />
        <DetailRow
          label="Loan Token"
          value={
            loanSymbol
              ? `${loanSymbol} (${truncateAddress(loan.loanToken)})`
              : truncateAddress(loan.loanToken)
          }
          mono
        />
        <View style={styles.divider} />

        <DetailRow
          label="Collateral Amount"
          value={`${formatAmount(collateralFormatted)} ${collateralSymbol ?? ''}`}
        />
        <DetailRow
          label="Loan Amount"
          value={`${formatAmount(loanFormatted)} ${loanSymbol ?? ''}`}
        />
        <DetailRow
          label="Interest Rate"
          value={`${formatBasisPointsAsPercent(loan.interestRate)} APR`}
        />
        <DetailRow
          label="Duration"
          value={formatDuration(loan.duration)}
        />

        {loan.isFunded && loan.isActive && (
          <>
            <View style={styles.divider} />
            <DetailRow
              label="Interest Accrued"
              value={`${formatAmount(interestFormatted)} ${loanSymbol ?? ''}`}
              highlight
            />
            <DetailRow
              label="Total Repayment"
              value={`${formatAmount(totalRepaymentFormatted)} ${loanSymbol ?? ''}`}
              highlight
            />
            <DetailRow
              label="Time"
              value={timeRemaining?.formatted ?? 'N/A'}
              highlight={timeRemaining?.isExpired}
            />
          </>
        )}
      </View>

      {/* Progress */}
      {isExecuting && stepIndex !== null && (
        <ProgressStepper currentStep={stepIndex} steps={PRIVATE_EXEC_STEPS} />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {isFundable && !isBorrower && (
          <Button
            title={isExecuting ? 'Funding…' : `Fund Loan (${formatAmount(loanFormatted)} ${loanSymbol ?? ''})`}
            onPress={handleFund}
            disabled={isExecuting}
          />
        )}
        {canRepay && (
          <Button
            title={isExecuting ? 'Repaying…' : `Repay (${formatAmount(totalRepaymentFormatted)} ${loanSymbol ?? ''})`}
            onPress={handleRepay}
            disabled={isExecuting}
          />
        )}
        {canLiquidate && (
          <Button
            title={isExecuting ? 'Liquidating…' : 'Liquidate (Seize Collateral)'}
            variant="danger"
            onPress={handleLiquidate}
            disabled={isExecuting}
          />
        )}
        {canCancel && (
          <Button
            title={isExecuting ? 'Cancelling…' : 'Cancel Loan (Return Collateral)'}
            variant="secondary"
            onPress={handleCancel}
            disabled={isExecuting}
          />
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Detail Row
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          mono && styles.detailMono,
          highlight && styles.detailHighlight,
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  detailsCard: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    flex: 1,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[800],
    flex: 1,
    textAlign: 'right',
  },
  detailMono: {
    fontFamily: 'monospace',
    fontSize: fontSize.xs,
  },
  detailHighlight: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.xs,
  },
  actions: {
    gap: spacing.md,
  },
})
