'use client'

import { useQuery } from '@tanstack/react-query'

import { queries } from '@/lib/cosmos'

export function useNativeParams() {
  return useQuery(queries.params.native())
}

export function usePoaParams() {
  return useQuery(queries.params.poa())
}
