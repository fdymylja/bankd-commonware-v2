// src/lib/native-wallet/services/view-service.ts
/**
 * Local implementation of Penumbra ViewService.
 *
 * This service provides view operations (balance queries, address derivation, etc.)
 * using locally stored data and the FVK from the wallet.
 *
 * Note: This is a partial implementation covering the methods actually used
 * by the bankd admin app. Full ViewService has many more methods.
 */

import { AppParameters } from '@mizufinance/protobuf/shieldd/core/app/v1/app_pb'
import type { FullViewingKey } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import {
  AddressByIndexRequest,
  AddressByIndexResponse,
  AppParametersRequest,
  AppParametersResponse,
  AuthorizeAndBuildRequest,
  AuthorizeAndBuildResponse,
  BalancesRequest,
  BalancesResponse,
  BroadcastTransactionRequest,
  BroadcastTransactionResponse,
  StatusRequest,
  StatusResponse,
  TransactionPlannerRequest,
  TransactionPlannerResponse,
  TransparentAddressRequest,
  TransparentAddressResponse,
  WalletIdRequest,
  WalletIdResponse,
} from '@mizufinance/protobuf/shieldd/view/v1/view_pb'

import { embeddedShielddQueryUrl } from '../embedded-shieldd'
import { addressByIndex, transparentAddress } from './address'
import { balances } from './balances'
import { getLastSyncedHeight, getSyncState } from '../../core'

// Dynamic import for WASM functions
async function loadWasm() {
  const wasm = await import('../wasm-loader')
  return { getWalletId: wasm.getWalletId }
}

/**
 * Configuration for the local view service.
 */
export interface LocalViewServiceConfig {
  /** Full Viewing Key for address derivation and note detection */
  fvk: FullViewingKey
  /** gRPC URL for remote queries (chain parameters, etc.) */
  grpcUrl: string
  /** Chain ID for verification */
  chainId: string
}

/**
 * Local ViewService implementation.
 *
 * Provides view operations using locally stored data.
 */
export class LocalViewService {
  private fvk: FullViewingKey
  private grpcUrl: string
  private chainId: string

  constructor(config: LocalViewServiceConfig) {
    this.fvk = config.fvk
    this.grpcUrl = config.grpcUrl
    this.chainId = config.chainId
  }

  /**
   * Get an address by account index.
   */
  async addressByIndex(
    request: AddressByIndexRequest
  ): Promise<AddressByIndexResponse> {
    return addressByIndex(this.fvk, request)
  }

  /**
   * Get the transparent address for the wallet.
   */
  async transparentAddress(
    request: TransparentAddressRequest
  ): Promise<TransparentAddressResponse> {
    return transparentAddress(this.fvk, request)
  }

  /**
   * Get the wallet ID.
   */
  async walletId(_request: WalletIdRequest): Promise<WalletIdResponse> {
    const wasm = await loadWasm()
    const id = await wasm.getWalletId(this.fvk)
    return new WalletIdResponse({ walletId: id })
  }

  /**
   * Get balances (streaming).
   */
  async *balances(
    request: BalancesRequest
  ): AsyncGenerator<BalancesResponse, void, unknown> {
    yield* balances(request)
  }

  /**
   * Get current sync status.
   */
  async status(_request: StatusRequest): Promise<StatusResponse> {
    const syncedHeight = await getLastSyncedHeight()

    // Get latest height from chain via Next.js API proxy
    let latestHeight = syncedHeight
    let catchingUp = false

    try {
      const response = await fetch('/api/penumbra/status')
      if (response.ok) {
        const data = await response.json()
        const chainHeight = data?.height
        if (chainHeight) {
          latestHeight = parseInt(chainHeight, 10)
          catchingUp = syncedHeight < latestHeight
        }
      }
    } catch (error) {
      console.warn(
        '[ViewService] Failed to get latest height from chain:',
        error
      )
    }

    return new StatusResponse({
      syncHeight: BigInt(syncedHeight),
      catchingUp,
    })
  }

  /**
   * Get app parameters.
   * Fetches from chain via gRPC if not cached locally.
   */
  async appParameters(
    _request: AppParametersRequest
  ): Promise<AppParametersResponse> {
    const syncState = await getSyncState()

    if (syncState?.appParams) {
      // Return cached app parameters
      const params = AppParameters.fromBinary(syncState.appParams)
      return new AppParametersResponse({ parameters: params })
    }

    // Fetch from chain via gRPC endpoint
    try {
      const response = await fetch(
        embeddedShielddQueryUrl(this.grpcUrl, 'AppParameters'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data?.appParameters) {
          // Note: The response format depends on the gRPC-gateway/gRPC-web setup
          // This is a best-effort attempt - full implementation requires @connectrpc/connect
          const params = new AppParameters({
            chainId: data.appParameters.chainId || this.chainId,
          })
          return new AppParametersResponse({ parameters: params })
        }
      }
    } catch (error) {
      console.warn(
        '[ViewService] Failed to fetch app parameters from chain:',
        error
      )
    }

    // Fallback: return minimal response with configured chain ID
    return new AppParametersResponse({
      parameters: new AppParameters({
        chainId: this.chainId,
      }),
    })
  }

