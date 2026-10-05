/**
 * Hooks for SimpleLending contract interactions.
 * Port of admin's useSimpleLending — uses viem publicClient instead of wagmi.
 */

import {
  SIMPLE_LENDING_ABI,
  type SimpleLendingLoan,
  type SimpleLendingLoanWithId,
} from '@bankd/shared/evm/simpleLending'
import {
  type EphemeralAddressRecord,
  filterFundableLoans,
  filterOwnBorrowedLoans,
  filterOwnLentLoans,
} from '@bankd/shared/penumbra'
import { useQuery } from '@tanstack/react-query'
import type { Hex } from 'viem'

import { getPublicClient } from '@/lib/evm/client'

/** Derive a stable cache key from registry records (content-sensitive). */
function registryCacheKey(records: readonly EphemeralAddressRecord[]): string {
  return records.map((r) => `${r.id}:${r.intermediateHex ?? ''}`).join('|')
}

// =============================================================================
// Individual Loan Queries
// =============================================================================

/**
 * Hook to get the next loan ID (also verifies contract exists).
 */
export function useNextLoanId(contractAddress: Hex | null) {
  return useQuery({
    queryKey: ['simpleLending', 'nextLoanId', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return 0n
      const client = getPublicClient()
      return client.readContract({
        address: contractAddress,
        abi: SIMPLE_LENDING_ABI,
        functionName: 'nextLoanId',
      })
    },
    enabled: !!contractAddress,
    refetchInterval: 10_000,
  })
}

/**
 * Hook to get a single loan by ID.
 */
export function useLoan(contractAddress: Hex | null, loanId: bigint | null) {
  return useQuery({
    queryKey: ['simpleLending', 'loan', contractAddress, loanId?.toString()],
    queryFn: async () => {
      if (!contractAddress || loanId === null) return null
      const client = getPublicClient()
      const result = await client.readContract({
        address: contractAddress,
        abi: SIMPLE_LENDING_ABI,
        functionName: 'getLoan',
        args: [loanId],
      })
      return result as unknown as SimpleLendingLoan
    },
    enabled: !!contractAddress && loanId !== null,
  })
}

/**
 * Hook to get calculated interest for a funded loan.
 */
export function useLoanInterest(
  contractAddress: Hex | null,
  loanId: bigint | null
) {
  return useQuery({
    queryKey: [
      'simpleLending',
      'calculateInterest',
      contractAddress,
      loanId?.toString(),
    ],
    queryFn: async () => {
      if (!contractAddress || loanId === null) return 0n
      const client = getPublicClient()
      try {
        return await client.readContract({
          address: contractAddress,
          abi: SIMPLE_LENDING_ABI,
          functionName: 'calculateInterest',
          args: [loanId],
        })
      } catch {
        return 0n
      }
    },
    enabled: !!contractAddress && loanId !== null,
    refetchInterval: 10_000,
  })
}

/**
 * Hook to check if a loan is expired.
 */
export function useIsLoanExpired(
  contractAddress: Hex | null,
  loanId: bigint | null
) {
  return useQuery({
    queryKey: [
      'simpleLending',
      'isLoanExpired',
      contractAddress,
      loanId?.toString(),
    ],
    queryFn: async () => {
      if (!contractAddress || loanId === null) return false
      const client = getPublicClient()
      return client.readContract({
        address: contractAddress,
        abi: SIMPLE_LENDING_ABI,
        functionName: 'isLoanExpired',
        args: [loanId],
      })
    },
    enabled: !!contractAddress && loanId !== null,
    refetchInterval: 30_000,
  })
}

// =============================================================================
// All Loans
// =============================================================================

/** Result type for useAllLoans hook */
export interface AllLoansResult {
  unfunded: SimpleLendingLoanWithId[]
  active: SimpleLendingLoanWithId[]
  completed: SimpleLendingLoanWithId[]
}

/**
 * Hook to get all loans with categorization.
 */
