// src/lib/native-wallet/core/db.ts
/**
 * IndexedDB storage for the unified native wallet.
 * Stores wallet config, accounts, and Penumbra-specific data.
 */

import type { EphemeralAddressRecord } from '@bankd/shared/penumbra'
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

import { chainConfig } from '@/lib/config'

import {
  type AccountRecord,
  DB_NAME,
  DB_VERSION,
  type WalletConfig,
} from './types'

// =============================================================================
// Penumbra-specific storage types (for sync, notes, etc.)
// =============================================================================

/** Sync state for Penumbra */
export interface SyncState {
  fullSyncHeight: number
  appParams: Uint8Array | null
  fmdParams: Uint8Array | null
  chainId?: string
  chainMarker?: string
  lastObservedChainHeight?: number
  sctStorageVersion?: number
  /** Deprecated legacy field kept only so old browser sessions can be migrated. */
  lastObservedHeight?: number
}

/** Spendable note record */
export interface SpendableNoteRecord {
  noteCommitment: string
  note: Uint8Array
  nullifier: string
  assetId: string
  addressIndex: number
  heightCreated: number
  heightSpent: number | null
}

/** Transaction record */
export interface TransactionRecord {
  txId: string
  height: number
  transaction: Uint8Array
}

/** IBC denom metadata */
export interface IBCDenomRecord {
  assetIdHex: string
  baseDenom: string
  name: string
  symbol: string
  decimals: number
  erc20Address?: string
  sourceChannel: string
  destinationChannel: string
  discoveredAt: number
  discoveredHeight: number
}

export type PrivateTransferJobType = 'private-send' | 'private-withdraw'
export type PrivateTransferJobStatus =
  | 'queued'
  | 'waiting-balance'
  | 'waiting-sync'
  | 'building-proof'
  | 'broadcasting'
  | 'confirmed'
  | 'failed'

export interface PrivateTransferJobRecord {
  id: string
  type: PrivateTransferJobType
  amount: string
  amountBaseUnits: string
  asset: {
    id: string
    symbol: string
    denom: string
    decimals: number
    sourceChannel?: string
    sourceAccount?: number
  }
  recipient: string
  recipientLabel?: string
  createdAt: number
  updatedAt: number
  status: PrivateTransferJobStatus
  statusMessage: string
  txHash?: string
  height?: string
  error?: string
}

// =============================================================================
// Database Schema
// =============================================================================

interface WalletDBSchema extends DBSchema {
  // Core wallet storage
  wallet: {
    key: 'config'
    value: WalletConfig
  }

  accounts: {
    key: number
    value: AccountRecord
  }

  // Penumbra sync state
  syncState: {
    key: 'current'
    value: SyncState
  }

  // Penumbra notes
  spendableNotes: {
    key: string
    value: SpendableNoteRecord
    indexes: {
      'by-nullifier': string
      'by-asset': string
      'by-address-index': number
      'by-height-created': number
    }
  }

  // Asset metadata
  assetMetadata: {
    key: string
    value: Uint8Array
  }

  // Transactions
  transactions: {
    key: string
    value: TransactionRecord
  }

  // IBC denoms
  ibcDenoms: {
    key: string
    value: IBCDenomRecord
    indexes: {
      'by-base-denom': string
    }
  }

  privateTransferJobs: {
    key: string
    value: PrivateTransferJobRecord
    indexes: {
      'by-status': PrivateTransferJobStatus
      'by-created-at': number
    }
  }

  ephemeralAddresses: {
    key: string
    value: EphemeralAddressRecord
    indexes: {
      'by-penumbra-address': string
      'by-intermediate-hex': string
      'by-purpose': string
    }
  }

  // Penumbra ViewServer compatible tables
  ASSETS: { key: string; value: unknown }
  AUCTIONS: { key: string; value: unknown }
  AUCTION_OUTSTANDING_RESERVES: { key: string; value: unknown }
  ADVICE_NOTES: { key: string; value: unknown }
  SPENDABLE_NOTES: { key: string; value: unknown }
  SWAPS: { key: string; value: unknown }
  FMD_PARAMETERS: { key: string; value: unknown }
  APP_PARAMETERS: { key: string; value: unknown }
  GAS_PRICES: { key: string; value: unknown }
  EPOCHS: { key: string; value: unknown }
  PRICES: { key: string; value: unknown }
  VALIDATOR_INFOS: { key: string; value: unknown }
  TRANSACTIONS: { key: string; value: unknown }
  FULL_SYNC_HEIGHT: { key: string; value: unknown }
  TREE_COMMITMENTS: { key: IDBValidKey; value: unknown }
  TREE_HASHES: { key: IDBValidKey; value: unknown }
  TREE_LAST_POSITION: { key: string; value: unknown }
  TREE_LAST_FORGOTTEN: { key: string; value: unknown }
  LQT_HISTORICAL_VOTES: { key: string; value: unknown }
}

