import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import {
  TotalBalance,
  QuickActions,
  type QuickActionName,
} from '@/components/balance'
import { colors, fontSize, fontWeight, spacing, borderRadius } from '@/lib/theme'
import { useWallet, useBalances, usePenumbraBalances } from '@/hooks'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import { useQueryClient } from '@tanstack/react-query'
import { ShieldBalance } from '@/components/balance/ShieldBalance'
import { formatAmount } from '@bankd/shared'
import type { SyncProgress } from '@/lib/penumbra-webview/usePenumbraWebView'

// ---------------------------------------------------------------------------
// Native BRL is the only asset with a BRL valuation on this base.
// ---------------------------------------------------------------------------
function formatNoteAmount(amount: string, decimals: number): string {
  const raw = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  if (!fracStr) return whole.toString()
  return `${whole}.${fracStr}`
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ---------------------------------------------------------------------------
// Sync Status Banner
// ---------------------------------------------------------------------------

function SyncBanner({
  isReady,
  isInitialized,
  isSyncing,
  progress,
  lastError,
}: {
  isReady: boolean
  isInitialized: boolean
  isSyncing: boolean
  progress: SyncProgress | null
  lastError: string | null
}) {
  if (lastError) {
    return (
      <View style={syncStyles.banner}>
        <Ionicons name="warning" size={14} color="#F59E0B" />
        <Text style={syncStyles.text} numberOfLines={2}>{lastError}</Text>
      </View>
    )
  }
  if (!isReady || !isInitialized) {
    return (
      <View style={syncStyles.banner}>
        <Ionicons name="sync" size={14} color={colors.gray[400]} />
        <Text style={syncStyles.text}>Initializing privacy wallet…</Text>
      </View>
    )
  }
  if (isSyncing && progress && !progress.isSynced) {
    return (
      <View style={syncStyles.banner}>
        <Ionicons name="sync" size={14} color={colors.primary[500]} />
        <Text style={syncStyles.text}>Syncing {progress.percent}%</Text>
        <View style={syncStyles.progressBg}>
          <View style={[syncStyles.progressFill, { width: `${progress.percent}%` }]} />
        </View>
      </View>
    )
  }
  if (isSyncing && !progress) {
    return (
      <View style={syncStyles.banner}>
        <Ionicons name="sync" size={14} color={colors.primary[500]} />
        <Text style={syncStyles.text}>Syncing…</Text>
      </View>
    )
  }
  return null
}

const syncStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.gray[50],
  },
  text: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
    flex: 1,
  },
  progressBg: {
    height: 3,
    width: 60,
    backgroundColor: colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 2,
  },
})

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const queryClient = useQueryClient()
  const assetRate = useCallback((balance: { baseDenom: string }) => balance.baseDenom === 'abrl' ? 1 : undefined, [])
  const { bech32Address } = useWallet()

  const bridge = usePenumbraBridge()
  const { refetch: refetchPublic } = useBalances(bech32Address ?? null)
  const { data: privateBalances, refetch: refetchPrivate, assetIdLookup } = usePenumbraBalances()
  const { history } = useTransactionHistory()
  const [refreshing, setRefreshing] = useState(false)

  // Resolve activity symbols using balance metadata + assetId lookup
  const resolvedHistory = useMemo(() => {
    // Build lookup from balances: raw base64 assetId → { symbol, decimals }
    const metaByAssetId = new Map<string, { symbol: string; decimals: number }>()
    for (const b of privateBalances ?? []) {
      const rawId = b.assetId.startsWith('(base64:')
        ? b.assetId.slice(8, -1)
        : b.assetId
      metaByAssetId.set(rawId, { symbol: b.symbol, decimals: b.decimals })
    }

    return history.map((tx) => {
      if (!tx.assetId) return tx // legacy entries without assetId

      // Try balance metadata first, then SHA256-computed assetId lookup
      const meta = metaByAssetId.get(tx.assetId) ?? assetIdLookup.get(tx.assetId)
      const symbol = meta?.symbol ?? '???'
      const decimals = meta?.decimals ?? tx.decimals ?? 18
      const action = tx.type === 'received' ? 'Received' : 'Sent'
      const formatted = tx.rawAmount
        ? formatNoteAmount(tx.rawAmount, decimals)
        : tx.amount.split(' ')[0]

      return {
        ...tx,
        label: `${action} ${symbol}`,
        amount: `${formatted} ${symbol}`,
      }
    })
  }, [history, privateBalances, assetIdLookup])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      refetchPublic(),
      refetchPrivate(),
      queryClient.invalidateQueries({ queryKey: ['erc20meta'] }),
    ])
    setRefreshing(false)
  }, [refetchPublic, refetchPrivate, queryClient])

  // Sort: BRL first, then alphabetical
  const sortedBalances = useMemo(
    () =>
      (privateBalances ?? [])
        .filter((b) => parseFloat(b.amountFormatted) > 0)
        .sort((a, b) => {
          const aIsBRL = a.symbol === 'BRL'
          const bIsBRL = b.symbol === 'BRL'
          const aIsPenumbra = a.symbol === 'PENUMBRA'
          const bIsPenumbra = b.symbol === 'PENUMBRA'
          const aHasRate = !!assetRate(a)
          const bHasRate = !!assetRate(b)

          // BRL always first
          if (aIsBRL && !bIsBRL) return -1
          if (!aIsBRL && bIsBRL) return 1
          // PENUMBRA always last
          if (aIsPenumbra && !bIsPenumbra) return 1
          if (!aIsPenumbra && bIsPenumbra) return -1
          // Recognized tokens (with rates) before unrecognized
          if (aHasRate && !bHasRate) return -1
          if (!aHasRate && bHasRate) return 1
          // Among recognized: sort by quantity descending
          if (aHasRate && bHasRate) {
            return parseFloat(b.amountFormatted) - parseFloat(a.amountFormatted)
          }
          // Among unrecognized: alphabetical
          return a.symbol.localeCompare(b.symbol)
        }),
    [privateBalances, assetRate],
  )

  // Total balance in BRL: sum all tokens with known conversion rates
  const totalFormatted = useMemo(() => {
    let total = 0
    for (const b of privateBalances ?? []) {
      const amount = parseFloat(b.amountFormatted)
      if (amount <= 0) continue
      const rate = assetRate(b)
      if (rate) {
        total += amount * rate
      }
      // Tokens without a known rate are shown in the list but don't count toward total
    }
    return formatAmount(total.toFixed(2))
  }, [privateBalances, assetRate])

  const router = useRouter()
  const handleAction = useCallback((action: QuickActionName) => {
    switch (action) {
      case 'send':
        router.push({ pathname: '/(tabs)/transfers', params: { tab: 'send' } } as any)
        break
      case 'receive':
        router.push({ pathname: '/(tabs)/transfers', params: { tab: 'receive' } } as any)
        break
      case 'shieldd-demo':
        router.push('/(tabs)/swap' as any)
        break
    }
  }, [router])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <TotalBalance amount={totalFormatted} />

        <SyncBanner
          isReady={bridge.isReady}
          isInitialized={bridge.isInitialized}
          isSyncing={bridge.isSyncing}
          progress={bridge.syncProgress}
          lastError={bridge.lastError}
        />

        <ShieldBalance />

        {/* Token Balances */}
        <View style={styles.balancesSection}>
          {sortedBalances.length === 0 ? (
            <Text style={styles.emptyText}>
              {bridge.isInitialized ? 'No tokens yet' : 'Loading…'}
            </Text>
          ) : (
            sortedBalances.map((b) => {
              const rate = assetRate(b)
              const amount = parseFloat(b.amountFormatted)
              const brlValue = rate && b.symbol !== 'BRL' ? amount * rate : null
              const subtitle = b.symbol === 'BRL' ? '= R$ 1,00' : brlValue != null ? `≈ R$ ${formatAmount(brlValue.toFixed(2))}` : null
              return (
                <View key={b.symbol} style={styles.tokenRow}>
                  <View style={styles.tokenIcon}>
                    <Text style={styles.tokenIconText}>
                      {b.symbol.slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.tokenInfo}>
                    <Text style={styles.tokenSymbol}>{b.symbol}</Text>
                    {subtitle != null && (
                      <Text style={styles.tokenConversion}>
                        {subtitle}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.tokenAmount}>
                    {formatAmount(b.amountFormatted)}
                  </Text>
                </View>
              )
            })
          )}
        </View>

        <QuickActions onAction={handleAction} disabled={!bridge.penumbraAddress} />

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {resolvedHistory.length === 0 ? (
            <Text style={styles.placeholder}>No recent transactions</Text>
          ) : (
            resolvedHistory.slice(0, 15).map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txIconBg}>
                  <Ionicons
                    name={tx.type === 'received' ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={tx.type === 'received' ? colors.green[600] : colors.gray[600]}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txLabel}>{tx.label}</Text>
                  <Text style={styles.txMeta}>
                    Block {tx.height} · {formatTime(tx.timestamp)}
                  </Text>
                </View>
                <Text style={[
                  styles.txAmount,
                  tx.type === 'received' && styles.txAmountReceived,
                ]}>{tx.type === 'received' ? '+' : '-'}{(() => {
                  const parts = tx.amount.split(' ')
                  if (parts.length >= 2) return `${formatAmount(parts[0])} ${parts.slice(1).join(' ')}`
                  return formatAmount(tx.amount)
                })()}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },

  // Balances
  balancesSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tokenIconText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
  },
  tokenConversion: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
    marginTop: 1,
  },
  tokenAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },

  // Recent Activity
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing.md,
  },
  placeholder: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  txIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  txInfo: {
    flex: 1,
  },
  txLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[900],
  },
  txMeta: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
    marginTop: 2,
  },
  txAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
  },
  txAmountReceived: {
    color: colors.green[600],
  },
})
