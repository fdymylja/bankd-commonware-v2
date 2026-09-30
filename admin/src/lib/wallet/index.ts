// src/lib/wallet/index.ts

// Types
export type {
  WalletProviderType,
  WalletProviderState,
  WalletProviderActions,
  WalletViewService,
  WalletProvider,
  WalletMode,
  TransparentAddress,
} from './types'

export { getDefaultWalletMode } from './types'

// Providers
export {
  createNativeWalletProvider,
  getNativeViewService,
  isNativeWalletAvailable,
  getNativeWalletAddress,
  getNativeWalletTransparentAddress,
} from './providers'
