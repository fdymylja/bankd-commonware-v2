'use client'

import { WagmiProvider as WagmiProviderBase } from 'wagmi'

import { makeWagmiConfig } from '@/lib/evm/wagmi'

const wagmiConfig = makeWagmiConfig()

/**
 * Provides wagmi context for EVM hooks (useAccount, useConnect, etc.)
 */
export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return <WagmiProviderBase config={wagmiConfig}>{children}</WagmiProviderBase>
}
