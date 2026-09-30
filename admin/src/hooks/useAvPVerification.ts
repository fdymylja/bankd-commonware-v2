'use client'

import { useQuery } from '@tanstack/react-query'
import { Hex } from 'viem'

import {
  type AvPVerificationResult,
  verifyAvPCompliance,
} from '@/lib/evm/avpVerify'

/**
 * Hook to verify AvP compliance of a completed atomic swap order.
 * Triggered on-demand via the `enabled` flag (user clicks "Verify").
 * Results are cached indefinitely since completed orders don't change.
 */
export function useAvPVerification(
  contractAddress: Hex | null,
  orderId: bigint | null,
  enabled: boolean = false
) {
  return useQuery<AvPVerificationResult | null>({
    queryKey: ['avpVerification', contractAddress, orderId?.toString()],
    queryFn: async () => {
      if (!contractAddress || orderId === null) return null
      return verifyAvPCompliance(contractAddress, orderId)
    },
    enabled: enabled && !!contractAddress && orderId !== null,
    staleTime: Infinity,
    retry: 1,
  })
}
