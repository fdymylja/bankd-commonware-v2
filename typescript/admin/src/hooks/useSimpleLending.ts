'use client'

import {
  SIMPLE_LENDING_ABI,
  SimpleLendingLoan,
  SimpleLendingLoanWithId,
} from '@bankd/shared/evm/simpleLending'
import { useQuery } from '@tanstack/react-query'
import { readContract } from '@wagmi/core'
import { Hex } from 'viem'

import { makeWagmiConfig } from '@/lib/evm/wagmi'

/**
 * Hook to get the next loan ID (also verifies contract exists)
 */
export function useNextLoanId(contractAddress: Hex | null) {
  return useQuery({
    queryKey: ['simpleLending', 'nextLoanId', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return 0n
      const config = makeWagmiConfig()
      return readContract(config, {
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
 * Hook to get a single loan by ID
 */
export function useLoan(contractAddress: Hex | null, loanId: bigint | null) {
  return useQuery({
    queryKey: ['simpleLending', 'loan', contractAddress, loanId?.toString()],
    queryFn: async () => {
      if (!contractAddress || loanId === null) return null
      const config = makeWagmiConfig()
      const result = await readContract(config, {
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
 * Hook to get calculated interest for a funded loan
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
      const config = makeWagmiConfig()
      try {
        return await readContract(config, {
          address: contractAddress,
          abi: SIMPLE_LENDING_ABI,
          functionName: 'calculateInterest',
          args: [loanId],
        })
      } catch {
        // Returns 0 if loan is not funded yet
        return 0n
      }
    },
    enabled: !!contractAddress && loanId !== null,
    refetchInterval: 10_000, // Refresh interest calculation every 10s
  })
}

/**
 * Hook to check if a loan is expired
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
      const config = makeWagmiConfig()
      return readContract(config, {
        address: contractAddress,
        abi: SIMPLE_LENDING_ABI,
        functionName: 'isLoanExpired',
        args: [loanId],
      })
    },
    enabled: !!contractAddress && loanId !== null,
    refetchInterval: 30_000, // Check expiry every 30s
  })
}

/**
 * Result type for useAllLoans hook
 */
export interface AllLoansResult {
  unfunded: SimpleLendingLoanWithId[]
  active: SimpleLendingLoanWithId[]
  completed: SimpleLendingLoanWithId[]
}

/**
 * Hook to get all loans with categorization
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

      const config = makeWagmiConfig()
      const start =
        nextLoanId > BigInt(maxLoans) ? nextLoanId - BigInt(maxLoans) : 0n

      // Fetch loans and their expiry status in parallel
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
            const loan = (await readContract(config, {
              address: contractAddress,
              abi: SIMPLE_LENDING_ABI,
              functionName: 'getLoan',
              args: [loanId],
            })) as unknown as SimpleLendingLoan

            let isExpired = false
            let interest = 0n

            if (loan.isFunded && loan.isActive) {
              // Check expiry and interest for funded loans
              try {
                isExpired = await readContract(config, {
                  address: contractAddress,
                  abi: SIMPLE_LENDING_ABI,
                  functionName: 'isLoanExpired',
                  args: [loanId],
                })
                interest = await readContract(config, {
                  address: contractAddress,
                  abi: SIMPLE_LENDING_ABI,
                  functionName: 'calculateInterest',
                  args: [loanId],
                })
              } catch {
                // Ignore errors for these optional queries
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
          // Loan is no longer active (repaid, liquidated, or cancelled)
          completed.push(loanWithId)
        } else if (!loan.isFunded) {
          // Active but not funded yet
          unfunded.push(loanWithId)
        } else {
          // Active and funded
          active.push(loanWithId)
        }
      }

      return { unfunded, active, completed }
    },
    enabled: !!contractAddress && !!nextLoanId && nextLoanId > 0n,
    refetchInterval: 15_000,
  })
}

/**
 * Hook to get loans where the user is the borrower
 */
export function useMyBorrowedLoans(
  contractAddress: Hex | null,
  userAddress: Hex | null
) {
  const { data: allLoans } = useAllLoans(contractAddress)

  return useQuery({
    queryKey: [
      'simpleLending',
      'myBorrowedLoans',
      contractAddress,
      userAddress,
      JSON.stringify(allLoans),
    ],
    queryFn: async (): Promise<AllLoansResult> => {
      if (!allLoans || !userAddress) {
        return { unfunded: [], active: [], completed: [] }
      }

      const filterByBorrower = (loans: SimpleLendingLoanWithId[]) =>
        loans.filter(
          (loan) => loan.borrower.toLowerCase() === userAddress.toLowerCase()
        )

      return {
        unfunded: filterByBorrower(allLoans.unfunded),
        active: filterByBorrower(allLoans.active),
        completed: filterByBorrower(allLoans.completed),
      }
    },
    enabled: !!allLoans && !!userAddress,
  })
}

/**
 * Hook to get loans where the user is the lender
 */
export function useMyLentLoans(
  contractAddress: Hex | null,
  userAddress: Hex | null
) {
  const { data: allLoans } = useAllLoans(contractAddress)

  return useQuery({
    queryKey: [
      'simpleLending',
      'myLentLoans',
      contractAddress,
      userAddress,
      JSON.stringify(allLoans),
    ],
    queryFn: async (): Promise<AllLoansResult> => {
      if (!allLoans || !userAddress) {
        return { unfunded: [], active: [], completed: [] }
      }

      const filterByLender = (loans: SimpleLendingLoanWithId[]) =>
        loans.filter(
          (loan) => loan.lender.toLowerCase() === userAddress.toLowerCase()
        )

      return {
        unfunded: [], // Unfunded loans don't have a lender yet
        active: filterByLender(allLoans.active),
        completed: filterByLender(allLoans.completed),
      }
    },
    enabled: !!allLoans && !!userAddress,
  })
}

/**
 * Hook to get loans that the user can fund (unfunded, not their own)
 */
export function useFundableLoans(
  contractAddress: Hex | null,
  userAddress: Hex | null
) {
  const { data: allLoans } = useAllLoans(contractAddress)

  return useQuery({
    queryKey: [
      'simpleLending',
      'fundableLoans',
      contractAddress,
      userAddress,
      JSON.stringify(allLoans),
    ],
    queryFn: async (): Promise<SimpleLendingLoanWithId[]> => {
      if (!allLoans) return []

      // If no user address, return all unfunded loans
      if (!userAddress) return allLoans.unfunded

      // Filter out loans where user is the borrower
      return allLoans.unfunded.filter(
        (loan) => loan.borrower.toLowerCase() !== userAddress.toLowerCase()
      )
    },
    enabled: !!allLoans,
  })
}
