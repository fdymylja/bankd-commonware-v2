'use client'

/**
 * A persistent, page-level cue that a multisig (not the personal account) is the
 * active wallet. Critical because feature pages route through `executeTx`, which
 * *proposes* (queues for co-signing) instead of broadcasting when a Safe is
 * active - without a standing indicator a user has no way to know their action
 * won't settle immediately. A slim strip in normal flow at the top of the content
 * column - it sticks on scroll but never overlaps the header or floats over content.
 */

import { useMultisig } from '@/lib/multisig'

export function ActiveWalletBanner() {
  const { activeWallet, activeMultisig, activeSafe, setActiveWallet } =
    useMultisig()

  if (activeWallet === 'personal') return null

  const label = activeSafe?.label ?? activeMultisig?.label ?? 'multisig'

  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-sm text-amber-900 shadow-sm">
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
      <span className="font-medium">Acting as {label}</span>
      <span className="hidden text-amber-700 sm:inline">
        · transactions are proposed for co-signing, not broadcast
      </span>
      <button
        onClick={() => setActiveWallet('personal')}
        className="ml-1 font-medium text-amber-800 underline hover:text-amber-900"
      >
        Switch to personal
      </button>
    </div>
  )
}
