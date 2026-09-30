'use client'

import { useQuery } from '@tanstack/react-query'

import { queries } from '@/lib/cosmos'

export function useValidators() {
  return useQuery(queries.validators.list())
}
