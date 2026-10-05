/**
 * useTransactionHistory — Builds transaction history from Penumbra sync events.
 *
 * Listens for note activity (received / spent) during block sync and
 * stores entries in AsyncStorage. Cleared when Penumbra cache is cleared.
 */

import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NoteActivity } from '@/lib/penumbra-webview/bridge-protocol'
import { onNoteActivity } from '@/lib/penumbra-webview/usePenumbraWebView'

// =============================================================================
// Types
// =============================================================================

export type TxType = 'received' | 'sent'

export interface LocalTransaction {
  id: string
  type: TxType
  /** Display label e.g. "Received BRL" */
  label: string
  /** Amount with symbol e.g. "10,00 BRL" */
  amount: string
  /** Block height */
  height: number
  /** ISO timestamp (approximated from block time or insertion time) */
  timestamp: string
  /** Asset ID (base64) for re-resolving symbol at display time */
  assetId?: string
  /** Raw amount in base units for re-formatting */
  rawAmount?: string
  /** Decimals for formatting */
  decimals?: number
  /** Local sync activity batch used for display-only coalescing. */
  activityGroupId?: string
  /** True when this display entry is netted from multiple note events. */
  isCoalesced?: boolean
}


// =============================================================================
// Storage
// =============================================================================

const STORAGE_KEY = 'bankd:tx_history_v3'
const MAX_HISTORY = 100

let cachedHistory: LocalTransaction[] | null = null
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

async function loadHistory(): Promise<LocalTransaction[]> {
  if (cachedHistory !== null) return cachedHistory
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    cachedHistory = raw ? JSON.parse(raw) : []
  } catch {
    cachedHistory = []
  }
  return cachedHistory!
}

async function persistHistory(history: LocalTransaction[]) {
  cachedHistory = history
  notifyListeners()
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // best-effort
  }
}

// =============================================================================
// Display coalescing
// =============================================================================

function getTransactionAmount(tx: LocalTransaction): bigint {
  try {
    return BigInt(tx.rawAmount ?? '0')
  } catch {
    return 0n
  }
}

function shouldHideDustTransaction(tx: LocalTransaction): boolean {
  const amount = getTransactionAmount(tx)
  if (amount <= 0n) return true

  // EEM trigger packets often send one base unit simply to carry a memo for
  // cancel/liquidate-style actions. Those render as ±0 with 6+ decimal assets
  // and are confusing in Recent Activity, so keep them out of the display view
  // while preserving the raw note activity in storage.
  return amount <= 1n
}

export function coalesceTransactionHistoryForDisplay(
  history: LocalTransaction[]
): LocalTransaction[] {
  const passthrough: LocalTransaction[] = []
  const groups = new Map<string, LocalTransaction[]>()

  for (const tx of history) {
    if (shouldHideDustTransaction(tx)) continue

    if (!tx.activityGroupId || !tx.assetId) {
      passthrough.push(tx)
      continue
    }

    const key = `${tx.activityGroupId}:${tx.height}:${tx.assetId}`
    const group = groups.get(key)
    if (group) group.push(tx)
    else groups.set(key, [tx])
  }

  const coalesced: LocalTransaction[] = []
  for (const group of groups.values()) {
    const sent = group.filter((tx) => tx.type === 'sent')
    const received = group.filter((tx) => tx.type === 'received')

    if (sent.length === 0 || received.length === 0) {
      coalesced.push(...group)
      continue
    }

    const sentTotal = sent.reduce((sum, tx) => sum + getTransactionAmount(tx), 0n)
    const receivedTotal = received.reduce((sum, tx) => sum + getTransactionAmount(tx), 0n)
    const net = sentTotal - receivedTotal

    if (net >= -1n && net <= 1n) continue

    const representative = net > 0n ? sent[0] : received[0]
    if (!representative) continue

    coalesced.push({
      ...representative,
      id: `${representative.activityGroupId}-${representative.height}-${representative.assetId}-net`,
      type: net > 0n ? 'sent' : 'received',
      rawAmount: (net > 0n ? net : -net).toString(),
      isCoalesced: true,
    })
  }

  return [...coalesced, ...passthrough].sort((a, b) => b.height - a.height)
}

// =============================================================================
// Process note activity from sync
// =============================================================================

async function processActivity(activity: NoteActivity[]) {
  const history = await loadHistory()
  const existingHeights = new Set(history.map((tx) => `${tx.type}:${tx.height}:${tx.rawAmount}:${tx.assetId}`))
  const newEntries: LocalTransaction[] = []
  const activityGroupId = `activity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  for (const note of activity) {
    const type: TxType = note.action === 'received' ? 'received' : 'sent'

    // Deduplicate by type + height + raw amount + asset
    const dedupeKey = `${type}:${note.height}:${note.amount}:${note.assetId}`
    if (existingHeights.has(dedupeKey)) continue
    existingHeights.add(dedupeKey)

    // Store raw data — symbol resolved at display time via customTokens
    newEntries.push({
      id: `${note.height}-${note.action}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: '', // resolved at display time
      amount: '', // resolved at display time
      height: note.height,
      timestamp: note.timestamp || new Date().toISOString(),
      assetId: note.assetId,
      rawAmount: note.amount,
      decimals: 6, // default, overridden at display time
      activityGroupId,
    })
  }

  if (newEntries.length > 0) {
    // Insert sorted by height descending (newest first)
    const updated = [...newEntries, ...history]
      .sort((a, b) => b.height - a.height)
      .slice(0, MAX_HISTORY)
    await persistHistory(updated)
  }
}

// =============================================================================
// Public API
// =============================================================================

export async function clearTransactionHistory(): Promise<void> {
  await persistHistory([])
}

// =============================================================================
// Hook
// =============================================================================

export function useTransactionHistory() {
  const [history, setHistory] = useState<LocalTransaction[]>(cachedHistory ?? [])

  useEffect(() => {
    loadHistory().then((items) => setHistory(coalesceTransactionHistoryForDisplay(items)))

    // Subscribe to in-memory updates
    const listener = () => {
      if (cachedHistory) setHistory(coalesceTransactionHistoryForDisplay([...cachedHistory]))
    }
    listeners.add(listener)

    // Subscribe to note activity from Penumbra sync
    const unsubActivity = onNoteActivity(processActivity)

    return () => {
      listeners.delete(listener)
      unsubActivity()
    }
  }, [])

  const clear = useCallback(async () => {
    await clearTransactionHistory()
  }, [])

  return { history, clear }
}
