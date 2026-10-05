/**
 * Hook to get wallet info for the mobile app.
 * Uses the native wallet context instead of wagmi's useAccount.
 */

import type { Hex } from 'viem'

import { useNativeWallet } from '@/lib/native-wallet'

export function useWallet() {
  const wallet = useNativeWallet()
  const hexAddress = wallet.addresses?.evm.hex as Hex | undefined
  const bech32Address = wallet.addresses?.evm.bech32 ?? undefined

  return {
    isConnected: wallet.initState === 'unlocked' && !!hexAddress,
    hexAddress: hexAddress ?? null,
    bech32Address: bech32Address ?? null,
  }
}

// Alias for clarity
export { useWallet as useEVMWallet }