  // ==========================================================================
  // Transaction methods
  // ==========================================================================

  /**
   * Plan a transaction.
   */
  async transactionPlanner(
    request: TransactionPlannerRequest
  ): Promise<TransactionPlannerResponse> {
    const { planTransaction, getGasFeeToken } = await import('./transaction')
    const { TransactionPlannerResponse } = await import(
      '@mizufinance/protobuf/shieldd/view/v1/view_pb'
    )

    const gasFeeToken = await getGasFeeToken()
    const plan = await planTransaction(request, this.fvk, gasFeeToken)

    return new TransactionPlannerResponse({ plan })
  }

  /**
   * Authorize and build a transaction.
   * Yields progress updates during the build process.
   */
  async *authorizeAndBuild(
    request: AuthorizeAndBuildRequest
  ): AsyncGenerator<AuthorizeAndBuildResponse> {
    const {
      AuthorizeAndBuildResponse,
      AuthorizeAndBuildResponse_BuildProgress,
      AuthorizeAndBuildResponse_Complete,
    } = await import('@mizufinance/protobuf/shieldd/view/v1/view_pb')
    const {
      authorizePlan,
      getWitness,
      buildTransaction,
      getStateCommitmentTree,
    } = await import('./transaction')
    const { getSpendKey } = await import('../../core')

    const plan = request.transactionPlan
    if (!plan) {
      throw new Error('No transaction plan provided')
    }

    // Yield progress: authorizing
    yield new AuthorizeAndBuildResponse({
      status: {
        case: 'buildProgress',
        value: new AuthorizeAndBuildResponse_BuildProgress({ progress: 0.1 }),
      },
    })

    // Authorize the plan
    const spendKey = getSpendKey()
    const authData = await authorizePlan(spendKey, plan)

    // Yield progress: generating witness
    yield new AuthorizeAndBuildResponse({
      status: {
        case: 'buildProgress',
        value: new AuthorizeAndBuildResponse_BuildProgress({ progress: 0.3 }),
      },
    })

    // Get SCT and generate witness
    const sct = await getStateCommitmentTree()
    const witnessData = await getWitness(plan, sct)

    // Yield progress: building
    yield new AuthorizeAndBuildResponse({
      status: {
        case: 'buildProgress',
        value: new AuthorizeAndBuildResponse_BuildProgress({ progress: 0.5 }),
      },
    })

    // Build the transaction
    const transaction = await buildTransaction(
      plan,
      witnessData,
      authData,
      this.fvk
    )

    // Yield the final transaction
    yield new AuthorizeAndBuildResponse({
      status: {
        case: 'complete',
        value: new AuthorizeAndBuildResponse_Complete({ transaction }),
      },
    })
  }

  /**
   * Broadcast a transaction to the chain.
   */
  async *broadcastTransaction(
    request: BroadcastTransactionRequest
  ): AsyncGenerator<BroadcastTransactionResponse> {
    const {
      BroadcastTransactionResponse,
      BroadcastTransactionResponse_BroadcastSuccess,
      BroadcastTransactionResponse_Confirmed,
    } = await import('@mizufinance/protobuf/shieldd/view/v1/view_pb')
    const { TransactionId } = await import(
      '@mizufinance/protobuf/shieldd/core/txhash/v1/txhash_pb'
    )
    const { broadcastTransaction: broadcast } = await import('./transaction')

    const transaction = request.transaction
    if (!transaction) {
      throw new Error('No transaction provided')
    }

    // Broadcast the transaction
    const result = await broadcast(transaction, request.awaitDetection)

    if (!result.success) {
      throw new Error(result.error ?? 'Broadcast failed')
    }

    // Convert hash to TransactionId
    const hashBytes = new Uint8Array(32)
    for (let i = 0; i < 32 && i * 2 < result.hash.length; i++) {
      hashBytes[i] = parseInt(result.hash.slice(i * 2, i * 2 + 2), 16)
    }
    const txId = new TransactionId({ inner: hashBytes })

    // Yield broadcast success
    yield new BroadcastTransactionResponse({
      status: {
        case: 'broadcastSuccess',
        value: new BroadcastTransactionResponse_BroadcastSuccess({ id: txId }),
      },
    })

    // If awaiting confirmation, yield confirmed status
    if (request.awaitDetection) {
      yield new BroadcastTransactionResponse({
        status: {
          case: 'confirmed',
          value: new BroadcastTransactionResponse_Confirmed({
            id: txId,
            detectionHeight: result.height ?? 0n,
          }),
        },
      })
    }
  }
}

/**
 * Create a LocalViewService instance.
 */
export function createLocalViewService(
  config: LocalViewServiceConfig
): LocalViewService {
  return new LocalViewService(config)
}
