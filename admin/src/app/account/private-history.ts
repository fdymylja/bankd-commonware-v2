'use client'

// Colocated client helper for the Private tab of the account page.
//
// Two jobs, both browser-only (they touch the wallet's IndexedDB and the WASM
// viewing-key machinery):
//   1. getActivityHeights(): the block heights this wallet actually shows up in,
//      read from the locally-synced SPENDABLE_NOTES. The page paginates that list
//      and only asks the API for ShielddMutationTx rows at the current page's
//      heights, so the browser never decrypts more than a page at a time.
//   2. decryptTx(): on demand, run one stored tx through the FVK to get a
//      TransactionView the user can read.

import type { IdbConstants } from '@mizufinance/types/indexed-db'

import {
  DB_NAME,
  DB_VERSION,
  IDB_TABLES,
  base64ToUint8Array,
  getDB,
  getFullViewingKey,
} from '@/lib/native-wallet/core'

// A SPENDABLE_NOTES record is stored as protobuf JSON (see view-server-sync), so
// its uint64 heights are strings; heightSpent is absent/null while unspent.
type StoredNote = {
  heightCreated?: string | number
  heightSpent?: string | number | null
}

function asHeight(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : 0
}

/**
 * getActivityHeights returns the distinct block heights this wallet participated
 * in (note created or spent), sorted newest-first. The view-server FVK sync
 * populates SPENDABLE_NOTES, so this is a local read with no network call.
 */
export async function getActivityHeights(): Promise<number[]> {
  const db = await getDB()
  const notes = (await db.getAll('SPENDABLE_NOTES')) as StoredNote[]
  const heights = new Set<number>()
  for (const n of notes) {
    const created = asHeight(n.heightCreated)
    if (created > 0) heights.add(created)
    const spent = asHeight(n.heightSpent ?? undefined)
    if (spent > 0) heights.add(spent)
  }
  return [...heights].sort((a, b) => b - a)
}

function idbConstants(): IdbConstants {
  return {
    name: DB_NAME,
    version: DB_VERSION,
    tables: IDB_TABLES as unknown as IdbConstants['tables'],
  }
}

/**
 * decryptTx runs one stored Penumbra tx (base64 tx_bytes) through the wallet's
 * full viewing key and returns the readable TransactionView. The caller renders
 * `.toJson()`. Wasm + protobuf modules are lazy-imported so they only load when a
 * user actually clicks Decrypt. Throws if the wallet is locked (no FVK).
 *
 * HACK(penumbra-migration): the demo wasm build compiles out
 * transaction_perspective_and_view, so when the wasm path throws we fall back to
 * the server-side note reader (/api/account/decrypt), which decrypts output
 * notes with the dev wallets' IVKs.
 */
export async function decryptTx(bytesB64: string): Promise<{ toJson(): unknown }> {
  try {
    const [{ Transaction }, { generateTransactionInfo }] = await Promise.all([
      import('@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'),
      import('@mizufinance/wasm/transaction'),
    ])
    const tx = Transaction.fromBinary(base64ToUint8Array(bytesB64))
    const { txv } = await generateTransactionInfo(
      getFullViewingKey(),
      tx,
      idbConstants()
    )
    return txv
  } catch (wasmErr) {
    // Wallet-locked errors should still surface the unlock flow, not the fallback.
    if (/lock/i.test(String(wasmErr))) throw wasmErr
    const res = await fetch('/api/account/decrypt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tx_bytes: bytesB64 }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'server decrypt failed')
    return { toJson: () => body }
  }
}
