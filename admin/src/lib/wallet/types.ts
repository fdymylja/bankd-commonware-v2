// src/lib/wallet/types.ts
/**
 * Wallet provider abstraction types.
 *
 * This provides a unified interface for both Prax extension and native wallet,
 * allowing the app to work with either provider transparently.
 */

import type { Address } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
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

/**
 * Wallet provider type identifier.
 */
export type WalletProviderType = 'prax' | 'native'

/**
 * Transparent address with bech32 encoding.
 */
export interface TransparentAddress {
  address: Address
  bech32: string
}

/**
 * Common state shared by all wallet providers.
 */
export interface WalletProviderState {
  /** The type of wallet provider */
  type: WalletProviderType

  /** Whether the wallet is connected/unlocked */
  isConnected: boolean

  /** Whether the wallet is currently connecting/unlocking */
  isConnecting: boolean

  /** Current account index */
  accountIndex: number

  /** Primary address for current account (null if not connected) */
  address: string | null

  /** Transparent address for current account (null if not connected) */
  transparentAddress: TransparentAddress | null

  /** Chain ID the wallet is connected to */
  chainId: string | null

  /** Error message if any */
  error: string | null
}

/**
 * Actions available on all wallet providers.
 */
export interface WalletProviderActions {
  /** Connect to the wallet / unlock */
  connect(): Promise<void>

  /** Disconnect from the wallet / lock */
  disconnect(): void

  /** Switch to a different account */
  switchAccount(accountIndex: number): Promise<void>

  /** Clear any error state */
  clearError(): void
}

/**
 * View service interface (subset of methods used by the app).
 */
export interface WalletViewService {
  /** Get address by account index */
  addressByIndex(request: AddressByIndexRequest): Promise<AddressByIndexResponse>

  /** Get transparent address */
  transparentAddress(request: TransparentAddressRequest): Promise<TransparentAddressResponse>

  /** Get balances (streaming) */
  balances(request: BalancesRequest): AsyncIterable<BalancesResponse>

  /** Get current status */
  status(request: StatusRequest): Promise<StatusResponse>
}

/**
 * Complete wallet provider interface.
 */
export interface WalletProvider extends WalletProviderState, WalletProviderActions {
  /** View service for balance and address queries */
  viewService: WalletViewService | null
}

/**
 * Wallet mode configuration.
 */
export type WalletMode = 'prax' | 'native' | 'auto'

/**
 * Get the default wallet mode from environment.
 */
export function getDefaultWalletMode(): WalletMode {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WALLET_MODE) {
    return process.env.NEXT_PUBLIC_WALLET_MODE as WalletMode
  }
  // Default to 'auto' which will try native first, then fall back to Prax
  return 'auto'
}
