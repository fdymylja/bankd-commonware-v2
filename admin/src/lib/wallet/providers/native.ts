// src/lib/wallet/providers/native.ts
/**
 * Native wallet provider adapter.
 *
 * Wraps the native wallet context to provide the unified WalletProvider interface.
 */

import type {
  AddressByIndexRequest,
  AddressByIndexResponse,
  BalancesRequest,
  BalancesResponse,
  StatusRequest,
  StatusResponse,
  TransparentAddressRequest,
  TransparentAddressResponse,
} from '@mizufinance/protobuf/shieldd/view/v1/view_pb'

import { penumbraConfig } from '@/lib/config'
import {
  LocalViewService,
  type WalletContextType,
  createLocalViewService,
  getFullViewingKey,
  getPenumbraAddressInfo,
  getPenumbraTransparentAddressInfo,
  isWalletUnlocked,
} from '@/lib/native-wallet'

import type {
  TransparentAddress,
  WalletProvider,
  WalletViewService,
} from '../types'

/**
 * Create a WalletViewService from the LocalViewService.
 */
function createViewServiceAdapter(
  localViewService: LocalViewService
): WalletViewService {
  return {
    async addressByIndex(
      request: AddressByIndexRequest
    ): Promise<AddressByIndexResponse> {
      return localViewService.addressByIndex(request)
    },

    async transparentAddress(
      request: TransparentAddressRequest
    ): Promise<TransparentAddressResponse> {
      return localViewService.transparentAddress(request)
    },

    async *balances(
      request: BalancesRequest
    ): AsyncIterable<BalancesResponse> {
      yield* localViewService.balances(request)
    },

    async status(request: StatusRequest): Promise<StatusResponse> {
      return localViewService.status(request)
    },
  }
}

/**
 * Create a native wallet provider from the wallet context.
 */
export function createNativeWalletProvider(
  context: WalletContextType
): WalletProvider {
  // Create view service if wallet is unlocked
  let viewService: WalletViewService | null = null

  if (context.initState === 'unlocked' && context.fullViewingKey) {
    const localViewService = createLocalViewService({
      fvk: context.fullViewingKey,
      grpcUrl: penumbraConfig.grpcUrl,
      chainId: penumbraConfig.chainId,
    })
    viewService = createViewServiceAdapter(localViewService)
  }

  return {
    type: 'native',
    isConnected: context.initState === 'unlocked',
    isConnecting: false,
    accountIndex: context.currentAccount,
    address: context.addresses?.penumbra.bech32 ?? null,
    transparentAddress: context.addresses?.penumbraTransparent ?? null,
    chainId: penumbraConfig.chainId,
    error: context.error,

    viewService,

    async connect(): Promise<void> {
      throw new Error('Use unlock() from WalletContext to unlock the wallet')
    },

    disconnect(): void {
      context.lock()
    },

    async switchAccount(accountIndex: number): Promise<void> {
      await context.switchAccount(accountIndex)
    },

    clearError(): void {
      context.clearError()
    },
  }
}

/**
 * Hook-friendly function to get view service methods for native wallet.
 * Returns null if wallet is locked.
 */
export function getNativeViewService(): WalletViewService | null {
  if (!isWalletUnlocked()) {
    return null
  }

  const fvk = getFullViewingKey()
  const localViewService = createLocalViewService({
    fvk,
    grpcUrl: penumbraConfig.grpcUrl,
    chainId: penumbraConfig.chainId,
  })

  return createViewServiceAdapter(localViewService)
}

/**
 * Check if native wallet is available (initialized and ready).
 */
export function isNativeWalletAvailable(): boolean {
  return isWalletUnlocked()
}

/**
 * Get native wallet address for a specific account.
 * Returns null if wallet is locked.
 */
export async function getNativeWalletAddress(accountIndex: number): Promise<string | null> {
  if (!isWalletUnlocked()) {
    return null
  }
  const info = await getPenumbraAddressInfo(accountIndex)
  return info.bech32
}

/**
 * Get native wallet transparent address.
 * Returns null if wallet is locked.
 */
export async function getNativeWalletTransparentAddress(
  _accountIndex: number
): Promise<TransparentAddress | null> {
  if (!isWalletUnlocked()) {
    return null
  }
  const result = await getPenumbraTransparentAddressInfo()
  return {
    address: result.address,
    bech32: result.bech32,
  }
}
