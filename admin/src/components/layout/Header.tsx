'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

import { WalletSwitcher } from '@/components/multisig'
import { CreateWalletModal, NativeWalletConfigModal, UnlockModal } from '@/components/native-wallet'
import { Button } from '@/components/ui'
import { useNativeWallet } from '@/lib/native-wallet'
import { truncateAddress } from '@/lib/utils'

interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalMode, setCreateModalMode] = useState<'create' | 'import'>('create')
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)

  const openCreate = () => {
    setCreateModalMode('create')
    setShowCreateModal(true)
  }
  const openImport = () => {
    setCreateModalMode('import')
    setShowCreateModal(true)
  }
  
  // Wagmi hooks for EVM connection
  const { connect, connectors } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { isConnected: isWagmiConnected } = useAccount()
  
  // Unified native wallet
  const wallet = useNativeWallet()

  // Get the native wallet connector
  const nativeConnector = connectors.find(c => c.id === 'native-wallet')

  // Auto-connect wagmi when native wallet is unlocked
  useEffect(() => {
    if (wallet.initState === 'unlocked' && !isWagmiConnected && nativeConnector) {
      connect({ connector: nativeConnector })
    }
  }, [wallet.initState, isWagmiConnected, nativeConnector, connect])

  // Auto-show unlock modal if wallet exists and is locked
  useEffect(() => {
    // Don't show any modals while still initializing
    if (wallet.isInitializing) {
      return
    }

    if (wallet.initState === 'locked' && wallet.authMethod !== null) {
      // Wallet exists but is locked - show unlock modal
      setShowUnlockModal(true)
    }
  }, [wallet.initState, wallet.authMethod, wallet.isInitializing])

  const handleLock = () => {
    wagmiDisconnect()
    wallet.lock()
  }

  const handleCreateWallet = async (
    seedPhrase: string,
    password: string,
    label: string
  ) => {
    await wallet.createWallet(seedPhrase, password, label)
    toast.success('Wallet created successfully!')
    setShowCreateModal(false)
  }

  const handleCreateWalletWithPasskey = async (
    seedPhrase: string,
    label: string
  ) => {
    await wallet.createWalletWithPasskey(seedPhrase, label)
    toast.success('Wallet created with passkey!')
    setShowCreateModal(false)
  }

  const handleImportWallet = async (
    seedPhrase: string,
    password: string,
    label: string
  ) => {
    await wallet.importWallet(seedPhrase, password, label)
    toast.success('Wallet imported successfully!')
    setShowCreateModal(false)
  }

  const handleImportWalletWithPasskey = async (
    seedPhrase: string,
    label: string
  ) => {
    await wallet.createWalletWithPasskey(seedPhrase, label)
    toast.success('Wallet imported with passkey!')
    setShowCreateModal(false)
  }

  const handleUnlock = async (password: string) => {
    await wallet.unlock(password)
    toast.success('Wallet unlocked!')
    setShowUnlockModal(false)
  }

  const handleUnlockWithPasskey = async () => {
    await wallet.unlockWithPasskey()
    toast.success('Wallet unlocked!')
    setShowUnlockModal(false)
  }

  const isConnected = wallet.initState === 'unlocked' && wallet.addresses

  // Determine what button to show based on wallet state
  const renderWalletButton = () => {
    // While the async wallet-existence check runs, initState is still the
    // default 'uninitialized' - don't flash "Setup Wallet" at a returning user.
    if (wallet.isInitializing) {
      return (
        <Button size="sm" disabled>
          Loading…
        </Button>
      )
    }
    switch (wallet.initState) {
      case 'uninitialized':
        return (
          <Button onClick={openCreate} size="sm">
            Setup Wallet
          </Button>
        )
      case 'locked':
        // A wallet already exists here - this is a login, not first-time setup.
        return (
          <Button onClick={() => setShowUnlockModal(true)} size="sm">
            Wallet Login
          </Button>
        )
      case 'unlocked':
        return null // Will show the connected state instead
    }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Multisig switcher: signing needs the unlocked native key */}
          {isConnected && <WalletSwitcher />}

          {isConnected && wallet.addresses ? (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <button
                onClick={() => setShowConfigModal(true)}
                className="font-mono text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {truncateAddress(wallet.addresses.evm.hex)}
              </button>

              <button
                onClick={openImport}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Import a different account (swaps the active seed)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v6.638l1.96-2.158a.75.75 0 1 1 1.11 1.004l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 1 1 1.1-1.004l1.96 2.158V3.75A.75.75 0 0 1 10 3Zm-6 12.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                </svg>
              </button>

              <button
                onClick={handleLock}
                className="rounded p-1 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                title="Lock wallet"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
                </svg>
              </button>

              <button
                onClick={() => setShowConfigModal(true)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Wallet settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ) : (
            renderWalletButton()
          )}
        </div>
      </header>

      {/* Wallet Modals */}
      <CreateWalletModal
        isOpen={showCreateModal}
        initialMode={createModalMode}
        onClose={() => setShowCreateModal(false)}
        onCreateWallet={handleCreateWallet}
        onCreateWalletWithPasskey={handleCreateWalletWithPasskey}
        onImportWallet={handleImportWallet}
        onImportWalletWithPasskey={handleImportWalletWithPasskey}
      />

      <UnlockModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        onUnlock={handleUnlock}
        onUnlockWithPasskey={wallet.hasPasskey ? handleUnlockWithPasskey : undefined}
        hasPasskey={wallet.hasPasskey}
        error={wallet.error}
      />

      <NativeWalletConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </>
  )
}
