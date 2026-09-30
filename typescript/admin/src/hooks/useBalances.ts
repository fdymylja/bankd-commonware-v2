'use client'

import { useQuery } from '@tanstack/react-query'

import { queries } from '@/lib/cosmos'

export function useBalances(address: string | null) {
  return useQuery({
    ...queries.balances.byAddress(address ?? ''),
    enabled: !!address,
    refetchInterval: 5_000, // Refresh every 5 seconds
  })
}
