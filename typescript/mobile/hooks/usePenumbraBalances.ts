/**
 * usePenumbraBalances — Hook for Penumbra privacy chain balances on mobile.
 *
 * Resolves ERC20 token metadata by querying contracts on-chain (cached in
 * React Query). No local token registry needed — symbols are always fresh.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { Hex } from 'viem'

import { chainConfig } from '@bankd/shared'
import { MOCK_ERC20_ABI } from '@bankd/shared/evm/mockERC20'
import { getIBCChannelMap } from '@bankd/shared/ibc/relay-tracker'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import { getPublicClient } from '@/lib/evm/client'
import type { PenumbraBridgeBalance } from '@/lib/penumbra-webview'
import { onNoteActivity } from '@/lib/penumbra-webview/usePenumbraWebView'
import { useDemoConfig } from '../../amm_demo/mobile/data'

// =============================================================================
// Types
// =============================================================================

export type AssetMeta = {
  symbol: string
  name: string
  decimals: number
  baseDenom: string
  erc20Address?: string
}

export interface PenumbraBalance {
  assetId: string
  symbol: string
  name: string
  display: string
  baseDenom: string
  amount: string
  amountFormatted: string
  decimals: number
  addressIndex?: number
  isIBC: boolean
  erc20Address?: Hex
  sourceChannel?: string
  destinationChannel?: string
}

// =============================================================================
// ERC20 on-chain metadata cache (React Query)
// =============================================================================

type ERC20Meta = { symbol: string; name: string; decimals: number }

/** In-memory cache so we don't re-fetch across renders before RQ kicks in */
const erc20MetaCache = new Map<string, ERC20Meta>()

async function fetchERC20Meta(address: Hex): Promise<ERC20Meta> {
  const cached = erc20MetaCache.get(address.toLowerCase())
  if (cached) return cached

  const publicClient = getPublicClient()
  const [symbol, name, decimals] = await Promise.all([
    publicClient.readContract({ address, abi: MOCK_ERC20_ABI, functionName: 'symbol' }),
    publicClient.readContract({ address, abi: MOCK_ERC20_ABI, functionName: 'name' }),
    publicClient.readContract({ address, abi: MOCK_ERC20_ABI, functionName: 'decimals' }),
  ])
  const meta = { symbol: symbol as string, name: name as string, decimals: Number(decimals) }
  erc20MetaCache.set(address.toLowerCase(), meta)
  return meta
}

/**
 * Hook to fetch and cache ERC20 metadata for a set of addresses.
 */
function useERC20Metadata(addresses: Hex[]) {
  return useQuery({
    queryKey: ['erc20meta', ...addresses.map(a => a.toLowerCase()).sort()],
    queryFn: async (): Promise<Map<string, ERC20Meta>> => {
      const result = new Map<string, ERC20Meta>()
      await Promise.all(
        addresses.map(async (addr) => {
          try {
            const meta = await fetchERC20Meta(addr)
            result.set(addr.toLowerCase(), meta)
          } catch (err) {
            console.warn(`[ERC20Meta] Failed to fetch ${addr}:`, err)
          }
        })
      )
      return result
    },
    enabled: addresses.length > 0,
    staleTime: Infinity, // contract metadata never changes
  })
}

// =============================================================================
// Helpers
// =============================================================================

function formatAmountRaw(amount: string, decimals: number): string {
  const value = BigInt(amount)
  const divisor = BigInt(10 ** decimals)
  const wholePart = value / divisor
  const fractionalPart = value % divisor
  if (fractionalPart === 0n) return wholePart.toString()
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  const trimmed = fractionalStr.replace(/0+$/, '')
  return `${wholePart}.${trimmed}`
}

/**
 * Convert a bridge balance to PenumbraBalance. Extracts ERC20 address and
 * base denom from bridge metadata or asset ID lookup. Symbol resolution
 * happens in a second pass using on-chain ERC20 metadata.
 */
function bridgeBalanceToPenumbraBalance(
  b: PenumbraBridgeBalance,
  assetIdLookup: Map<string, AssetMeta>,
  erc20Meta: Map<string, ERC20Meta>,
  penumbraToBankdChannels: Map<string, string>,
): PenumbraBalance {
  const rawAssetId = b.assetIdHex.startsWith('(base64:')
    ? b.assetIdHex.slice(8, -1)
    : b.assetIdHex
  const localMeta = assetIdLookup.get(rawAssetId)

  const baseDenom = b.metadata?.baseDenom || localMeta?.baseDenom || b.assetIdHex
  let symbol = 'Unknown'
  let name = 'Unknown'
  let decimals = b.metadata?.decimals ?? localMeta?.decimals ?? 6
  let erc20Address: Hex | undefined = localMeta?.erc20Address as Hex | undefined

  const isIBC = baseDenom.startsWith('transfer/')
  let sourceChannel: string | undefined

  if (baseDenom.startsWith('erc20:')) {
    erc20Address = baseDenom.slice(6) as Hex
  } else if (!isIBC && !baseDenom.startsWith('(base64:')) {
    symbol = baseDenom.startsWith('u')
      ? baseDenom.slice(1).toUpperCase()
      : baseDenom.toUpperCase()
    name = symbol
  }

  if (isIBC) {
    const parts = baseDenom.split('/')
    if (parts.length >= 2) sourceChannel = parts[1]

    const denomPart = parts[parts.length - 1]
    if (denomPart?.startsWith('erc20:') && !erc20Address) {
      erc20Address = denomPart.slice(6) as Hex
    }

    // Native denoms: strip "u" prefix, uppercase
    if (denomPart && !denomPart.startsWith('erc20:')) {
      symbol = denomPart.startsWith('u')
        ? denomPart.slice(1).toUpperCase()
        : denomPart.toUpperCase()
      name = symbol
      decimals = 6
    }
  }

  // Resolve ERC20 symbol from on-chain metadata
  if (erc20Address) {
    const meta = erc20Meta.get(erc20Address.toLowerCase())
    if (meta) {
      symbol = meta.symbol
      name = meta.name
      decimals = meta.decimals
    } else {
      // Fallback: truncated address
      symbol = erc20Address.slice(0, 8) + '...'
      name = `ERC20 ${erc20Address}`
    }
  }

  // Resolve the Bankd-side destination channel from the Penumbra source channel
  const destinationChannel = sourceChannel
    ? penumbraToBankdChannels.get(sourceChannel)
    : undefined

  return {
    assetId: b.assetIdHex,
    symbol,
    name,
    display: symbol !== 'Unknown' ? symbol : (erc20Address ? `${erc20Address.slice(0, 8)}...` : b.assetIdHex.slice(0, 16) + '...'),
    baseDenom,
    amount: b.amount,
    amountFormatted: formatAmountRaw(b.amount, decimals),
    decimals,
    addressIndex: b.accountIndex,
    isIBC,
    erc20Address,
    sourceChannel,
    destinationChannel,
  }
}

