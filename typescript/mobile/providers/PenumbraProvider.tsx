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
import { StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { chainConfig } from '@bankd/shared'
import type { EphemeralAddressRecord, OwnPenumbraAddressInfo } from '@bankd/shared/penumbra'
import {
  createEphemeralAddressRecord,
  type ExternalAddressPurpose,
} from '@bankd/shared/penumbra'

import { setTransactionHistoryIdentity } from '@/hooks/useTransactionHistory'
import { useNetworkSettings } from '@/lib/network'
import { ephemeralAddressRegistryQueryKey } from '@/hooks/useEphemeralAddressRecords'
import { useNativeWallet } from '@/lib/native-wallet'
import { getMnemonicForBridge } from '@/lib/native-wallet/wallet'
import {
  savePenumbraFVK,
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
  const queryClient = useQueryClient()
  const initAttempted = useRef(false)
  const [readyEngine, setReadyEngine] = useState<{ key: string } | null>(null)
  const [penumbraAddress, setPenumbraAddress] = useState<string | null>(null)

  const network = useNetworkSettings()
  const walletIdentity = wallet.addresses?.evm.hex ?? ''
  const liveEngine = useRef('')
  const engineKey = `${walletIdentity}:${network.rpcUrl}:${network.proverUrl}`

  liveEngine.current = wallet.initState === 'unlocked' ? engineKey : 'locked'

  // A new WebView destroys the previous wallet's in-memory spend key.
  useEffect(() => {
    initAttempted.current = false
    setReadyEngine(null)
    setPenumbraAddress(null)
    bridge.reload()
    void setTransactionHistoryIdentity(wallet.initState === 'unlocked' ? `${network.rpcUrl}:${walletIdentity}` : 'locked')
    queryClient.removeQueries({ queryKey: ['penumbra'] })
  }, [wallet.initState, engineKey])

  useEffect(() => {
    if (!bridge.isReady || readyEngine?.key !== engineKey || initAttempted.current || wallet.initState !== 'unlocked') return
    initAttempted.current = true
    let cancelled = false
    const initialize = async () => {
      try {
        const mnemonic = await getMnemonicForBridge()
        if (!mnemonic) throw new Error('Unlock the wallet to initialize Shieldd')
        const keys = await bridge.deriveKeys(mnemonic)
        if (cancelled) return
        await savePenumbraFVK(keys.fvk)
        const success = await bridge.init({
          fvk: keys.fvk,
          spendKey: keys.spendKey,
          grpcUrl: network.rpcUrl,
          rpcUrl: network.rpcUrl,
          proverUrl: network.proverUrl,
          chainId: `bankd-${chainConfig.evmChainId}`,
        })
        if (cancelled || !success) return
        setPenumbraAddress(await bridge.getAddress(0))
        await bridge.startSync()
      } catch (error) {
        if (!cancelled) bridge.onWebViewError(error instanceof Error ? error.message : 'Wallet initialization failed')
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [bridge.isReady, readyEngine, wallet.initState, engineKey])

  const resetAndResync = React.useCallback(async () => {
    const { clearTransactionHistory } = require('@/hooks/useTransactionHistory')
    await clearTransactionHistory()
    if (bridge.isInitialized) await bridge.clearData()
    initAttempted.current = false
    setReadyEngine(null)
    setPenumbraAddress(null)
    bridge.reload()
  }, [bridge])

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
      getOwnAddressInfo: bridge.getOwnAddressInfo,
    }),
    [bridge, penumbraAddress, resetAndResync, generateEphemeralAddressRecord]
  )

  return (
    <PenumbraContext.Provider value={contextValue}>
      <View style={styles.flex}>
        {children}
        {/* Hidden WebView — inside the flex container with pointerEvents none */}
        {wallet.initState === 'unlocked' && (
          <View style={styles.webViewContainer} pointerEvents="none">
            <PenumbraWebView
              key={engineKey}
              ref={bridge.webViewRef as React.RefObject<PenumbraWebViewHandle>}
              onEvent={event => {
                if (liveEngine.current !== engineKey) return
                if (event.type === 'ready') {
                  initAttempted.current = false
                  setReadyEngine({ key: engineKey })
                }
                bridge.onEvent(event)
              }}
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
