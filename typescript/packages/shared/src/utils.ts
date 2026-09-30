import { fromBech32, toBech32 } from '@cosmjs/encoding'
import { CallExecutionError, getAddress } from 'viem'

import { chainConfig } from './config'

/**
 * Format a token amount from minimal denom to display denom
 */
export function formatTokenAmount(
  amount: string | number | bigint,
  decimals: number = chainConfig.decimals
): string {
  const value = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)
  const wholePart = value / divisor
  const fractionalPart = value % divisor

  if (fractionalPart === 0n) {
    return wholePart.toString()
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  const trimmedFractional = fractionalStr.replace(/0+$/, '')

  return `${wholePart}.${trimmedFractional}`
}

/**
 * Parse a display amount to minimal denom
 */
export function parseTokenAmount(
  amount: string,
  decimals: number = chainConfig.decimals
): bigint {
  const [whole, fractional = ''] = amount.split('.')
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFractional)
}

/**
 * Truncate an address for display
 */
export function truncateAddress(
  address: string,
  startChars: number = 8,
  endChars: number = 6
): string {
  if (address.length <= startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Check if an address is a valid bech32 address
 */
export function isValidBech32Address(address: string): boolean {
  return (
    address.startsWith(chainConfig.bech32Prefix + '1') && address.length > 10
  )
}

/**
 * Check if an address is a valid hex address
 */
export function isValidHexAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Check if an address is valid (either bech32 or hex)
 */
export function isValidAddress(address: string): boolean {
  return isValidBech32Address(address) || isValidHexAddress(address)
}

/**
 * Convert a bech32 address to hex format
 */
export function bech32ToHex(bech32Address: string): string {
  try {
    const { data } = fromBech32(bech32Address)
    return getAddress('0x' + Buffer.from(data).toString('hex'))
  } catch {
    return ''
  }
}

/**
 * Convert a hex address to bech32 format
 */
export function hexToBech32(
  hexAddress: string,
  prefix: string = chainConfig.bech32Prefix
): string {
  try {
    const hex = hexAddress.startsWith('0x') ? hexAddress.slice(2) : hexAddress
    const data = Buffer.from(hex, 'hex')
    return toBech32(prefix, data)
  } catch {
    return ''
  }
}

/**
 * Normalize an address to lowercase hex format for comparison
 */
export function normalizeAddressToHex(address: string): string {
  if (isValidHexAddress(address)) {
    return address.toLowerCase()
  }
  if (isValidBech32Address(address)) {
    return bech32ToHex(address).toLowerCase()
  }
  return address.toLowerCase()
}

/**
 * Check if two addresses are the same (comparing in hex format)
 */
export function addressesEqual(
  addr1: string | null | undefined,
  addr2: string | null | undefined
): boolean {
  if (!addr1 || !addr2) return false
  return normalizeAddressToHex(addr1) === normalizeAddressToHex(addr2)
}

/**
 * Check if an address is in a list (comparing in hex format)
 */
export function addressInList(
  address: string | null | undefined,
  list: string[]
): boolean {
  if (!address) return false
  const normalizedAddress = normalizeAddressToHex(address)
  return list.some((item) => normalizeAddressToHex(item) === normalizedAddress)
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number | string): string {
  return Number(value).toLocaleString()
}

/**
 * Format a token amount for display (pt-BR locale):
 * - Zero: "0"
 * - Dust (< 0.01): "< 0,01"
 * - Any value: 2 decimal places with pt-BR separators (e.g. "1.234,56")
 */
export function formatAmount(raw: string): string {
  const num = parseFloat(raw)
  if (num === 0 || isNaN(num)) return '0'
  if (num > 0 && num < 0.01) return '< 0,01'
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extract error message from an unknown error
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = 'An unknown error occurred',
  fallbackIsPrefix: boolean = true
): string {
  if (
    error instanceof Error &&
    (error.message.includes('User rejected the request') ||
      error.message.includes('was not approved'))
  ) {
    return 'Transaction denied'
  }

  if (error instanceof CallExecutionError) {
    return (
      'Execution failed: ' +
      error.details
        .replace(/^execution reverted: /, '')
        .replace(/^failed to execute message: /, '')
        .replace(/^message execution failed: /, '')
    )
  }

  return error instanceof Error
    ? `${fallbackIsPrefix ? fallback + ': ' : ''}${error.message}`
    : `${fallback}: ${error}`
}
