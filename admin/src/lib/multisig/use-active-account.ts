// src/lib/multisig/use-active-account.ts
'use client'

/**
 * Resolve the addresses a feature action should bind to. When a Safe is the
 * active wallet, msg identity fields (sender / fromAddress / burn-from) and
 * "your funds" balance reads must point at the Safe, or x/msgexec reverts (the
 * inner cosmos signer must equal the EVM caller = the Safe). Otherwise it falls
 * back to the connected personal account.
 */

import { fromBech32 } from '@cosmjs/encoding'
import { type Hex, getAddress, toHex } from 'viem'

import { useWallet } from '@/hooks/useWallet'
import { hexToBech32 } from '@/lib/utils'

import { useMultisig } from './context'

export interface ActiveAccount {
  /** hex EVM address of the active account (Safe or personal), if any. */
  evmAddress?: Hex
  /** bech32 (`wallet1...`) form of the same account. */
  cosmosAddress?: string
}

/**
 * The active account's addresses: the multisig's Safe when a multisig (Safe or
 * cosmos-multisig) is selected, else the connected personal account. A Safe
 * lives at the cosmos multisig's own address, so both wallet types resolve to
 * the same 20 bytes - selecting either drives EVM actions as that Safe.
 */
export function useActiveAccount(): ActiveAccount {
  const { hexAddress } = useWallet()
  const { activeSafe, activeMultisig } = useMultisig()

  const safeHex = activeSafe?.safeAddress
    ? (getAddress(activeSafe.safeAddress) as Hex)
    : activeMultisig?.cosmosAddress
      ? (getAddress(toHex(fromBech32(activeMultisig.cosmosAddress).data)) as Hex)
      : null

  if (safeHex) {
    return { evmAddress: safeHex, cosmosAddress: hexToBech32(safeHex) }
  }

  return {
    evmAddress: hexAddress,
    cosmosAddress: hexAddress ? hexToBech32(hexAddress) : undefined,
  }
}
