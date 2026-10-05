/**
 * usePenumbra — Hook to access Penumbra wallet state on mobile.
 *
 * Mirrors the admin's usePenumbra hook API surface, but backed by
 * the native wallet context. The Penumbra WebView bridge provides
 * FVK, sync status, and balances through the wallet context once
 * it's wired up in the provider stack.
 *
 * For new code, prefer useNativeWallet() directly.
 */

import { useCallback } from 'react'

import { chainConfig } from '@bankd/shared'

import { useNativeWallet } from '@/lib/native-wallet'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'

export const usePenumbra = () => {
  const wallet = useNativeWallet()
  const bridge = usePenumbraBridge()

  const isConnected = wallet.initState === 'unlocked'
  const chainId = isConnected ? chainConfig.chainId : null

  const getEphemeralAddress = useCallback(
    async (accountIndex: number = wallet.currentAccount): Promise<string> => {
      return bridge.getEphemeralAddress(accountIndex)
    },
    [bridge, wallet.currentAccount],
  )

  return {
    /** Whether the Penumbra wallet is connected (unlocked). */
    isConnected,

    /** Whether the wallet is currently connecting. */
    isConnecting: wallet.isInitializing,

    /** Penumbra bech32 address (null if not unlocked or no Penumbra keys). */
    address: wallet.addresses?.penumbra?.bech32 ?? null,

    /** Transparent (IBC-compatible) Penumbra address. */
    transparentAddress: wallet.addresses?.penumbraTransparent ?? null,

    /** Full viewing key for the Penumbra wallet. */
    fullViewingKey: wallet.fullViewingKey,

    /** Generate a fresh ephemeral shielded address for IBC deposit/return use. */
    getEphemeralAddress,

    /** Bankd chain ID hosting embedded Shieldd. */
    chainId,

    /** Whether we're connected to the expected chain. */
    isCorrectChain: true,

    /** Expected chain ID from config. */
    expectedChainId: chainConfig.chainId,

    /** Last error from wallet operations. */
    error: wallet.error,

    /** Whether Penumbra sync is running. */
    isSyncing: wallet.isSyncing,

    /** Sync progress (currentHeight, targetHeight, percent). */
    syncProgress: wallet.syncProgress,

    // Map to wallet actions
    connect: wallet.unlock,
    disconnect: wallet.lock,

    // Expose full wallet for advanced usage
    wallet,
  }
}
