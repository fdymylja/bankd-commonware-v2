/**
 * TanStack Query hooks for the ephemeral address registry.
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { EphemeralAddressRecord } from '@bankd/shared/penumbra'

import {
  getAllEphemeralAddressRecords,
  saveEphemeralAddressRecord,
  saveEphemeralAddressRecords,
} from '@/lib/native-wallet/storage'

export const ephemeralAddressRegistryQueryKey = ['ephemeralAddressRegistry'] as const

/**
 * Query hook that returns all ephemeral address records from local storage.
 */
export function useEphemeralAddressRecords() {
  return useQuery({
    queryKey: ephemeralAddressRegistryQueryKey,
    queryFn: getAllEphemeralAddressRecords,
    staleTime: 30_000,
  })
}

/**
 * Mutation-like actions for ephemeral address records.
 * Returns `save` and `saveMany` that persist and invalidate the query cache.
 */
export function useEphemeralAddressRegistryActions() {
  const queryClient = useQueryClient()

  const save = useCallback(
    async (record: EphemeralAddressRecord) => {
      await saveEphemeralAddressRecord(record)
      await queryClient.invalidateQueries({
        queryKey: ephemeralAddressRegistryQueryKey,
      })
    },
    [queryClient]
  )

  const saveMany = useCallback(
    async (records: EphemeralAddressRecord[]) => {
      await saveEphemeralAddressRecords(records)
      await queryClient.invalidateQueries({
        queryKey: ephemeralAddressRegistryQueryKey,
      })
    },
    [queryClient]
  )

  return { save, saveMany }
}
