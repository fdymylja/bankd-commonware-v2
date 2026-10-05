/**
 * Hook to fetch native Commonware BRL balances for an address.
 * Identical to admin's useBalances — uses shared query options.
 */

import { queries } from '@bankd/shared/cosmos/queryOptions'
import { useQuery } from '@tanstack/react-query'

export function useBalances(address: string | null) {
  return useQuery({
    ...queries.balances.byAddress(address ?? ''),
    enabled: !!address,
    refetchInterval: 5_000,
  })
}
