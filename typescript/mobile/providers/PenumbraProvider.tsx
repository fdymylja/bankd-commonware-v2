/**
 * PenumbraProvider — Manages the hidden Penumbra WebView bridge.
 *
 * Renders a hidden <PenumbraWebView /> and automatically initializes
 * the bridge + starts syncing when the wallet is unlocked.
 *
 * Provides the WebView bridge state to children via context.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { chainConfig, penumbraConfig } from '@bankd/shared'
import type { EphemeralAddressRecord, OwnPenumbraAddressInfo } from '@bankd/shared/penumbra'
import {
  createEphemeralAddressRecord,
  type ExternalAddressPurpose,
} from '@bankd/shared/penumbra'

import { ephemeralAddressRegistryQueryKey } from '@/hooks/useEphemeralAddressRecords'
import { useNativeWallet } from '@/lib/native-wallet'
import { getMnemonicForBridge } from '@/lib/native-wallet/wallet'
import {
  savePenumbraFVK,
  getPenumbraFVK,
  saveEphemeralAddressRecord,
} from '@/lib/native-wallet/storage'
import {
  PenumbraWebView,
  usePenumbraWebView,
  type PenumbraWebViewState,
} from '@/lib/penumbra-webview'
import type { PenumbraWebViewHandle } from '@/lib/penumbra-webview/PenumbraWebView'

// =============================================================================
// Context
// =============================================================================

export interface GenerateEphemeralAddressInput {
  accountIndex?: number
  purpose: ExternalAddressPurpose
  sourceChannel?: string
  destinationChannel?: string
  relatedKind?: EphemeralAddressRecord['relatedKind']
  relatedId?: string
  label?: string
}

export interface PenumbraBridgeContext extends PenumbraWebViewState {
  penumbraAddress: string | null
  /** Clear all Penumbra data and resync from scratch. */
  resetAndResync: () => Promise<void>
  /** Generate a new ephemeral address, create a registry record, persist it, and return it. */
  generateEphemeralAddressRecord: (input: GenerateEphemeralAddressInput) => Promise<EphemeralAddressRecord>
  /**
   * Check if a Penumbra address belongs to this wallet.
   * Uses WASM-level `getAddressIndexByAddress` via the WebView bridge.
   */
  getOwnAddressInfo: (address: string) => Promise<OwnPenumbraAddressInfo>
}

const PenumbraContext = createContext<PenumbraBridgeContext | null>(null)

/**
 * Hook to access the Penumbra WebView bridge state.
 * Must be used within a PenumbraProvider.
 */
export function usePenumbraBridge(): PenumbraBridgeContext {
  const ctx = useContext(PenumbraContext)
  if (!ctx) {
    throw new Error('usePenumbraBridge must be used within PenumbraProvider')
  }
  return ctx
}

// =============================================================================
// Provider
// =============================================================================

interface PenumbraProviderProps {
  children: React.ReactNode
}

