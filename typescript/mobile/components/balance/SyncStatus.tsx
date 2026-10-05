/**
 * SyncStatus — Shows Penumbra sync progress on the home screen.
 */

import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { colors, fontSize, spacing } from '@/lib/theme'
import type { SyncProgress } from '@/lib/penumbra-webview/usePenumbraWebView'

interface SyncStatusProps {
  isReady: boolean
  isInitialized: boolean
  isSyncing: boolean
  progress: SyncProgress | null
  lastError: string | null
}

export function SyncStatus({
  isReady,
  isInitialized,
  isSyncing,
  progress,
  lastError,
}: SyncStatusProps) {
  // Not connected to bridge yet
  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.gray[400]} />
        <Text style={styles.textMuted}>Loading privacy engine...</Text>
      </View>
    )
  }

  // Error state
  if (lastError) {
    return (
      <View style={[styles.container, styles.errorBg]}>
        <Ionicons name="warning" size={14} color={colors.red[600]} />
        <Text style={styles.textError} numberOfLines={1}>
          {lastError}
        </Text>
      </View>
    )
  }

  // Initializing WASM / deriving keys
  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.purple[500]} />
        <Text style={styles.textMuted}>Initializing privacy keys...</Text>
      </View>
    )
  }

  // Syncing with no progress yet
  if (isSyncing && !progress) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.purple[500]} />
        <Text style={styles.textSync}>Syncing privacy chain...</Text>
      </View>
    )
  }

  // Syncing with progress
  if (isSyncing && progress && !progress.isSynced) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.purple[500]} />
        <View style={styles.syncInfo}>
          <Text style={styles.textSync}>
            Syncing... {progress.percent}%
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${progress.percent}%` }]}
            />
          </View>
          <Text style={styles.textBlock}>
            Block {progress.currentHeight.toLocaleString()} / {progress.targetHeight.toLocaleString()}
          </Text>
        </View>
      </View>
    )
  }

  // Synced
  if (progress?.isSynced) {
    return (
      <View style={styles.container}>
        <Ionicons name="shield-checkmark" size={14} color={colors.green[600]} />
        <Text style={styles.textSynced}>Privacy synced</Text>
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray[50],
    borderRadius: 8,
  },
  errorBg: {
    backgroundColor: colors.red[50],
  },
  syncInfo: {
    flex: 1,
  },
  textMuted: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  textError: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.red[600],
  },
  textSync: {
    fontSize: fontSize.xs,
    color: colors.purple[600],
    fontWeight: '600',
  },
  textBlock: {
    fontSize: 10,
    color: colors.gray[500],
    marginTop: 2,
  },
  textSynced: {
    fontSize: fontSize.xs,
    color: colors.green[600],
    fontWeight: '500',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: colors.gray[200],
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.purple[500],
    borderRadius: 2,
  },
})