// =============================================================================
// Database Instance
// =============================================================================

let dbInstance: IDBPDatabase<WalletDBSchema> | null = null
let isDeleting = false

export async function getDB(): Promise<IDBPDatabase<WalletDBSchema>> {
  if (isDeleting) {
    throw new Error('Database is being deleted')
  }
  
  if (dbInstance) {
    return dbInstance
  }

  let staleSchema = false
  dbInstance = await openDB<WalletDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion !== 0) {
        staleSchema = true
        transaction.abort()
        return
      }
      if (oldVersion < 1) {
        // Core stores
        db.createObjectStore('wallet')
        db.createObjectStore('accounts', { keyPath: 'index' })
        db.createObjectStore('syncState')

        // Notes with indexes
        const notesStore = db.createObjectStore('spendableNotes', {
          keyPath: 'noteCommitment',
        })
        notesStore.createIndex('by-nullifier', 'nullifier', { unique: true })
        notesStore.createIndex('by-asset', 'assetId', { unique: false })
        notesStore.createIndex('by-address-index', 'addressIndex', { unique: false })
        notesStore.createIndex('by-height-created', 'heightCreated', { unique: false })

        db.createObjectStore('assetMetadata')
        db.createObjectStore('transactions')

        // IBC denoms
        const ibcStore = db.createObjectStore('ibcDenoms', { keyPath: 'assetIdHex' })
        ibcStore.createIndex('by-base-denom', 'baseDenom', { unique: false })

        // Penumbra ViewServer tables
        const penumbraStores = [
          'ASSETS', 'AUCTIONS', 'AUCTION_OUTSTANDING_RESERVES', 'ADVICE_NOTES',
          'SPENDABLE_NOTES', 'SWAPS', 'FMD_PARAMETERS', 'APP_PARAMETERS',
          'GAS_PRICES', 'EPOCHS', 'PRICES', 'VALIDATOR_INFOS', 'TRANSACTIONS',
          'FULL_SYNC_HEIGHT', 'TREE_COMMITMENTS', 'TREE_HASHES',
          'TREE_LAST_POSITION', 'TREE_LAST_FORGOTTEN', 'LQT_HISTORICAL_VOTES',
        ]
        for (const name of penumbraStores) {
          db.createObjectStore(name as any)
        }
      }
      if (oldVersion < 2) {
        const jobsStore = db.createObjectStore('privateTransferJobs', { keyPath: 'id' })
        jobsStore.createIndex('by-status', 'status', { unique: false })
        jobsStore.createIndex('by-created-at', 'createdAt', { unique: false })
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('ephemeralAddresses')) {
          const store = db.createObjectStore('ephemeralAddresses', { keyPath: 'id' })
          store.createIndex('by-penumbra-address', 'penumbraAddress', { unique: false })
          store.createIndex('by-intermediate-hex', 'intermediateHex', { unique: false })
          store.createIndex('by-purpose', 'purpose', { unique: false })
        }
      }
    },
    blocked() {
      console.warn('[Wallet DB] Upgrade blocked by another tab')
    },
    blocking() {
      dbInstance?.close()
      dbInstance = null
    },
  }).catch((error) => {
    if (staleSchema) throw new Error('Stale prototype wallet format. Back up your recovery phrase, reset the local wallet database and import it again.')
    throw error
  })

  return dbInstance
}

export async function enqueuePrivateTransferJob(
  job: Omit<PrivateTransferJobRecord, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'statusMessage'>
): Promise<PrivateTransferJobRecord> {
  const now = Date.now()
  const record: PrivateTransferJobRecord = {
    ...job,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'queued',
    statusMessage: 'Queued',
  }
  const db = await getDB()
  await db.put('privateTransferJobs', record)
  return record
}

export async function getPrivateTransferJobs(): Promise<PrivateTransferJobRecord[]> {
  const db = await getDB()
  const jobs = await db.getAll('privateTransferJobs')
  return jobs.sort((a, b) => a.createdAt - b.createdAt)
}

export async function updatePrivateTransferJob(
  id: string,
  patch: Partial<PrivateTransferJobRecord>,
): Promise<PrivateTransferJobRecord | null> {
  const db = await getDB()
  const existing = await db.get('privateTransferJobs', id)
  if (!existing) return null
  const updated = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  }
  await db.put('privateTransferJobs', updated)
  return updated
}

