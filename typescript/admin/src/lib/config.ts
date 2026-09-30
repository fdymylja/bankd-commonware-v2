// Re-export shared config
export { chainConfig, penumbraConfig } from '@bankd/shared'
export type { ChainConfig, PenumbraConfig } from '@bankd/shared'

// Admin-specific: viem Chain definition (wagmi needs this)
import { chainConfig } from '@bankd/shared'
import { Chain } from 'viem'

export const chainDefinition: Chain = {
  id: chainConfig.evmChainId,
  name: chainConfig.prettyName,
  nativeCurrency: {
    name: chainConfig.displayDenom,
    symbol: chainConfig.displayDenom,
    decimals: chainConfig.decimals,
  },
  rpcUrls: {
    default: { http: [chainConfig.evmRpc] },
    webSocket: { http: [chainConfig.evmWebSocket] },
  },
  blockExplorers: {
    default: { name: 'Bankd Explorer', url: 'https://explorer.bankd.finance' },
  },
}
