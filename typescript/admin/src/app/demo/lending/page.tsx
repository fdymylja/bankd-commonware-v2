'use client'

import { isOwnContractAddress } from '@bankd/shared/penumbra'
import type { FullViewingKey } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { type Hex, formatUnits, getAddress, parseUnits } from 'viem'

import { PageContainer } from '@/components/layout'
import { Button, ButtonSelect, Card, Input, Modal } from '@/components/ui'
import {
  PenumbraBalance,
  useAllLoans,
  useCustomTokenBalances,
  useCustomTokens,
  useEphemeralAddressRecords,
  useLoan,
  useLoanInterest,
  useNextLoanId,
  usePenumbra,
  usePenumbraBalances,
  useTokenDecimals,
  useTokenSymbol,
  useWallet,
} from '@/hooks'
import {
  ERC20_ABI,
  SIMPLE_LENDING_ABI,
  SIMPLE_LENDING_BYTECODE,
  SimpleLendingLoanWithId,
  ZERO_ADDRESS,
  calculateTimeRemaining,
  formatBasisPointsAsPercent,
  formatDuration,
  validateCollateralRatio,
} from '@/lib/evm'
import { deployedAddress, executeTx } from '@/lib/evm/execute'
import { formatAmount, getErrorMessage, isValidHexAddress, truncateAddress } from '@/lib/utils'
import { PenumbraTransparentAddress } from '@/store/penumbra'

const STORAGE_KEY = 'bankd-simplelending-address'

// Duration presets in seconds
const DURATION_PRESETS = [
  { label: '7 days', value: 7n * 24n * 60n * 60n },
  { label: '30 days', value: 30n * 24n * 60n * 60n },
  { label: '90 days', value: 90n * 24n * 60n * 60n },
]

