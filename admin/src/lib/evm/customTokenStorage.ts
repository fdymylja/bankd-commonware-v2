import { type CustomToken } from '@bankd/shared/evm/mockERC20'
import { type Hex } from 'viem'

const STORAGE_KEY = 'bankd-custom-erc20-tokens'

/**
 * Load custom tokens from localStorage
 */
export function loadCustomTokens(): CustomToken[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

/**
 * Save custom tokens to localStorage
 */
export function saveCustomTokens(tokens: CustomToken[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

/**
 * Add a custom token to localStorage
 */
export function addCustomToken(token: CustomToken): CustomToken[] {
  const tokens = loadCustomTokens()
  // Avoid duplicates
  const existing = tokens.findIndex(
    (t) => t.address.toLowerCase() === token.address.toLowerCase()
  )
  if (existing >= 0) {
    tokens[existing] = token
  } else {
    tokens.push(token)
  }
  saveCustomTokens(tokens)
  return tokens
}

/**
 * Remove a custom token from localStorage
 */
export function removeCustomToken(address: Hex): CustomToken[] {
  const tokens = loadCustomTokens().filter(
    (t) => t.address.toLowerCase() !== address.toLowerCase()
  )
  saveCustomTokens(tokens)
  return tokens
}
