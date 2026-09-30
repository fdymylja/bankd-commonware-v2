'use client'

import { useEffect } from 'react'
import { bytesToHex } from 'viem'

import { penumbraConfig } from '@/lib/config'
import { registerKnownIBCDenoms, useNativeWallet } from '@/lib/native-wallet'
import { usePenumbraStore } from '@/store/penumbra'

/**
 * Compute asset ID from base denom using Penumbra's WASM.
 * Returns hex string with 0x prefix.
 * 
 * Uses dynamic import to avoid SSR issues with WASM.
 */
async function computeAssetIdFromDenom(baseDenom: string): Promise<string> {
  // Dynamic import to avoid loading WASM during SSR
  const { assetIdFromBaseDenom } = await import('@/lib/native-wallet/penumbra/wasm-loader')
  const assetId = await assetIdFromBaseDenom(baseDenom)
  return bytesToHex(assetId.inner)
}

/**
 * Provider component that syncs native wallet state to the penumbra store
 * and initializes Penumbra-specific background tasks.
 * 
 * This bridges the native wallet context with the legacy penumbra store
 * for backwards compatibility with existing components.
 */
export function PenumbraProvider({ children }: { children: React.ReactNode }) {
  const wallet = useNativeWallet()
  const updateStore = usePenumbraStore((s) => s._updateFromNativeWallet)
  
  // Sync wallet state to penumbra store
  useEffect(() => {
    updateStore({
      isConnected: wallet.initState === 'unlocked',
      address: wallet.addresses?.penumbra.bech32 ?? null,
      transparentAddress: wallet.addresses?.penumbraTransparent ?? null,
      chainId: wallet.initState === 'unlocked' ? penumbraConfig.chainId : null,
      error: wallet.error,
    })
  }, [
    wallet.initState,
    wallet.addresses,
    wallet.error,
    updateStore,
  ])

  // Register known IBC denoms on initialization (needs WASM for asset ID computation)
  useEffect(() => {
    registerKnownIBCDenoms(computeAssetIdFromDenom)
  }, [])

  // NOTE: IBC denom scanning is handled by the ViewServer sync
  // See: src/lib/native-wallet/services/view-server-sync.ts - extractIBCDenomsFromBlock()

  return <>{children}</>
}
