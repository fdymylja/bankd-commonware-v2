// src/lib/native-wallet/services/transaction.ts
/**
 * Transaction planning, building, and broadcasting service for the native wallet.
 *
 * This service handles the complete transaction lifecycle:
 * 1. Planning - Create a transaction plan from user intent
 * 2. Authorization - Sign the plan with the spend key
 * 3. Witness - Generate merkle proofs from SCT
 * 4. Building - Create the transaction with ZK proofs
 * 5. Broadcasting - Submit to the chain
 */

import type { AssetId } from '@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb'
import { Fee } from '@mizufinance/protobuf/shieldd/core/component/fee/v1/fee_pb'
import type {
  FullViewingKey,
  SpendKey,
} from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import { Amount } from '@mizufinance/protobuf/shieldd/core/num/v1/num_pb'
import {
  ActionPlan,
  type AuthorizationData,
  type Transaction,
  TransactionParameters,
  TransactionPlan,
  type WitnessData,
} from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import type { TransactionPlannerRequest } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'
import type { IdbConstants } from '@mizufinance/types/indexed-db'
import type { StateCommitmentTree } from '@mizufinance/types/state-commitment-tree'

import { penumbraConfig } from '@/lib/config'

import {
  DB_NAME,
  DB_VERSION,
  IDB_TABLES,
  getDB,
  getFullViewingKey,
  getSpendKey,
  isWalletUnlocked,
} from '../../core'
import { wrapShielddTransaction } from '../embedded-shieldd'
import { buildProoflessAction } from '../proofless-actions'
import { SHIELDD_BASE_DENOM } from '../protocol'

// =============================================================================
// Types
// =============================================================================

export interface TransactionServiceConfig {
  /** gRPC-web proxy URL for chain queries */
  grpcUrl: string
  /** Chain ID */
  chainId: string
}

export interface PlanAndBuildResult {
  /** The transaction plan */
  plan: TransactionPlan
  /** The built transaction ready for broadcast */
  transaction: Transaction
  /** Transaction ID (hash) */
  transactionId: string
}

export interface BroadcastResult {
  /** Transaction hash */
  hash: string
  /** Block height when included (if awaited) */
  height?: bigint
  /** Success status */
  success: boolean
  /** Error message if failed */
  error?: string
  /** The chain definitively rejected the transaction. */
  rejected?: boolean
}

// =============================================================================
// WASM Module Loading (via wasm-loader for SSR safety)
// =============================================================================

async function loadWasmFunctions() {
  const wasmLoader = await import('../wasm-loader')
  return {
    planTransaction: wasmLoader.planTransaction,
    authorizePlan: wasmLoader.authorizePlan,
    getWitness: wasmLoader.getWitness,
    buildParallel: wasmLoader.buildParallel,
    buildActionParallel: wasmLoader.buildActionParallel,
    assetIdFromBaseDenom: wasmLoader.assetIdFromBaseDenom,
  }
}

// =============================================================================
// IDB Constants for WASM
// =============================================================================

/**
 * Get IDB constants in the format expected by @mizufinance/wasm.
 */
export function getIdbConstants(): IdbConstants {
  return {
    name: DB_NAME,
    version: DB_VERSION,
    tables: IDB_TABLES as unknown as IdbConstants['tables'],
  }
}

// =============================================================================
// State Commitment Tree
// =============================================================================

/**
 * Load the State Commitment Tree from IndexedDB.
 * The SCT is required for generating merkle proofs during transaction building.
 */
export async function getStateCommitmentTree(): Promise<StateCommitmentTree> {
  const { openDB } = await import('idb')
  const db = await openDB(DB_NAME, DB_VERSION)

  try {
    // Load last position
    const lastPosition = await db.get('TREE_LAST_POSITION', 'last_position')
    const lastForgotten = await db.get('TREE_LAST_FORGOTTEN', 'last_forgotten')

    // Load all hashes
    const hashes = await db.getAll('TREE_HASHES')

    // Load all commitments
    const commitments = await db.getAll('TREE_COMMITMENTS')

    // Sort hashes by position then by height for consistent tree reconstruction
    const sortedHashes = [...(hashes ?? [])].sort((a, b) => {
      const posA =
        a.position.epoch * 4294967296 +
        a.position.block * 65536 +
        a.position.commitment
      const posB =
        b.position.epoch * 4294967296 +
        b.position.block * 65536 +
        b.position.commitment
      if (posA !== posB) return posA - posB
      return a.height - b.height
    })

    return {
      last_position: lastPosition ?? {
        Position: { epoch: 0, block: 0, commitment: 0 },
      },
      last_forgotten: lastForgotten ?? 0n,
      hashes: sortedHashes,
      commitments: commitments ?? [],
    }
  } finally {
    db.close()
  }
}

