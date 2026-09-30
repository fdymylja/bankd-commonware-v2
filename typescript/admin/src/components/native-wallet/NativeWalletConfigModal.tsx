'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  type AccountRecord,
  addAccount,
  exportAdminEphemeralAddressRegistry,
  getAccounts,
  importAdminEphemeralAddressRegistry,
  useNativeWallet,
} from '@/lib/native-wallet'
import { truncateAddress } from '@/lib/utils'

interface NativeWalletConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AccountWithAddress extends AccountRecord {
  penumbraAddress?: string
  evmAddress?: string
}

export function NativeWalletConfigModal({
  isOpen,
  onClose,
}: NativeWalletConfigModalProps) {
  const {
    addresses,
    currentAccount,
    switchAccount,
    lock,
    reset,
    resetCacheAndResync,
    initState,
    exportSeedPhrase,
    getEVMAddressForIndex,
    hasPasskey,
    authMethod,
  } = useNativeWallet()

  const [accounts, setAccounts] = useState<AccountWithAddress[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newAccountLabel, setNewAccountLabel] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetCacheConfirm, setShowResetCacheConfirm] = useState(false)
  const [showExportSeed, setShowExportSeed] = useState(false)
  const [exportPassword, setExportPassword] = useState('')
  const [revealedSeed, setRevealedSeed] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showImportRegistry, setShowImportRegistry] = useState(false)
  const [importRegistryText, setImportRegistryText] = useState('')

  const queryClient = useQueryClient()

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setShowAddAccount(false)
      setNewAccountLabel('')
      setShowResetConfirm(false)
      setShowResetCacheConfirm(false)
      setShowExportSeed(false)
      setExportPassword('')
      setRevealedSeed(null)
      setExportError(null)
      setShowImportRegistry(false)
      setImportRegistryText('')
    }
  }, [isOpen])

  // Load accounts when modal opens
  useEffect(() => {
    if (isOpen && initState === 'unlocked') {
      loadAccounts()
    }
  }, [isOpen, initState])

  const loadAccounts = async () => {
    try {
      const accts = await getAccounts()
      
      // Derive EVM addresses for each account (async)
      const acctsWithAddresses: AccountWithAddress[] = await Promise.all(
        accts.map(async (acct) => {
          const evmAddr = await getEVMAddressForIndex(acct.index)
          return { ...acct, evmAddress: evmAddr?.hex }
        })
      )
      setAccounts(acctsWithAddresses)
    } catch (error) {
      console.error('Failed to load accounts:', error)
    }
  }

  const handleSwitchAccount = async (index: number) => {
    if (index === currentAccount) return
    
    setIsLoading(true)
    try {
      await switchAccount(index)
      toast.success(`Switched to account ${index}`)
    } catch (error) {
      toast.error('Failed to switch account')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddAccount = async () => {
    if (!newAccountLabel.trim()) {
      toast.error('Please enter an account label')
      return
    }

    setIsLoading(true)
    try {
      const nextIndex = accounts.length > 0 
        ? Math.max(...accounts.map(a => a.index)) + 1 
        : 0
      
      await addAccount(nextIndex, newAccountLabel.trim())
      await loadAccounts()
      setNewAccountLabel('')
      setShowAddAccount(false)
      toast.success(`Account "${newAccountLabel.trim()}" created`)
    } catch (error) {
      toast.error('Failed to create account')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetWallet = async () => {
    setIsLoading(true)
    try {
      await reset()

      toast.success('Wallet reset successfully.')
      onClose()
    } catch (error) {
      console.error('Failed to reset wallet:', error)
      toast.error('Failed to reset wallet')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetCacheAndResync = async () => {
    setIsLoading(true)
    try {
      await resetCacheAndResync()
      queryClient.invalidateQueries()
      setShowResetCacheConfirm(false)
      toast.success('Scan cache cleared. Resync started.')
    } catch (error) {
      console.error('Failed to reset cache:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reset cache')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLock = () => {
    lock()
    onClose()
    toast.success('Wallet locked')
  }

  const handleExportSeed = async () => {
    // For password auth, require password
    if (!hasPasskey && !exportPassword) {
      setExportError('Please enter your password')
      return
    }

    setIsLoading(true)
    setExportError(null)
    try {
      // For passkey auth, don't pass password (will trigger biometric)
      // For password auth, pass the password
      const seed = await exportSeedPhrase(hasPasskey ? undefined : exportPassword)
      setRevealedSeed(seed)
    } catch (error) {
      setExportError(
        hasPasskey 
          ? 'Passkey authentication failed' 
          : 'Incorrect password'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseExport = () => {
    setShowExportSeed(false)
    setExportPassword('')
    setRevealedSeed(null)
    setExportError(null)
  }

  const handleCopySeed = async () => {
    if (revealedSeed) {
      await navigator.clipboard.writeText(revealedSeed)
      toast.success('Seed phrase copied to clipboard')
    }
  }

  const handleExportRegistry = async () => {
    try {
      const registry = await exportAdminEphemeralAddressRegistry()
      await navigator.clipboard.writeText(JSON.stringify(registry, null, 2))
      toast.success('Address registry copied')
    } catch (error) {
      toast.error('Failed to export address registry')
    }
  }

  const handleImportRegistry = async () => {
    try {
      const parsed = JSON.parse(importRegistryText)
      await importAdminEphemeralAddressRegistry(parsed)
      queryClient.invalidateQueries({ queryKey: ['ephemeral-address-registry'] })
      queryClient.invalidateQueries({ queryKey: ['atomicSwap'] })
      queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
      setShowImportRegistry(false)
      setImportRegistryText('')
      toast.success('Address registry imported')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import registry')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Private Wallet Settings"
      size="md"
    >
      <div className="space-y-6">
        {/* Current Address */}
        {addresses && (
          <div className="rounded-lg bg-purple-50 p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-blue-600 mb-1">Public Address</p>
              <p className="font-mono text-xs text-blue-900 break-all">
                {addresses.evm.hex}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-purple-600 mb-1">Private Address</p>
              <p className="font-mono text-xs text-purple-900 break-all">
                {addresses.penumbra.bech32}
              </p>
            </div>
          </div>
        )}

        {/* Accounts Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Accounts</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddAccount(!showAddAccount)}
            >
              {showAddAccount ? 'Cancel' : '+ Add Account'}
            </Button>
          </div>

          {/* Add Account Form */}
          {showAddAccount && (
            <div className="mb-3 p-3 rounded-lg bg-gray-50 space-y-2">
              <p className="text-xs text-gray-500">
                Creates a new address under <strong>this same wallet</strong>
                {' '}(derived from your seed phrase) - just give it a label. It
                does <strong>not</strong> import an outside key. To sign as a
                different key (e.g. another multisig owner), open a separate
                browser profile and import that key&apos;s seed phrase.
              </p>
              <Input
                placeholder="Account label (e.g. Treasury)"
                value={newAccountLabel}
                onChange={(e) => setNewAccountLabel(e.target.value)}
                disabled={isLoading}
              />
              <Button
                size="sm"
                onClick={handleAddAccount}
                isLoading={isLoading}
                disabled={!newAccountLabel.trim()}
                className="w-full"
              >
                Create Account
              </Button>
            </div>
          )}

          {/* Account List */}
          <div className="space-y-2">
            {accounts.map((account) => (
              <button
                key={account.index}
                onClick={() => handleSwitchAccount(account.index)}
                disabled={isLoading}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  account.index === currentAccount
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    account.index === currentAccount ? 'bg-purple-500' : 'bg-gray-300'
                  }`} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {account.label}
                    </p>
                    {account.evmAddress ? (
                      <p className="font-mono text-xs text-gray-500">
                        {truncateAddress(account.evmAddress)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Account #{account.index}
                      </p>
                    )}
                  </div>
                </div>
                {account.index === currentAccount && (
                  <span className="text-xs text-purple-600 font-medium">Active</span>
                )}
              </button>
            ))}

            {accounts.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No accounts found
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          {/* Address Registry Export/Import */}
          <Button
            variant="secondary"
            onClick={handleExportRegistry}
            className="w-full"
          >
            📤 Export Address Registry
          </Button>

          {!showImportRegistry ? (
            <Button
              variant="secondary"
              onClick={() => setShowImportRegistry(true)}
              className="w-full"
            >
              📥 Import Address Registry
            </Button>
          ) : (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-3">
              <p className="text-sm text-blue-700">
                Paste the exported registry JSON below:
              </p>
              <textarea
                className="w-full h-32 p-2 text-xs font-mono border border-blue-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder='{"version": 1, "records": [...]}'
                value={importRegistryText}
                onChange={(e) => setImportRegistryText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowImportRegistry(false)
                    setImportRegistryText('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleImportRegistry}
                  disabled={!importRegistryText.trim()}
                  className="flex-1"
                >
                  Import
                </Button>
              </div>
            </div>
          )}

          {!showResetCacheConfirm ? (
            <Button
              variant="secondary"
              onClick={() => setShowResetCacheConfirm(true)}
              className="w-full"
            >
              🔄 Reset Cache & Resync
            </Button>
          ) : (
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-3">
              <p className="text-sm text-purple-700">
                This clears scanned private notes, balances, IBC denom cache, and pending private transfer jobs, then rescans from the chain. Your wallet, accounts, seed phrase, and address registry are preserved.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowResetCacheConfirm(false)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleResetCacheAndResync}
                  isLoading={isLoading}
                  className="flex-1"
                >
                  Reset & Resync
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="secondary"
            onClick={handleLock}
            className="w-full"
          >
            🔒 Lock Wallet
          </Button>

          {/* Export Seed Phrase Section */}
          {!showExportSeed ? (
            <Button
              variant="secondary"
              onClick={() => setShowExportSeed(true)}
              className="w-full"
            >
              📝 Export Seed Phrase
            </Button>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
              {!revealedSeed ? (
                <>
                  <p className="text-sm text-amber-700">
                    ⚠️ Never share your seed phrase. Anyone with it can access your funds.
                  </p>
                  
                  {hasPasskey ? (
                    // Passkey authentication UI
                    <>
                      <div className="flex flex-col items-center py-2">
                        <div className="text-3xl mb-2">🔐</div>
                        <p className="text-sm text-amber-700 text-center">
                          Authenticate with your passkey to reveal
                        </p>
                      </div>
                      {exportError && (
                        <p className="text-sm text-red-600 text-center">{exportError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCloseExport}
                          className="flex-1"
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleExportSeed}
                          isLoading={isLoading}
                          className="flex-1"
                        >
                          Reveal with Passkey
                        </Button>
                      </div>
                    </>
                  ) : (
                    // Password authentication UI
                    <>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        value={exportPassword}
                        onChange={(e) => {
                          setExportPassword(e.target.value)
                          setExportError(null)
                        }}
                        error={exportError || undefined}
                        disabled={isLoading}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCloseExport}
                          className="flex-1"
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleExportSeed}
                          isLoading={isLoading}
                          className="flex-1"
                        >
                          Reveal
                        </Button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-amber-700 font-medium">
                    🔑 Your Seed Phrase
                  </p>
                  <div className="p-3 rounded bg-white border border-amber-300">
                    <p className="font-mono text-sm text-gray-900 break-all select-all">
                      {revealedSeed}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCloseExport}
                      className="flex-1"
                    >
                      Close
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCopySeed}
                      className="flex-1"
                    >
                      Copy
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Reset Section */}
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full text-center text-sm text-red-500 hover:text-red-700 py-2"
            >
              Reset Wallet
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-3">
              <p className="text-sm text-red-700">
                ⚠️ This will delete all wallet data including accounts and transaction history. 
                Make sure you have backed up your seed phrase!
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleResetWallet}
                  isLoading={isLoading}
                  className="flex-1"
                >
                  Reset Wallet
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
