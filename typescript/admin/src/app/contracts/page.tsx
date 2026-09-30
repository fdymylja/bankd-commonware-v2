'use client'

import {
  CustomToken,
  MOCK_ERC20_ABI,
  MOCK_ERC20_BYTECODE,
} from '@bankd/shared/evm/mockERC20'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { type Abi, type Hex, getAddress } from 'viem'
import { useAccount } from 'wagmi'

import { ContractInteract } from '@/components/contracts/ContractInteract'
import { PageContainer } from '@/components/layout'
import { Button, Card, CopyButton, Input, Modal } from '@/components/ui'
import { useEVMWallet } from '@/hooks'
import {
  type EnrichedContract,
  useDeployedContracts,
} from '@/hooks/useDeployedContracts'
import { loadAbi, removeAbi, saveAbiFromJson } from '@/lib/evm/contractAbiStorage'
import { addCustomToken } from '@/lib/evm/customTokenStorage'
import {
  assertBroadcast,
  deployedAddress,
  executeTx,
  isProposedResult,
} from '@/lib/evm/execute'
import { getErrorMessage, truncateAddress } from '@/lib/utils'

export default function ContractsPage() {
  const { hexAddress } = useEVMWallet()
  const { chainId: connectedChainId } = useAccount()
  const queryClient = useQueryClient()
  const [deployOpen, setDeployOpen] = useState(false)
  const { data: capabilities } = useQuery({ queryKey: ['contractCapabilities'], queryFn: async () => { const response = await fetch('/api/contracts/capabilities', { cache: 'no-store' }); if (!response.ok) throw new Error('Contract tooling is not authorized'); return response.json() as Promise<{ wallet: Hex; chainId: number; canWrite: boolean }> } })
  const toolEnabled = !!capabilities?.canWrite && capabilities.wallet.toLowerCase() === hexAddress?.toLowerCase() && capabilities.chainId === connectedChainId

  const walletReady = !!hexAddress
  const { data: inventory, isLoading, error, refetch } = useDeployedContracts({ enabled: walletReady })
  const contracts = inventory?.contracts


  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['deployedContracts'] })
    refetch()
  }

  return (
    <PageContainer
      title="Contracts"
      description="Successful top-level CREATE deployments by the authenticated wallet, indexed by Shinzo. Factory/internal CREATE and CREATE2 are not covered; creator does not prove owner or control."
    >
      <Card
        header="Deployed contracts"
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setDeployOpen(true)}
              // Deploy is a client-side EVM tx via your own wallet - it doesn't
              // need the Shinzo index/capabilities, so keep it usable even when
              // those fail to load. Only requires a connected wallet.
              disabled={!walletReady}
            >
              Deploy ERC20
            </Button>
          </div>
        }
      >
        {!hexAddress && (
          <p className="text-sm text-gray-500">
            Connect a wallet to see contracts it deployed.
          </p>
        )}
        {isLoading && <p className="text-sm text-gray-500">Loading index...</p>}
        {error && (
          <p className="text-sm text-red-600">
            {getErrorMessage(error, 'Failed to load contracts')}
          </p>
        )}
        {contracts && contracts.length === 0 && !isLoading && (
          <p className="text-sm text-gray-500">
            No successful top-level CREATE deployments are indexed for the authenticated wallet. Deploy one to get
            started (it shows up once Shinzo indexes the block).
          </p>
        )}
        {inventory && <div className="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-600">Shinzo quorum {inventory.provenance.signerIds.length}/{inventory.provenance.requiredSigners} · chain {inventory.identity.chainId} · indexed {inventory.provenance.indexedStartHeight}–{inventory.provenance.latestHeight} · {inventory.coverage.complete ? 'complete' : 'truncated'}. Factory/internal CREATE and CREATE2 are unsupported; creator does not establish ownership/control.</div>}
        {capabilities && !toolEnabled && <p className="mb-3 text-sm text-red-600">Write tooling is blocked: connected signer or chain does not match the authenticated wallet and configured chain.</p>}
        {walletReady && (
          <div className="flex flex-col gap-3">
            {contracts?.map((contract) => (
              <ContractRow key={contract.address} contract={contract} chainId={inventory!.identity.chainId} writeEnabled={toolEnabled} />
            ))}
          </div>
        )}
      </Card>

      <DeployERC20Modal
        isOpen={deployOpen}
        onClose={() => setDeployOpen(false)}
        onSuccess={(token) => {
          addCustomToken(token)
          refresh()
        }}
      />
    </PageContainer>
  )
}

