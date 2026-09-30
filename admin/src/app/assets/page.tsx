'use client'

import {
  MsgConvertERC20,
  MsgRegisterERC20,
} from '@bankd/shared/proto/cosmos/evm/erc20/v1/tx'
import { MsgDeposit } from '@bankd/shared/shieldd/msg-deposit'
import { useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Hex, parseUnits } from 'viem'

import { RegulatedAssetCommandBuilder } from '@/components/assets/RegulatedAssetCommandBuilder'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CopyButton,
  Input,
  Modal,
  PermissionAlert,
  PermissionBadge,
} from '@/components/ui'
import {
  CustomTokenBalance,
  useBalances,
  useComplianceAssetStatus,
  useCustomTokenBalances,
  useCustomTokens,
  useEVMWallet,
  usePenumbra,
  usePenumbraBalances,
  usePermissions,
} from '@/hooks'
import { chainConfig } from '@/lib/config'
import { queryKeys } from '@/lib/cosmos'
import {
  CustomToken,
  MOCK_ERC20_ABI,
  MOCK_ERC20_BYTECODE,
  NATIVE_ABI,
  NATIVE_PRECOMPILE_ADDRESS,
  parseAmount,
} from '@/lib/evm'
import { assertBroadcast, executeTx } from '@/lib/evm/execute'
import { guardSafeUnsupported, useActiveAccount } from '@/lib/multisig'
import {
  generateAndSaveEphemeralAddressRecord,
  useNativeWallet,
} from '@/lib/native-wallet'
import { encodeInitCode, predictCreate2Address, randomSalt } from '@/lib/safe'
import {
  formatAmount,
  formatTokenAmount,
  isValidAddress,
  isValidHexAddress,
  truncateAddress,
} from '@/lib/utils'

type AssetRow = {
  key: string
  symbol: string
  decimals: number
  erc20Address?: string
  /** Bank module balance (native denom or an erc20: denom). */
  bankAmount: bigint
  /** ERC20 contract balance. */
  erc20Amount: bigint
  privateAmount: bigint
  /** Set when the asset has an ERC20 that can be shielded from this page. */
  token?: CustomTokenBalance
}

// The native ERC20 precompile reports the same funds as the bank balance, so
// take one side of the pair instead of adding them.
function publicAmount(row: AssetRow): bigint {
  if (row.key !== 'native') return row.bankAmount + row.erc20Amount
  return row.bankAmount > row.erc20Amount ? row.bankAmount : row.erc20Amount
}

