'use client'

import { MOCK_ERC20_ABI } from '@bankd/shared/evm/mockERC20'
import { getIBCChannelMap } from '@bankd/shared/ibc/relay-tracker'
import { BalancesResponse } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'
import { useQuery } from '@tanstack/react-query'
import { readContract } from '@wagmi/core'
import { useMemo } from 'react'
import { Hex, bytesToHex } from 'viem'


import { chainConfig, penumbraConfig } from '@/lib/config'
import { makeWagmiConfig } from '@/lib/evm'
import { type IBCDenomRecord, createLocalViewService, getIBCDenomsMap, useNativeWallet } from '@/lib/native-wallet'

export interface PenumbraBalance {
  assetId: string
  symbol: string
  name: string
  display: string
  baseDenom: string // The raw base denom (e.g., "transfer/channel-0/erc20:0x...")
  amount: string
  amountFormatted: string
  decimals: number
  addressIndex?: number
  isIBC: boolean
  erc20Address?: Hex
  sourceChannel?: string
  destinationChannel?: string
}

/** Raw balance data before metadata enrichment */
interface RawPenumbraBalance {
  assetId: string
  amount: bigint
  addressIndex?: number
  // Known asset data
  isKnownAsset: boolean
  knownSymbol?: string
  knownName?: string
  knownDisplay?: string
  knownBaseDenom?: string
  knownDecimals?: number
}

// Convert hi/lo Amount to bigint
function amountToBigInt(amount: { lo: bigint; hi: bigint }): bigint {
  return (amount.hi << 64n) + amount.lo
}

// Format amount with decimals
function formatAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) {
    return amount.toString()
  }
  const str = amount.toString().padStart(decimals + 1, '0')
  const intPart = str.slice(0, -decimals) || '0'
  const decPart = str.slice(-decimals)
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = decPart.replace(/0+$/, '').padEnd(2, '0')
  return `${intPart}.${trimmed}`
}

/**
 * Extract raw balance data from a BalancesResponse without applying metadata.
 * Handles both new format (balanceView/accountAddress) and deprecated format (balance/account).
 */
export function extractRawBalance(
  balanceResponse: BalancesResponse
): RawPenumbraBalance | null {
  try {
    let amount: bigint
    let assetIdBytes: Uint8Array | undefined
    let addressIndex: number | undefined
    let isKnownAsset = false
    let metadata: { base?: string; symbol?: string; display?: string; denomUnits?: Array<{ exponent?: number }> } | undefined

    // Try new format first (balanceView)
    const valueView = balanceResponse.balanceView?.valueView
    if (valueView?.value) {
      const value = valueView.value
      
      if ('amount' in value && value.amount) {
        amount = amountToBigInt({ lo: value.amount.lo ?? 0n, hi: value.amount.hi ?? 0n })
      } else {
        return null
      }

      isKnownAsset = valueView.case === 'knownAssetId'
      
      if (isKnownAsset && 'metadata' in value) {
        // For knownAssetId, asset ID is inside metadata.shielddAssetId. Reading
        // the old penumbraAssetId name here returned undefined, and the
        // !assetIdBytes guard below then dropped every asset the chain has
        // metadata for: notes kept landing while the balance read 0.
        metadata = value.metadata
        assetIdBytes = value.metadata?.shielddAssetId?.inner
      } else if ('assetId' in value && value.assetId?.inner) {
        // For unknownAssetId, asset ID is directly in the value
        assetIdBytes = value.assetId.inner
      }

      // Get address index from new format
      const addrView = balanceResponse.accountAddress?.addressView
      if (addrView?.case === 'decoded' && addrView.value?.index) {
        addressIndex = addrView.value.index.account
      }
    }
    // Fall back to deprecated format (balance/account)
    else if (balanceResponse.balance) {
      const balance = balanceResponse.balance
      
      if (balance.amount) {
        amount = amountToBigInt({ lo: balance.amount.lo ?? 0n, hi: balance.amount.hi ?? 0n })
      } else {
        return null
      }

      if (balance.assetId?.inner) {
        assetIdBytes = balance.assetId.inner
      }

      // Get address index from deprecated format
      addressIndex = balanceResponse.account?.account
      
      // Deprecated format doesn't include metadata
      isKnownAsset = false
    } else {
      console.warn('No balance data in response')
      return null
    }

    if (!amount! || !assetIdBytes) {
      return null
    }

    const assetIdHex = bytesToHex(assetIdBytes)
    const baseDenom = metadata?.base || ''

    if (isKnownAsset && metadata) {
      // The chain registers the native denom with an empty symbol and a single
      // exponent-0 unit, so it would come back as "ubrl" with 0 decimals. That
      // is the same asset as the public native balance, and /assets groups rows
      // by symbol, so leaving it as ubrl splits one asset across two rows.
      const isNative = metadata.base === chainConfig.denom
      const displayDenom = isNative
        ? chainConfig.displayDenom
        : metadata.symbol || metadata.display || metadata.base || 'Unknown'
      const displayUnit = metadata.denomUnits?.find(u => u.exponent && u.exponent > 0)
      const decimals = isNative ? chainConfig.decimals : displayUnit?.exponent ?? 6

      return {
        assetId: assetIdHex,
        amount: amount!,
        addressIndex,
        isKnownAsset: true,
        knownName: displayDenom,
        knownSymbol: displayDenom,
        knownDisplay: displayDenom,
        knownBaseDenom: baseDenom || displayDenom,
        knownDecimals: decimals,
      }
    } else {
      return {
        assetId: assetIdHex,
        amount: amount!,
        addressIndex,
        isKnownAsset: false,
        knownBaseDenom: baseDenom || undefined,
      }
    }
  } catch (error) {
    console.error('Error extracting raw balance:', error)
    return null
  }
}

