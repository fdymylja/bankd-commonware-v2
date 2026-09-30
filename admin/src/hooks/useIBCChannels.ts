'use client'

import { useQuery } from '@tanstack/react-query'

import { queries } from '@/lib/cosmos'

export function useIBCChannels() {
  return useQuery({
    ...queries.ibc.channels(),
    refetchInterval: 5_000,
  })
}