export default function AssetsPage() {
  const nativeWallet = useNativeWallet()
  const { evmAddress: hexAddress, cosmosAddress: bech32Address } =
    useActiveAccount()
  const { data: balances = [], isLoading } = useBalances(bech32Address ?? null)
  const { isConnected: isPenumbraConnected } = usePenumbra()
  const { data: penumbraBalances = [], isLoading: isPenumbraLoading } =
    usePenumbraBalances()
  const { isSyncing, syncProgress } = nativeWallet
  const queryClient = useQueryClient()

  // Custom ERC20 tokens
  const { tokens: customTokens, addToken } = useCustomTokens()
  const { data: customTokenBalances = [], invalidate: invalidateCustomTokens } =
    useCustomTokenBalances(customTokens, hexAddress ?? null)

  // Deploy modal state
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)

  // Convert modal state
  const [tokenToConvert, setTokenToConvert] =
    useState<CustomTokenBalance | null>(null)

  // Send to Private modal state
  const [tokenToSendPrivate, setTokenToSendPrivate] =
    useState<CustomTokenBalance | null>(null)

  const invalidateBalances = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.balances.byAddress(bech32Address!),
    })
    queryClient.invalidateQueries({ queryKey: ['penumbra', 'balances'] })
    invalidateCustomTokens()
  }

  const handleTokenDeployed = (token: CustomToken) => {
    addToken(token)
    invalidateCustomTokens()
  }

  // One row per asset, with the public/private split under the total. The
  // native ERC20 is a precompile view of the bank balance, so those two mirror
  // each other rather than stacking.
  const assetRows = useMemo(() => {
    const nativeErc20 = chainConfig.nativeErc20Address.toLowerCase()
    const displaySymbol = chainConfig.displayDenom.toUpperCase()

    const keyFor = (symbol: string, erc20Address?: string | null) => {
      if (symbol.toUpperCase() === displaySymbol) return 'native'
      const address = erc20Address?.toLowerCase()
      if (address) return address === nativeErc20 ? 'native' : address
      return `symbol:${symbol.toUpperCase()}`
    }

    const rows = new Map<string, AssetRow>()
    const rowFor = (
      key: string,
      seed: { symbol: string; decimals: number; erc20Address?: string }
    ) => {
      const existing = rows.get(key)
      if (existing) {
        if (!existing.erc20Address && seed.erc20Address) {
          existing.erc20Address = seed.erc20Address
        }
        return existing
      }
      const row: AssetRow = {
        key,
        bankAmount: 0n,
        erc20Amount: 0n,
        privateAmount: 0n,
        ...seed,
      }
      rows.set(key, row)
      return row
    }

    for (const balance of balances) {
      const key =
        balance.denom === chainConfig.denom
          ? 'native'
          : keyFor(balance.symbol, balance.erc20Address)
      const row = rowFor(key, {
        symbol: key === 'native' ? chainConfig.displayDenom : balance.symbol,
        decimals: balance.decimals,
        erc20Address: balance.erc20Address ?? undefined,
      })
      row.bankAmount += BigInt(balance.amount)
    }

    for (const token of customTokenBalances) {
      const key = keyFor(token.symbol, token.address)
      const row = rowFor(key, {
        symbol: token.symbol,
        decimals: token.decimals,
        erc20Address: token.address,
      })
      row.erc20Amount += token.balance
      row.token = token
    }

    for (const balance of penumbraBalances) {
      const key = keyFor(balance.symbol, balance.erc20Address)
      const row = rowFor(key, {
        symbol: balance.symbol,
        decimals: balance.decimals,
        erc20Address: balance.erc20Address,
      })
      row.privateAmount += BigInt(balance.amount)
    }

    return [...rows.values()].sort((a, b) => {
      if (a.key === 'native') return -1
      if (b.key === 'native') return 1
      return a.symbol.localeCompare(b.symbol)
    })
  }, [balances, customTokenBalances, penumbraBalances])

  return (
    <PageContainer
      title="Asset Management"
      description="Issue, manage, and monitor digital assets"
    >
      <Card
        header="Balances"
        headerRight={
          <div className="flex items-center gap-3">
            {isPenumbraConnected && syncProgress ? (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                <span className="text-xs text-purple-600">
                  {/* Prevent flickering between 99 and 100% as blocks sync by rounding 99 up to 100 */}
                  {syncProgress.percentage < 99
                    ? `Syncing ${syncProgress.percentage.toFixed(0)}%`
                    : 'Synced 100%'}
                </span>
              </div>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDeployModalOpen(true)}
              disabled={!hexAddress}
            >
              New Unregulated Asset
            </Button>
          </div>
        }
      >
        {/* Sync progress bar - only show when significantly behind (>5 blocks) */}
        {isSyncing &&
          syncProgress &&
          syncProgress.target - syncProgress.current > 5 && (
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span>Syncing private balances...</span>
                <span>
                  {syncProgress.current.toString()} /{' '}
                  {syncProgress.target.toString()}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(syncProgress.percentage, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

        {!bech32Address ? (
          <p className="text-sm text-gray-500">
            Connect your wallet to view balances
          </p>
        ) : isLoading ? (
          <p className="text-sm text-gray-500">Loading balances...</p>
        ) : assetRows.length === 0 ? (
          <p className="text-sm text-gray-500">No balances found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4 text-left">Asset</th>
                  <th className="px-4 py-2 text-right">Public</th>
                  <th className="px-4 py-2 text-right">Private</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="py-2 pl-4" />
                </tr>
              </thead>
              <tbody>
                {assetRows.map((row) => {
                  const publicTotal = publicAmount(row)
                  const total = publicTotal + row.privateAmount
                  const format = (amount: bigint) =>
                    formatAmount(
                      formatTokenAmount(amount.toString(), row.decimals)
                    )
                  const hasPrivate = row.privateAmount > 0n

                  return (
                    <tr
                      key={row.key}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="py-3 pr-4 align-top">
                        <div className="font-mono text-sm font-medium text-gray-900">
                          {row.symbol}
                        </div>
                        {row.erc20Address && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="font-mono text-xs text-gray-500">
                              {truncateAddress(row.erc20Address, 10, 8)}
                            </span>
                            <CopyButton
                              value={row.erc20Address}
                              successMessage="Address copied!"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono text-sm tabular-nums text-gray-700">
                        {format(publicTotal)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right align-top font-mono text-sm tabular-nums ${
                          hasPrivate ? 'text-purple-700' : 'text-gray-400'
                        }`}
                      >
                        {!isPenumbraConnected
                          ? '—'
                          : isPenumbraLoading
                            ? '...'
                            : hasPrivate
                              ? format(row.privateAmount)
                              : '—'}
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono text-sm font-semibold tabular-nums text-gray-900">
                        {format(total)}
                      </td>
                      <td className="py-3 pl-4 text-right align-top">
                        {isPenumbraConnected &&
                          row.token &&
                          row.token.balance > 0n && (
                            <button
                              onClick={() => setTokenToSendPrivate(row.token!)}
                              className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-200"
                              title="Shield to a private address"
                            >
                              Shield
                            </button>
                          )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!isPenumbraConnected && (
              <p className="pt-3 text-xs text-gray-500">
                Connect your private wallet to see private balances
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="mt-6">
        <RegulatedAssetCommandBuilder />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <MintForm
          onSuccess={invalidateBalances}
          customTokens={customTokens}
          customTokenBalances={customTokenBalances}
        />
        <BurnForm onSuccess={invalidateBalances} />
      </div>

      {/* Deploy ERC20 Modal */}
      <DeployERC20Modal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onSuccess={handleTokenDeployed}
      />

      {/* Convert ERC20 Modal */}
      <ConvertERC20Modal
        token={tokenToConvert}
        onClose={() => setTokenToConvert(null)}
        onSuccess={invalidateBalances}
      />

      {/* Send to Private Modal */}
      <SendToPrivateModal
        token={tokenToSendPrivate}
        onClose={() => setTokenToSendPrivate(null)}
        onSuccess={invalidateBalances}
      />
    </PageContainer>
  )
}

function MintForm({
  onSuccess,
  customTokens,
  customTokenBalances,
}: {
  onSuccess: () => void
  customTokens: CustomToken[]
  customTokenBalances: CustomTokenBalance[]
}) {
  const queryClient = useQueryClient()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState<'native' | Hex>('native')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { evmAddress: hexAddress, cosmosAddress: bech32Address } =
    useActiveAccount()
  const { canMint, whitelistedMinters, isNativeLoading } = usePermissions()

  const isNativeMint = selectedToken === 'native'
  const selectedCustomToken = !isNativeMint
    ? customTokens.find(
        (t) =>
          t.address.toLowerCase() === (selectedToken as string).toLowerCase()
      )
    : null
  const selectedTokenBalance = !isNativeMint
    ? customTokenBalances.find(
        (t) =>
          t.address.toLowerCase() === (selectedToken as string).toLowerCase()
      )
    : null
  const selectedTokenExists =
    isNativeMint || (selectedTokenBalance?.exists ?? true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bech32Address || !hexAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!isValidAddress(recipient)) {
      toast.error('Invalid recipient address')
      return
    }

    if (!isValidHexAddress(recipient)) {
      toast.error('Please provide an 0x address for minting')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Invalid amount')
      return
    }

    if (!selectedTokenExists) {
      toast.error(
        'Contract not found on-chain. It may have been deployed on a previous network.'
      )
      return
    }

    setIsSubmitting(true)

    try {
      if (isNativeMint) {
        const amountInMinDenom = parseAmount(amount)
        await executeTx(queryClient, {
          address: NATIVE_PRECOMPILE_ADDRESS,
          abi: NATIVE_ABI,
          functionName: 'mint',
          args: [recipient as Hex, amountInMinDenom],
          successMessage: `${chainConfig.displayDenom} minted successfully!`,
        })
      } else if (selectedCustomToken) {
        const amountBigInt = parseUnits(amount, selectedCustomToken.decimals)
        await executeTx(queryClient, {
          address: selectedCustomToken.address,
          abi: MOCK_ERC20_ABI,
          functionName: 'mint',
          args: [recipient as Hex, amountBigInt],
          successMessage: `${selectedCustomToken.symbol} minted successfully!`,
        })
      }

      setRecipient('')
      setAmount('')
      onSuccess()
    } catch (error) {
      console.error('Failed to mint assets', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card
      header="Mint Assets"
      headerRight={
        <PermissionBadge
          hasPermission={canMint}
          isLoading={isNativeLoading}
          permittedLabel="Authorized"
          deniedLabel="Not Authorized"
        />
      }
    >
      <div className="space-y-4">
        <PermissionAlert
          hasPermission={canMint}
          isLoading={isNativeLoading}
          deniedMessage="Your address is not authorized to mint assets."
        />

        {whitelistedMinters.length > 0 && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-500">
              Authorized Minters
            </p>
            <ul className="space-y-1">
              {whitelistedMinters.map((minter, i) => (
                <li key={i} className="font-mono text-xs text-gray-600">
                  {truncateAddress(minter, 10, 8)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Asset
            </label>
            <select
              value={selectedToken}
              onChange={(e) =>
                setSelectedToken(e.target.value as 'native' | Hex)
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="native">
                {chainConfig.displayDenom} (Native)
              </option>
              {customTokenBalances
                .filter(
                  (t) =>
                    t.address.toLowerCase() !==
                    chainConfig.nativeErc20Address.toLowerCase()
                )
                .map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} ({truncateAddress(token.address, 6, 4)})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Recipient Address
              </label>
              {hexAddress && !recipient && (
                <button
                  type="button"
                  onClick={() => setRecipient(hexAddress)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Use my address
                </button>
              )}
            </div>
            <Input
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          <Input
            label="Amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Amount in ${selectedCustomToken?.symbol ?? chainConfig.displayDenom}`}
          />
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={!bech32Address || !canMint}
            className="w-full"
          >
            Mint {selectedCustomToken?.symbol ?? chainConfig.displayDenom}
          </Button>
        </form>
      </div>
    </Card>
  )
}

function BurnForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { evmAddress: hexAddress } = useActiveAccount()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hexAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Invalid amount')
      return
    }

    setIsSubmitting(true)

    try {
      const amountInMinDenom = parseAmount(amount)
      await executeTx(queryClient, {
        address: NATIVE_PRECOMPILE_ADDRESS,
        abi: NATIVE_ABI,
        functionName: 'burn',
        args: [hexAddress, amountInMinDenom],
        successMessage: 'Assets burned successfully!',
      })

      setAmount('')
      onSuccess()
    } catch (error) {
      console.error('Failed to burn assets', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card header="Burn Assets">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount to Burn"
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint="BRL will be burned from your account"
        />
        <Button
          type="submit"
          variant="danger"
          isLoading={isSubmitting}
          disabled={!hexAddress}
          className="w-full"
        >
          Burn Assets
        </Button>
      </form>
    </Card>
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
  const { hexAddress, bech32Address } = useEVMWallet()
  // Under a Safe this is the Safe's cosmos address (the msgexec caller); else the
  // personal account. The register step's signer must match the executing caller.
  const { cosmosAddress: activeBech32 } = useActiveAccount()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState('6')
  const [isDeploying, setIsDeploying] = useState(false)

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hexAddress || !bech32Address) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!name.trim()) {
      toast.error('Please enter an asset name')
      return
    }

    if (!symbol.trim()) {
      toast.error('Please enter an asset symbol')
      return
    }

    const decimalsNum = parseInt(decimals, 10)
    if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
      toast.error('Decimals must be between 0 and 18')
      return
    }

    const finishForm = () => {
      setName('')
      setSymbol('')
      setDecimals('6')
      onClose()
    }

    setIsDeploying(true)
    const toastId = toast.loading('Creating and registering asset...')

    try {
      if (!activeBech32) {
        toast.error('No active account', { id: toastId })
        return
      }
      // CREATE2 makes the address known up front, so deploy + register go in one
      // executeTx call for both signers - executeTx routes by active wallet: a
      // Safe batches them into one atomic MultiSend proposal, the personal path
      // runs them in sequence. The constructor's initial mint goes to CreateCall,
      // not the caller - real supply is minted via x/native afterwards.
      const initCode = encodeInitCode({
        abi: MOCK_ERC20_ABI,
        bytecode: MOCK_ERC20_BYTECODE,
        args: [name.trim(), symbol.trim(), decimalsNum],
      })
      const salt = randomSalt()
      const predicted = predictCreate2Address(initCode, salt)

      await executeTx(
        queryClient,
        {
          abi: MOCK_ERC20_ABI,
          bytecode: MOCK_ERC20_BYTECODE,
          args: [name.trim(), symbol.trim(), decimalsNum],
          salt,
          successMessage: 'Asset deployed',
          toastId,
        },
        {
          msg: MsgRegisterERC20,
          values: {
            signer: activeBech32,
            erc20addresses: [predicted],
          },
          successMessage: `Asset deployed and registered at ${truncateAddress(predicted, 8, 6)}!`,
        }
      )
      // The predicted address is stable, so add it now: the personal path has
      // already registered it, a Safe registers it once the owners execute.
      onSuccess({
        address: predicted,
        name: name.trim(),
        symbol: symbol.trim(),
        decimals: decimalsNum,
      })
      finishForm()
    } catch (error) {
      console.error('Failed to create asset:', error)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deploy New Unregulated ERC20 Asset"
      size="md"
    >
      <form onSubmit={handleDeploy} className="space-y-4">
        <p className="text-sm text-gray-500">
          Deploy a new unregulated ERC20 asset. You will receive 1,000,000 units
          upon deployment.
        </p>
        <Input
          label="Asset Name"
          placeholder="My Asset"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="The full name of your asset (e.g., 'Gold')"
        />
        <Input
          label="Asset Symbol"
          placeholder="MTK"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          hint="Short symbol (e.g., 'GOLD')"
        />
        <Input
          label="Decimals"
          type="number"
          placeholder="6"
          value={decimals}
          onChange={(e) => setDecimals(e.target.value)}
          hint="Number of decimal places (0-18, default: 6)"
        />
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={isDeploying}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isDeploying}
            disabled={!hexAddress}
            className="flex-1"
          >
            Deploy Asset
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ConvertERC20Modal({
  token,
  onClose,
  onSuccess,
}: {
  token: CustomTokenBalance | null
  onClose: () => void
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const { evmAddress: hexAddress, cosmosAddress: bech32Address } =
    useActiveAccount()
  const [amount, setAmount] = useState('')
  const [isConverting, setIsConverting] = useState(false)

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hexAddress || !bech32Address || !token) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    // Parse amount with token decimals using parseUnits for precision
    let amountBigInt: bigint
    try {
      amountBigInt = parseUnits(amount, token.decimals)
    } catch {
      toast.error('Invalid amount format')
      return
    }

    if (amountBigInt > token.balance) {
      toast.error('Amount exceeds your balance')
      return
    }

    setIsConverting(true)

    try {
      await executeTx(queryClient, {
        msg: MsgConvertERC20,
        values: {
          contractAddress: token.address,
          amount: amountBigInt.toString(),
          receiver: bech32Address,
          sender: hexAddress,
        },
        successMessage: `Converted ${amount} ${token.symbol} to native assets!`,
      })

      setAmount('')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to convert assets:', error)
    } finally {
      setIsConverting(false)
    }
  }

  const handleMaxClick = () => {
    if (token) {
      setAmount(token.balanceFormatted)
    }
  }

  return (
    <Modal
      isOpen={token !== null}
      onClose={onClose}
      title={`Convert ${token?.symbol ?? 'Asset'} to Native`}
      size="md"
    >
      <form onSubmit={handleConvert} className="space-y-4">
        <p className="text-sm text-gray-500">
          Convert assets to native format so they can be transferred between
          institutions.
        </p>

        {token && (
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">Your Balance</span>
              <span className="font-mono text-sm font-medium text-blue-900">
                {formatAmount(token.balanceFormatted)} {token.symbol}
              </span>
            </div>
            <div className="mt-1 text-xs text-blue-600">
              Contract: {truncateAddress(token.address, 12, 10)}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Amount to Convert
            </label>
            <button
              type="button"
              onClick={handleMaxClick}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Max
            </button>
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Will receive native erc20:${token?.address ?? ''} tokens`}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={isConverting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isConverting}
            disabled={!hexAddress || !amount}
            className="flex-1"
          >
            Convert
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function SendToPrivateModal({
  token,
  onClose,
  onSuccess,
}: {
  token: CustomTokenBalance | null
  onClose: () => void
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const { bech32Address, hexAddress } = useEVMWallet()
  const { address: penumbraAddress } = usePenumbra()

  const { currentAccount } = useNativeWallet()
  const [amount, setAmount] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [depositAddress, setDepositAddress] = useState<string | null>(null)
  const [depositAddrError, setDepositAddrError] = useState<string | null>(null)
  const [isGeneratingAddr, setIsGeneratingAddr] = useState(false)

  // Regulated assets require the registered default private address.
  const depositDenom = useMemo(() => {
    if (!token) return null
    const isNativeToken =
      token.address.toLowerCase() ===
      chainConfig.nativeErc20Address.toLowerCase()
    const bankDenom = isNativeToken
      ? chainConfig.denom
      : `erc20:${token.address}`
    return bankDenom
  }, [token])
  const { data: assetStatus, isPending: isStatusPending } =
    useComplianceAssetStatus(depositDenom)
  const isRegulated = Boolean(assetStatus?.isRegulated)

  // Pick the deposit address when the modal opens: the registered default
  // address for regulated assets, a fresh ephemeral address otherwise.
  React.useEffect(() => {
    if (!token || !penumbraAddress) {
      setDepositAddress(null)
      return
    }
    if (isStatusPending) {
      setDepositAddress(null)
      return
    }
    if (isRegulated) {
      setDepositAddress(penumbraAddress)
      setDepositAddrError(null)
      return
    }
    let cancelled = false
    setIsGeneratingAddr(true)
    setDepositAddrError(null)
    generateAndSaveEphemeralAddressRecord({
      accountIndex: currentAccount,
      purpose: 'generated-deposit',
      label: 'Generated receive address',
    })
      .then((record) => {
        if (!cancelled) setDepositAddress(record.penumbraAddress)
      })
      .catch((err) => {
        console.warn('[SendToPrivate] Failed to generate deposit address:', err)
        if (!cancelled) {
          setDepositAddress(null)
          setDepositAddrError(
            err?.message || 'Failed to generate deposit address'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsGeneratingAddr(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, penumbraAddress, currentAccount, isRegulated, isStatusPending])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (guardSafeUnsupported('Making an asset private')) return

    if (!bech32Address || !token) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!penumbraAddress) {
      toast.error('Please connect your private wallet first')
      return
    }

    if (!depositAddress) {
      toast.error(
        'Ephemeral deposit address required for public chain transfers. Please wait for generation or retry.'
      )
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    // Parse amount with token decimals
    let amountBigInt: bigint
    try {
      amountBigInt = parseUnits(amount, token.decimals)
    } catch {
      toast.error('Invalid amount format')
      return
    }

    if (amountBigInt > token.balance) {
      toast.error('Amount exceeds your balance')
      return
    }

    setIsSending(true)
    const toastId = toast.loading('Preparing transfer...')

    try {
      // Use the Bankd coin denomination:
      // - Native BRL (0xEeee...) uses 'ubrl'
      // - ERC20 tokens use 'erc20:<address>'
      const isNativeToken =
        token.address.toLowerCase() ===
        chainConfig.nativeErc20Address.toLowerCase()
      const denom = isNativeToken ? chainConfig.denom : `erc20:${token.address}`
      const amountStr = amountBigInt.toString()

      const transferStep = {
        msg: MsgDeposit,
        values: {
          sender: bech32Address,
          amount: { denom, amount: amountStr },
          recipient: depositAddress,
        },
        successMessage: `Transfer initiated`,
        toastId,
      }

      // ERC20 tokens must be converted to native bank balance before deposit
      if (!isNativeToken) {
        const [, transferResult] = await executeTx(
          queryClient,
          {
            msg: MsgConvertERC20,
            values: {
              contractAddress: token.address,
              amount: amountStr,
              receiver: bech32Address,
              sender: hexAddress,
            },
            successMessage: 'Converted to native token',
            toastId,
          },
          transferStep
        )
        assertBroadcast(transferResult)
      } else {
        const [transferResult] = await executeTx(queryClient, transferStep)
        assertBroadcast(transferResult)
      }

      toast.success(`Shielded ${amount} ${token.symbol}`, { id: toastId })

      setAmount('')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to send to private:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleMaxClick = () => {
    if (token) {
      setAmount(token.balanceFormatted)
    }
  }

  return (
    <Modal
      isOpen={token !== null}
      onClose={onClose}
      title={`Make ${token?.symbol ?? 'Asset'} Private`}
      size="md"
    >
      <form onSubmit={handleSend} className="space-y-4">
        <p className="text-sm text-gray-500">
          Shield assets in your private wallet to protect your privacy.
        </p>

        {token && (
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">Your Balance</span>
              <span className="font-mono text-sm font-medium text-blue-900">
                {formatAmount(token.balanceFormatted)} {token.symbol}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1">
              <div className="text-xs text-blue-600">
                Contract: {truncateAddress(token.address, 12, 10)}
              </div>
              <CopyButton
                value={token.address}
                successMessage="Address copied!"
              />
            </div>
          </div>
        )}

        {depositAddress ? (
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="flex items-center gap-2 text-sm text-purple-700">
              <span>Destination</span>
              {isRegulated ? (
                <span className="text-xs text-amber-600">
                  registered default address (regulated asset)
                </span>
              ) : (
                <span className="text-xs text-green-600">ephemeral</span>
              )}
            </div>
            <div className="mt-1 break-all font-mono text-xs text-purple-600">
              {depositAddress}
            </div>
            {isRegulated && (
              <p className="mt-1 text-xs text-purple-600">
                Regulated assets must land on a compliance-registered address —
                ephemeral deposit addresses aren&apos;t in the compliance tree,
                so notes sent there could never be spent.
              </p>
            )}
          </div>
        ) : isGeneratingAddr ? (
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="flex items-center gap-2 text-sm text-purple-700">
              <span>Destination</span>
              <span className="text-xs text-purple-500">
                (generating ephemeral address...)
              </span>
            </div>
          </div>
        ) : depositAddrError ? (
          <div className="rounded-lg bg-red-50 p-3">
            <div className="text-sm text-red-700">
              Failed to generate ephemeral address
            </div>
            <p className="mt-1 text-xs text-red-500">{depositAddrError}</p>
          </div>
        ) : null}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Amount to Send
            </label>
            <button
              type="button"
              onClick={handleMaxClick}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              Max
            </button>
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSending}
            disabled={
              !bech32Address ||
              !penumbraAddress ||
              !amount ||
              isGeneratingAddr ||
              !depositAddress
            }
            className="flex-1 bg-purple-500 hover:bg-purple-600"
          >
            Make Private
          </Button>
        </div>
      </form>
    </Modal>
  )
}
