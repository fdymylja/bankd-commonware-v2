'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

import { ChevronDownIcon } from '@/components/ui'
import { type MultisigConfig, useMultisig } from '@/lib/multisig'
import { truncateAddress } from '@/lib/utils'

import { CreateMultisigModal } from './CreateMultisigModal'

/**
 * Header dropdown to switch between the personal (native) account and any saved
 * multisig. Additive - it never changes the native wallet's own connection.
 */
export function WalletSwitcher() {
  const { wallets, activeWallet, setActiveWallet, deleteWallet } = useMultisig()
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // Removes only the local record (label/address/members + any pending txs). It
  // does not touch on-chain state or a deployed Safe - you can re-add it later.
  const handleRemove = async (w: MultisigConfig) => {
    if (!window.confirm(`Remove "${w.label}" from this list? On-chain state is untouched.`)) {
      return
    }
    try {
      await deleteWallet(w.id)
      toast.success('Removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove')
    }
  }

  const activeConfig =
    activeWallet !== 'personal'
      ? wallets.find((w) => w.id === activeWallet.multisigId)
      : undefined

  const activeLabel = activeConfig ? activeConfig.label : 'Personal account'

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span className="max-w-[10rem] truncate">{activeLabel}</span>
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setActiveWallet('personal')
                  setOpen(false)
                }}
              >
                <span>Personal account</span>
                {activeWallet === 'personal' && (
                  <span className="text-primary-600">✓</span>
                )}
              </button>

              {wallets.map((w) => {
                const isActive =
                  activeWallet !== 'personal' && activeWallet.multisigId === w.id
                const addr = w.cosmosAddress ?? w.safeAddress ?? ''
                return (
                  <div
                    key={w.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <button
                      className="flex flex-1 items-center justify-between text-left"
                      onClick={() => {
                        setActiveWallet({ multisigId: w.id })
                        setOpen(false)
                      }}
                    >
                      <span className="flex flex-col items-start">
                        <span className="font-medium">
                          {w.label}
                          <span className="ml-1 text-xs text-gray-400">
                            {w.type === 'safe' ? 'Safe' : 'multisig'}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-gray-400">
                          {truncateAddress(addr)}
                        </span>
                      </span>
                      {isActive && <span className="text-primary-600">✓</span>}
                    </button>
                    <button
                      title="Remove from list"
                      className="ml-2 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRemove(w)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}

              <div className="my-1 border-t border-gray-100" />
              <button
                className="w-full px-3 py-2 text-left text-sm text-primary-600 hover:bg-gray-50"
                onClick={() => {
                  setShowCreate(true)
                  setOpen(false)
                }}
              >
                Add multisig…
              </button>
            </div>
          </>
        )}
      </div>

      <CreateMultisigModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
