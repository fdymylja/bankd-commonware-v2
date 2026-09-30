'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface UnlockModalProps {
  isOpen: boolean
  onClose: () => void
  onUnlock: (password: string) => Promise<void>
  onUnlockWithPasskey?: () => Promise<void>
  /** Whether this wallet uses passkey authentication */
  hasPasskey?: boolean
  error?: string | null
}

export function UnlockModal({
  isOpen,
  onClose,
  onUnlock,
  onUnlockWithPasskey,
  hasPasskey = false,
  error,
}: UnlockModalProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Note: WebAuthn requires user gesture, can't auto-trigger on page load

  const handlePasskeyUnlock = async () => {
    if (!onUnlockWithPasskey) return

    setIsLoading(true)
    setLocalError(null)

    try {
      await onUnlockWithPasskey()
      onClose()
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Passkey authentication failed'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPassword('')
      setLocalError(null)
    }
  }, [isOpen])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password) {
      setLocalError('Password is required')
      return
    }

    setIsLoading(true)
    setLocalError(null)

    try {
      await onUnlock(password)
      setPassword('')
      onClose()
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Failed to unlock wallet'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = localError || error

  // Passkey unlock UI
  if (hasPasskey && onUnlockWithPasskey) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Unlock Wallet">
        <div className="space-y-4">
          <div className="flex flex-col items-center py-4">
            <div className="mb-4 text-5xl">🔐</div>
            <p className="text-center text-sm text-gray-600">
              {isLoading ? 'Authenticating...' : 'Use your passkey to unlock your wallet'}
            </p>
            <p className="mt-1 text-center text-xs text-gray-500">
              Face ID, Touch ID, or security key
            </p>
          </div>

          {displayError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {displayError}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <Button onClick={handlePasskeyUnlock} isLoading={isLoading} className="w-full">
              {isLoading ? 'Authenticating...' : 'Unlock with Passkey'}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  // Password unlock UI
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unlock Wallet">
      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Enter your password to unlock your wallet.
        </p>

        <Input
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoFocus
          error={displayError || undefined}
        />

        <div className="flex justify-center pt-2">
          <Button type="submit" isLoading={isLoading} className="w-full">
            Unlock
          </Button>
        </div>
      </form>
    </Modal>
  )
}
