'use client'

import { useCallback } from 'react'

import { penumbraConfig } from '@/lib/config'
import { getPenumbraEphemeralAddressInfo, useNativeWallet } from '@/lib/native-wallet'

/**
 * Hook to access Penumbra wallet state.
 * 
 * This is now a wrapper around the unified wallet context for backwards
 * compatibility. For new code, use useNativeWallet directly.
 */
export const usePenumbra = () => {
  const wallet = useNativeWallet()

  const isConnected = wallet.initState === 'unlocked'
  const chainId = isConnected ? penumbraConfig.chainId : null

  const getEphemeralAddress = useCallback(
    async (accountIndex: number = wallet.currentAccount): Promise<string> => {
      const address = await getPenumbraEphemeralAddressInfo(accountIndex)
      return address.bech32
    },
    [wallet.currentAccount],
  )

  return {
    isConnected,
    isConnecting: false,
    address: wallet.addresses?.penumbra.bech32 ?? null,
    transparentAddress: wallet.addresses?.penumbraTransparent ?? null,
    fullViewingKey: wallet.fullViewingKey,
    getEphemeralAddress,
    chainId,
    isCorrectChain: true,
    expectedChainId: penumbraConfig.chainId,
    error: wallet.error,
    
    // Map to wallet actions
    connect: wallet.unlock,
    disconnect: wallet.lock,
    
    // Expose wallet for advanced usage
    wallet,
  }
}
