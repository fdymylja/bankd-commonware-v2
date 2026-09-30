'use client'

/**
 * Penumbra store - thin wrapper around unified wallet for backwards compatibility.
 * 
 * This store re-exports state from the wallet context to maintain
 * API compatibility with existing components that use usePenumbraStore.
 * 
 * @deprecated Use useWallet or usePenumbraAddress from @/lib/native-wallet for new code.
 */

import type { PenumbraTransparentAddress } from '@bankd/shared/penumbra/address'
import { create } from 'zustand'

export type { PenumbraTransparentAddress } from '@bankd/shared/penumbra/address'

export interface PenumbraState {
  isConnected: boolean
  isConnecting: boolean
  address: string | null
  transparentAddress: PenumbraTransparentAddress | null
  chainId: string | null
  error: string | null

  // These are now no-ops - use native wallet context directly
  connect: () => Promise<void>
  disconnect: () => void
  setError: (error: string | null) => void
  
  // Internal: update state from native wallet
  _updateFromNativeWallet: (state: {
    isConnected: boolean
    address: string | null
    transparentAddress: PenumbraTransparentAddress | null
    chainId: string | null
    error: string | null
  }) => void
}

export const usePenumbraStore = create<PenumbraState>()((set) => ({
  isConnected: false,
  isConnecting: false,
  address: null,
  transparentAddress: null,
  chainId: null,
  error: null,

  connect: async () => {
    // No-op: connection is handled by native wallet context
    console.warn('usePenumbraStore.connect() is deprecated. Use native wallet unlock() instead.')
  },

  disconnect: () => {
    // No-op: disconnection is handled by native wallet context
    console.warn('usePenumbraStore.disconnect() is deprecated. Use native wallet lock() instead.')
  },

  setError: (error) => set({ error }),
  
  _updateFromNativeWallet: (state) => set({
    isConnected: state.isConnected,
    address: state.address,
    transparentAddress: state.transparentAddress,
    chainId: state.chainId,
    error: state.error,
  }),
}))