export async function nextRunnablePrivateTransferJob(): Promise<PrivateTransferJobRecord | null> {
  const jobs = await getPrivateTransferJobs()
  const active = jobs.find((job) =>
    ['waiting-balance', 'waiting-sync', 'building-proof', 'broadcasting'].includes(job.status)
  )
  if (active) return null
  return jobs.find((job) => job.status === 'queued') ?? null
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

// =============================================================================
// Wallet Config Operations
// =============================================================================

export async function getWalletConfig(): Promise<WalletConfig | undefined> {
  const db = await getDB()
  return db.get('wallet', 'config')
}

export async function saveWalletConfig(config: WalletConfig): Promise<void> {
  const db = await getDB()
  await db.put('wallet', config, 'config')
}

export async function hasWallet(): Promise<boolean> {
  const config = await getWalletConfig()
  return config !== undefined
}

export async function deleteWallet(): Promise<void> {
  // Prevent new connections
  isDeleting = true
  
  // Close our connection first
  closeDB()
  
  // Small delay to let any pending operations complete
  await new Promise(resolve => setTimeout(resolve, 100))
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => {
      isDeleting = false
      resolve()
    }
    request.onerror = (event) => {
      isDeleting = false
      reject(event)
    }
    request.onblocked = () => {
      // Database is blocked by another connection
      // This can happen if another tab has the DB open
      // We'll resolve anyway since the delete will complete when connections close
      console.warn('[DB] Database deletion blocked - will complete when other connections close')
      isDeleting = false
      resolve()
    }
  })
}

// =============================================================================
// Account Operations
// =============================================================================

export async function getAccounts(): Promise<AccountRecord[]> {
  const db = await getDB()
  return db.getAll('accounts')
}

export async function getAccount(index: number): Promise<AccountRecord | undefined> {
  const db = await getDB()
  return db.get('accounts', index)
}

export async function addAccount(index: number, label: string): Promise<void> {
  const db = await getDB()
  await db.put('accounts', { index, label, createdAt: Date.now() })
}

export async function ensureDefaultAccount(): Promise<void> {
  const db = await getDB()
  const account0 = await db.get('accounts', 0)
  if (!account0) {
    await addAccount(0, 'Default Account')
  }
}

// =============================================================================
// Sync State Operations
// =============================================================================

export async function getSyncState(): Promise<SyncState | undefined> {
  const db = await getDB()
  return db.get('syncState', 'current')
}

export async function saveSyncState(state: SyncState): Promise<void> {
  const db = await getDB()
  await db.put('syncState', state, 'current')
}

export async function getLastSyncedHeight(): Promise<number> {
  const state = await getSyncState()
  return state?.fullSyncHeight ?? 0
}

export async function updateSyncHeight(height: number): Promise<void> {
  const db = await getDB()
  const existing = await db.get('syncState', 'current')
  await db.put('syncState', {
    fullSyncHeight: height,
    appParams: existing?.appParams ?? null,
    fmdParams: existing?.fmdParams ?? null,
    chainId: existing?.chainId,
    chainMarker: existing?.chainMarker,
    lastObservedChainHeight: existing?.lastObservedChainHeight ?? existing?.lastObservedHeight ?? 0,
    sctStorageVersion: existing?.sctStorageVersion,
  }, 'current')
}

export async function savePenumbraChainFingerprint(input: {
  chainId: string
  marker: string
  lastObservedChainHeight: number
  sctStorageVersion?: number
}): Promise<void> {
  const db = await getDB()
  const existing = await db.get('syncState', 'current')
  await db.put('syncState', {
    fullSyncHeight: existing?.fullSyncHeight ?? 0,
    appParams: existing?.appParams ?? null,
    fmdParams: existing?.fmdParams ?? null,
    chainId: input.chainId,
    chainMarker: input.marker,
    lastObservedChainHeight: input.lastObservedChainHeight,
    sctStorageVersion: input.sctStorageVersion ?? existing?.sctStorageVersion,
  }, 'current')
}

export async function clearPenumbraSyncTables(): Promise<void> {
  const db = await getDB()
  const stores = [
    'syncState',
    'spendableNotes',
    'assetMetadata',
    'transactions',
    'ASSETS',
    'AUCTIONS',
    'AUCTION_OUTSTANDING_RESERVES',
    'ADVICE_NOTES',
    'SPENDABLE_NOTES',
    'SWAPS',
    'FMD_PARAMETERS',
    'APP_PARAMETERS',
    'GAS_PRICES',
    'EPOCHS',
    'PRICES',
    'VALIDATOR_INFOS',
    'TRANSACTIONS',
    'FULL_SYNC_HEIGHT',
    'TREE_COMMITMENTS',
    'TREE_HASHES',
    'TREE_LAST_POSITION',
    'TREE_LAST_FORGOTTEN',
    'LQT_HISTORICAL_VOTES',
    'ibcDenoms',
    'privateTransferJobs',
  ] as const

  for (const store of stores) {
    await db.clear(store)
  }
}

