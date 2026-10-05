/**
 * Mobile Native Wallet — React Context + Hook.
 *
 * Provides the same WalletState & WalletActions interface as the admin,
 * but backed by expo-secure-store, biometrics, and EVM-first key derivation.
 *
 * Usage:
 *   <NativeWalletProvider>
 *     <App />
 *   </NativeWalletProvider>
 *
 *   const wallet = useNativeWallet()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  AccountAddresses,
  EVMAddressInfo,
  WalletContextType,
  WalletInitState,
} from './types'
import {
  createWallet as coreCreateWallet,
  destroyWallet,
  enableBiometric as coreEnableBiometric,
  disableBiometric as coreDisableBiometric,
  exportSeedPhrase as coreExportSeedPhrase,
  getCurrentAccountAddresses,
  getCurrentAccountIndex,
  getEVMAddressForAccountIndex,
  getWalletInitState,
  isBiometricEnabled,
  isWalletUnlocked,
  lockWallet as coreLockWallet,
  importWallet as coreImportWallet,
  signMessage,
  signTransaction,
  signTypedData,
  startAutoLockTimer,
  switchAccount as coreSwitchAccount,
  unlockWallet as coreUnlockWallet,
  unlockWithBiometric as coreUnlockWithBiometric,
} from './wallet'

// =============================================================================
// Context
// =============================================================================

const NativeWalletContext = createContext<WalletContextType | null>(null)

// =============================================================================
// Provider
// =============================================================================

interface NativeWalletProviderProps {
  children: React.ReactNode
}

export function NativeWalletProvider({
  children,
}: NativeWalletProviderProps): React.JSX.Element {
  const [initState, setInitState] = useState<WalletInitState>('uninitialized')
  const [isInitializing, setIsInitializing] = useState(true)
  const [currentAccount, setCurrentAccount] = useState(0)
  const [addresses, setAddresses] = useState<AccountAddresses | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'password' | 'passkey' | null>(
    null
  )
  const [hasPasskey, setHasPasskey] = useState(false)

  // =========================================================================
  // Initialize wallet state on mount
  // =========================================================================

  useEffect(() => {
    async function init() {
      try {
        const state = await getWalletInitState()
        setInitState(state)

        if (state === 'unlocked') {
          const addrs = getCurrentAccountAddresses()
          setAddresses(addrs as AccountAddresses)
          setCurrentAccount(getCurrentAccountIndex())
          startAutoLockTimer()
        }

        // Check biometric availability
        const bioEnabled = await isBiometricEnabled()
        setHasPasskey(bioEnabled) // Reuse hasPasskey to indicate biometric is available

        setAuthMethod('password') // Mobile always uses password (biometric is a shortcut)
      } catch (err) {
        console.error('[NativeWallet] Init error:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize')
      } finally {
        setIsInitializing(false)
      }
    }
    init()
  }, [])

  // =========================================================================
  // Helper to refresh addresses after unlock
  // =========================================================================

  const refreshAddresses = useCallback(() => {
    if (isWalletUnlocked()) {
      try {
        const addrs = getCurrentAccountAddresses()
        setAddresses(addrs as AccountAddresses)
        setCurrentAccount(getCurrentAccountIndex())
      } catch (err) {
        console.error('[NativeWallet] refreshAddresses error:', err)
      }
    }
  }, [])

  // =========================================================================
  // Actions
  // =========================================================================

  const createWallet = useCallback(
    async (seedPhrase: string, password: string, label?: string) => {
      try {
        setError(null)
        await coreCreateWallet(seedPhrase, password, label)
        setInitState('unlocked')
        refreshAddresses()
        startAutoLockTimer()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create wallet'
        setError(message)
        throw err
      }
    },
    [refreshAddresses]
  )

  const createWalletWithPasskey = useCallback(
    async (_seedPhrase: string, _label?: string) => {
      // Mobile doesn't support WebAuthn passkeys — use biometric instead
      throw new Error(
        'Passkey creation not supported on mobile. Use password + biometric.'
      )
    },
    []
  )

  const importWalletAction = useCallback(
    async (seedPhrase: string, password: string, label?: string) => {
      try {
        setError(null)
        await coreImportWallet(seedPhrase, password, label)
        setInitState('unlocked')
        refreshAddresses()
        startAutoLockTimer()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to import wallet'
        setError(message)
        throw err
      }
    },
    [refreshAddresses]
  )

  const unlock = useCallback(
    async (password: string) => {
      try {
        setError(null)
        await coreUnlockWallet(password)
        setInitState('unlocked')
        refreshAddresses()
        startAutoLockTimer()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to unlock wallet'
        setError(message)
        throw err
      }
    },
    [refreshAddresses]
  )

  const unlockWithPasskey = useCallback(async () => {
    try {
      setError(null)
      await coreUnlockWithBiometric()
      setInitState('unlocked')
      refreshAddresses()
      startAutoLockTimer()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Biometric authentication failed'
      setError(message)
      throw err
    }
  }, [refreshAddresses])

  const lock = useCallback(() => {
    coreLockWallet()
    setInitState('locked')
    setAddresses(null)
    setCurrentAccount(0)
  }, [])

  const reset = useCallback(async () => {
    try {
      setError(null)
      await destroyWallet()
      setInitState('uninitialized')
      setAddresses(null)
      setCurrentAccount(0)
      setHasPasskey(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reset wallet'
      setError(message)
      throw err
    }
  }, [])

  const exportSeedPhraseAction = useCallback(async (password?: string) => {
    if (!password) {
      throw new Error('Password required to export seed phrase')
    }
    return coreExportSeedPhrase(password)
  }, [])

  const switchAccountAction = useCallback(async (accountIndex: number) => {
    try {
      setError(null)
      await coreSwitchAccount(accountIndex)
      refreshAddresses()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to switch account'
      setError(message)
      throw err
    }
  }, [refreshAddresses])

  const startSync = useCallback(async () => {
    // Penumbra sync is managed by the WebView bridge (Task 19)
    // This is a no-op until the bridge is integrated
  }, [])

  const stopSync = useCallback(() => {
    // Penumbra sync is managed by the WebView bridge (Task 19)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const getEVMAddressForIndex = useCallback(
    async (accountIndex: number): Promise<EVMAddressInfo | null> => {
      return getEVMAddressForAccountIndex(accountIndex)
    },
    []
  )

  // =========================================================================
  // Context Value
  // =========================================================================

  const value = useMemo<WalletContextType>(
    () => ({
      // State
      initState,
      isInitializing,
      currentAccount,
      addresses,
      fullViewingKey: null, // Set by WebView bridge
      walletId: null, // Set by WebView bridge
      isSyncing: false, // Managed by WebView bridge
      syncProgress: null, // Managed by WebView bridge
      error,
      authMethod,
      hasPasskey,

      // Actions
      createWallet,
      createWalletWithPasskey,
      importWallet: importWalletAction,
      unlock,
      unlockWithPasskey,
      lock,
      reset,
      exportSeedPhrase: exportSeedPhraseAction,
      switchAccount: switchAccountAction,
      startSync,
      stopSync,
      clearError,
      signMessage,
      signTypedData,
      signTransaction,
      getEVMAddressForIndex,

      // No-op
      resetCacheAndResync: async () => {},
    }),
    [
      initState,
      isInitializing,
      currentAccount,
      addresses,
      error,
      authMethod,
      hasPasskey,
      createWallet,
      createWalletWithPasskey,
      importWalletAction,
      unlock,
      unlockWithPasskey,
      lock,
      reset,
      exportSeedPhraseAction,
      switchAccountAction,
      startSync,
      stopSync,
      clearError,
      getEVMAddressForIndex,
    ]
  )

  return React.createElement(
    NativeWalletContext.Provider,
    { value },
    children
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access the native wallet context.
 * Must be used within a NativeWalletProvider.
 */
export function useNativeWallet(): WalletContextType {
  const context = useContext(NativeWalletContext)
  if (!context) {
    throw new Error('useNativeWallet must be used within NativeWalletProvider')
  }
  return context
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { generateNewMnemonic, validateMnemonic, getEVMAccount } from './evm-keys'
export { isBiometricAvailable, getBiometricType } from './biometric'
export {
  enableBiometric as coreEnableBiometric,
  disableBiometric as coreDisableBiometric,
} from './wallet'
