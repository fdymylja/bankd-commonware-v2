'use client'

import { generateMnemonic, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { isWebAuthnSupported } from '@/lib/native-wallet'

interface CreateWalletModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateWallet: (
    seedPhrase: string,
    password: string,
    label: string
  ) => Promise<void>
  onCreateWalletWithPasskey: (
    seedPhrase: string,
    label: string
  ) => Promise<void>
  onImportWallet: (
    seedPhrase: string,
    password: string,
    label: string
  ) => Promise<void>
  onImportWalletWithPasskey: (
    seedPhrase: string,
    label: string
  ) => Promise<void>
  /** Which tab to open on. Defaults to 'create'. */
  initialMode?: Mode
  error?: string | null
}

type Mode = 'create' | 'import'
type AuthType = 'password' | 'passkey'

/**
 * Generate a cryptographically secure BIP39 mnemonic.
 */
function generateSecureMnemonic(): string {
  return generateMnemonic(wordlist, 128)
}

/**
 * Validate a BIP39 mnemonic phrase.
 */
function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim().toLowerCase(), wordlist)
}

export function CreateWalletModal({
  isOpen,
  onClose,
  onCreateWallet,
  onCreateWalletWithPasskey,
  onImportWallet,
  onImportWalletWithPasskey,
  initialMode = 'create',
  error,
}: CreateWalletModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [authType, setAuthType] = useState<AuthType>('passkey')
  const [seedPhrase, setSeedPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [label, setLabel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [hasCopied, setHasCopied] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)

  // Check passkey support on mount
  useEffect(() => {
    const supported = isWebAuthnSupported()
    setPasskeySupported(supported)
    // Default to password if passkey not supported
    if (!supported) {
      setAuthType('password')
    }
  }, [])

  // Snap to the requested tab each time the modal opens.
  useEffect(() => {
    if (isOpen) setMode(initialMode)
  }, [isOpen, initialMode])

  // Generate a new seed phrase when modal opens in create mode
  useEffect(() => {
    if (isOpen && mode === 'create') {
      setSeedPhrase(generateSecureMnemonic())
      setHasCopied(false)
    }
  }, [isOpen, mode])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPassword('')
      setConfirmPassword('')
      setLabel('')
      setLocalError(null)
    }
  }, [isOpen])

  const handleCopySeed = async () => {
    try {
      await navigator.clipboard.writeText(seedPhrase)
      setHasCopied(true)
    } catch {
      setLocalError('Failed to copy seed phrase')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    const trimmedSeedPhrase = seedPhrase.trim()

    // Validation
    if (!trimmedSeedPhrase) {
      setLocalError('Seed phrase is required')
      return
    }

    if (!isValidMnemonic(trimmedSeedPhrase)) {
      setLocalError(
        'Invalid seed phrase. Please enter a valid 12 or 24 word BIP39 mnemonic.'
      )
      return
    }

    if (mode === 'create' && !hasCopied) {
      setLocalError('Please copy your seed phrase before continuing')
      return
    }

    // Password validation (only for password auth)
    if (authType === 'password') {
      if (!password) {
        setLocalError('Password is required')
        return
      }

      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters')
        return
      }

      if (password !== confirmPassword) {
        setLocalError('Passwords do not match')
        return
      }
    }

    setIsLoading(true)

    try {
      const walletLabel = label || (mode === 'create' ? 'My Wallet' : 'Imported Wallet')
      
      if (authType === 'passkey') {
        if (mode === 'create') {
          await onCreateWalletWithPasskey(trimmedSeedPhrase, walletLabel)
        } else {
          await onImportWalletWithPasskey(trimmedSeedPhrase, walletLabel)
        }
      } else {
        if (mode === 'create') {
          await onCreateWallet(trimmedSeedPhrase, password, walletLabel)
        } else {
          await onImportWallet(trimmedSeedPhrase, password, walletLabel)
        }
      }
      
      // Reset form
      setSeedPhrase('')
      setPassword('')
      setConfirmPassword('')
      setLabel('')
      setHasCopied(false)
      onClose()
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Failed to create wallet'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create Wallet' : 'Import Wallet'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Mode tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              mode === 'create'
                ? 'border-b-2 border-primary-500 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode('create')}
          >
            Create New
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              mode === 'import'
                ? 'border-b-2 border-primary-500 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              setMode('import')
              setSeedPhrase('')
              setHasCopied(false)
              setLocalError(null)
            }}
          >
            Import Existing
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seed phrase */}
          {mode === 'create' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Recovery Seed Phrase
              </label>
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
                <p className="mb-2 font-mono text-sm leading-relaxed text-gray-700">
                  {seedPhrase}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-amber-600">
                    ⚠️ Write this down and store it safely. It cannot be
                    recovered.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopySeed}
                  >
                    {hasCopied ? '✓ Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Recovery Seed Phrase
              </label>
              <textarea
                value={seedPhrase}
                onChange={(e) => {
                  setSeedPhrase(e.target.value)
                  if (localError?.includes('Invalid seed phrase')) {
                    setLocalError(null)
                  }
                }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                placeholder="Enter your 12 or 24 word recovery phrase..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter each word separated by spaces
              </p>
            </div>
          )}

          {/* Wallet label */}
          <Input
            label="Wallet Name (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={mode === 'create' ? 'My Wallet' : 'Imported Wallet'}
          />

          {/* Auth type selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Security Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Passkey option */}
              <button
                type="button"
                disabled={!passkeySupported}
                onClick={() => setAuthType('passkey')}
                className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                  authType === 'passkey'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!passkeySupported ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🔐</div>
                  <div>
                    <div className="font-medium text-gray-900">Passkey</div>
                    <div className="text-xs text-gray-500">
                      Face ID, Touch ID, or security key
                    </div>
                  </div>
                </div>
                {authType === 'passkey' && (
                  <div className="absolute right-2 top-2 text-primary-500">✓</div>
                )}
                {!passkeySupported && (
                  <div className="mt-2 text-xs text-amber-600">
                    Not supported in this browser
                  </div>
                )}
              </button>

              {/* Password option */}
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                  authType === 'password'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🔑</div>
                  <div>
                    <div className="font-medium text-gray-900">Password</div>
                    <div className="text-xs text-gray-500">
                      Traditional password protection
                    </div>
                  </div>
                </div>
                {authType === 'password' && (
                  <div className="absolute right-2 top-2 text-primary-500">✓</div>
                )}
              </button>
            </div>
            
            {authType === 'passkey' && passkeySupported && (
              <p className="mt-2 text-xs text-green-600">
                ✓ Passkeys are phishing-resistant and more secure than passwords
              </p>
            )}
          </div>

          {/* Password fields (only shown for password auth) */}
          {authType === 'password' && (
            <>
              <Input
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                hint="At least 8 characters"
              />

              <Input
                type="password"
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
              />
            </>
          )}

          {/* Error display */}
          {displayError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {displayError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {authType === 'passkey' ? (
                <>
                  {mode === 'create' ? 'Create with Passkey' : 'Import with Passkey'}
                </>
              ) : (
                <>{mode === 'create' ? 'Create Wallet' : 'Import Wallet'}</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
