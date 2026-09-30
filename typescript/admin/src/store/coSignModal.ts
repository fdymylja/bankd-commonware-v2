'use client'

/**
 * Global co-sign modal store. When `executeTx` proposes a Safe tx it can't use
 * hooks, so it drops the pending tx here via `getState().open(pending)`; the
 * modal mounted at the app root (beside the Toaster) renders it so the initiator
 * can sign / share / execute without navigating to /multisig.
 */

import { create } from 'zustand'

import type { PendingSafeTx } from '@/lib/safe'

interface CoSignModalState {
  /** The pending Safe tx currently shown, or null when the modal is closed. */
  pendingTx: PendingSafeTx | null
  open: (tx: PendingSafeTx) => void
  close: () => void
}

export const useCoSignModal = create<CoSignModalState>()((set) => ({
  pendingTx: null,
  open: (tx) => set({ pendingTx: tx }),
  close: () => set({ pendingTx: null }),
}))