export function PenumbraProvider({ children }: PenumbraProviderProps) {
  const bridge = usePenumbraWebView()
  const wallet = useNativeWallet()
  const initAttempted = useRef(false)
  const [penumbraAddress, setPenumbraAddress] = useState<string | null>(null)

  // Auto-initialize when WebView is ready and wallet is unlocked
  useEffect(() => {
    if (
      bridge.isReady &&
      !bridge.isInitialized &&
      !initAttempted.current &&
      wallet.initState === 'unlocked'
    ) {
      initAttempted.current = true

      const doInit = async () => {
        try {
          let fvkBase64 = ''
          let spendKeyBase64 = ''

          // Check if we have a stored FVK
          const storedFVK = await getPenumbraFVK()
          if (storedFVK) {
            console.log('[Penumbra] Using stored FVK, deriving spend key...')
            fvkBase64 = storedFVK
            // Still need spend key for transactions — derive from mnemonic
            const mnemonic = await getMnemonicForBridge()
            if (mnemonic) {
              const keys = await bridge.deriveKeys(mnemonic)
              spendKeyBase64 = keys.spendKey
            }
          } else {
            // Derive keys from mnemonic via WebView WASM
            console.log('[Penumbra] Deriving keys via WebView WASM...')
            const mnemonic = await getMnemonicForBridge()
            if (!mnemonic) {
              console.warn('[Penumbra] Cannot get mnemonic — skipping init')
              initAttempted.current = false
              return
            }

            const keys = await bridge.deriveKeys(mnemonic)
            fvkBase64 = keys.fvk
            spendKeyBase64 = keys.spendKey

            // Persist FVK for future sessions
            await savePenumbraFVK(fvkBase64)
            console.log('[Penumbra] Keys derived and FVK stored. Address:', keys.address)
          }

          // Initialize the bridge with FVK
          const success = await bridge.init({
            fvk: fvkBase64,
            spendKey: spendKeyBase64,
            grpcUrl: chainConfig.grpcWeb,
            rpcUrl: chainConfig.rpc,
            proverUrl: penumbraConfig.proverUrl,
            chainId: chainConfig.chainId,
          })

          if (success) {
            console.log('[Penumbra] Bridge initialized, starting sync...')
            // Fetch the Penumbra address
            bridge.getAddress(0).then(addr => {
              console.log('[Penumbra] Address:', addr)
              setPenumbraAddress(addr)
            }).catch(console.error)
            bridge.startSync().catch(console.error)
          } else {
            console.error('[Penumbra] Bridge init returned false')
          }
        } catch (err) {
          console.error('[Penumbra] Bridge init failed:', err)
          initAttempted.current = false
        }
      }

      doInit()
    }
  }, [bridge.isReady, bridge.isInitialized, wallet.initState, bridge])

  // Reset init flag when wallet locks or bridge becomes ready (re-trigger init)
  useEffect(() => {
    if (wallet.initState !== 'unlocked') {
      initAttempted.current = false
    }
  }, [wallet.initState])

  const resetAndResync = React.useCallback(async () => {
    console.log('[Penumbra] Clearing data and resyncing...')
    // Clear transaction history built from sync events
    const { clearTransactionHistory } = require('@/hooks/useTransactionHistory')
    await clearTransactionHistory()
    await bridge.clearData()
    // Reset so the auto-init useEffect will re-trigger
    initAttempted.current = false
    setPenumbraAddress(null)
    // The useEffect watching bridge.isInitialized will pick this up
    // and re-derive keys + re-init + restart sync
  }, [bridge])

  const queryClient = useQueryClient()

  const generateEphemeralAddressRecord = React.useCallback(
    async (input: GenerateEphemeralAddressInput): Promise<EphemeralAddressRecord> => {
      const accountIndex = input.accountIndex ?? 0
      const address = await bridge.getEphemeralAddress(accountIndex)
      const record = createEphemeralAddressRecord({
        ...input,
        accountIndex,
        penumbraAddress: address,
      })
      await saveEphemeralAddressRecord(record)
      await queryClient.invalidateQueries({
        queryKey: ephemeralAddressRegistryQueryKey,
      })
      return record
    },
    [bridge, queryClient]
  )

  const contextValue = React.useMemo<PenumbraBridgeContext>(
    () => ({
      ...bridge,
      penumbraAddress,
      resetAndResync,
      generateEphemeralAddressRecord,
    }),
    [bridge, penumbraAddress, resetAndResync, generateEphemeralAddressRecord]
  )

  return (
    <PenumbraContext.Provider value={contextValue}>
      <View style={styles.flex}>
        {children}
        {/* Hidden WebView — inside the flex container with pointerEvents none */}
        {(Platform.OS !== 'web' || !!process.env.EXPO_PUBLIC_AMM_DEMO_URL) && (
          <View style={styles.webViewContainer} pointerEvents="none">
            <PenumbraWebView
              ref={bridge.webViewRef as React.RefObject<PenumbraWebViewHandle>}
              onEvent={bridge.onEvent}
              onError={bridge.onWebViewError}
            />
          </View>
        )}
      </View>
    </PenumbraContext.Provider>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  webViewContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
})
