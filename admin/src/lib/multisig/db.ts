// src/lib/multisig/db.ts
/**
 * Isolated IndexedDB for multisig wallets. Kept separate from the native
 * wallet DB on purpose: all data here is public (pubkeys/threshold/address, no
 * secrets), and staying out of `native-wallet` means `deleteWallet()` never
 * wipes it.
 */

import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

import type { MultisigConfig, PendingMultisigTx } from './types'
import type { PendingSafeTx } from '../safe/types'

const DB_NAME = 'multisig-wallets'
// v2 adds the pendingSafeTxs store for the EVM-Safe host surface.
const DB_VERSION = 2

interface MultisigDBSchema extends DBSchema {
  wallets: {
    key: string
    value: MultisigConfig
  }
  pendingTxs: {
    key: string
    value: PendingMultisigTx
    indexes: { 'by-multisig': string }
  }
  pendingSafeTxs: {
    key: string
    value: PendingSafeTx
    indexes: { 'by-safe': string }
  }
}

let dbInstance: IDBPDatabase<MultisigDBSchema> | null = null

async function getDB(): Promise<IDBPDatabase<MultisigDBSchema>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<MultisigDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('wallets', { keyPath: 'id' })
        const pending = db.createObjectStore('pendingTxs', { keyPath: 'id' })
        pending.createIndex('by-multisig', 'multisigId', { unique: false })
      }
      if (oldVersion < 2) {
        const safe = db.createObjectStore('pendingSafeTxs', { keyPath: 'id' })
        safe.createIndex('by-safe', 'safeId', { unique: false })
      }
    },
    blocked() {
      console.warn('[Multisig DB] Upgrade blocked by another tab')
    },
    blocking() {
      dbInstance?.close()
      dbInstance = null
    },
  })

  return dbInstance
}

// =============================================================================
// Wallet CRUD
// =============================================================================

export async function getMultisigWallets(): Promise<MultisigConfig[]> {
  const db = await getDB()
  return db.getAll('wallets')
}

export async function saveMultisigWallet(config: MultisigConfig): Promise<void> {
  const db = await getDB()
  await db.put('wallets', config)
}

export async function deleteMultisigWallet(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['wallets', 'pendingTxs', 'pendingSafeTxs'],
    'readwrite'
  )
  await tx.objectStore('wallets').delete(id)
  // Delete every pending tx for this multisig (its collected signatures live
  // inside those txs) via a cursor over the by-multisig index.
  let cursor = await tx.objectStore('pendingTxs').index('by-multisig').openCursor(id)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  // Same for any pending Safe txs (a 'safe' wallet keeps its collected owner
  // signatures here).
  let safeCursor = await tx
    .objectStore('pendingSafeTxs')
    .index('by-safe')
    .openCursor(id)
  while (safeCursor) {
    await safeCursor.delete()
    safeCursor = await safeCursor.continue()
  }
  await tx.done
}

/**
 * Drop any pending tx whose multisig no longer exists - a safety net for
 * orphans left behind by an interrupted delete or an older build. Called on load
 * so stale signatures never resurface under a freshly created multisig.
 */
export async function pruneOrphanedPendingTxs(
  validMultisigIds: string[]
): Promise<void> {
  const db = await getDB()
  const valid = new Set(validMultisigIds)
  const tx = db.transaction(['pendingTxs', 'pendingSafeTxs'], 'readwrite')
  let cursor = await tx.objectStore('pendingTxs').openCursor()
  while (cursor) {
    if (!valid.has(cursor.value.multisigId)) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }
  let safeCursor = await tx.objectStore('pendingSafeTxs').openCursor()
  while (safeCursor) {
    if (!valid.has(safeCursor.value.safeId)) {
      await safeCursor.delete()
    }
    safeCursor = await safeCursor.continue()
  }
  await tx.done
}

// =============================================================================
// Pending tx CRUD
// =============================================================================

export async function getPendingMultisigTxs(
  multisigId: string
): Promise<PendingMultisigTx[]> {
  const db = await getDB()
  const txs = await db.getAllFromIndex('pendingTxs', 'by-multisig', multisigId)
  return txs.sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Fetch a single pending tx by id, straight from the store. Callers use this
 * instead of the in-memory list so a just-created tx is found even before the
 * React state that mirrors the store has caught up.
 */
export async function getPendingMultisigTx(
  id: string
): Promise<PendingMultisigTx | undefined> {
  const db = await getDB()
  return db.get('pendingTxs', id)
}

export async function savePendingMultisigTx(
  tx: PendingMultisigTx
): Promise<void> {
  const db = await getDB()
  await db.put('pendingTxs', tx)
}

export async function deletePendingMultisigTx(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pendingTxs', id)
}

// =============================================================================
// Pending Safe tx CRUD (EVM-Safe host surface)
// =============================================================================

export async function getPendingSafeTxs(
  safeId: string
): Promise<PendingSafeTx[]> {
  const db = await getDB()
  const txs = await db.getAllFromIndex('pendingSafeTxs', 'by-safe', safeId)
  return txs.sort((a, b) => a.createdAt - b.createdAt)
}

/** Fetch a single pending Safe tx by id, straight from the store. */
export async function getPendingSafeTx(
  id: string
): Promise<PendingSafeTx | undefined> {
  const db = await getDB()
  return db.get('pendingSafeTxs', id)
}

export async function savePendingSafeTx(tx: PendingSafeTx): Promise<void> {
  const db = await getDB()
  await db.put('pendingSafeTxs', tx)
}

export async function deletePendingSafeTx(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pendingSafeTxs', id)
}
