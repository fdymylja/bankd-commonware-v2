import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatUnits, type Hex } from 'viem'
import { formatAmount } from '@bankd/shared/utils'

import { Button } from '@/components/ui'
import { useEphemeralAddressRecords } from '@/hooks/useEphemeralAddressRecords'
import { useTokenDecimals, useTokenSymbol } from '@/hooks'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import { isOwnPenumbraAddress } from '@bankd/shared/penumbra'
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from '@/lib/theme'
import {
  ZERO_ADDRESS,
  type AtomicSwapOrderWithId,
} from '@bankd/shared/evm/atomicSwap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderDetailSheetProps {
  order: AtomicSwapOrderWithId
  contractAddress: Hex
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrderDetailSheet({
  order,
  contractAddress,
  onClose,
}: OrderDetailSheetProps) {

  // Token metadata
  const { data: sellSymbol } = useTokenSymbol(order.sellToken)
  const { data: buySymbol } = useTokenSymbol(order.buyToken)
  const { data: sellDecimals } = useTokenDecimals(order.sellToken)
  const { data: buyDecimals } = useTokenDecimals(order.buyToken)

  const status = order.isCancelled
    ? 'Cancelled'
    : order.isActive
      ? 'Active'
      : 'Filled'
  const statusColor = statusStyles[status]

  // Compare seller's IBC address with the user's Penumbra address to determine ownership
  const { penumbraAddress } = usePenumbraBridge()
  const { data: registryRecords = [] } = useEphemeralAddressRecords()
  const isOwnOrder =
    !!penumbraAddress &&
    !!order.sellerIBCAddr &&
    (order.sellerIBCAddr === penumbraAddress ||
      isOwnPenumbraAddress(order.sellerIBCAddr, registryRecords))
  const isFillable = order.isActive && !isOwnOrder

  // Format amounts
  const sellAmountFormatted =
    sellDecimals !== undefined && sellDecimals !== null
      ? `${formatAmount(formatUnits(order.sellAmount, sellDecimals))} ${sellSymbol ?? ''}`
      : order.sellAmount.toString()
  const buyAmountFormatted =
    buyDecimals !== undefined && buyDecimals !== null
      ? `${formatAmount(formatUnits(order.buyAmount, buyDecimals))} ${buySymbol ?? ''}`
      : order.buyAmount.toString()

  const handleExecuteOrder = async () => {
    Alert.alert('Unavailable', 'Swap actions require integration with the AvP precompile and host withdrawals.')
  }

  const handleCancelOrder = async () => {
    Alert.alert('Unavailable', 'Swap actions require integration with the AvP precompile and host withdrawals.')
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Order #{order.id.toString()}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {/* Status badge */}
      <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
        <Text style={[styles.badgeText, { color: statusColor.text }]}>
          {status}
        </Text>
      </View>

      {/* Details */}
      <View style={styles.detailSection}>
        <DetailRow label="Seller" value={truncateAddr(order.seller)} />
        {order.whitelistedBuyer !== ZERO_ADDRESS && (
          <DetailRow
            label="Authorized Buyer"
            value={truncateAddr(order.whitelistedBuyer)}
          />
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.detailSection}>
        <DetailRow label="Sell Token" value={sellAmountFormatted} />
        <DetailRow label="Buy Token" value={buyAmountFormatted} />
      </View>

      {order.sellerIBCAddr ? (
        <>
          <View style={styles.divider} />
          <View style={styles.detailSection}>
            <DetailRow
              label="IBC Address"
              value={truncateAddr(order.sellerIBCAddr)}
            />
            {order.sellerChannel ? (
              <DetailRow label="IBC Channel" value={order.sellerChannel} />
            ) : null}
          </View>
        </>
      ) : null}

      {/* Progress */}

      {/* Actions */}
      <View style={styles.actions}>
        {isFillable && (
          <Button
            title="Execute Order"
            variant="primary"
            onPress={handleExecuteOrder}

            disabled
            style={styles.actionButton}
          />
        )}
        {isOwnOrder && order.isActive && (
          <Button
            title="Cancel Order"
            variant="danger"
            onPress={handleCancelOrder}

            disabled
            style={styles.actionButton}
          />
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// DetailRow
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusStyles: Record<string, { bg: string; text: string }> = {
  Active: { bg: colors.green[50], text: colors.green[600] },
  Filled: { bg: colors.gray[100], text: colors.gray[500] },
  Cancelled: { bg: colors.red[50], text: colors.red[600] },
}

function truncateAddr(addr: string): string {
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  closeText: {
    fontSize: fontSize.lg,
    color: colors.gray[400],
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  badgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  detailSection: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[800],
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.md,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  actionButton: {
    // full width by default
  },
})
