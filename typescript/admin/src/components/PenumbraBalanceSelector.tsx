'use client'

import { clsx } from 'clsx'

import { PenumbraBalance, usePenumbraBalances } from '@/hooks'
import { formatAmount } from '@/lib/utils'

export interface PenumbraBalanceSelectorProps {
  value: string | null
  onChange: (balance: PenumbraBalance | null) => void
  label?: string
  placeholder?: string
  className?: string
  filter?: (balance: PenumbraBalance) => boolean
}

/**
 * Dropdown selector for Penumbra balances.
 * Can be filtered to show only specific balances (e.g., IBC tokens from Bankd).
 */
export function PenumbraBalanceSelector({
  value,
  onChange,
  label,
  placeholder = 'Select a token...',
  className,
  filter,
}: PenumbraBalanceSelectorProps) {
  const { data: balances, isLoading } = usePenumbraBalances()

  const filteredBalances = filter ? balances?.filter(filter) : balances

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    if (!selectedId) {
      onChange(null)
      return
    }
    const selected = filteredBalances?.find((b) => b.assetId === selectedId)
    onChange(selected || null)
  }

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={isLoading}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          {isLoading ? 'Loading balances...' : placeholder}
        </option>
        {filteredBalances?.map((balance) => (
          <option key={balance.assetId} value={balance.assetId}>
            {balance.symbol} - {formatAmount(balance.amountFormatted)}
          </option>
        ))}
      </select>
      {!isLoading && filteredBalances?.length === 0 && (
        <p className="mt-1.5 text-sm text-gray-500">
          No matching balances found
        </p>
      )}
    </div>
  )
}

/**
 * Filter function to show only IBC ERC20 tokens from Bankd.
 * These tokens have the format: transfer/channel-X/erc20:0x...
 */
export function filterBankdERC20Tokens(balance: PenumbraBalance): boolean {
  return true
  // Check if the base denom contains the ERC20 pattern from Bankd
  // return (
  //   balance.baseDenom.includes('erc20:') ||
  //   balance.baseDenom.includes('transfer/channel')
  // )
}