// =============================================================================
// Gas Fee Token
// =============================================================================

/**
 * Get Shieldd's canonical base-asset ID for transaction fees.
 */
export async function getGasFeeToken(): Promise<AssetId> {
  const wasm = await loadWasmFunctions()
  return wasm.assetIdFromBaseDenom(SHIELDD_BASE_DENOM)
}

// =============================================================================
// Transaction Planning
// =============================================================================

/**
 * Plan a transaction using the WASM planner.
 *
 * The planner:
 * - Selects notes to spend from SPENDABLE_NOTES table
 * - Calculates fees
 * - Creates change outputs
 * - Generates the full transaction plan
 *
 * Requires SPENDABLE_NOTES to be populated by ViewServer sync.
 */
export async function planTransaction(
  request: TransactionPlannerRequest,
  fullViewingKey: FullViewingKey,
  gasFeeToken?: AssetId
): Promise<TransactionPlan> {
  const wasm = await loadWasmFunctions()
  const idbConstants = getIdbConstants()
  const feeToken = gasFeeToken ?? (await getGasFeeToken())

  // Debug: log the gas fee token we're using
  const feeTokenKey = Buffer.from(feeToken.inner).toString('base64')
  console.log(
    '[Transaction] Planning transaction with gas fee token:',
    feeTokenKey
  )

  const plan = await wasm.planTransaction(
    idbConstants,
    request,
    fullViewingKey,
    feeToken,
    penumbraConfig.grpcUrl
  )
  console.log('[Transaction] Plan created with', plan.actions.length, 'actions')
  // Log action details
  plan.actions.forEach((action, i) => {
    const actionCase = action.action.case
    console.log(`[Transaction] Action ${i}: ${actionCase}`)
  })

  return plan
}

// =============================================================================
// Authorization
// =============================================================================

/**
 * Authorize a transaction plan with the spend key.
 * Creates the cryptographic authorization data needed for building.
 */
export async function authorizePlan(
  spendKey: SpendKey,
  plan: TransactionPlan
): Promise<AuthorizationData> {
  const wasm = await loadWasmFunctions()

  console.log('[Transaction] Authorizing plan...')
  const authData = wasm.authorizePlan(spendKey, plan)
  console.log('[Transaction] Authorization complete')

  return authData
}

// =============================================================================
// Witness Generation
// =============================================================================

/**
 * Generate witness data (merkle proofs) for a transaction plan.
 * The witness proves note ownership without revealing the notes.
 */
export async function getWitness(
  plan: TransactionPlan,
  sct: StateCommitmentTree
): Promise<WitnessData> {
  const wasm = await loadWasmFunctions()

  console.log('[Transaction] Generating witness data...')
  const witness = await wasm.getWitness(plan, sct)
  console.log('[Transaction] Witness generated:', {
    anchorHex: witness.anchor?.inner
      ? Buffer.from(witness.anchor.inner).toString('hex')
      : 'none',
    stateCommitmentProofCount: witness.stateCommitmentProofs?.length ?? 0,
  })

  return witness
}

// =============================================================================
// Transaction Building
// =============================================================================

/**
 * Build a transaction from a plan, witness, and authorization data.
 * This creates the actual transaction with ZK proofs.
 *
 * Uses parallel building for better performance.
 */
export async function buildTransaction(
  plan: TransactionPlan,
  witnessData: WitnessData,
  authData: AuthorizationData,
  fullViewingKey: FullViewingKey
): Promise<Transaction> {
  const wasm = await loadWasmFunctions()

  console.log(
    '[Transaction] Building transaction with',
    plan.actions.length,
    'actions...'
  )

  const actions = await Promise.all(
    plan.actions.map((actionPlan, actionIndex) => {
      const prooflessAction = buildProoflessAction(actionPlan)
      if (prooflessAction) {
        return Promise.resolve(prooflessAction)
      }

      return wasm.buildActionParallel(
        plan,
        witnessData,
        fullViewingKey,
        actionIndex,
        penumbraConfig.proverUrl
      )
    })
  )
  console.log('[Transaction] Built', actions.length, 'actions')

  // Combine actions into final transaction
  const transaction = await wasm.buildParallel(
    actions,
    plan,
    witnessData,
    authData
  )
  console.log('[Transaction] Transaction built successfully')

  const { prepareAuditPackages } = await import('@/lib/audit-demo/wallet')
  await prepareAuditPackages(plan, transaction)

  return transaction
}

function collectSpentNullifiers(transaction: Transaction): string[] {
  const nullifiers: string[] = []

  for (const action of transaction.body?.actions ?? []) {
    const value = action.action.value as
      | {
          body?: {
            inputs?: Array<{
              nullifier?: {
                inner?: Uint8Array
              }
            }>
          }
        }
      | undefined

    for (const input of value?.body?.inputs ?? []) {
      const inner = input.nullifier?.inner
      if (inner && inner.length > 0) {
        nullifiers.push(Buffer.from(inner).toString('base64'))
      }
    }
  }

  return nullifiers
}