// =============================================================================
// ERC20 on-chain metadata resolution
// =============================================================================

type ERC20Meta = { symbol: string; name: string; decimals: number }

/** In-memory cache so we don't re-fetch across renders before RQ kicks in */
const erc20MetaCache = new Map<string, ERC20Meta>()

async function fetchERC20Meta(address: Hex): Promise<ERC20Meta> {
  const cached = erc20MetaCache.get(address.toLowerCase())
  if (cached) return cached

  const wagmiConfig = makeWagmiConfig()
  const [symbol, name, decimals] = await Promise.all([
    readContract(wagmiConfig, { address, abi: MOCK_ERC20_ABI, functionName: 'symbol' }),
    readContract(wagmiConfig, { address, abi: MOCK_ERC20_ABI, functionName: 'name' }),
    readContract(wagmiConfig, { address, abi: MOCK_ERC20_ABI, functionName: 'decimals' }),
  ])
  const meta = { symbol: symbol as string, name: name as string, decimals: Number(decimals) }
  erc20MetaCache.set(address.toLowerCase(), meta)
  return meta
}

/**
 * Extract ERC20 address from a base denom string like
 * "transfer/channel-0/erc20:0xABC..."
 */
function extractERC20Address(baseDenom: string): Hex | undefined {
  const parts = baseDenom.split('/')
  const underlying = parts[parts.length - 1]
  if (underlying?.startsWith('erc20:')) {
    return underlying.slice(6) as Hex
  }
  return undefined
}

/**
 * Collect all unique ERC20 addresses from raw balances that aren't already
 * resolved by the IBC denoms table.
 */
function collectUnresolvedERC20Addresses(
  rawBalances: RawPenumbraBalance[],
  ibcDenoms: Map<string, IBCDenomRecord>,
): Hex[] {
  const addrs = new Set<string>()
  for (const raw of rawBalances) {
    // Skip if IBC denoms already has metadata for this asset
    if (ibcDenoms.has(raw.assetId)) continue

    const baseDenom = raw.knownBaseDenom || ''
    const addr = extractERC20Address(baseDenom)
    if (addr) addrs.add(addr.toLowerCase())
  }
  return [...addrs] as Hex[]
}

/**
 * Hook to fetch and cache ERC20 metadata for a set of contract addresses.
 * Metadata is fetched on-chain and cached permanently (contract metadata is immutable).
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

/**
 * Apply IBC denoms metadata and on-chain ERC20 metadata to raw balances.
 */
