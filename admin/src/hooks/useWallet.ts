import { useAccount } from 'wagmi'

import { hexToBech32 } from '@/lib/utils'

/**
 * Hook to get EVM wallet info from wagmi.
 * 
 * For the unified native wallet, use useNativeWallet from @/lib/native-wallet instead.
 */
export const useWallet = () => {
  const { address: hexAddress, isConnected } = useAccount()
  const bech32Address = hexAddress ? hexToBech32(hexAddress) : undefined

  return {
    isConnected,
    hexAddress,
    bech32Address,
  }
}

// Alias for clarity
export { useWallet as useEVMWallet }
