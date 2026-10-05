/**
 * Hook to manage custom ERC20 tokens for mobile.
 * Uses AsyncStorage instead of admin's localStorage.
 * Uses viem publicClient instead of wagmi readContract.
 */

import { chainConfig } from '@bankd/shared'
import { CustomToken, MOCK_ERC20_ABI } from '@bankd/shared/evm/mockERC20'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { type Hex, formatUnits } from 'viem'

import { getPublicClient } from '@/lib/evm/client'

const STORAGE_KEY = 'bankd_custom_tokens'

// =============================================================================
// AsyncStorage helpers
// =============================================================================

async function loadCustomTokens(): Promise<CustomToken[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

async function saveCustomTokens(tokens: CustomToken[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

// =============================================================================
// Types
// =============================================================================

export interface CustomTokenBalance extends CustomToken {
  balance: bigint
  balanceFormatted: string
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to manage custom ERC20 tokens stored in AsyncStorage.
 * Uses React Query so all consumers share the same cache.
 */
export function useCustomTokens() {
  const queryClient = useQueryClient()

  const { data: _tokens = [] } = useQuery({
    queryKey: ['customTokens', 'list'],
    queryFn: loadCustomTokens,
    staleTime: Infinity,
  })

  // Always include the native token in the list
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

  const addToken = useCallback(async (token: CustomToken) => {
    const current = await loadCustomTokens()
    // Don't add duplicates
    if (current.some((t) => t.address.toLowerCase() === token.address.toLowerCase())) {
      return current
    }
    const updated = [...current, token]
    await saveCustomTokens(updated)
    queryClient.setQueryData(['customTokens', 'list'], updated)
    return updated
  }, [queryClient])

  const removeToken = useCallback(async (address: Hex) => {
    const current = await loadCustomTokens()
    const updated = current.filter(
      (t) => t.address.toLowerCase() !== address.toLowerCase()
    )
    await saveCustomTokens(updated)
    queryClient.setQueryData(['customTokens', 'list'], updated)
    return updated
  }, [queryClient])

  const refreshTokens = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ['customTokens', 'list'] })
  }, [queryClient])

  return {
    tokens,
    addToken,
    removeToken,
    refreshTokens,
  }
}

/**
 * Hook to fetch balances for all custom tokens.
 * Uses viem publicClient directly (no wagmi).
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

      const publicClient = getPublicClient()
      const balances = await Promise.all(
        tokens.map(async (token) => {
          try {
            const balance = await publicClient.readContract({
              address: token.address,
              abi: MOCK_ERC20_ABI,
              functionName: 'balanceOf',
              args: [account],
            })
            return {
              ...token,
              balance,
              balanceFormatted: formatUnits(balance, token.decimals),
            }
          } catch {
            return {
              ...token,
              balance: 0n,
              balanceFormatted: '0',
            }
          }
        })
      )

      return balances
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