// =============================================================================
// Note Operations
// =============================================================================

export async function saveSpendableNote(note: SpendableNoteRecord): Promise<void> {
  const db = await getDB()
  await db.put('spendableNotes', note)
}

export async function saveSpendableNotes(notes: SpendableNoteRecord[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('spendableNotes', 'readwrite')
  await Promise.all([...notes.map((note) => tx.store.put(note)), tx.done])
}

export async function getSpendableNote(noteCommitment: string): Promise<SpendableNoteRecord | undefined> {
  const db = await getDB()
  return db.get('spendableNotes', noteCommitment)
}

export async function getSpendableNotes(accountIndex: number): Promise<SpendableNoteRecord[]> {
  const db = await getDB()
  return db.getAllFromIndex('spendableNotes', 'by-address-index', accountIndex)
}

export async function getAllSpendableNotes(): Promise<SpendableNoteRecord[]> {
  const db = await getDB()
  return db.getAll('spendableNotes')
}

export async function getUnspentNotes(accountIndex: number): Promise<SpendableNoteRecord[]> {
  const notes = await getSpendableNotes(accountIndex)
  return notes.filter((n) => n.heightSpent === null)
}

export async function getUnspentNotesByAsset(accountIndex: number): Promise<Map<string, SpendableNoteRecord[]>> {
  const notes = await getUnspentNotes(accountIndex)
  const grouped = new Map<string, SpendableNoteRecord[]>()
  for (const note of notes) {
    const existing = grouped.get(note.assetId) ?? []
    existing.push(note)
    grouped.set(note.assetId, existing)
  }
  return grouped
}

export async function markNoteSpent(noteCommitment: string, heightSpent: number): Promise<void> {
  const db = await getDB()
  const note = await db.get('spendableNotes', noteCommitment)
  if (note) {
    note.heightSpent = heightSpent
    await db.put('spendableNotes', note)
  }
}

export async function hasNullifier(nullifier: string): Promise<boolean> {
  const db = await getDB()
  const note = await db.getFromIndex('spendableNotes', 'by-nullifier', nullifier)
  return note !== undefined
}

// =============================================================================
// Asset Metadata Operations
// =============================================================================

export async function getAssetMetadata(assetId: string): Promise<Uint8Array | undefined> {
  const db = await getDB()
  return db.get('assetMetadata', assetId)
}

export async function saveAssetMetadata(assetId: string, metadata: Uint8Array): Promise<void> {
  const db = await getDB()
  await db.put('assetMetadata', metadata, assetId)
}

export async function getAllAssetMetadata(): Promise<Map<string, Uint8Array>> {
  const db = await getDB()
  const all = await db.getAll('assetMetadata')
  const keys = await db.getAllKeys('assetMetadata')
  return new Map(keys.map((k, i) => [k, all[i]]))
}

// =============================================================================
// Transaction Operations
// =============================================================================

export async function saveTransaction(txId: string, height: number, transaction: Uint8Array): Promise<void> {
  const db = await getDB()
  await db.put('transactions', { txId, height, transaction })
}

export async function getTransaction(txId: string): Promise<{ height: number; transaction: Uint8Array } | undefined> {
  const db = await getDB()
  const record = await db.get('transactions', txId)
  return record ? { height: record.height, transaction: record.transaction } : undefined
}

export async function getAllTransactions(): Promise<Array<{ txId: string; height: number; transaction: Uint8Array }>> {
  const db = await getDB()
  return db.getAll('transactions')
}

// =============================================================================
// IBC Denom Operations
// =============================================================================

export async function saveIBCDenom(denom: IBCDenomRecord): Promise<void> {
  const db = await getDB()
  await db.put('ibcDenoms', denom)
}

export async function saveIBCDenoms(denoms: IBCDenomRecord[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('ibcDenoms', 'readwrite')
  for (const denom of denoms) {
    await tx.store.put(denom)
  }
  await tx.done
}

export async function getIBCDenom(assetIdHex: string): Promise<IBCDenomRecord | undefined> {
  const db = await getDB()
  return db.get('ibcDenoms', assetIdHex)
}

export async function getAllIBCDenoms(): Promise<IBCDenomRecord[]> {
  const db = await getDB()
  return db.getAll('ibcDenoms')
}

export async function getIBCDenomsMap(): Promise<Map<string, IBCDenomRecord>> {
  const denoms = await getAllIBCDenoms()
  return new Map(denoms.map(d => [d.assetIdHex, d]))
}

export const KNOWN_IBC_DENOMS = [
  {
    baseDenom: 'transfer/channel-0/ubrl',
    name: chainConfig.displayDenom,
    symbol: chainConfig.displayDenom,
    decimals: chainConfig.decimals,
    sourceChannel: 'channel-0',
    destinationChannel: 'channel-0',
  },
]

export async function registerKnownIBCDenoms(
  computeAssetId: (baseDenom: string) => Promise<string>
): Promise<void> {
  const db = await getDB()
  
  for (const known of KNOWN_IBC_DENOMS) {
    const existingByDenom = await db.getFromIndex('ibcDenoms', 'by-base-denom', known.baseDenom)
    if (existingByDenom) continue
    
    const assetIdHex = await computeAssetId(known.baseDenom)
    
    console.log('[DB] Registering IBC denom:', known.baseDenom)
    await db.put('ibcDenoms', {
      assetIdHex,
      baseDenom: known.baseDenom,
      name: known.name,
      symbol: known.symbol,
      decimals: known.decimals,
      sourceChannel: known.sourceChannel,
      destinationChannel: known.destinationChannel,
      discoveredAt: Date.now(),
      discoveredHeight: 0,
    })
  }
}

// =============================================================================
// IDB Constants (for Penumbra ViewServer compatibility)
// =============================================================================

// =============================================================================
// Ephemeral Address Operations
// =============================================================================

export async function saveEphemeralAddressRecord(record: EphemeralAddressRecord): Promise<void> {
  const db = await getDB()
  await db.put('ephemeralAddresses', {
    ...record,
    intermediateHex: record.intermediateHex?.toLowerCase() as EphemeralAddressRecord['intermediateHex'],
  })
}

export async function saveEphemeralAddressRecords(records: EphemeralAddressRecord[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('ephemeralAddresses', 'readwrite')
  await Promise.all([
    ...records.map((record) =>
      tx.store.put({
        ...record,
        intermediateHex: record.intermediateHex?.toLowerCase() as EphemeralAddressRecord['intermediateHex'],
      })
    ),
    tx.done,
  ])
}

export async function getEphemeralAddressRecord(id: string): Promise<EphemeralAddressRecord | undefined> {
  const db = await getDB()
  return db.get('ephemeralAddresses', id)
}

export async function getAllEphemeralAddressRecords(): Promise<EphemeralAddressRecord[]> {
  const db = await getDB()
  return db.getAll('ephemeralAddresses')
}

export async function findEphemeralAddressRecordsByPenumbraAddress(address: string): Promise<EphemeralAddressRecord[]> {
  const db = await getDB()
  return db.getAllFromIndex('ephemeralAddresses', 'by-penumbra-address', address)
}

export async function findEphemeralAddressRecordsByIntermediateHex(address: string): Promise<EphemeralAddressRecord[]> {
  const db = await getDB()
  return db.getAllFromIndex('ephemeralAddresses', 'by-intermediate-hex', address.toLowerCase())
}

export async function clearEphemeralAddressRecords(): Promise<void> {
  const db = await getDB()
  await db.clear('ephemeralAddresses')
}

// =============================================================================
// IDB Constants (for Penumbra ViewServer compatibility)
// =============================================================================

export const IDB_TABLES = {
  ephemeralAddresses: 'ephemeralAddresses',
  assets: 'ASSETS',
  auctions: 'AUCTIONS',
  auction_outstanding_reserves: 'AUCTION_OUTSTANDING_RESERVES',
  advice_notes: 'ADVICE_NOTES',
  spendable_notes: 'SPENDABLE_NOTES',
  swaps: 'SWAPS',
  fmd_parameters: 'FMD_PARAMETERS',
  app_parameters: 'APP_PARAMETERS',
  gas_prices: 'GAS_PRICES',
  epochs: 'EPOCHS',
  prices: 'PRICES',
  validator_infos: 'VALIDATOR_INFOS',
  transactions: 'TRANSACTIONS',
  full_sync_height: 'FULL_SYNC_HEIGHT',
  tree_commitments: 'TREE_COMMITMENTS',
  tree_hashes: 'TREE_HASHES',
  tree_last_position: 'TREE_LAST_POSITION',
  tree_last_forgotten: 'TREE_LAST_FORGOTTEN',
  lqt_historical_votes: 'LQT_HISTORICAL_VOTES',
} as const
