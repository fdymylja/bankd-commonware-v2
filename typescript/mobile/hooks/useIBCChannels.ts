/**
 * Hook to fetch IBC channels.
 * Identical to admin's useIBCChannels — uses shared query options.
 */

import { queries } from '@bankd/shared/cosmos/queryOptions'
import { useQuery } from '@tanstack/react-query'

export function useIBCChannels() {
  return useQuery({
    ...queries.ibc.channels(),
    refetchInterval: 5_000,
  })
}
