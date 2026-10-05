import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { Hex } from 'viem'

import { Card } from '@/components/ui'
import { useAllOrders, useWallet } from '@/hooks'
import type { AllOrdersResult } from '@/hooks'
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from '@/lib/theme'
import type { AtomicSwapOrderWithId } from '@bankd/shared/evm/atomicSwap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = 'All' | 'Active' | 'My Orders'

interface OrderBookProps {
  contractAddress: Hex | null
  onOrderPress?: (order: AtomicSwapOrderWithId) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrderBook({ contractAddress, onOrderPress }: OrderBookProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('All')
  const { data, isLoading } = useAllOrders(contractAddress)
  const { hexAddress } = useWallet()

  const allOrders = useMemo<AtomicSwapOrderWithId[]>(() => {
    if (!data) return []
    return [...data.active, ...data.inactive]
  }, [data])

  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case 'Active':
        return data?.active ?? []
      case 'My Orders':
        return allOrders.filter(
          (o) =>
            hexAddress &&
            o.seller.toLowerCase() === hexAddress.toLowerCase()
        )
      default:
        return allOrders
    }
  }, [activeTab, data, allOrders, hexAddress])

  if (!contractAddress) {
    return null
  }

  return (
    <Card title="Order Book">
      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {(['All', 'Active', 'My Orders'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No orders found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <OrderRow order={item} onPress={() => onOrderPress?.(item)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// OrderRow
// ---------------------------------------------------------------------------

function OrderRow({
  order,
  onPress,
}: {
  order: AtomicSwapOrderWithId
  onPress: () => void
}) {
  const status = getStatus(order)
  const statusColor = statusColors[status]

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.orderId}>#{order.id.toString()}</Text>
        <Text style={styles.pairText}>
          {truncateAddr(order.sellToken)} → {truncateAddr(order.buyToken)}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <View
          style={[styles.badge, { backgroundColor: statusColor.bg }]}
        >
          <Text style={[styles.badgeText, { color: statusColor.text }]}>
            {status}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type OrderStatus = 'Active' | 'Filled' | 'Cancelled'

function getStatus(order: AtomicSwapOrderWithId): OrderStatus {
  if (order.isCancelled) return 'Cancelled'
  if (order.isActive) return 'Active'
  return 'Filled'
}

const statusColors: Record<OrderStatus, { bg: string; text: string }> = {
  Active: { bg: colors.green[50], text: colors.green[600] },
  Filled: { bg: colors.gray[100], text: colors.gray[500] },
  Cancelled: { bg: colors.red[50], text: colors.red[600] },
}

function truncateAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  tabActive: {
    backgroundColor: colors.primary[600],
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
  },
  tabTextActive: {
    color: colors.white,
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },
  separator: {
    height: 1,
    backgroundColor: colors.gray[100],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  orderId: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[800],
  },
  pairText: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
})
