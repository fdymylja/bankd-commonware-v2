'use client'

// src/lib/native-wallet/core/context.tsx
/**
 * Unified wallet React context.
 * Provides access to both EVM and Penumbra addresses from a single wallet.
 */

import { useQueryClient } from '@tanstack/react-query'
import React, {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { penumbraConfig } from '@/lib/config'
import { startPackageUploads } from '@/lib/audit-demo/outbox'

import type {
  AccountAddresses,
  AuthMethod,
  SyncProgress,
  WalletContextType,
  WalletInitState,
} from './types'
import {
  createWallet as createWalletCore,
  createWalletWithPasskey as createWalletWithPasskeyCore,
  destroyWallet,
  exportSeedPhrase as exportSeedPhraseCore,
  getCurrentAccountAddresses,
  getCurrentAccountIndex,
  getFullViewingKey,
  getWalletAuthMethod,
  getWalletId,
  getWalletInitState,
  hasPasskeyAuth,
  isWalletUnlocked,
  lockWallet as lockWalletCore,
  replaceWallet as replaceWalletCore,
  signMessage as signMessageCore,
  signTransaction as signTransactionCore,
  signTypedData as signTypedDataCore,
  switchAccount as switchAccountCore,
  tryAutoUnlock,
  unlockWallet as unlockWalletCore,
  unlockWithPasskey as unlockWithPasskeyCore,
} from './wallet'

// =============================================================================
// Context
// =============================================================================

const WalletContext = createContext<WalletContextType | null>(null)

// =============================================================================
// Provider
// =============================================================================

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ORBIS_AUDIT_DEMO === 'true') return startPackageUploads()
  }, [])

  // State
  const [initState, setInitState] = useState<WalletInitState>('uninitialized')
  const [currentAccount, setCurrentAccount] = useState(0)
  const [addresses, setAddresses] = useState<AccountAddresses | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null)
  const [hasPasskey, setHasPasskey] = useState(false)

  // Sync controller ref
  const syncControllerRef = useRef<{
    start: () => Promise<void>
    stop: () => void
    stopAndWait: () => Promise<void>
  } | null>(null)
  const isResettingRef = useRef(false)

  // =============================================================================
  // State Updates
  // =============================================================================

  const updateUnlockedState = useCallback(async () => {
    try {
      const accountIndex = getCurrentAccountIndex()
      const addrs = await getCurrentAccountAddresses()
      setAddresses(addrs)
      setCurrentAccount(accountIndex)
    } catch (err) {
      console.error('[Wallet] Failed to get addresses:', err)
      setError(err instanceof Error ? err.message : 'Failed to get wallet state')
    }
  }, [])

  const clearUnlockedState = useCallback(() => {
    setAddresses(null)
  }, [])

  // =============================================================================
  // Initialization
  // =============================================================================

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        const state = await getWalletInitState()

        if (!mounted) return

        // Load auth method info
        if (state !== 'uninitialized') {
          const [method, passkey] = await Promise.all([
            getWalletAuthMethod(),
            hasPasskeyAuth(),
          ])
          if (mounted) {
            setAuthMethod(method)
            setHasPasskey(passkey)
          }
        }

        if (state === 'locked') {
          const autoUnlocked = await tryAutoUnlock()
          if (autoUnlocked && mounted) {
            await updateUnlockedState()
            setInitState('unlocked')
            setIsInitializing(false)
            return
          }
        }

        if (state === 'unlocked' && mounted) {
          await updateUnlockedState()
        }

        setInitState(state)
      } catch (err) {
        if (mounted) {
          console.error('[Wallet] Initialization error:', err)
          setError(err instanceof Error ? err.message : 'Failed to initialize wallet')
        }
      } finally {
        if (mounted) {
          setIsInitializing(false)
        }
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [updateUnlockedState])

  // =============================================================================
  // Wallet Actions
  // =============================================================================

  const createWallet = useCallback(
    async (seedPhrase: string, password: string, label?: string) => {
      try {
        setError(null)
        await createWalletCore(seedPhrase, password, label)
        setAuthMethod('password')
        setHasPasskey(false)
        await updateUnlockedState()
        setInitState('unlocked')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create wallet'
        setError(message)
        throw err
      }
    },
    [updateUnlockedState]
  )

  const createWalletWithPasskey = useCallback(
    async (seedPhrase: string, label?: string) => {
      try {
        setError(null)
        await createWalletWithPasskeyCore(seedPhrase, label)
        setAuthMethod('passkey')
        setHasPasskey(true)
        await updateUnlockedState()
        setInitState('unlocked')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create wallet with passkey'
        setError(message)
        throw err
      }
    },
    [updateUnlockedState]
  )

  const importWallet = useCallback(
    async (seedPhrase: string, password: string, label?: string) => {
      try {
        setError(null)
        // replaceWallet swaps out any existing single-seed custody, so importing
        // acc0 then acc1 works without a manual reset. Multisig data (and any
        // collected signatures) lives in a separate DB and is untouched.
        await replaceWalletCore(seedPhrase, password, label)
        await updateUnlockedState()
        setInitState('unlocked')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to import wallet'
        setError(message)
        throw err
      }
    },
    [updateUnlockedState]
  )

  const unlock = useCallback(
    async (password: string) => {
      try {
        setError(null)
        await unlockWalletCore(password)
        await updateUnlockedState()
        setInitState('unlocked')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid password'
        setError(message)
        throw err
      }
    },
    [updateUnlockedState]
  )

  const unlockWithPasskey = useCallback(
    async () => {
      try {
        setError(null)
        await unlockWithPasskeyCore()
        await updateUnlockedState()
        setInitState('unlocked')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Passkey authentication failed'
        setError(message)
        throw err
      }
    },
    [updateUnlockedState]
  )

  const lock = useCallback(() => {
    syncControllerRef.current?.stop()
    setIsSyncing(false)
    setSyncProgress(null)

    lockWalletCore()
    clearUnlockedState()
    setInitState('locked')
  }, [clearUnlockedState])

  const reset = useCallback(async () => {
    // Stop sync and clear state
    lock()
    
    // Small delay to ensure all DB operations complete
    await new Promise(resolve => setTimeout(resolve, 200))
    
    await destroyWallet()
    
    // Reload page to ensure clean state
    window.location.reload()
  }, [lock])

  const exportSeedPhrase = useCallback(async (password?: string) => {
    try {
      return await exportSeedPhraseCore(password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export seed phrase'
      setError(message)
      throw err
    }
  }, [])

  const switchAccount = useCallback(async (accountIndex: number) => {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked')
    }

    try {
      await switchAccountCore(accountIndex)
      await updateUnlockedState()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch account'
      setError(message)
      throw err
    }
  }, [updateUnlockedState])

  // =============================================================================
  // Penumbra Sync
  // =============================================================================

  const startSync = useCallback(async (force = false) => {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked')
    }

    if (isSyncing && !force) {
      return
    }

    try {
      const fvk = getFullViewingKey()
      const { createViewServerSyncController } = await import('../penumbra/services/view-server-sync')

      if (syncControllerRef.current) {
        // Wait for the old loop to fully exit — a fire-and-forget stop lets its
        // in-flight flush interleave with (and corrupt) the new sync's state.
        await syncControllerRef.current.stopAndWait()
        syncControllerRef.current = null
      }

      syncControllerRef.current = createViewServerSyncController({
        fullViewingKey: fvk,
        grpcUrl: penumbraConfig.grpcUrl,
        chainId: penumbraConfig.chainId,
        onProgress: (current, target) => {
          const percentage = target > 0 ? Math.floor((current / target) * 100) : 0
          setSyncProgress({ current: BigInt(current), target: BigInt(target), percentage })
        },
        onNotesFound: (count, height) => {
          console.log(`[Wallet] Found ${count} notes at height ${height}`)
          // Immediately refresh balances when new notes are discovered
          queryClient.invalidateQueries({ queryKey: ['penumbra', 'balances'] })
        },
        onError: (err) => {
          console.error('[Wallet] Sync error:', err)
          setError(`Sync error: ${err.message}`)
          setIsSyncing(false)
        },
      })

      setIsSyncing(true)
      syncControllerRef.current.start()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start sync'
      setError(message)
      setIsSyncing(false)
      throw err
    }
  }, [isSyncing])

  const stopSync = useCallback(() => {
    if (syncControllerRef.current) {
      syncControllerRef.current.stop()
      syncControllerRef.current = null
    }
    setIsSyncing(false)
  }, [])

  const resetCacheAndResync = useCallback(async () => {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked')
    }

    isResettingRef.current = true
    try {
      // Fully stop the running sync loop BEFORE clearing tables. Otherwise its
      // in-flight iteration flushes a stale tree fragment + sync height into
      // the freshly cleared DB, and the next sync resumes from a height the
      // stored tree never reached — a permanently invalid SCT root.
      const controller = syncControllerRef.current
      stopSync()
      if (controller) {
        await controller.stopAndWait()
      }
      setSyncProgress(null)
      setError(null)

      const { resetNativeWalletSyncState } = await import('../penumbra/services/diagnostics')
      await resetNativeWalletSyncState()

      queryClient.invalidateQueries({ queryKey: ['penumbra'] })
      queryClient.invalidateQueries({ queryKey: ['privateTransferJobs'] })

      await startSync(true)
    } finally {
      isResettingRef.current = false
    }
  }, [queryClient, startSync, stopSync])

  // Auto-start sync when wallet unlocks. Must not fire mid-reset: stopSync
  // flips isSyncing to false before the tables are cleared, and a sync started
  // in that window scans from the about-to-be-cleared state.
  useEffect(() => {
    if (
      initState === 'unlocked' &&
      !isSyncing &&
      !isInitializing &&
      !isResettingRef.current
    ) {
      startSync()
    }
  }, [initState, isSyncing, isInitializing, startSync])

  // =============================================================================
  // EVM Signing
  // =============================================================================

  const signMessage = useCallback(async (message: string) => {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked')
    }
    return signMessageCore(message)
  }, [])

  const signTypedData = useCallback(async (typedData: any) => {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked')
    }
    return signTypedDataCore(typedData)
  }, [])

  const signTransaction = useCallback(async (transaction: any) => {
    if (!isWalletUnlocked()) {
      throw new Error('Wallet is locked')
    }
    return signTransactionCore(transaction)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const getEVMAddressForIndex = useCallback(async (accountIndex: number) => {
    if (!isWalletUnlocked()) {
      return null
    }
    const { getEVMAddressForAccountIndex } = await import('../evm/keys')
    return getEVMAddressForAccountIndex(accountIndex)
  }, [])

  // =============================================================================
  // Context Value
  // =============================================================================

  const contextValue: WalletContextType = {
    // State
    initState,
    isInitializing,
    currentAccount,
    addresses,
    fullViewingKey: isWalletUnlocked() ? getFullViewingKey() : null,
    walletId: isWalletUnlocked() ? getWalletId() : null,
    isSyncing,
    syncProgress,
    error,
    authMethod,
    hasPasskey,

    // Actions
    createWallet,
    createWalletWithPasskey,
    importWallet,
    unlock,
    unlockWithPasskey,
    lock,
    reset,
    resetCacheAndResync,
    exportSeedPhrase,
    switchAccount,
    startSync,
    stopSync,
    clearError,

    // EVM signing
    signMessage,
    signTypedData,
    signTransaction,

    // Address helpers
    getEVMAddressForIndex,
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the unified native wallet context.
 */
export function useNativeWallet(): WalletContextType {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useNativeWallet must be used within WalletProvider')
  }
  return context
}

/**
 * Hook to optionally access native wallet context.
 */
export function useNativeWalletOptional(): WalletContextType | null {
  return useContext(WalletContext)
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook to get just the EVM address info from native wallet.
 */
export function useNativeEVMAddress() {
  const { addresses, initState } = useNativeWallet()
  return {
    isConnected: initState === 'unlocked' && addresses !== null,
    address: addresses?.evm.hex ?? null,
    bech32Address: addresses?.evm.bech32 ?? null,
  }
}

/**
 * Hook to get just the Penumbra address info from native wallet.
 */
export function useNativePenumbraAddress() {
  const { addresses, initState, fullViewingKey } = useNativeWallet()
  return {
    isConnected: initState === 'unlocked' && addresses !== null,
    address: addresses?.penumbra.bech32 ?? null,
    transparentAddress: addresses?.penumbraTransparent ?? null,
    fullViewingKey,
  }
}
