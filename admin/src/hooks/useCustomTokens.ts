'use client'

import { CustomToken, MOCK_ERC20_ABI } from '@bankd/shared/evm/mockERC20'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBytecode, readContract } from '@wagmi/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Hex, formatUnits } from 'viem'

import { chainConfig } from '@/lib/config'
import {
  addCustomToken,
  loadCustomTokens,
  removeCustomToken,
} from '@/lib/evm/customTokenStorage'
import { makeWagmiConfig } from '@/lib/evm/wagmi'

export interface CustomTokenBalance extends CustomToken {
  balance: bigint
  balanceFormatted: string
  /** Whether the contract exists on-chain (has deployed code) */
  exists: boolean
}

// Fired whenever a hook instance mutates the stored token list, so every
// other mounted useCustomTokens instance (any page/component) resyncs.
const TOKENS_CHANGED_EVENT = 'bankd:custom-tokens-changed'

/**
 * Hook to manage custom ERC20 tokens stored in localStorage
 */
export function useCustomTokens() {
  const [_tokens, setTokens] = useState<CustomToken[]>([])
  // Always include the native token in the list of erc20 tokens
  const tokens = useMemo<CustomToken[]>(
    () => [
      {
        address: chainConfig.nativeErc20Address,
        name: chainConfig.displayDenom,
        symbol: chainConfig.displayDenom,
        decimals: chainConfig.decimals,
      },
      ..._tokens,
    ],
    [_tokens]
  )

  // Load tokens from localStorage on mount and resync when any instance
  // mutates the list (same tab via TOKENS_CHANGED_EVENT, other tabs via
  // the browser's storage event).
  useEffect(() => {
    const sync = () => setTokens(loadCustomTokens())
    sync()
    window.addEventListener(TOKENS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(TOKENS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const addToken = useCallback((token: CustomToken) => {
    const updated = addCustomToken(token)
    setTokens(updated)
    window.dispatchEvent(new Event(TOKENS_CHANGED_EVENT))
    return updated
  }, [])

  const removeToken = useCallback((address: Hex) => {
    const updated = removeCustomToken(address)
    setTokens(updated)
    window.dispatchEvent(new Event(TOKENS_CHANGED_EVENT))
    return updated
  }, [])

  const refreshTokens = useCallback(() => {
    setTokens(loadCustomTokens())
  }, [])

  return {
    tokens,
    addToken,
    removeToken,
    refreshTokens,
  }
}

/**
 * Hook to fetch balances for all custom tokens
 */
export function useCustomTokenBalances(
  tokens: CustomToken[],
  account: Hex | null
) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [
      'customTokens',
      'balances',
      account,
      tokens.map((t) => t.address),
    ],
    queryFn: async (): Promise<CustomTokenBalance[]> => {
      if (!account || tokens.length === 0) return []

      const config = makeWagmiConfig()
      const balances = await Promise.all(
        tokens.map(async (token) => {
          try {
            // Skip code check for the native token sentinel address
            const isNative =
              token.address.toLowerCase() ===
              chainConfig.nativeErc20Address.toLowerCase()

            let exists = true
            if (!isNative) {
              const code = await getBytecode(config, { address: token.address })
              exists = !!code && code !== '0x'
            }

            if (!exists) {
              console.warn(`skipping custom token because contract doesn't seem to exist: ${token.address}`)
              return null
              // return {
              //   ...token,
              //   balance: 0n,
              //   balanceFormatted: '0',
              //   exists: false,
              // }
            }

            const balance = await readContract(config, {
              address: token.address,
              abi: MOCK_ERC20_ABI,
              functionName: 'balanceOf',
              args: [account],
            })
            return {
              ...token,
              balance,
              balanceFormatted: formatUnits(balance, token.decimals),
              exists: true,
            }
          } catch {
            // Token contract may not exist or be valid
            console.warn(`skipping custom token because errored while reading balance: ${token.address}`)
            return null
            // return {
            //   ...token,
            //   balance: 0n,
            //   balanceFormatted: '0',
            //   exists: false,
            // }
          }
        })
      )

      return balances.filter((b): b is CustomTokenBalance => b !== null)
    },
    enabled: !!account && tokens.length > 0,
    refetchInterval: 10_000,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customTokens'] })
  }, [queryClient])

  return {
    ...query,
    invalidate,
  }
}
