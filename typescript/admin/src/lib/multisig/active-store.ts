// src/lib/multisig/active-store.ts
/**
 * Module-level mirror of the currently-active wallet, so non-hook code (namely
 * `executeTx` in src/lib/evm/execute.ts) can read the selection synchronously.
 *
 * The React context (context.tsx) stays the source of truth for the UI; this is
 * a one-writer/many-readers shadow of it. `MultisigProvider` is the sole writer
 * (a useEffect keeps it in sync with `activeSafe`); everyone else only reads.
 */

import type { Hex } from 'viem'

/** The active wallet, as far as the signing layer cares. */
export type ActiveWalletKind =
  | { kind: 'personal' }
  | { kind: 'safe'; safeId: string; safeAddress: Hex }

let active: ActiveWalletKind = { kind: 'personal' }

/** Read the current active wallet. Safe to call outside React. */
export function getActiveWallet(): ActiveWalletKind {
  return active
}

/** Overwrite the active wallet mirror. Only the provider should call this. */
export function setActiveWallet(next: ActiveWalletKind): void {
  active = next
}

/**
 * True when a Safe is the active wallet. Used by Class B/C feature handlers to
 * bail out early (multi-step / deploy flows aren't proposable yet).
 */
export function isSafeActive(): boolean {
  return active.kind === 'safe'
}

/**
 * Class B/C gate: if a Safe is active, toast that the feature isn't supported
 * yet and return true (the handler should early-return). Keeps the check from
 * being copy-pasted differently across pages.
 */
export function guardSafeUnsupported(feature: string): boolean {
  if (active.kind !== 'safe') return false
  // Lazy import to avoid pulling react-hot-toast into non-UI callers.
  void import('react-hot-toast').then(({ default: toast }) => {
    toast.error(`${feature} isn't supported for Safe wallets yet`)
  })
  return true
}