export function useAllLoans(contractAddress: Hex | null, maxLoans = 50) {
  const { data: nextLoanId } = useNextLoanId(contractAddress)

  return useQuery({
    queryKey: [
      'simpleLending',
      'allLoans',
      contractAddress,
      nextLoanId?.toString(),
      maxLoans,
    ],
    queryFn: async (): Promise<AllLoansResult> => {
      if (!contractAddress || !nextLoanId || nextLoanId === 0n) {
        return { unfunded: [], active: [], completed: [] }
      }

      const client = getPublicClient()
      const start =
        nextLoanId > BigInt(maxLoans) ? nextLoanId - BigInt(maxLoans) : 0n

      const loanPromises: Promise<{
        id: bigint
        loan: SimpleLendingLoan
        isExpired: boolean
        interest: bigint
      }>[] = []

      for (let i = nextLoanId - 1n; i >= start && i >= 0n; i--) {
        const loanId = i
        loanPromises.push(
          (async () => {
            const loan = (await client.readContract({
              address: contractAddress,
              abi: SIMPLE_LENDING_ABI,
              functionName: 'getLoan',
              args: [loanId],
            })) as unknown as SimpleLendingLoan

            let isExpired = false
            let interest = 0n

            if (loan.isFunded && loan.isActive) {
              try {
                isExpired = await client.readContract({
                  address: contractAddress,
                  abi: SIMPLE_LENDING_ABI,
                  functionName: 'isLoanExpired',
                  args: [loanId],
                })
                interest = await client.readContract({
                  address: contractAddress,
                  abi: SIMPLE_LENDING_ABI,
                  functionName: 'calculateInterest',
                  args: [loanId],
                })
              } catch {
                // Ignore errors for optional queries
              }
            }

            return { id: loanId, loan, isExpired, interest }
          })()
        )
      }

      const results = await Promise.all(loanPromises)

      const unfunded: SimpleLendingLoanWithId[] = []
      const active: SimpleLendingLoanWithId[] = []
      const completed: SimpleLendingLoanWithId[] = []

      for (const { id, loan, isExpired, interest } of results) {
        const loanWithId: SimpleLendingLoanWithId = {
          ...loan,
          id,
          isExpired,
          currentInterest: interest,
        }

        if (!loan.isActive) {
          completed.push(loanWithId)
        } else if (!loan.isFunded) {
          unfunded.push(loanWithId)
        } else {
          active.push(loanWithId)
        }
      }

      return { unfunded, active, completed }
    },
    enabled: !!contractAddress && !!nextLoanId && nextLoanId > 0n,
    refetchInterval: 15_000,
  })
}

// =============================================================================
// User-Filtered Loan Queries
// =============================================================================

/**
 * Hook to get loans where the user is the borrower.
 * Uses shared registry-aware matching to detect own ephemeral addresses.
 */
export function useMyBorrowedLoans(
  contractAddress: Hex | null,
  userAddress: Hex | null,
  registryRecords: readonly EphemeralAddressRecord[] = [],
) {
  const { data: allLoans } = useAllLoans(contractAddress)

  return useQuery({
    queryKey: [
      'simpleLending',
      'myBorrowedLoans',
      contractAddress,
      userAddress,
      registryCacheKey(registryRecords),
      JSON.stringify(allLoans, (_k, v) => typeof v === "bigint" ? v.toString() : v),
    ],
    queryFn: async (): Promise<AllLoansResult> => {
      if (!allLoans) {
        return { unfunded: [], active: [], completed: [] }
      }

      const fallback = userAddress ? [userAddress] : []

      return {
        unfunded: filterOwnBorrowedLoans(allLoans.unfunded, registryRecords, fallback),
        active: filterOwnBorrowedLoans(allLoans.active, registryRecords, fallback),
        completed: filterOwnBorrowedLoans(allLoans.completed, registryRecords, fallback),
      }
    },
    enabled: !!allLoans,
  })
}

/**
 * Hook to get loans where the user is the lender.
 * Uses shared registry-aware matching to detect own ephemeral addresses.
 */
export function useMyLentLoans(
  contractAddress: Hex | null,
  userAddress: Hex | null,
  registryRecords: readonly EphemeralAddressRecord[] = [],
) {
  const { data: allLoans } = useAllLoans(contractAddress)

  return useQuery({
    queryKey: [
      'simpleLending',
      'myLentLoans',
      contractAddress,
      userAddress,
      registryCacheKey(registryRecords),
      JSON.stringify(allLoans, (_k, v) => typeof v === "bigint" ? v.toString() : v),
    ],
    queryFn: async (): Promise<AllLoansResult> => {
      if (!allLoans) {
        return { unfunded: [], active: [], completed: [] }
      }

      const fallback = userAddress ? [userAddress] : []

      return {
        unfunded: [],
        active: filterOwnLentLoans(allLoans.active, registryRecords, fallback),
        completed: filterOwnLentLoans(allLoans.completed, registryRecords, fallback),
      }
    },
    enabled: !!allLoans,
  })
}

/**
 * Hook to get loans that the user can fund (unfunded, not their own).
 * Uses shared registry-aware matching to exclude own ephemeral addresses.
 */
export function useFundableLoans(
  contractAddress: Hex | null,
  userAddress: Hex | null,
  registryRecords: readonly EphemeralAddressRecord[] = [],
) {
  const { data: allLoans } = useAllLoans(contractAddress)

  return useQuery({
    queryKey: [
      'simpleLending',
      'fundableLoans',
      contractAddress,
      userAddress,
      registryCacheKey(registryRecords),
      JSON.stringify(allLoans, (_k, v) => typeof v === "bigint" ? v.toString() : v),
    ],
    queryFn: async (): Promise<SimpleLendingLoanWithId[]> => {
      if (!allLoans) return []
      const fallback = userAddress ? [userAddress] : []
      return filterFundableLoans(allLoans.unfunded, registryRecords, fallback)
    },
    enabled: !!allLoans,
  })
}
