import React, { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { type Hex, formatUnits } from 'viem'

import {
  type SimpleLendingLoanWithId,
  formatBasisPointsAsPercent,
} from '@bankd/shared/evm/simpleLending'
import { formatAmount } from '@bankd/shared/utils'
import {
  useAllLoans,
  useFundableLoans,
  useMyBorrowedLoans,
  useMyLentLoans,
  useTokenDecimals,
  useTokenSymbol,
  useWallet,
} from '@/hooks'
import { useEphemeralAddressRecords } from '@/hooks/useEphemeralAddressRecords'
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

export interface LoansListProps {
  contractAddress: Hex | null
  onSelectLoan?: (loan: SimpleLendingLoanWithId) => void
}

type FilterTab = 'all' | 'fundable' | 'borrowed' | 'lent'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

type StatusInfo = { label: string; bg: string; text: string }

function getStatusInfo(loan: SimpleLendingLoanWithId): StatusInfo {
  if (!loan.isActive && !loan.isFunded) {
    return { label: 'Cancelled', bg: colors.yellow[100], text: colors.yellow[600] }
  }
  if (!loan.isActive && loan.isFunded) {
    // Could be repaid or liquidated — we mark as completed
    return { label: 'Repaid', bg: colors.gray[100], text: colors.gray[600] }
  }
  if (loan.isActive && !loan.isFunded) {
    return { label: 'Unfunded', bg: colors.primary[100], text: colors.primary[600] }
  }
  if (loan.isExpired) {
    return { label: 'Expired', bg: colors.red[100], text: colors.red[600] }
  }
  return { label: 'Active', bg: colors.green[100], text: colors.green[600] }
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fundable', label: 'Fundable' },
  { key: 'borrowed', label: 'My Borrowed' },
  { key: 'lent', label: 'My Lent' },
]

// ---------------------------------------------------------------------------
// Loan Item (own component so it can use hooks for token decimals)
// ---------------------------------------------------------------------------

function LoanItem({
  item,
  onPress,
}: {
  item: SimpleLendingLoanWithId
  onPress: () => void
}) {
  const { data: collateralDecimals } = useTokenDecimals(item.collateralToken)
  const { data: loanDecimals } = useTokenDecimals(item.loanToken)
  const { data: collateralSymbol } = useTokenSymbol(item.collateralToken)
  const { data: loanSymbol } = useTokenSymbol(item.loanToken)
  const status = getStatusInfo(item)

  const collateralStr = collateralDecimals != null
    ? `${formatAmount(formatUnits(item.collateralAmount, collateralDecimals))} ${collateralSymbol ?? ''}`
    : '…'
  const loanStr = loanDecimals != null
    ? `${formatAmount(formatUnits(item.loanAmount, loanDecimals))} ${loanSymbol ?? ''}`
    : '…'

  return (
    <Pressable
      style={({ pressed }) => [
        styles.loanRow,
        pressed && styles.loanRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.loanHeader}>
        <Text style={styles.loanId}>Loan #{item.id.toString()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.addressRow}>
        <Text style={styles.addressLabel}>Borrower</Text>
        <Text style={styles.addressValue}>
          {truncateAddress(item.borrower)}
        </Text>
      </View>

      {item.isFunded && (
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>Lender</Text>
          <Text style={styles.addressValue}>
            {truncateAddress(item.lender)}
          </Text>
        </View>
      )}

      <View style={styles.amountRow}>
        <Text style={styles.amountText}>
          {collateralStr} → {loanStr}
        </Text>
        <Text style={styles.interestText}>
          {formatBasisPointsAsPercent(item.interestRate)} interest
        </Text>
      </View>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoansList({ contractAddress, onSelectLoan }: LoansListProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const { hexAddress } = useWallet()
  const { data: registryRecords = [] } = useEphemeralAddressRecords()

  const { data: allLoansData } = useAllLoans(contractAddress)
  const { data: fundableData } = useFundableLoans(contractAddress, hexAddress, registryRecords)
  const { data: borrowedData } = useMyBorrowedLoans(contractAddress, hexAddress, registryRecords)
  const { data: lentData } = useMyLentLoans(contractAddress, hexAddress, registryRecords)

  const loans = useMemo((): SimpleLendingLoanWithId[] => {
    switch (activeTab) {
      case 'all': {
        if (!allLoansData) return []
        return [
          ...allLoansData.unfunded,
          ...allLoansData.active,
          ...allLoansData.completed,
        ]
      }
      case 'fundable':
        return fundableData ?? []
      case 'borrowed': {
        if (!borrowedData) return []
        return [
          ...borrowedData.unfunded,
          ...borrowedData.active,
          ...borrowedData.completed,
        ]
      }
      case 'lent': {
        if (!lentData) return []
        return [
          ...lentData.unfunded,
          ...lentData.active,
          ...lentData.completed,
        ]
      }
    }
  }, [activeTab, allLoansData, fundableData, borrowedData, lentData])

  const renderLoanItem = ({
    item,
  }: {
    item: SimpleLendingLoanWithId
  }) => (
    <LoanItem item={item} onPress={() => onSelectLoan?.(item)} />
  )

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Loans list */}
      <FlatList
        data={loans}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderLoanItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No loans found</Text>
          </View>
        }
        scrollEnabled={false}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  tabActive: {
    backgroundColor: colors.primary[600],
  },
  tabText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
  },
  tabTextActive: {
    color: colors.white,
  },
  listContent: {
    gap: spacing.sm,
  },
  loanRow: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  loanRowPressed: {
    backgroundColor: colors.gray[50],
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loanId: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.semibold,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  addressValue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
    fontFamily: 'monospace',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  amountText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[800],
  },
  interestText: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },
})
