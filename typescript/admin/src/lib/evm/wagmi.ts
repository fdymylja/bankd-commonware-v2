import { Chain } from 'viem'
import { createConfig, fallback, http, webSocket } from 'wagmi'

import { chainDefinition } from '../config'
import { nativeWallet } from '../native-wallet'

// Environment-based network configuration
export const getCurrentChainConfig = (): Chain => {
  return chainDefinition
}

// Get the current network configuration
export const currentNetworkConfig = getCurrentChainConfig()

const supportedChains = [
  currentNetworkConfig,
] as readonly [Chain, ...Chain[]]

let wagmiConfig: ReturnType<typeof _makeWagmiConfig> | undefined

/**
 * Make the Wagmi config object.
 */
export const makeWagmiConfig = () => {
  if (!wagmiConfig) {
    wagmiConfig = _makeWagmiConfig()
  }
  return wagmiConfig
}
export const _makeWagmiConfig = () =>
  createConfig({
    chains: supportedChains,
    // Disable auto-discovery of injected wallets (MetaMask, etc.)
    // We only use the native wallet connector
    multiInjectedProviderDiscovery: false,
    connectors: [
      nativeWallet(),
    ],
    transports: supportedChains.reduce(
      (acc, chain) => {
        const transports = [
          ...(chain.rpcUrls.default.webSocket?.map((url) => webSocket(url)) ||
            []),
          ...(chain.rpcUrls.default.http.map((url) => http(url)) || []),
        ]

        acc[chain.id] =
          transports.length > 1 ? fallback(transports) : transports[0]
        return acc
      },
      {} as Record<number, any>
    ),
  })

// Export utility functions for network management
export const getTargetChainId = (): number => {
  return currentNetworkConfig.id
}

export const getTargetChainConfig = (): Chain => {
  return currentNetworkConfig
}

export const createNetworkAddParams = (config: Chain) => {
  return {
    chainId: `0x${config.id.toString(16)}`,
    chainName: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: config.rpcUrls.provided?.http || config.rpcUrls.default.http,
    blockExplorerUrls: config.blockExplorers?.default?.url
      ? [config.blockExplorers.default.url]
      : undefined,
  }
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof makeWagmiConfig>
  }
}