// =============================================================================
// Hook
// =============================================================================

export function usePenumbraBalances() {
  const { data: ammDemo } = useDemoConfig()
  const bridge = usePenumbraBridge()
  const queryClient = useQueryClient()
  const [assetIdLookup, setAssetIdLookup] = useState<Map<string, AssetMeta>>(new Map())

  const isReady = bridge.isInitialized && bridge.syncProgress?.isSynced

  // Build asset ID lookup via bridge WASM for native denom
  useEffect(() => {
    if (!bridge.isInitialized) return

    bridge.computeAssetIds([chainConfig.denom, ...(ammDemo ? [ammDemo.gold.denom] : [])])
      .then((assetIds) => {
        const lookup = new Map<string, AssetMeta>()
        const assetIdBase64 = assetIds[chainConfig.denom]
        if (assetIdBase64) {
          lookup.set(assetIdBase64, {
            symbol: chainConfig.displayDenom,
            name: chainConfig.displayDenom,
            decimals: chainConfig.decimals,
            baseDenom: chainConfig.denom,
          })
        }
        if (ammDemo && assetIds[ammDemo.gold.denom]) {
          lookup.set(assetIds[ammDemo.gold.denom], {
            symbol: 'GOLD', name: 'Gold (demo)', decimals: ammDemo.gold.decimals,
            baseDenom: ammDemo.gold.denom,
          })
        }
        setAssetIdLookup(lookup)
      })
      .catch((err) => console.warn('[usePenumbraBalances] Failed to compute native asset ID:', err))
  }, [bridge.isInitialized, ammDemo?.genesisHash])

  // Refetch balances immediately when new notes arrive
  useEffect(() => {
    const unsub = onNoteActivity((_notes) => {
      queryClient.invalidateQueries({ queryKey: ['penumbra', 'balances', 'mobile'] })
    })
    return unsub
  }, [queryClient])

  // Poll bridge for balances
  const query = useQuery({
    queryKey: ['penumbra', 'balances', 'mobile', isReady],
    queryFn: async (): Promise<PenumbraBridgeBalance[]> => {
      return bridge.getBalances()
    },
    enabled: !!isReady,
    staleTime: 5_000,
    refetchInterval: 10_000,
  })

  const bridgeBalances = bridge.balances
  const rawBalances = (query.data?.length ? query.data : bridgeBalances) ?? []

  // Extract unique ERC20 addresses from raw balances (for on-chain metadata lookup)
  const erc20Addresses = useMemo(() => {
    const addrs = new Set<Hex>()
    for (const b of rawBalances) {
      const baseDenom = b.metadata?.baseDenom || ''
      const parts = baseDenom.split('/')
      const underlying = parts[parts.length - 1]
      if (underlying?.startsWith('erc20:')) {
        const addr = underlying.slice(6) as Hex
        if (addr.toLowerCase() !== chainConfig.nativeErc20Address.toLowerCase()) {
          addrs.add(addr)
        }
      }
    }
    // Also check assetIdLookup for any mapped ERC20 addresses
    for (const meta of assetIdLookup.values()) {
      if (meta.erc20Address) addrs.add(meta.erc20Address as Hex)
    }
    return [...addrs]
  }, [rawBalances, assetIdLookup])

  // Fetch on-chain ERC20 metadata for all discovered addresses
  const { data: erc20Meta } = useERC20Metadata(erc20Addresses)

  // Fetch IBC channel map so we can resolve Penumbra→Bankd destination channels
  const { data: channelMap } = useQuery({
    queryKey: ['ibc', 'channelMap'],
    queryFn: () => getIBCChannelMap(),
    staleTime: 60_000,
  })

  // Convert bridge balances to PenumbraBalance format
  const balances = useMemo(() => {
    return rawBalances
      .map((b) => bridgeBalanceToPenumbraBalance(
        b,
        assetIdLookup,
        erc20Meta ?? new Map(),
        channelMap?.penumbraToBankd ?? new Map(),
      ))
      .filter((b) => b.amount !== '0')
  }, [rawBalances, assetIdLookup, erc20Meta])

  return {
    ...query,
    data: balances,
    assetIdLookup,
  }
}