function ContractRow({ contract, chainId, writeEnabled }: { contract: EnrichedContract; chainId: number; writeEnabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [abi, setAbi] = useState<Abi | null>(null)

  // ERC20s are interactive out of the box; anything else needs an uploaded ABI.
  useEffect(() => {
    if (contract.erc20) {
      setAbi(MOCK_ERC20_ABI as unknown as Abi)
    } else {
      setAbi(loadAbi(chainId, contract.address)?.abi ?? null)
    }
  }, [chainId, contract.address, contract.erc20])

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-900">
              {truncateAddress(contract.address, 10, 8)}
            </span>
            <CopyButton value={contract.address} />
            {contract.erc20 ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                ERC20 · {contract.erc20.symbol}
              </span>
            ) : (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {contract.hasCode ? 'Contract' : 'no code'}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {contract.erc20 && (
              <span>
                {contract.erc20.name} · supply{' '}
                {contract.erc20.totalSupplyFormatted} ·{' '}
              </span>
            )}
            deployer {truncateAddress(contract.deployer, 6, 4)} · block{' '}
            {contract.blockNumber}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Interact'}
        </Button>
      </div>
      {open && (
        <div className="border-t border-gray-200 p-3">
          {abi ? (
            <>
              <ContractInteract address={contract.address} abi={abi} writeEnabled={writeEnabled} />
              {!contract.erc20 && (
                <button
                  className="mt-3 text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    removeAbi(chainId, contract.address)
                    setAbi(null)
                  }}
                >
                  remove ABI
                </button>
              )}
            </>
          ) : (
            <AbiUpload
              chainId={chainId}
              address={contract.address}
              onLoaded={(loaded) => setAbi(loaded)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function AbiUpload({
  chainId,
  address,
  onLoaded,
}: {
  chainId: number
  address: Hex
  onLoaded: (abi: Abi) => void
}) {
  const [json, setJson] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    try {
      const record = saveAbiFromJson(chainId, address, json)
      onLoaded(record.abi)
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid ABI'))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        Paste the contract ABI (or a full compiler artifact) to interact with it.
      </p>
      <textarea
        className="h-32 w-full rounded border border-gray-200 p-2 font-mono text-xs"
        placeholder='[{"type":"function","name":"...","inputs":[],"outputs":[]}]'
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Button size="sm" onClick={load} disabled={!json.trim()}>
          Load ABI
        </Button>
      </div>
    </div>
  )
}

function DeployERC20Modal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: (token: CustomToken) => void
}) {
  const queryClient = useQueryClient()
  const { hexAddress } = useEVMWallet()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState('6')
  const [isDeploying, setIsDeploying] = useState(false)

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hexAddress) {
      toast.error('Please connect your wallet first')
      return
    }
    if (!name.trim() || !symbol.trim()) {
      toast.error('Name and symbol are required')
      return
    }
    const decimalsNum = parseInt(decimals, 10)
    if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
      toast.error('Decimals must be between 0 and 18')
      return
    }

    setIsDeploying(true)
    try {
      const results = await executeTx(queryClient, {
        abi: MOCK_ERC20_ABI,
        bytecode: MOCK_ERC20_BYTECODE,
        args: [name.trim(), symbol.trim(), decimalsNum],
        successMessage: 'Contract deployed',
      })
      // Safe active: the deploy was proposed. The CREATE2 address is deterministic
      // and known up front, so save the token now - otherwise it never shows in
      // the list (Shinzo doesn't index CREATE2 deploys). Its balance resolves once
      // the Safe co-signs and executes the proposal.
      if (isProposedResult(results)) {
        const predicted = deployedAddress(results, 0)
        if (predicted) {
          onSuccess({
            address: getAddress(predicted),
            name: name.trim(),
            symbol: symbol.trim(),
            decimals: decimalsNum,
          })
        }
        setName('')
        setSymbol('')
        setDecimals('6')
        onClose()
        return
      }
      const [result] = results
      assertBroadcast(result)
      if (result.contractAddress) {
        onSuccess({
          address: getAddress(result.contractAddress),
          name: name.trim(),
          symbol: symbol.trim(),
          decimals: decimalsNum,
        })
        setName('')
        setSymbol('')
        setDecimals('6')
        onClose()
      }
    } catch (error) {
      console.error('Failed to deploy contract:', error)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deploy ERC20" size="md">
      <form onSubmit={handleDeploy} className="space-y-4">
        <p className="text-sm text-gray-500">
          Deploys a standard ERC20 and mints 1,000,000 units to your wallet. It
          appears in the list once Shinzo indexes the deployment block.
        </p>
        <Input
          label="Name"
          placeholder="My Token"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Symbol"
          placeholder="MTK"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        />
        <Input
          label="Decimals"
          type="number"
          value={decimals}
          onChange={(e) => setDecimals(e.target.value)}
          hint="0-18, default 6"
        />
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isDeploying} className="flex-1">
            Deploy
          </Button>
        </div>
      </form>
    </Modal>
  )
}
