'use client'

import { useQuery } from '@tanstack/react-query'

import { getComplianceAssetStatus } from '@/lib/native-wallet'

/**
 * Chain-authoritative compliance status for a Penumbra base denom (e.g. the
 * IBC voucher denom a bankd asset becomes once shielded). `data` is null when
 * the query fails — treat as unknown, not unregulated.
 */
export function useComplianceAssetStatus(denom: string | null) {
  return useQuery({
    queryKey: ['compliance', 'asset-status', denom],
    queryFn: () => getComplianceAssetStatus(denom!),
    enabled: !!denom,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
