'use client'

import { SpendableNoteRecord as SpendableNoteRecordProto } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'
import { openDB } from 'idb'
import { bytesToHex } from 'viem'

import {
  DB_NAME,
  DB_VERSION,
  clearPenumbraSyncTables,
  getPrivateTransferJobs,
  getSyncState,
} from '../../core'
import {
  getPenumbraWalletSyncStatus,
  getViewServerRuntimeStatus,
} from './view-server-sync'

export interface NativeWalletDiagnostics {
  syncState?: Awaited<ReturnType<typeof getSyncState>>
  syncStatus: Awaited<ReturnType<typeof getPenumbraWalletSyncStatus>>
  runtimeStatus: ReturnType<typeof getViewServerRuntimeStatus>
  fullSyncHeightTable: unknown
  spendableNoteCount: number
  notesByAsset: Array<{
    assetId: string
    noteCount: number
    amountBaseUnits: string
  }>
  tableCounts: Record<string, number>
  privateJobs: Awaited<ReturnType<typeof getPrivateTransferJobs>>
}

function noteAmountToBigInt(noteJson: unknown): bigint {
  try {
    const note = SpendableNoteRecordProto.fromJson(noteJson as any)
    const amount = note.note?.value?.amount
    if (!amount) return 0n
    return (BigInt(amount.hi ?? 0n) << 64n) + BigInt(amount.lo ?? 0n)
  } catch {
    return 0n
  }
}

function noteAssetId(noteJson: unknown): string {
  try {
    const note = SpendableNoteRecordProto.fromJson(noteJson as any)
    const inner = note.note?.value?.assetId?.inner
    return inner ? bytesToHex(inner) : 'unknown'
  } catch {
    return 'unknown'
  }
}

function isUnspentNote(noteJson: unknown): boolean {
  const value = noteJson as { heightSpent?: unknown } | undefined
  return !value?.heightSpent
}

export async function getNativeWalletDiagnostics(): Promise<NativeWalletDiagnostics> {
  const db = await openDB(DB_NAME, DB_VERSION)

  try {
    const [
      syncState,
      syncStatus,
      runtimeStatus,
      fullSyncHeightTable,
      notes,
      privateJobs,
    ] = await Promise.all([
      getSyncState(),
      getPenumbraWalletSyncStatus(),
      Promise.resolve(getViewServerRuntimeStatus()),
      db.get('FULL_SYNC_HEIGHT', 'height'),
      db.getAll('SPENDABLE_NOTES'),
      getPrivateTransferJobs(),
    ])

    const tableNames = [
      'SPENDABLE_NOTES',
      'TREE_COMMITMENTS',
      'TREE_HASHES',
      'ibcDenoms',
      'privateTransferJobs',
    ] as const
    const tableCounts: Record<string, number> = {}
    for (const table of tableNames) {
      tableCounts[table] = await db.count(table)
    }

    const grouped = new Map<string, { noteCount: number; amount: bigint }>()
    for (const note of notes) {
      if (!isUnspentNote(note)) continue
      const assetId = noteAssetId(note)
      const current = grouped.get(assetId) ?? { noteCount: 0, amount: 0n }
      current.noteCount += 1
      current.amount += noteAmountToBigInt(note)
      grouped.set(assetId, current)
    }

    return {
      syncState,
      syncStatus,
      runtimeStatus,
      fullSyncHeightTable,
      spendableNoteCount: notes.filter(isUnspentNote).length,
      notesByAsset: Array.from(grouped.entries()).map(([assetId, value]) => ({
        assetId,
        noteCount: value.noteCount,
        amountBaseUnits: value.amount.toString(),
      })),
      tableCounts,
      privateJobs,
    }
  } finally {
    db.close()
  }
}

export async function resetNativeWalletSyncState(): Promise<void> {
  await clearPenumbraSyncTables()
}
