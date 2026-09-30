'use client'

import { useQuery } from '@tanstack/react-query'

import { queries } from '@/lib/cosmos'

export function useTotalSupply() {
  return useQuery(queries.supply.total())
}