function applyMetadataToBalances(
  rawBalances: RawPenumbraBalance[],
  ibcDenoms: Map<string, IBCDenomRecord>,
  erc20Meta: Map<string, ERC20Meta>,
  /** Penumbra channel → Bankd channel mapping */
  channelMap?: Map<string, string>,
): PenumbraBalance[] {
  const balances: PenumbraBalance[] = []

  for (const raw of rawBalances) {
    const ibcMetadata = ibcDenoms.get(raw.assetId)

    if (ibcMetadata) {
      // Have IBC metadata from block processor
      balances.push({
        assetId: raw.assetId,
        name: ibcMetadata.name,
        symbol: ibcMetadata.symbol,
        display: ibcMetadata.symbol,
        baseDenom: ibcMetadata.baseDenom,
        amount: raw.amount.toString(),
        amountFormatted: formatAmount(raw.amount, ibcMetadata.decimals),
        decimals: ibcMetadata.decimals,
        addressIndex: raw.addressIndex,
        isIBC: true,
        erc20Address: ibcMetadata.erc20Address as Hex | undefined,
        sourceChannel: ibcMetadata.sourceChannel,
        destinationChannel: ibcMetadata.destinationChannel,
      })
    } else {
      const baseDenom = raw.knownBaseDenom || raw.assetId
      const isIBC = baseDenom.startsWith('transfer/')
      const erc20Address = extractERC20Address(baseDenom)

      // Try on-chain ERC20 metadata
      const onChainMeta = erc20Address
        ? erc20Meta.get(erc20Address.toLowerCase())
        : undefined

      if (onChainMeta) {
        // Resolved ERC20 token via on-chain query
        const parts = baseDenom.split('/')
        const sourceChannel = parts.length >= 2 ? parts[1] : undefined

        balances.push({
          assetId: raw.assetId,
          name: onChainMeta.name,
          symbol: onChainMeta.symbol,
          display: onChainMeta.symbol,
          baseDenom,
          amount: raw.amount.toString(),
          amountFormatted: formatAmount(raw.amount, onChainMeta.decimals),
          decimals: onChainMeta.decimals,
          addressIndex: raw.addressIndex,
          isIBC,
          erc20Address,
          sourceChannel,
          destinationChannel: sourceChannel ? channelMap?.get(sourceChannel) : undefined,
        })
      } else {
        // Fallback: parse what we can from the denom string
        let symbol = raw.knownSymbol || 'Unknown'
        let name = raw.knownName || 'Unknown'
        let decimals = raw.knownDecimals ?? 0
        const parts = baseDenom.split('/')
        const sourceChannel = isIBC && parts.length >= 2 ? parts[1] : undefined

        // For IBC native denoms like transfer/channel-0/ubrl, parse the symbol
        if (isIBC && !erc20Address) {
          const denomPart = parts[parts.length - 1]
          if (denomPart) {
            symbol = denomPart.startsWith('u')
              ? denomPart.slice(1).toUpperCase()
              : denomPart.toUpperCase()
            name = symbol
            decimals = 6
          }
        }

        // For unresolved ERC20s, show truncated address
        if (erc20Address) {
          symbol = erc20Address.slice(0, 8) + '...'
          name = `ERC20 ${erc20Address}`
        }

        balances.push({
          assetId: raw.assetId,
          name,
          symbol,
          display: symbol !== 'Unknown' ? symbol : raw.assetId.slice(0, 16) + '...',
          baseDenom,
          amount: raw.amount.toString(),
          amountFormatted: formatAmount(raw.amount, decimals),
          decimals,
          addressIndex: raw.addressIndex,
          isIBC,
          erc20Address,
          sourceChannel,
          destinationChannel: sourceChannel ? channelMap?.get(sourceChannel) : undefined,
        })
      }
    }
  }

  return balances
}

export function usePenumbraBalances() {
  const { initState, fullViewingKey } = useNativeWallet()

  const isConnected = initState === 'unlocked' && !!fullViewingKey

  // Fetch raw balances using native wallet's view service
  const rawBalancesQuery = useQuery({
    queryKey: ['penumbra', 'balances', 'raw', isConnected],
    queryFn: async (): Promise<RawPenumbraBalance[]> => {
      if (!fullViewingKey) {
        throw new Error('Wallet not unlocked')
      }

      const viewService = createLocalViewService({
        fvk: fullViewingKey,
        grpcUrl: penumbraConfig.grpcUrl,
        chainId: penumbraConfig.chainId,
      })

      const { BalancesRequest } = await import('@mizufinance/protobuf/shieldd/view/v1/view_pb')
      const balances: RawPenumbraBalance[] = []

      // The balances method returns a streaming response
      for await (const response of viewService.balances(new BalancesRequest())) {
        const result = extractRawBalance(response)
        if (result && result.amount > 0n) {
          balances.push(result)
        }
      }

      return balances
    },
    enabled: isConnected,
    staleTime: 5_000, // 5 seconds
    refetchInterval: 5_000, // Refresh every 5 seconds
  })

  // Fetch IBC denoms from IndexedDB
  const ibcDenomsQuery = useQuery({
    queryKey: ['penumbra', 'ibcDenoms'],
    queryFn: async () => {
      return getIBCDenomsMap()
    },
    enabled: isConnected,
    staleTime: 2_000,
    refetchInterval: 5_000,
  })

  // Collect ERC20 addresses that need on-chain metadata resolution
  const erc20Addresses = useMemo(() => {
    if (!rawBalancesQuery.data) return []
    const ibcDenoms = ibcDenomsQuery.data ?? new Map()
    return collectUnresolvedERC20Addresses(rawBalancesQuery.data, ibcDenoms)
  }, [rawBalancesQuery.data, ibcDenomsQuery.data])

  // Fetch on-chain ERC20 metadata for all discovered addresses
  const { data: erc20Meta } = useERC20Metadata(erc20Addresses)

  // Fetch IBC channel map (Penumbra channel → Bankd channel) for balances
  // that don't have destinationChannel from the block processor
  const channelMapQuery = useQuery({
    queryKey: ['ibc', 'penumbraToBankdMap'],
    queryFn: async () => {
      const { penumbraToBankd } = await getIBCChannelMap()
      return penumbraToBankd
    },
    enabled: isConnected,
    staleTime: 60_000, // Channels rarely change
  })

  const balances = useMemo(() => {
    if (!rawBalancesQuery.data) return []
    const ibcDenoms = ibcDenomsQuery.data ?? new Map()
    return applyMetadataToBalances(
      rawBalancesQuery.data,
      ibcDenoms,
      erc20Meta ?? new Map(),
      channelMapQuery.data,
    )
  }, [rawBalancesQuery.data, ibcDenomsQuery.data, erc20Meta, channelMapQuery.data])

  return {
    ...rawBalancesQuery,
    data: balances,
    isLoading: rawBalancesQuery.isLoading || ibcDenomsQuery.isLoading,
  }
}