async function markTransactionInputsSpent(
  transaction: Transaction,
  heightSpent: number
): Promise<void> {
  const nullifiers = new Set(collectSpentNullifiers(transaction))
  if (nullifiers.size === 0) return

  const db = await getDB()
  const tx = db.transaction('SPENDABLE_NOTES', 'readwrite')
  const store = tx.objectStore('SPENDABLE_NOTES')

  let cursor = await store.openCursor()
  while (cursor) {
    const note = cursor.value as {
      heightSpent?: string | number | null
      nullifier?: {
        inner?: string
      }
    }

    const nullifier = note.nullifier?.inner
    if (!note.heightSpent && nullifier && nullifiers.has(nullifier)) {
      await cursor.update({
        ...note,
        heightSpent: heightSpent.toString(),
      })
    }

    cursor = await cursor.continue()
  }

  await tx.done
}

// =============================================================================
// Broadcasting
// =============================================================================

/** Configuration for transaction confirmation polling */
export interface ConfirmationConfig {
  /** Maximum time to wait for confirmation (ms). Default: 60000 (60s) */
  timeout?: number
  /** Interval between polls (ms). Default: 2000 (2s) */
  pollInterval?: number
}

/**
 * Wait for a successful EVM receipt to reach the finalized block height.
 */
async function pollForConfirmation(
  txHash: string,
  rpcUrl: string,
  config: ConfirmationConfig = {}
): Promise<{
  confirmed: boolean
  height?: number
  error?: string
  rejected?: boolean
}> {
  const timeout = config.timeout ?? 60000
  const pollInterval = config.pollInterval ?? 2000
  const startTime = Date.now()

  // The Commonware envelope hash is the EVM receipt identifier.
  const formattedHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`

  console.log(`[Transaction] Waiting for confirmation...`)

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [formattedHash] }),
      })
      if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error.message)
      const receipt = data.result
      if (receipt) {
        if (receipt.status === '0x0') return { confirmed: false, rejected: true, error: 'Shieldd transaction reverted' }
        const finalizedResponse = await fetch(rpcUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['finalized', false] }),
        })
        const finalized = await finalizedResponse.json()
        if (finalized.result && BigInt(finalized.result.number) >= BigInt(receipt.blockNumber)) {
          return { confirmed: true, height: Number(BigInt(receipt.blockNumber)) }
        }
      }

      // Transaction not found yet, keep polling silently
    } catch {
      // Continue polling silently on network errors
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  console.warn('[Transaction] Confirmation timeout')
  return { confirmed: false, error: 'Confirmation timeout' }
}

/**
 * Broadcast the native Shieldd envelope through the EVM JSON-RPC endpoint.
 */
export async function broadcastTransaction(
  transaction: Transaction,
  awaitConfirmation: boolean = true,
  confirmationConfig?: ConfirmationConfig
): Promise<BroadcastResult> {
  console.log('[Transaction] Broadcasting transaction...')

  try {
    const bankdTxBytes = wrapShielddTransaction(transaction.toBinary())
    const bankdTxHex = `0x${Buffer.from(bankdTxBytes).toString('hex')}`
    const response = await fetch(penumbraConfig.rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [bankdTxHex] }),
    })
    if (!response.ok) throw new Error(`Broadcast failed: HTTP ${response.status}`)
    const broadcastResponse = await response.json()
    if (broadcastResponse.error) {
      return { hash: '', success: false, rejected: true, error: broadcastResponse.error.message || 'Shieldd transaction rejected' }
    }
    const hash = broadcastResponse.result
    if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('RPC returned no transaction hash')

    console.log('[Transaction] Broadcast successful, hash:', hash)
    if (!awaitConfirmation || !hash) return { hash, success: true }

    const confirmation = await pollForConfirmation(
      hash,
      penumbraConfig.rpcUrl,
      confirmationConfig
    )
    if (!confirmation.confirmed) {
      return {
        hash,
        success: false,
        rejected: confirmation.rejected,
        error: confirmation.error ?? 'Transaction not confirmed',
      }
    }
    if (confirmation.height !== undefined) {
      await markTransactionInputsSpent(transaction, confirmation.height)
    }
    if (process.env.NEXT_PUBLIC_ORBIS_AUDIT_DEMO === 'true') {
      void import('@/lib/audit-demo/outbox').then(({ flushPackages }) => flushPackages()).catch(() => undefined)
    }
    return {
      hash,
      success: true,
      height:
        confirmation.height !== undefined
          ? BigInt(confirmation.height)
          : undefined,
    }
  } catch (error) {
    console.error('[Transaction] Broadcast error:', error)
    return {
      hash: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown broadcast error',
    }
  }
}

// =============================================================================
// High-Level Transaction Service
// =============================================================================

/**
 * Transaction service for the native wallet.
 * Provides a high-level interface for planning, building, and broadcasting transactions.
 */
export class TransactionService {
  private config: TransactionServiceConfig

  constructor(config: TransactionServiceConfig) {
    this.config = config
    if (typeof window !== 'undefined') {
    }
  }

  /**
   * Check if the wallet is ready for transactions.
   */
  isReady(): boolean {
    return isWalletUnlocked()
  }

  /**
   * Get the full viewing key.
   */
  private getFVK(): FullViewingKey {
    if (!this.isReady()) {
      throw new Error('Wallet is locked - cannot create transactions')
    }
    return getFullViewingKey()
  }

  /**
   * Get the spend key for authorization.
   */
  private getSpendKey(): SpendKey {
    if (!this.isReady()) {
      throw new Error('Wallet is locked - cannot authorize transactions')
    }
    return getSpendKey()
  }

  async buildActionPlanTransaction(
    actions: ActionPlan[]
  ): Promise<PlanAndBuildResult> {
    const fvk = this.getFVK()
    const spendKey = this.getSpendKey()

    const { assertPenumbraWalletSynced } = await import('./view-server-sync')
    await assertPenumbraWalletSynced()

    const plan = new TransactionPlan({
      actions,
      transactionParameters: new TransactionParameters({
        chainId: this.config.chainId,
        expiryHeight: 0n,
        fee: new Fee({
          amount: new Amount({ lo: 0n, hi: 0n }),
          assetId: await getGasFeeToken(),
        }),
      }),
    })

    const authData = await authorizePlan(spendKey, plan)
    const witnessData = await getWitness(plan, await getStateCommitmentTree())

    const { assertSctAnchorMatchesChain } = await import('./view-server-sync')
    await assertSctAnchorMatchesChain(witnessData.anchor?.inner)

    const transaction = await buildTransaction(plan, witnessData, authData, fvk)
    const txBytes = transaction.toBinary()
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new Uint8Array(txBytes)
    )
    const transactionId = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return {
      plan,
      transaction,
      transactionId,
    }
  }

  async executeActionPlans(actions: ActionPlan[]): Promise<BroadcastResult> {
    const { transaction } = await this.buildActionPlanTransaction(actions)
    return this.broadcast(transaction)
  }

  /**
   * Plan and build a transaction from a planner request.
   *
   * This is the main entry point for creating transactions.
   * It handles the full lifecycle: plan → authorize → witness → build
   */
  async planAndBuild(
    request: TransactionPlannerRequest
  ): Promise<PlanAndBuildResult> {
    const fvk = this.getFVK()
    const spendKey = this.getSpendKey()

    const { assertPenumbraWalletSynced } = await import('./view-server-sync')
    await assertPenumbraWalletSynced()

    // 1. Plan the transaction
    const plan = await planTransaction(request, fvk)

    // 2. Authorize the plan
    const authData = await authorizePlan(spendKey, plan)

    // 3. Get the SCT for witness generation
    const sct = await getStateCommitmentTree()

    // 4. Generate witness data
    const witnessData = await getWitness(plan, sct)

    // 4b. Verify the witness anchor was a real chain root before broadcasting,
    // so a poisoned local tree fails fast with guidance instead of a cryptic
    // "provided anchor is not a valid SCT root" rejection.
    const { assertSctAnchorMatchesChain } = await import('./view-server-sync')
    await assertSctAnchorMatchesChain(witnessData.anchor?.inner)

    // 5. Build the transaction
    const transaction = await buildTransaction(plan, witnessData, authData, fvk)

    // 6. Compute transaction ID (hash of transaction bytes)
    const txBytes = transaction.toBinary()
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new Uint8Array(txBytes)
    )
    const transactionId = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return {
      plan,
      transaction,
      transactionId,
    }
  }

  /**
   * Broadcast a built transaction to the chain.
   */
  async broadcast(
    transaction: Transaction,
    awaitConfirmation: boolean = true
  ): Promise<BroadcastResult> {
    return broadcastTransaction(transaction, awaitConfirmation)
  }

  /**
   * Plan, build, and broadcast a transaction in one call.
   */
  async execute(request: TransactionPlannerRequest): Promise<BroadcastResult> {
    const { transaction } = await this.planAndBuild(request)
    return this.broadcast(transaction)
  }
}

/**
 * Create a TransactionService instance.
 */
export function createTransactionService(
  config: TransactionServiceConfig
): TransactionService {
  return new TransactionService(config)
}
