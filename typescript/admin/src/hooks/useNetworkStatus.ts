'use client'

import { useQuery } from '@tanstack/react-query'

import { queries } from '@/lib/cosmos'

export function useNetworkStatus() {
  const { data: isConnected = false, isLoading: isCheckingConnection } =
    useQuery(queries.network.status())

  const { data: blockHeight } = useQuery({
    ...queries.network.blockHeight(),
    enabled: isConnected,
  })

  return {
    isConnected,
    blockHeight: blockHeight ?? null,
    isLoading: isCheckingConnection,
  }
}
