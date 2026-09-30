'use client'

import {
  ATOMIC_SWAP_ABI,
  AtomicSwapOrder,
  AtomicSwapOrderWithId,
  ERC20_ABI,
} from '@bankd/shared/evm/atomicSwap'
import { useQuery } from '@tanstack/react-query'
import { readContract } from '@wagmi/core'
import { Hex } from 'viem'

import { makeWagmiConfig } from '@/lib/evm/wagmi'

/**
 * Hook to get the total number of orders created
 */
export function useOrderCounter(contractAddress: Hex | null) {
  return useQuery({
    queryKey: ['atomicSwap', 'orderCounter', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return 0n
      const config = makeWagmiConfig()
      return readContract(config, {
        address: contractAddress,
        abi: ATOMIC_SWAP_ABI,
        functionName: 'orderCounter',
      })
    },
    enabled: !!contractAddress,
    refetchInterval: 10_000,
  })
}

/**
 * Hook to get a single order by ID
 */
export function useOrder(contractAddress: Hex | null, orderId: bigint | null) {
  return useQuery({
    queryKey: ['atomicSwap', 'order', contractAddress, orderId?.toString()],
    queryFn: async () => {
      if (!contractAddress || orderId === null) return null
      const config = makeWagmiConfig()
      const result = await readContract(config, {
        address: contractAddress,
        abi: ATOMIC_SWAP_ABI,
        functionName: 'getOrder',
        args: [orderId],
      })
      return result as unknown as AtomicSwapOrder
    },
    enabled: !!contractAddress && orderId !== null,
  })
}

/**
 * Hook to check if a buyer can execute an order
 */
export function useCanExecuteOrder(
  contractAddress: Hex | null,
  orderId: bigint | null,
  buyer: Hex | null
) {
  return useQuery({
    queryKey: [
      'atomicSwap',
      'canExecuteOrder',
      contractAddress,
      orderId?.toString(),
      buyer,
    ],
    queryFn: async () => {
      if (!contractAddress || orderId === null || !buyer) return false
      const config = makeWagmiConfig()
      return readContract(config, {
        address: contractAddress,
        abi: ATOMIC_SWAP_ABI,
        functionName: 'canExecuteOrder',
        args: [orderId, buyer],
      })
    },
    enabled: !!contractAddress && orderId !== null && !!buyer,
  })
}

/**
 * Hook to check if a seller is IBC-based
 */
export function useIsSellerIBC(
  contractAddress: Hex | null,
  orderId: bigint | null
) {
  return useQuery({
    queryKey: ['atomicSwap', 'isSellerIBC', contractAddress, orderId?.toString()],
    queryFn: async () => {
      if (!contractAddress || orderId === null) return false
      const config = makeWagmiConfig()
      return readContract(config, {
        address: contractAddress,
        abi: ATOMIC_SWAP_ABI,
        functionName: 'isSellerIBC',
        args: [orderId],
      })
    },
    enabled: !!contractAddress && orderId !== null,
  })
}

/**
 * Result type for useAllOrders hook
 */
export interface AllOrdersResult {
  active: AtomicSwapOrderWithId[]
  inactive: AtomicSwapOrderWithId[]
}

/**
 * Hook to get all orders (both active and inactive) with pagination
 */
export function useAllOrders(contractAddress: Hex | null, maxOrders = 50) {
  const { data: orderCounter } = useOrderCounter(contractAddress)

  return useQuery({
    queryKey: [
      'atomicSwap',
      'allOrders',
      contractAddress,
      orderCounter?.toString(),
      maxOrders,
    ],
    queryFn: async (): Promise<AllOrdersResult> => {
      if (!contractAddress || !orderCounter || orderCounter === 0n) {
        return { active: [], inactive: [] }
      }

      const config = makeWagmiConfig()
      const start =
        orderCounter > BigInt(maxOrders)
          ? orderCounter - BigInt(maxOrders) + 1n
          : 1n

      // Fetch orders in parallel for better performance
      const orderPromises: Promise<{ id: bigint; order: AtomicSwapOrder }>[] = []
      for (let i = orderCounter; i >= start; i--) {
        orderPromises.push(
          readContract(config, {
            address: contractAddress,
            abi: ATOMIC_SWAP_ABI,
            functionName: 'getOrder',
            args: [i],
          }).then((order) => ({
            id: i,
            order: order as unknown as AtomicSwapOrder,
          }))
        )
      }

      const results = await Promise.all(orderPromises)
      const active: AtomicSwapOrderWithId[] = []
      const inactive: AtomicSwapOrderWithId[] = []

      for (const { id, order } of results) {
        if (order.isActive) {
          active.push({ ...order, id })
        } else {
          inactive.push({ ...order, id })
        }
      }

      return { active, inactive }
    },
    enabled: !!contractAddress && !!orderCounter && orderCounter > 0n,
    refetchInterval: 15_000,
  })
}

/**
 * Hook to get all active orders (with pagination)
 * @deprecated Use useAllOrders instead for both active and inactive orders
 */
export function useActiveOrders(contractAddress: Hex | null, maxOrders = 50) {
  const { data } = useAllOrders(contractAddress, maxOrders)
  return {
    data: data?.active ?? [],
    isLoading: !data,
  }
}

/**
 * Hook to get ERC20 token allowance
 */
export function useAllowance(
  tokenAddress: Hex | null,
  owner: Hex | null,
  spender: Hex | null
) {
  return useQuery({
    queryKey: ['erc20', 'allowance', tokenAddress, owner, spender],
    queryFn: async () => {
      if (!tokenAddress || !owner || !spender) return 0n
      const config = makeWagmiConfig()
      return readContract(config, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spender],
      })
    },
    enabled: !!tokenAddress && !!owner && !!spender,
    refetchInterval: 10_000,
  })
}

/**
 * Hook to get ERC20 token balance
 */
export function useTokenBalance(tokenAddress: Hex | null, account: Hex | null) {
  return useQuery({
    queryKey: ['erc20', 'balanceOf', tokenAddress, account],
    queryFn: async () => {
      if (!tokenAddress || !account) return 0n
      const config = makeWagmiConfig()
      return readContract(config, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account],
      })
    },
    enabled: !!tokenAddress && !!account,
    refetchInterval: 10_000,
  })
}

/**
 * Hook to get ERC20 token symbol
 */
export function useTokenSymbol(tokenAddress: Hex | null) {
  return useQuery({
    queryKey: ['erc20', 'symbol', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null
      const config = makeWagmiConfig()
      return readContract(config, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      })
    },
    enabled: !!tokenAddress,
    staleTime: Infinity, // Symbol doesn't change
  })
}

/**
 * Hook to get ERC20 token decimals
 */
export function useTokenDecimals(tokenAddress: Hex | null) {
  return useQuery({
    queryKey: ['erc20', 'decimals', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null
      const config = makeWagmiConfig()
      return readContract(config, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      })
    },
    enabled: !!tokenAddress,
    staleTime: Infinity, // Decimals don't change
  })
}
