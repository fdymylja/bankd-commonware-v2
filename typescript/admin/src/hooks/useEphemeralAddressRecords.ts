/**
 * TanStack Query hook for the admin ephemeral address registry.
 */

import { useQuery } from '@tanstack/react-query'

import { getAllEphemeralAddressRecords } from '@/lib/native-wallet'

export const ephemeralAddressRegistryQueryKey = ['ephemeral-address-registry'] as const

/**
 * Query hook that returns all ephemeral address records from IndexedDB.
 */
export function useEphemeralAddressRecords() {
  return useQuery({
    queryKey: ephemeralAddressRegistryQueryKey,
    queryFn: getAllEphemeralAddressRecords,
    staleTime: 30_000,
  })
}
