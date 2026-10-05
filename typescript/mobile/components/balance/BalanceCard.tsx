import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Card } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/theme'
import type { SyncProgress } from '@/lib/penumbra-webview/usePenumbraWebView'

export interface BalanceItem {
  symbol: string
  amountFormatted: string
}

export interface PrivacySyncState {
  isReady: boolean
  isInitialized: boolean
  isSyncing: boolean
  progress: SyncProgress | null
  lastError: string | null
}

interface BalanceCardProps {
  variant: 'public' | 'private'
  balances: BalanceItem[]
  /** Only used for private variant */
  syncState?: PrivacySyncState
}

export function BalanceCard({ variant, balances, syncState }: BalanceCardProps) {
  const isPrivate = variant === 'private'
  const title = isPrivate ? 'Private Balance' : 'Public Balance'
  const subtitle = isPrivate
    ? 'Shielded tokens via Penumbra'
    : 'Transparent tokens on Bankd'

  // Render sync status inside private card
  const renderSyncStatus = () => {
    if (!isPrivate || !syncState) return null

    const { isReady, isInitialized, isSyncing, progress, lastError } = syncState

    if (lastError) {
      return (
        <View style={styles.syncRow}>
          <Ionicons name="warning" size={11} color={colors.purple[300]} />
          <Text style={styles.syncText} numberOfLines={2}>{lastError}</Text>
        </View>
      )
    }

    if (!isReady || !isInitialized) {
      return (
        <View style={styles.syncRow}>
          <Ionicons name="sync" size={11} color={colors.purple[300]} />
          <Text style={styles.syncText}>Initializing...</Text>
        </View>
      )
    }

    if (isSyncing && progress && !progress.isSynced) {
      return (
        <View style={styles.syncSection}>
          <View style={styles.syncRow}>
            <Ionicons name="sync" size={11} color={colors.purple[300]} />
            <Text style={styles.syncText}>Syncing {progress.percent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress.percent}%` }]} />
          </View>
        </View>
      )
    }

    if (isSyncing && !progress) {
      return (
        <View style={styles.syncRow}>
          <Ionicons name="sync" size={11} color={colors.purple[300]} />
          <Text style={styles.syncText}>Syncing...</Text>
        </View>
      )
    }

    if (progress?.isSynced) {
      return (
        <View style={styles.syncRow}>
          <Ionicons name="shield-checkmark" size={11} color={colors.purple[300]} />
          <Text style={styles.syncText}>Synced</Text>
        </View>
      )
    }

    return null
  }

  return (
    <Card
      title={title}
      variant={isPrivate ? 'privacy' : 'default'}
      style={styles.card}
    >
      <View style={styles.balancesSection}>
        {balances.length === 0 ? (
          <Text style={[styles.empty, isPrivate && styles.privacyText]}>
            No tokens yet
          </Text>
        ) : (
          balances.map((b) => (
            <View key={b.symbol} style={styles.tokenRow}>
              <Text
                style={[styles.tokenSymbol, isPrivate && styles.privacyText]}
              >
                {b.symbol}
              </Text>
              <Text
                style={[styles.tokenAmount, isPrivate && styles.privacyText]}
              >
                {b.amountFormatted}
              </Text>
            </View>
          ))
        )}
      </View>
      <View style={styles.footer}>
        {renderSyncStatus()}
        <Text style={[styles.subtitle, isPrivate && styles.privacySubtitle]}>
          {subtitle}
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    marginRight: spacing.md,
    flex: 1,
    justifyContent: 'space-between' as const,
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tokenSymbol: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
  },
  tokenAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
    flexShrink: 1,
    textAlign: 'right' as const,
  },
  empty: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
    marginTop: spacing.sm,
  },
  privacyText: {
    color: '#FFFFFF',
  },
  privacySubtitle: {
    color: colors.purple[300],
  },
  balancesSection: {
    flex: 1,
  },
  footer: {
    marginTop: 'auto' as any,
  },
  syncSection: {
    marginTop: spacing.sm,
  },
  syncRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: spacing.xs,
  },
  syncText: {
    fontSize: 11,
    color: colors.purple[300],
    lineHeight: 14,
  },
  progressBarBg: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%' as any,
    backgroundColor: colors.purple[300],
    borderRadius: 1,
  },
})
