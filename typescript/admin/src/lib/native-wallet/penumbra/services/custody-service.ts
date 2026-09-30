// src/lib/native-wallet/services/custody-service.ts
/**
 * Local implementation of Penumbra CustodyService.
 *
 * This service handles transaction authorization using the locally stored
 * spend key, which is derived from the encrypted seed phrase when the wallet
 * is unlocked.
 */

import type { FullViewingKey, SpendKey } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import {
  AuthorizeRequest,
  AuthorizeResponse,
  ExportFullViewingKeyRequest,
  ExportFullViewingKeyResponse,
} from '@mizufinance/protobuf/shieldd/custody/v1/custody_pb'

import { getFullViewingKey, getSpendKey, isWalletUnlocked } from '../../core'

// Dynamic import for WASM functions
async function loadWasm() {
  const wasm = await import('../wasm-loader')
  return { authorizePlan: wasm.authorizePlan }
}

/**
 * Configuration for the local custody service.
 */
export interface LocalCustodyServiceConfig {
  /**
   * Optional callback for authorization approval.
   * If not provided, all authorization requests are auto-approved.
   * Return true to approve, false to reject.
   */
  onAuthorizeRequest?: (request: AuthorizeRequest) => Promise<boolean>
}

/**
 * Local CustodyService implementation.
 *
 * Provides transaction authorization using the locally stored spend key.
 */
export class LocalCustodyService {
  private config: LocalCustodyServiceConfig

  constructor(config: LocalCustodyServiceConfig = {}) {
    this.config = config
  }

  /**
   * Get the spend key for authorization.
   * Throws if wallet is locked.
   */
  private getSpendKey(): SpendKey {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked - cannot authorize transactions')
    }
    return getSpendKey()
  }

  /**
   * Get the full viewing key.
   * Throws if wallet is locked.
   */
  private getFVK(): FullViewingKey {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked - cannot access FVK')
    }
    return getFullViewingKey()
  }

  /**
   * Authorize a transaction plan.
   *
   * This creates the AuthorizationData needed to build a transaction.
   * The actual signing happens during the build phase.
   */
  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    // Check if wallet is unlocked
    const spendKey = this.getSpendKey()

    // If there's an approval callback, use it
    if (this.config.onAuthorizeRequest) {
      const approved = await this.config.onAuthorizeRequest(request)
      if (!approved) {
        throw new Error('Transaction authorization rejected')
      }
    }

    // Get the transaction plan from the request
    const plan = request.plan
    if (!plan) {
      throw new Error('No transaction plan provided')
    }

    // Create authorization data using WASM
    const wasm = await loadWasm()
    const authData = await wasm.authorizePlan(spendKey, plan)

    return new AuthorizeResponse({
      data: authData,
    })
  }

  /**
   * Export the full viewing key.
   *
   * The FVK is not sensitive (cannot spend) but allows viewing all transactions.
   * Some implementations may want to require additional authentication.
   */
  exportFullViewingKey(
    _request: ExportFullViewingKeyRequest
  ): ExportFullViewingKeyResponse {
    const fvk = this.getFVK()

    return new ExportFullViewingKeyResponse({
      fullViewingKey: fvk,
    })
  }

  /**
   * Check if the custody service can authorize (wallet is unlocked).
   */
  canAuthorize(): boolean {
    return isWalletUnlocked()
  }
}

/**
 * Create a LocalCustodyService instance.
 */
export function createLocalCustodyService(
  config?: LocalCustodyServiceConfig
): LocalCustodyService {
  return new LocalCustodyService(config)
}