export default function LendingPage() {
  const queryClient = useQueryClient()
  const { hexAddress } = useWallet()
  const { transparentAddress, fullViewingKey } = usePenumbra()
  const [contractAddress, setContractAddress] = useState<Hex | null>(null)
  const [addressInput, setAddressInput] = useState('')
  const [selectedLoanId, setSelectedLoanId] = useState<bigint | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  // Verify contract exists by trying to read nextLoanId
  const {
    data: nextLoanId,
    isLoading: isVerifying,
    isError: isContractInvalid,
  } = useNextLoanId(contractAddress)

  const isContractVerified =
    contractAddress &&
    !isVerifying &&
    !isContractInvalid &&
    nextLoanId !== undefined

  // Load contract address from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isValidHexAddress(stored)) {
      setContractAddress(stored as Hex)
      setAddressInput(stored)
    }
  }, [])

  const handleSaveAddress = () => {
    if (!isValidHexAddress(addressInput)) {
      toast.error('Invalid contract address')
      return
    }
    const addr = addressInput as Hex
    setContractAddress(addr)
    localStorage.setItem(STORAGE_KEY, addr)
    toast.success('Contract address saved')
  }

  const handleClearAddress = () => {
    setContractAddress(null)
    setAddressInput('')
    localStorage.removeItem(STORAGE_KEY)
    toast.success('Contract address cleared')
  }

  const handleDeploy = async () => {
    if (!hexAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsDeploying(true)

    try {
      // executeTx routes by active wallet: personal broadcasts, a Safe proposes.
      // deployedAddress reads the result either way (actual for a broadcast, the
      // predicted CREATE2 address for a Safe) - loans run against this address.
      const results = await executeTx(queryClient, {
        abi: SIMPLE_LENDING_ABI,
        bytecode: SIMPLE_LENDING_BYTECODE,
        successMessage: 'SimpleLending contract deployed',
      })
      const deployed = deployedAddress(results)
      if (deployed) {
        const addr = getAddress(deployed)
        setContractAddress(addr)
        setAddressInput(addr)
        localStorage.setItem(STORAGE_KEY, addr)
      }
    } catch (error) {
      console.error('Failed to deploy contract:', error)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <PageContainer
      title="Lending Demo"
      description="Lending demonstration using the SimpleLending contract"
    >
      <p className="mb-4 text-sm text-gray-600">
        Private swap and lending are unavailable until host withdrawal integration is complete.
      </p>
      {/* Contract Configuration */}
      <Card
        header="Contract Configuration"
        headerRight={
          <Button
            variant="secondary"
            onClick={handleDeploy}
            isLoading={isDeploying}
            disabled={!hexAddress}
          >
            Deploy New
          </Button>
        }
        className="mb-6"
      >
        <div className="flex gap-4">
          <Input
            label="SimpleLending Contract Address"
            placeholder="0x..."
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="flex-1"
          />
          <div className="flex items-end gap-2">
            <Button onClick={handleSaveAddress}>Save</Button>
            {contractAddress && (
              <Button variant="ghost" onClick={handleClearAddress}>
                Clear
              </Button>
            )}
          </div>
        </div>
        {contractAddress && isVerifying && (
          <p className="mt-2 text-sm text-gray-500">Verifying contract...</p>
        )}
        {contractAddress && isContractInvalid && (
          <p className="mt-2 text-sm text-red-600">
            No SimpleLending contract found at this address
          </p>
        )}
        {isContractVerified && (
          <p className="mt-2 text-sm text-green-600">
            Connected to: {truncateAddress(contractAddress, 10, 8)}
          </p>
        )}
        {!hexAddress && (
          <p className="mt-2 text-sm text-yellow-600">
            Connect your wallet to deploy a new contract
          </p>
        )}
      </Card>

      {!contractAddress ? (
        <Card>
          <p className="py-8 text-center text-gray-500">
            Enter the SimpleLending contract address above to get started.
          </p>
        </Card>
      ) : !isContractVerified ? (
        <Card>
          <p className="py-8 text-center text-gray-500">
            {isVerifying
              ? 'Verifying contract...'
              : 'Enter a valid SimpleLending contract address to get started.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <CreateLoanForm
              contractAddress={contractAddress}
              transparentAddress={transparentAddress}
              fullViewingKey={fullViewingKey}
            />
            <LoansListCard
              contractAddress={contractAddress}
              selectedLoanId={selectedLoanId}
              onSelectLoan={setSelectedLoanId}
            />
          </div>

          <Modal
            isOpen={selectedLoanId !== null}
            onClose={() => setSelectedLoanId(null)}
            title={`Loan #${selectedLoanId?.toString() ?? ''}`}
            size="lg"
          >
            <LoanDetailsContent
              contractAddress={contractAddress}
              loanId={selectedLoanId}
              onClose={() => setSelectedLoanId(null)}
              transparentAddress={transparentAddress}
              fullViewingKey={fullViewingKey}
            />
          </Modal>
        </>
      )}
    </PageContainer>
  )
}

// ============================================================================
// Create Loan Form
// ============================================================================

type UnifiedToken = {
  id: string
  symbol: string
  address: Hex
  balance: bigint
  balanceFormatted: string
  decimals: number
  isPrivate: boolean
  penumbraBalance?: PenumbraBalance
}

function CreateLoanForm({
  contractAddress,
  transparentAddress,
  fullViewingKey,
}: {
  contractAddress: Hex
  transparentAddress: PenumbraTransparentAddress | null
  fullViewingKey: FullViewingKey | null
}) {
  const queryClient = useQueryClient()
  const { hexAddress } = useWallet()
  const { tokens: savedTokens } = useCustomTokens()
  const { data: evmBalances = [] } = useCustomTokenBalances(
    savedTokens,
    hexAddress ?? null
  )
  const { data: penumbraBalances = [] } = usePenumbraBalances()

  // Form state
  const [selectedCollateralToken, setSelectedCollateralToken] =
    useState<UnifiedToken | null>(null)
  const [collateralAmount, setCollateralAmount] = useState('')
  const [loanToken, setLoanToken] = useState('')
  const [loanAmount, setLoanAmount] = useState('')
  const [interestRate, setInterestRate] = useState('1000') // 10% default
  const [duration, setDuration] = useState(DURATION_PRESETS[1].value.toString())
  const [customDuration, setCustomDuration] = useState('')
  const [manualERC20Address, setManualERC20Address] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Build deduplicated list of verified on-chain tokens for the loan token selector.
  const knownTokens = useMemo(() => {
    const seen = new Set<string>()
    const tokens: { address: Hex; symbol: string; decimals: number }[] = []
    for (const t of evmBalances) {
      const key = t.address.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        tokens.push({ address: t.address, symbol: t.symbol, decimals: t.decimals })
      }
    }
    for (const b of penumbraBalances) {
      if (b.erc20Address) {
        const key = b.erc20Address.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          tokens.push({ address: b.erc20Address, symbol: b.symbol, decimals: b.decimals })
        }
      }
    }
    return tokens.sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [evmBalances, penumbraBalances])

  const loanTokenData = knownTokens.find(
    (t) => t.address.toLowerCase() === loanToken.toLowerCase()
  )

  // Extract ERC20 address from IBC denom
  const extractERC20Address = (denom: string): Hex | null => {
    const match = denom.match(/erc20:(0x[a-fA-F0-9]{40})/)
    return match ? (match[1] as Hex) : null
  }

  // Build unified token list
  const unifiedTokens: UnifiedToken[] = [
    ...evmBalances.map((token) => ({
      id: `evm-${token.address}`,
      symbol: token.symbol,
      address: token.address,
      balance: token.balance,
      balanceFormatted: token.balanceFormatted,
      decimals: token.decimals,
      isPrivate: false,
    })),
    ...penumbraBalances.map((balance) => {
      const erc20Addr = extractERC20Address(balance.baseDenom)
      return {
        id: `penumbra-${balance.assetId}`,
        symbol: balance.symbol,
        address: (erc20Addr || '0x0') as Hex,
        balance: BigInt(balance.amount),
        balanceFormatted: balance.amountFormatted,
        decimals: balance.decimals,
        isPrivate: true,
        penumbraBalance: balance,
      }
    }),
  ]
    .filter((t) => t.balance > 0n)
    .sort((a, b) => a.symbol.localeCompare(b.symbol))

  const getEffectiveCollateralAddress = (): Hex | null => {
    if (!selectedCollateralToken) return null
    if (
      selectedCollateralToken.isPrivate &&
      selectedCollateralToken.address === '0x0'
    ) {
      return isValidHexAddress(manualERC20Address)
        ? (manualERC20Address as Hex)
        : null
    }
    return selectedCollateralToken.address
  }

  // Calculate collateral ratio for display
  const collateralRatioDisplay = (() => {
    if (!collateralAmount || !loanAmount || !loanTokenData || !selectedCollateralToken)
      return null
    try {
      const collateralWei = parseUnits(
        collateralAmount,
        selectedCollateralToken.decimals
      )
      const loanWei = parseUnits(loanAmount, loanTokenData.decimals)
      return validateCollateralRatio(collateralWei, loanWei)
    } catch {
      return null
    }
  })()

  const effectiveDuration =
    duration === 'custom' ? BigInt(customDuration || '0') : BigInt(duration)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCollateralToken) {
      toast.error('Please select a collateral token')
      return
    }

    if (!isValidHexAddress(loanToken)) {
      toast.error('Invalid loan token address')
      return
    }

    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      toast.error('Invalid collateral amount')
      return
    }

    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      toast.error('Invalid loan amount')
      return
    }

    const collateralTokenAddress = getEffectiveCollateralAddress()
    if (!collateralTokenAddress) {
      toast.error('Please enter a valid ERC20 address for collateral')
      return
    }

    const collateralWei = parseUnits(
      collateralAmount,
      selectedCollateralToken.decimals
    )
    const loanWei = parseUnits(loanAmount, loanTokenData?.decimals ?? 18)
    const interestRateBp = BigInt(interestRate)

    // Validate collateral ratio
    const ratioCheck = validateCollateralRatio(collateralWei, loanWei)
    if (!ratioCheck.isValid) {
      toast.error(
        `Collateral ratio ${ratioCheck.formatted} is below 150% minimum`
      )
      return
    }

    // Validate interest rate
    if (interestRateBp <= 0n || interestRateBp > 5000n) {
      toast.error('Interest rate must be between 0.01% and 50%')
      return
    }

    // Validate duration
    if (effectiveDuration <= 0n) {
      toast.error('Invalid duration')
      return
    }

    setIsSubmitting(true)

    if (selectedCollateralToken.isPrivate) {
      await handleSubmitPrivate(
        collateralTokenAddress,
        collateralWei,
        loanWei,
        interestRateBp
      )
    } else {
      await handleSubmitTransparent(
        collateralTokenAddress,
        collateralWei,
        loanWei,
        interestRateBp
      )
    }

    setIsSubmitting(false)
  }

  const handleSubmitTransparent = async (
    collateralTokenAddress: Hex,
    collateralWei: bigint,
    loanWei: bigint,
    interestRateBp: bigint
  ) => {
    if (!hexAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      await executeTx(
        queryClient,
        {
          address: collateralTokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contractAddress, collateralWei],
          successMessage: 'Collateral approved',
        },
        {
          address: contractAddress,
          abi: SIMPLE_LENDING_ABI,
          functionName: 'createLoan',
          args: [
            collateralTokenAddress,
            loanToken as Hex,
            collateralWei,
            loanWei,
            interestRateBp,
            effectiveDuration,
          ],
          successMessage: 'Loan created successfully!',
        }
      )

      // Reset form
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
      queryClient.invalidateQueries({ queryKey: ['erc20'] })
    } catch (error) {
      console.error('Failed to create loan:', error)
    }
  }

  const handleSubmitPrivate = async (
    collateralTokenAddress: Hex,
    collateralWei: bigint,
    loanWei: bigint,
    interestRateBp: bigint
  ) => {
    toast.error('Private swap and lending are unavailable until host withdrawal integration is complete.')
  }

  const resetForm = () => {
    setCollateralAmount('')
    setLoanAmount('')
    setSelectedCollateralToken(null)
    setManualERC20Address('')
  }

  return (
    <Card header="Create Loan Request">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Collateral Token Selector */}
        <div>
          <ButtonSelect
            label="Collateral"
            value={selectedCollateralToken?.id ?? null}
            onChange={(id) => {
              const token = unifiedTokens.find((t) => t.id === id)
              setSelectedCollateralToken(token ?? null)
            }}
            options={unifiedTokens.map((t) => ({
              value: t.id,
              label: t.symbol,
              detail: formatAmount(t.balanceFormatted),
              badge: t.isPrivate ? 'Private' : 'Public',
              tooltip: t.address !== '0x0' ? t.address : undefined,
              variant: t.isPrivate ? 'purple' : 'primary',
            }))}
            emptyMessage="No assets available. Deploy assets on the Assets page."
          />
          {selectedCollateralToken?.isPrivate &&
            selectedCollateralToken.address === '0x0' && (
              <div className="mt-3">
                <Input
                  label="ERC20 Address on Bankd"
                  placeholder="0x..."
                  value={manualERC20Address}
                  onChange={(e) => setManualERC20Address(e.target.value)}
                  hint="Unknown asset - enter the ERC20 contract address"
                />
              </div>
            )}
        </div>

        <Input
          label="Collateral Amount"
          type="number"
          placeholder="0.00"
          value={collateralAmount}
          onChange={(e) => setCollateralAmount(e.target.value)}
          hint={
            selectedCollateralToken
              ? `Balance: ${formatAmount(selectedCollateralToken.balanceFormatted)}`
              : undefined
          }
        />

        {/* Loan Token */}
        <ButtonSelect
          label="Borrow Asset"
          value={
            knownTokens.find(
              (t) => t.address.toLowerCase() === loanToken.toLowerCase()
            )?.address ?? null
          }
          onChange={(addr) => setLoanToken(addr)}
          options={knownTokens.map((t) => ({
            value: t.address,
            label: t.symbol,
            tooltip: t.address,
          }))}
          emptyMessage="No assets available. Deploy assets on the Assets page."
        />

        <Input
          label="Loan Amount (how much to borrow)"
          type="number"
          placeholder="0.00"
          value={loanAmount}
          onChange={(e) => setLoanAmount(e.target.value)}
        />

        {/* Collateral Ratio Display */}
        {collateralRatioDisplay && (
          <div
            className={`rounded-lg p-3 ${
              collateralRatioDisplay.isValid
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            <p className="text-sm">
              Collateral Ratio:{' '}
              <strong>{collateralRatioDisplay.formatted}</strong>
              {!collateralRatioDisplay.isValid && ' (minimum 150% required)'}
            </p>
          </div>
        )}

        {/* Interest Rate */}
        <div>
          <Input
            label="Interest Rate (basis points, 100 = 1%)"
            type="number"
            placeholder="1000"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            hint={`${Number(interestRate) / 100}% APR (max 50%)`}
          />
        </div>

        {/* Duration */}
        <div>
          <ButtonSelect
            label="Loan Duration"
            value={duration}
            onChange={(val) => setDuration(val)}
            options={[
              ...DURATION_PRESETS.map((preset) => ({
                value: preset.value.toString(),
                label: preset.label,
              })),
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {duration === 'custom' && (
            <div className="mt-2">
              <Input
                label="Duration (seconds)"
                type="number"
                placeholder="86400"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                hint={
                  customDuration
                    ? `= ${formatDuration(BigInt(customDuration || '0'))}`
                    : undefined
                }
              />
            </div>
          )}
        </div>

        {/* Intermediate address for private loans */}
        {/* {selectedCollateralToken?.isPrivate && intermediateAddress && (
          <div className="rounded-lg bg-purple-50 p-3">
            <p className="text-xs font-medium text-purple-700">
              Your IBC Borrower Address:
            </p>
            <p className="mt-1 break-all font-mono text-xs text-purple-600">
              {intermediateAddress.hex}
            </p>
          </div>
        )} */}

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={
            !selectedCollateralToken ||
            (selectedCollateralToken.isPrivate
              ? !fullViewingKey
              : !hexAddress)
          }
          className={`w-full ${selectedCollateralToken?.isPrivate ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
        >
          Create Loan
        </Button>
      </form>
    </Card>
  )
}

// ============================================================================
// Loans List
// ============================================================================

function LoansListCard({
  contractAddress,
  selectedLoanId,
  onSelectLoan,
}: {
  contractAddress: Hex
  selectedLoanId: bigint | null
  onSelectLoan: (id: bigint) => void
}) {
  const queryClient = useQueryClient()
  const { hexAddress } = useWallet()
  const { data: registryRecords = [] } = useEphemeralAddressRecords()
  const { data, isLoading } = useAllLoans(contractAddress)
  const [filter, setFilter] = useState<'all' | 'fundable' | 'my'>('all')

  const fallbackAddresses = [
    ...(hexAddress ? [hexAddress] : []),
  ]

  const unfundedLoans = data?.unfunded ?? []
  const activeLoans = data?.active ?? []
  const completedLoans = data?.completed ?? []

  // Filter loans based on selection, using registry records for matching
  const filterLoans = (loans: SimpleLendingLoanWithId[]) => {
    if (filter === 'all') return loans
    if (filter === 'fundable') {
      return loans.filter(
        (loan) => !isOwnContractAddress(loan.borrower, registryRecords, fallbackAddresses)
      )
    }
    if (filter === 'my') {
      return loans.filter(
        (loan) =>
          isOwnContractAddress(loan.borrower, registryRecords, fallbackAddresses) ||
          isOwnContractAddress(loan.lender, registryRecords, fallbackAddresses)
      )
    }
    return loans
  }

  const filteredUnfunded = filterLoans(unfundedLoans)
  const filteredActive = filterLoans(activeLoans)
  const filteredCompleted = filterLoans(completedLoans)

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
  }

  return (
    <Card
      header="Loans"
      headerRight={
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      }
    >
      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        {(['all', 'fundable', 'my'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              filter === f
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'fundable' ? 'Fundable' : 'My Loans'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading loans...</p>
      ) : filteredUnfunded.length === 0 &&
        filteredActive.length === 0 &&
        filteredCompleted.length === 0 ? (
        <p className="text-sm text-gray-500">No loans found</p>
      ) : (
        <div className="space-y-4">
          {/* Unfunded Loans */}
          {filteredUnfunded.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Awaiting Funding ({filteredUnfunded.length})
              </h4>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {filteredUnfunded.map((loan) => (
                  <LoanListItem
                    key={loan.id.toString()}
                    loan={loan}
                    isSelected={selectedLoanId === loan.id}
                    onSelect={() => onSelectLoan(loan.id)}
                    status="unfunded"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Loans */}
          {filteredActive.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Active ({filteredActive.length})
              </h4>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {filteredActive.map((loan) => (
                  <LoanListItem
                    key={loan.id.toString()}
                    loan={loan}
                    isSelected={selectedLoanId === loan.id}
                    onSelect={() => onSelectLoan(loan.id)}
                    status={loan.isExpired ? 'expired' : 'active'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Loans */}
          {filteredCompleted.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Completed ({filteredCompleted.length})
              </h4>
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {filteredCompleted.map((loan) => (
                  <LoanListItem
                    key={loan.id.toString()}
                    loan={loan}
                    isSelected={selectedLoanId === loan.id}
                    onSelect={() => onSelectLoan(loan.id)}
                    status="completed"
                    inactive
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function LoanListItem({
  loan,
  isSelected,
  onSelect,
  status,
  inactive,
}: {
  loan: SimpleLendingLoanWithId
  isSelected: boolean
  onSelect: () => void
  status: 'unfunded' | 'active' | 'expired' | 'completed'
  inactive?: boolean
}) {
  const { data: collateralSymbol } = useTokenSymbol(loan.collateralToken)
  const { data: loanSymbol } = useTokenSymbol(loan.loanToken)
  const { data: collateralDecimals } = useTokenDecimals(loan.collateralToken)
  const { data: loanDecimals } = useTokenDecimals(loan.loanToken)

  const collateralFormatted =
    collateralDecimals !== undefined && collateralDecimals !== null
      ? formatAmount(formatUnits(loan.collateralAmount, collateralDecimals))
      : '...'
  const loanFormatted =
    loanDecimals !== undefined && loanDecimals !== null
      ? formatAmount(formatUnits(loan.loanAmount, loanDecimals))
      : '...'

  const statusColors = {
    unfunded: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    completed: 'bg-gray-200 text-gray-600',
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        isSelected
          ? 'border-primary-500 bg-primary-50'
          : inactive
            ? 'border-gray-100 bg-gray-50 opacity-60 hover:opacity-80'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-medium ${inactive ? 'text-gray-500' : 'text-gray-900'}`}
        >
          Loan #{loan.id.toString()}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[status]}`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
      <p
        className={`mt-1 text-sm ${inactive ? 'text-gray-400' : 'text-gray-600'}`}
      >
        {collateralFormatted}{' '}
        {collateralSymbol || truncateAddress(loan.collateralToken, 4, 4)}{' '}
        <span className="text-gray-400">→</span> {loanFormatted}{' '}
        {loanSymbol || truncateAddress(loan.loanToken, 4, 4)}
      </p>
      <p
        className={`mt-1 text-xs ${inactive ? 'text-gray-400' : 'text-gray-500'}`}
      >
        {formatBasisPointsAsPercent(loan.interestRate)} APR •{' '}
        {formatDuration(loan.duration)}
      </p>
    </button>
  )
}

// ============================================================================
// Loan Details Modal Content
// ============================================================================

function LoanDetailsContent({
  contractAddress,
  loanId,
  onClose,
  transparentAddress,
  fullViewingKey,
}: {
  contractAddress: Hex
  loanId: bigint | null
  onClose: () => void
  transparentAddress: PenumbraTransparentAddress | null
  fullViewingKey: FullViewingKey | null
}) {
  const queryClient = useQueryClient()
  const { hexAddress } = useWallet()
  const [isExecuting, setIsExecuting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)

  const { tokens: savedTokens } = useCustomTokens()
  const { data: evmBalances = [] } = useCustomTokenBalances(
    savedTokens,
    hexAddress ?? null
  )
  const { data: loan, isLoading } = useLoan(contractAddress, loanId)
  const { data: currentInterest } = useLoanInterest(contractAddress, loanId)
  const { data: penumbraBalances = [] } = usePenumbraBalances()
  const { data: collateralSymbol } = useTokenSymbol(
    loan?.collateralToken ?? null
  )
  const { data: loanSymbol } = useTokenSymbol(loan?.loanToken ?? null)
  const { data: collateralDecimals } = useTokenDecimals(
    loan?.collateralToken ?? null
  )
  const { data: loanDecimals } = useTokenDecimals(loan?.loanToken ?? null)

  // Find matching Penumbra balance for the loan token (like avp-swap does)
  const matchingBalance = loan
    ? penumbraBalances.find(
        (b) =>
          b.isIBC &&
          b.erc20Address &&
          b.erc20Address.toLowerCase() === loan.loanToken.toLowerCase()
      )
    : undefined


  // Build payment options for the loan token
  const evmBalance = loan
    ? evmBalances.find(
        (t) => t.address.toLowerCase() === loan.loanToken.toLowerCase()
      )
    : undefined

  type PaymentOption = { value: string; label: string; detail: string; badge: string; variant: 'primary' | 'purple'; tooltip?: string }
  const publicOption: PaymentOption | null = evmBalance && evmBalance.balance > 0n ? {
    value: 'public',
    label: evmBalance.symbol,
    detail: formatAmount(evmBalance.balanceFormatted),
    badge: 'Public',
    variant: 'primary',
    tooltip: evmBalance.address,
  } : null
  const privateOption: PaymentOption | null = matchingBalance && BigInt(matchingBalance.amount) > 0n ? {
    value: 'private',
    label: matchingBalance.symbol,
    detail: formatAmount(matchingBalance.amountFormatted),
    badge: 'Private',
    variant: 'purple',
    tooltip: matchingBalance.erc20Address ?? undefined,
  } : null

  // Funding: show both public and private options
  const fundOptions = [publicOption, privateOption].filter((o): o is PaymentOption => o !== null)

  // Load registry records for ephemeral address matching
  const { data: registryRecords = [] } = useEphemeralAddressRecords()

  // Repayment: only show the option matching the borrower's address
  // If borrower is the IBC intermediate address, only private; if EVM address, only public
  const isBorrowerIntermediate = loan && isOwnContractAddress(
    loan.borrower,
    registryRecords,
    [],
  )
  const isBorrowerEVM = loan && hexAddress &&
    loan.borrower.toLowerCase() === hexAddress.toLowerCase()
  const repayOptions = isBorrowerIntermediate
    ? [privateOption].filter((o): o is PaymentOption => o !== null)
    : isBorrowerEVM
      ? [publicOption].filter((o): o is PaymentOption => o !== null)
      : [] // fallback: show none

  const activeOptions = !loan ? [] : loan.isFunded ? repayOptions : fundOptions

  const isPrivatePayment = paymentMethod === 'private'

  if (isLoading) {
    return <p className="py-4 text-sm text-gray-500">Loading loan details...</p>
  }

  if (!loan) {
    return <p className="py-4 text-sm text-red-500">Loan not found</p>
  }

  const collateralFormatted =
    collateralDecimals !== undefined && collateralDecimals !== null
      ? formatAmount(formatUnits(loan.collateralAmount, collateralDecimals))
      : '...'
  const loanFormatted =
    loanDecimals !== undefined && loanDecimals !== null
      ? formatAmount(formatUnits(loan.loanAmount, loanDecimals))
      : '...'
  const interestFormatted =
    loanDecimals !== undefined &&
    loanDecimals !== null &&
    currentInterest !== undefined
      ? formatAmount(formatUnits(currentInterest, loanDecimals))
      : '...'
  const totalRepayment =
    currentInterest !== undefined
      ? loan.loanAmount + currentInterest
      : loan.loanAmount
  const totalRepaymentFormatted =
    loanDecimals !== undefined && loanDecimals !== null
      ? formatAmount(formatUnits(totalRepayment, loanDecimals))
      : '...'

  const timeRemaining =
    loan.isFunded && loan.startTime > 0n
      ? calculateTimeRemaining(loan.startTime, loan.duration)
      : null

  const isUserBorrower =
    hexAddress && loan.borrower.toLowerCase() === hexAddress.toLowerCase()
  const isUserLender =
    hexAddress && loan.lender.toLowerCase() === hexAddress.toLowerCase()
  // Determine what actions are available
  const canLiquidateEVM =
    loan.isActive && loan.isFunded && isUserLender && timeRemaining?.isExpired
  const canCancelEVM = loan.isActive && !loan.isFunded && isUserBorrower

  const handleFundEVM = async () => {
    if (!hexAddress || loanId === null) return
    setIsExecuting(true)

    try {
      await executeTx(
        queryClient,
        {
          address: loan.loanToken,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contractAddress, loan.loanAmount],
          successMessage: 'Token approved',
        },
        {
          address: contractAddress,
          abi: SIMPLE_LENDING_ABI,
          functionName: 'fundLoan',
          args: [loanId],
          successMessage: 'Loan funded successfully!',
        }
      )

      onClose()
      queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
      queryClient.invalidateQueries({ queryKey: ['erc20'] })
    } catch (error) {
      console.error('Failed to fund loan:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleFundPrivate = async () => {
    toast.error('Private swap and lending are unavailable until host withdrawal integration is complete.')
  }

  const handleRepayEVM = async () => {
    if (!hexAddress || loanId === null) return
    setIsExecuting(true)

    // Add 1% buffer for interest accrual during tx
    const repaymentWithBuffer = (totalRepayment * 101n) / 100n

    try {
      await executeTx(
        queryClient,
        {
          address: loan.loanToken,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contractAddress, repaymentWithBuffer],
          successMessage: 'Token approved',
        },
        {
          address: contractAddress,
          abi: SIMPLE_LENDING_ABI,
          functionName: 'repayLoan',
          args: [loanId],
          successMessage: 'Loan repaid successfully!',
        }
      )

      onClose()
      queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
      queryClient.invalidateQueries({ queryKey: ['erc20'] })
    } catch (error) {
      console.error('Failed to repay loan:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleRepayPrivate = async () => {
    toast.error('Private swap and lending are unavailable until host withdrawal integration is complete.')
  }

  const handleLiquidateEVM = async () => {
    if (!hexAddress || loanId === null) return
    setIsExecuting(true)

    try {
      await executeTx(queryClient, {
        address: contractAddress,
        abi: SIMPLE_LENDING_ABI,
        functionName: 'liquidate',
        args: [loanId],
        successMessage: 'Loan liquidated! Collateral seized.',
      })

      onClose()
      queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
    } catch (error) {
      console.error('Failed to liquidate loan:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCancelEVM = async () => {
    if (!hexAddress || loanId === null) return
    setIsExecuting(true)

    try {
      await executeTx(queryClient, {
        address: contractAddress,
        abi: SIMPLE_LENDING_ABI,
        functionName: 'cancelLoan',
        args: [loanId],
        successMessage: 'Loan cancelled! Collateral returned.',
      })

      onClose()
      queryClient.invalidateQueries({ queryKey: ['simpleLending'] })
    } catch (error) {
      console.error('Failed to cancel loan:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  // Determine status
  let status: string
  let statusColor: string
  if (!loan.isActive && !loan.isFunded) {
    status = 'Cancelled'
    statusColor = 'bg-gray-200 text-gray-600'
  } else if (!loan.isActive && loan.isFunded) {
    status = 'Completed'
    statusColor = 'bg-gray-200 text-gray-600'
  } else if (loan.isActive && !loan.isFunded) {
    status = 'Awaiting Funding'
    statusColor = 'bg-yellow-100 text-yellow-700'
  } else if (timeRemaining?.isExpired) {
    status = 'Expired'
    statusColor = 'bg-red-100 text-red-700'
  } else {
    status = 'Active'
    statusColor = 'bg-green-100 text-green-700'
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-gray-500">Status</dt>
          <dd className="mt-1">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}
            >
              {status}
            </span>
          </dd>
        </div>
        <DetailItem label="Loan ID" value={`#${loanId?.toString() ?? ''}`} />
      </div>

      {/* Parties */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Parties
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem
            label="Borrower"
            value={truncateAddress(loan.borrower, 8, 6)}
            mono
          />
          <DetailItem
            label="Lender"
            value={
              loan.lender === ZERO_ADDRESS
                ? 'Awaiting lender...'
                : truncateAddress(loan.lender, 8, 6)
            }
            mono={loan.lender !== ZERO_ADDRESS}
          />
        </div>
      </div>

      {/* Loan Terms */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Loan Terms
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem
            label="Collateral"
            value={`${collateralFormatted} ${collateralSymbol || ''}`}
          />
          <DetailItem
            label="Loan Amount"
            value={`${loanFormatted} ${loanSymbol || ''}`}
          />
          <DetailItem
            label="Interest Rate"
            value={formatBasisPointsAsPercent(loan.interestRate) + ' APR'}
          />
          <DetailItem label="Duration" value={formatDuration(loan.duration)} />
        </div>
      </div>

      {/* Interest & Repayment (for funded loans) */}
      {loan.isFunded && loan.isActive && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Repayment Info
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailItem
              label="Current Interest"
              value={`${interestFormatted} ${loanSymbol || ''}`}
            />
            <DetailItem
              label="Total Repayment"
              value={`${totalRepaymentFormatted} ${loanSymbol || ''}`}
            />
            <DetailItem
              label="Time Remaining"
              value={timeRemaining?.formatted || 'N/A'}
              valueClassName={
                timeRemaining?.isExpired ? 'text-red-600' : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Action */}
      {loan.isActive && activeOptions.length > 0 && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Action
          </h4>

          {/* Fund Loan */}
          {!loan.isFunded && fundOptions.length > 0 && (
            <div className="space-y-3">
              <ButtonSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={fundOptions}
                fullWidth
              />
              <Button
                onClick={isPrivatePayment ? handleFundPrivate : handleFundEVM}
                isLoading={isExecuting}
                disabled={!paymentMethod}
                className={`w-full ${isPrivatePayment ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
              >
                Fund Loan ({loanFormatted} {loanSymbol})
              </Button>
            </div>
          )}

          {/* Repay Loan */}
          {loan.isFunded && repayOptions.length > 0 && (
            <div className="space-y-3">
              <ButtonSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={repayOptions}
                fullWidth
              />
              <Button
                onClick={isPrivatePayment ? handleRepayPrivate : handleRepayEVM}
                isLoading={isExecuting}
                disabled={!paymentMethod}
                className={`w-full ${isPrivatePayment ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
              >
                Repay ({totalRepaymentFormatted} {loanSymbol})
              </Button>
            </div>
          )}

          {/* Liquidate */}
          {canLiquidateEVM && (
            <Button
              variant="danger"
              onClick={handleLiquidateEVM}
              isLoading={isExecuting}
              className="w-full"
            >
              Liquidate (Seize Collateral)
            </Button>
          )}

          {/* Cancel */}
          {canCancelEVM && (
            <Button
              variant="danger"
              onClick={handleCancelEVM}
              isLoading={isExecuting}
              className="w-full"
            >
              Cancel Loan (Return Collateral)
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function DetailItem({
  label,
  value,
  mono,
  valueClassName,
}: {
  label: string
  value: string
  mono?: boolean
  valueClassName?: string
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd
        className={`mt-1 text-sm ${mono ? 'font-mono' : ''} ${valueClassName || 'text-gray-900'}`}
      >
        {value}
      </dd>
    </div>
  )
}
