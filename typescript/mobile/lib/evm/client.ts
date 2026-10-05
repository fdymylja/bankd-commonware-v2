/**
 * EVM client setup for mobile using viem directly (no wagmi).
 *
 * Provides public client (read) and wallet client (write) creation
 * backed by the HD account from the native wallet.
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Transport,
} from 'viem'
import type { HDAccount } from 'viem/accounts'

import { chainConfig } from '@bankd/shared'
import { getNetworkSettings } from '../network'

// =============================================================================
// Chain Definition
// =============================================================================

/**
 * Bankd chain definition for viem.
 */
export const bankdChain: Chain = defineChain({
  id: chainConfig.evmChainId,
  name: chainConfig.prettyName,
  nativeCurrency: {
    name: chainConfig.displayDenom,
    symbol: chainConfig.displayDenom,
    decimals: chainConfig.decimals,
  },
  rpcUrls: {
    default: { http: [chainConfig.evmRpc] },
  },
})

// =============================================================================
// Client Singletons
// =============================================================================

let publicClientInstance: PublicClient | null = null
let clientRpcUrl = ''

/**
 * Get a viem public client for read-only operations.
 * Recreates the client when the configured RPC endpoint changes.
 */
export function getPublicClient(): PublicClient {
  if (!publicClientInstance || clientRpcUrl !== getNetworkSettings().rpcUrl) {
    clientRpcUrl = getNetworkSettings().rpcUrl
    publicClientInstance = createPublicClient({
      chain: bankdChain,
      transport: http(getNetworkSettings().rpcUrl),
    })
  }
  return publicClientInstance
}

/**
 * Reset the public client singleton (e.g., after RPC endpoint change in settings).
 */
export function resetPublicClient(): void {
  publicClientInstance = null
}

/**
 * Create a viem wallet client for write operations.
 * Not cached — the account may change (account switching, lock/unlock).
 */
export function createMobileWalletClient(
  account: HDAccount
): WalletClient<Transport, Chain, HDAccount> {
  return createWalletClient({
    account,
    chain: bankdChain,
    transport: http(getNetworkSettings().rpcUrl),
  })
}
