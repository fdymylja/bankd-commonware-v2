'use client'

import { MsgSend } from '@bankd/shared/proto/cosmos/bank/v1beta1/tx'
import { MsgConvertERC20 } from '@bankd/shared/proto/cosmos/evm/erc20/v1/tx'
import { MsgDeposit } from '@bankd/shared/shieldd/msg-deposit'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback,useEffect,useMemo,useState } from 'react'
import toast from 'react-hot-toast'
import { bytesToHex } from 'viem'

import { PageContainer } from '@/components/layout'
import { Button,Card,Input } from '@/components/ui'
import {
  CustomTokenBalance,
  PenumbraBalance,
  useBalances,
  useComplianceAssetStatus,
  useCustomTokenBalances,
  useCustomTokens,
  usePenumbra,
  usePenumbraBalances,
} from '@/hooks'
import { usePrivateTransferQueue } from '@/hooks/usePrivateTransferQueue'
import { chainConfig } from '@/lib/config'
import { queryKeys, TokenBalance } from '@/lib/cosmos'
import { assertBroadcast,executeTx,isProposedResult } from '@/lib/evm'
import { guardSafeUnsupported,useActiveAccount } from '@/lib/multisig'
import { generateAndSaveEphemeralAddressRecord,useNativeWallet } from '@/lib/native-wallet'
import { formatAmount,formatTokenAmount,parseTokenAmount,truncateAddress } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

type Chain = 'public' | 'private'

/** Unified token for both public and private balances */
interface UnifiedToken {
  id: string // unique key
  chain: Chain
  symbol: string
  name: string
  denom: string // raw denom for tx (e.g., "ubrl", "erc20:0x...", "transfer/channel-0/ubrl")
  decimals: number
  amount: bigint
  amountFormatted: string
  erc20Address?: string
  baseDenom?: string
  // Private balances are per (asset, account); a token unifies them for
  // display. A single transaction spends from ONE account, so the send
  // sources the account that can cover it (largest first). Sorted desc.
  privateAccounts?: Array<{ account: number; amount: bigint }>
}

type TransferMode = 'same-chain' | 'cross-chain'
const PRIVATE_BRL_DENOM = chainConfig.denom

// =============================================================================
// Helpers
// =============================================================================

function classifyAddress(address: string): Chain | null {
  if (!address) return null
  if (address.startsWith('shieldd1')) return 'private'
  if (address.startsWith('0x') || address.startsWith('wallet')) return 'public'
  return null
}

function canWithdrawPrivateToken(token: UnifiedToken | null) {
  return token?.chain === 'private'
}

// =============================================================================
// Page
// =============================================================================

export default function TransfersPage() {
  const { evmAddress: hexAddress, cosmosAddress: bech32Address } =
    useActiveAccount()
  const { data: publicBalances = [] } = useBalances(bech32Address ?? null)
  const { data: privateBalances = [] } = usePenumbraBalances()
  const { tokens: customTokens } = useCustomTokens()
  const { data: erc20Balances = [] } = useCustomTokenBalances(customTokens, hexAddress ?? null)

  return (
    <PageContainer
      title="Transfers"
      description="Send assets between institutions"
    >
      <div className="grid gap-6">
        <div className="w-full">
          <TransferForm
            publicBalances={publicBalances}
            privateBalances={privateBalances}
            // Drop the native-token ERC20 alias (0xEeee…): it duplicates the
            // native bank balance and bank-module sends of its denom fail.
            erc20Balances={erc20Balances.filter(
              (t) =>
                t.balance > 0n &&
                t.address.toLowerCase() !==
                  chainConfig.nativeErc20Address.toLowerCase()
            )}
          />
        </div>

      </div>
    </PageContainer>
  )
}

// =============================================================================
// Transfer Form
// =============================================================================

function TransferForm({
  publicBalances,
  privateBalances,
  erc20Balances,
}: {
  publicBalances: TokenBalance[]
  privateBalances: PenumbraBalance[]
  erc20Balances: CustomTokenBalance[]
}) {
  const queryClient = useQueryClient()
  const { evmAddress: hexAddress, cosmosAddress: bech32Address } =
    useActiveAccount()
  const { address: penumbraAddress, fullViewingKey } = usePenumbra()
  const { addresses, currentAccount } = useNativeWallet()

  // --- Form state ---
  const [selectedTokenId, setSelectedTokenId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [memo, setMemo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [privateBrlAssetId, setPrivateBrlAssetId] = useState<string | null>(null)
  const [isGeneratingDepositAddr, setIsGeneratingDepositAddr] = useState(false)
  // The last completed public or shield transfer, shown under the button. The
  // success toast is a 2.6s pill in the corner of the viewport: on a wide screen
  // it is nowhere near the form you were just looking at, and it is gone before
  // you have found it. This keeps the confirmation where the eye already is, and
  // keeps it there until the next transfer. Private sends have the Private
  // activity list below for the same reason.
  const [lastResult, setLastResult] = useState<
    { action: string; amount: string; symbol: string; to: string } | null
  >(null)
  const privateQueue = usePrivateTransferQueue({
    fullViewingKey,
    addresses,
  })

  useEffect(() => {
    let cancelled = false

    async function loadPrivateBrlAssetId() {
      try {
        const { assetIdFromBaseDenom } = await import('@/lib/native-wallet/penumbra/wasm-loader')
        const assetId = await assetIdFromBaseDenom(PRIVATE_BRL_DENOM)
        if (!cancelled) {
          setPrivateBrlAssetId(bytesToHex(assetId.inner))
        }
      } catch (error) {
        console.warn('[Transfers] Unable to resolve private BRL asset id:', error)
      }
    }

    loadPrivateBrlAssetId()

    return () => {
      cancelled = true
    }
  }, [])

  // --- Build unified token list ---
  const tokens = useMemo((): UnifiedToken[] => {
    const list: UnifiedToken[] = []

    // Public native balances
    for (const b of publicBalances) {
      list.push({
        id: `public:${b.denom}`,
        chain: 'public',
        symbol: b.symbol,
        name: b.name,
        denom: b.denom,
        decimals: b.decimals,
        amount: BigInt(b.amount),
        amountFormatted: formatTokenAmount(b.amount, b.decimals),
      })
    }

    // Public ERC20 balances
    for (const t of erc20Balances) {
      list.push({
        id: `public:erc20:${t.address}`,
        chain: 'public',
        symbol: t.symbol,
        name: t.name,
        denom: `erc20:${t.address}`,
        decimals: t.decimals,
        amount: t.balance,
        amountFormatted: t.balanceFormatted,
        erc20Address: t.address,
      })
    }

    // Private balances — the same asset can be held under multiple accounts,
    // and each usePenumbraBalances row is one (asset, account). Merge them
    // into one token per asset (total for display) while retaining the
    // per-account breakdown so the send can source a single account.
    const privateByAsset = new Map<string, UnifiedToken>()
    for (const b of privateBalances) {
      const id = `private:${b.assetId}`
      const existing = privateByAsset.get(id)
      const account = b.addressIndex ?? 0
      const amount = BigInt(b.amount)
      if (existing) {
        existing.amount += amount
        existing.amountFormatted = formatTokenAmount(
          existing.amount.toString(),
          existing.decimals
        )
        existing.privateAccounts!.push({ account, amount })
      } else {
        privateByAsset.set(id, {
          id,
          chain: 'private',
          symbol: b.symbol,
          name: b.name,
          denom: b.baseDenom,
          decimals: b.decimals,
          amount,
          amountFormatted: b.amountFormatted,
          baseDenom: b.baseDenom,
          erc20Address: b.erc20Address,
          privateAccounts: [{ account, amount }],
        })
      }
    }

    if (privateBrlAssetId && !privateByAsset.has(`private:${privateBrlAssetId}`)) {
      privateByAsset.set(`private:${privateBrlAssetId}`, {
        id: `private:${privateBrlAssetId}`,
        chain: 'private',
        symbol: chainConfig.displayDenom,
        name: chainConfig.displayDenom,
        denom: PRIVATE_BRL_DENOM,
        decimals: chainConfig.decimals,
        amount: 0n,
        amountFormatted: '0.00',
        baseDenom: PRIVATE_BRL_DENOM,
        privateAccounts: [{ account: 0, amount: 0n }],
      })
    }

    for (const token of privateByAsset.values()) {
      // Largest account first — the send sources whichever covers the amount.
      token.privateAccounts!.sort((a, b) =>
        b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0
      )
      list.push(token)
    }

    // Dedup by id: a converted ERC20 appears both as a bank balance
    // (public:erc20:0x…) and a custom-token balance, and the same asset can
    // surface twice — collisions would break React keys in the selector.
    const seen = new Set<string>()
    return list.filter((token) => {
      if (seen.has(token.id)) return false
      seen.add(token.id)
      return true
    })
  }, [publicBalances, erc20Balances, privateBalances, privateBrlAssetId])

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null

  // Regulated deposits must go to the wallet's
  // registered default address — notes deposited to ephemeral addresses
  // aren't in the compliance tree and can never be spent.
  const { data: shieldAssetStatus } = useComplianceAssetStatus(
    selectedToken?.chain === 'public' ? selectedToken.denom : null
  )
  const shieldingRegulated = Boolean(shieldAssetStatus?.isRegulated)

  // --- Derive transfer mode ---
  const recipientChain = classifyAddress(recipient)
  const sourceChain = selectedToken?.chain ?? null
  const transferMode: TransferMode | null = useMemo(() => {
    if (!sourceChain || !recipientChain) return null
    return sourceChain === recipientChain ? 'same-chain' : 'cross-chain'
  }, [sourceChain, recipientChain])

  // --- Label for the transfer type ---
  const transferLabel = useMemo(() => {
    if (!sourceChain || !recipientChain) return 'Transfer'
    if (sourceChain === 'public' && recipientChain === 'public') return 'Public Send'
    if (sourceChain === 'private' && recipientChain === 'private') return 'Private Send'
    if (sourceChain === 'public' && recipientChain === 'private') return 'Shield'
    if (sourceChain === 'private' && recipientChain === 'public') return 'Unshield'
    return 'Transfer'
  }, [sourceChain, recipientChain])

  const recipientLabel = useCallback((address: string) => {
    if (address === penumbraAddress) return 'My Private Address'
    if (address === bech32Address || address === hexAddress) return 'My public address'
    return undefined
  }, [bech32Address, hexAddress, penumbraAddress])

  // A private transfer spends from ONE account; the best single source is the
  // largest-balance account (privateAccounts is sorted desc).
  const privateSourceAccount = useCallback(
    (token: UnifiedToken) => token.privateAccounts?.[0]?.account ?? 0,
    []
  )

  const expectedPrivateAvailable = useCallback((token: UnifiedToken) => {
    if (token.chain !== 'private') return token.amount

    // Spendable in one tx = the largest single account, not the total.
    const maxAccount = token.privateAccounts?.[0]?.amount ?? token.amount

    const pendingDebits = privateQueue.jobs
      .filter((job) =>
        job.asset.id === token.id &&
        !['confirmed', 'failed'].includes(job.status)
      )
      .reduce((total, job) => total + BigInt(job.amountBaseUnits), 0n)

    return maxAccount > pendingDebits ? maxAccount - pendingDebits : 0n
  }, [privateQueue.jobs])

  const assertPrivateBudget = useCallback((token: UnifiedToken, amountBaseUnits: bigint) => {
    if (token.chain !== 'private') return

    const available = expectedPrivateAvailable(token)
    if (amountBaseUnits > available) {
      const multiAccount = (token.privateAccounts?.length ?? 0) > 1
      const base = `Insufficient spendable ${token.symbol}. Available in one transfer: ${formatTokenAmount(available.toString(), token.decimals)} ${token.symbol}`
      throw new Error(
        multiAccount
          ? `${base} — your balance is split across accounts and a private transfer spends from one account at a time.`
          : `${base}.`
      )
    }
  }, [expectedPrivateAvailable])

  const enqueuePrivateAction = useCallback(async (type: 'private-send' | 'private-withdraw') => {
    if (!selectedToken || !amount || !recipient) return
    const amountBaseUnits = parseTokenAmount(amount, selectedToken.decimals)
    assertPrivateBudget(selectedToken, amountBaseUnits)
    const job = await privateQueue.enqueue(type, {
      amount,
      amountBaseUnits,
      asset: {
        id: selectedToken.id,
        symbol: selectedToken.symbol,
        denom: selectedToken.denom,
        decimals: selectedToken.decimals,
        sourceAccount: privateSourceAccount(selectedToken),
      },
      recipient,
      recipientLabel: recipientLabel(recipient),
    })
    // One persistent toast tracks the job from here: the queue updates it by
    // id through every phase (balance wait, sync wait, proving, broadcast)
    // and resolves it to success or error.
    toast.loading(
      type === 'private-send' ? 'Sending privately...' : 'Unshielding...',
      { id: `private-job-${job.id}` }
    )
  }, [amount, assertPrivateBudget, privateQueue, privateSourceAccount, recipient, recipientLabel, selectedToken])

  // --- Submit ---
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedToken || !amount || parseFloat(amount) <= 0 || !recipient) return

    setIsSubmitting(true)
    setLastResult(null)
    const toastId = toast.loading('Preparing transfer...')
    // what actually landed, or null when the Safe path only queued a proposal
    let done: string | null = null

    try {
      if (sourceChain === 'public' && recipientChain === 'public') {
        done = await handlePublicSend(selectedToken, amount, recipient, bech32Address!, queryClient, toastId)
      } else if (sourceChain === 'public' && recipientChain === 'private') {
        // Shield is a 2-step convert+transfer that reads the broadcast hash to
        // track the IBC relay - no async-proposal fit yet (Phase 2).
        if (guardSafeUnsupported('Shielding')) {
          toast.dismiss(toastId)
          return
        }
        done = await handleShield(selectedToken, amount, recipient, bech32Address!, hexAddress!, queryClient, toastId)
      } else if (sourceChain === 'private' && recipientChain === 'public') {
        if (!fullViewingKey) throw new Error('Private wallet not unlocked')
        await enqueuePrivateAction('private-withdraw')
        toast.dismiss(toastId) // the per-job toast takes over from here
      } else if (sourceChain === 'private' && recipientChain === 'private') {
        if (!fullViewingKey) throw new Error('Private wallet not unlocked')
        await enqueuePrivateAction('private-send')
        toast.dismiss(toastId) // the per-job toast takes over from here
      }

      // Both sides, not just the private one. The public balance query polls on a
      // 5s interval, so without this the strip above still shows the pre-transfer
      // number for up to five seconds after the success toast, which reads as the
      // transfer not having happened. Shield is the obvious case: you move
      // 250.000 out of public and the public balance sits there unchanged.
      queryClient.invalidateQueries({ queryKey: ['penumbra', 'balances'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all })
      queryClient.invalidateQueries({ queryKey: ['customTokens', 'balances'] })
      if (done) {
        setLastResult({ action: done, amount, symbol: selectedToken.symbol,
                        // a one-off address has no demo label, so show the address
                        to: recipientLabel(recipient) ?? truncateAddress(recipient) })
      }
      setAmount('')
      setMemo('')
    } catch (error: any) {
      console.error('Transfer failed:', error)
      toast.error(error?.message || 'Transfer failed', { id: toastId })
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedToken, amount, recipient, sourceChain, recipientChain, bech32Address, hexAddress, fullViewingKey, enqueuePrivateAction, queryClient])

  // --- Validation ---
  const canSubmit = useMemo(() => {
    if (!selectedToken || !amount || parseFloat(amount) <= 0 || !recipient) return false
    if (!recipientChain) return false
    // Public sends need public wallet
    if (sourceChain === 'public' && !bech32Address) return false
    // Private sends need private wallet
    if (sourceChain === 'private' && !fullViewingKey) return false
    if (sourceChain === 'private' && recipientChain === 'public' && !canWithdrawPrivateToken(selectedToken)) return false
    return true
  }, [selectedToken, amount, recipient, recipientChain, sourceChain, bech32Address, fullViewingKey])

  return (
    <Card header="New Transfer">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Amount + Token */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              {selectedToken && (
                <button
                  type="button"
                  onClick={() =>
                    // For private tokens, Max is the largest single account
                    // (what one transfer can spend), not the cross-account
                    // total shown as the balance.
                    setAmount(
                      selectedToken.chain === 'private'
                        ? formatTokenAmount(
                            expectedPrivateAvailable(selectedToken).toString(),
                            selectedToken.decimals
                          )
                        : selectedToken.amountFormatted
                    )
                  }
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Max
                </button>
              )}
            </div>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Token</label>
            <select
              value={selectedTokenId}
              onChange={(e) => setSelectedTokenId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select token...</option>
              {tokens.filter(t => t.chain === 'public').length > 0 && (
                <optgroup label="Public (EVM)">
                  {tokens.filter(t => t.chain === 'public').map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.symbol} — {formatAmount(t.amountFormatted)}
                    </option>
                  ))}
                </optgroup>
              )}
              {tokens.filter(t => t.chain === 'private').length > 0 && (
                <optgroup label="Private">
                  {tokens.filter(t => t.chain === 'private').map((t) => (
                    <option key={t.id} value={t.id} data-asset-id={t.id.slice('private:'.length)} data-denom={t.baseDenom ?? t.denom} data-spendable={expectedPrivateAvailable(t).toString()} data-decimals={t.decimals}>
                      {t.symbol} — {formatAmount(t.amountFormatted)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Selected token info */}
        {selectedToken && (
          <div className={`rounded-lg px-3 py-2 ${selectedToken.chain === 'private' ? 'bg-purple-50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between text-sm">
              <span className={selectedToken.chain === 'private' ? 'text-purple-600' : 'text-gray-600'}>
                {selectedToken.chain === 'private' ? '🔒 Private' : '🌐 Public'} Balance:
              </span>
              <span className="font-mono font-medium">
                {formatAmount(selectedToken.amountFormatted)} {selectedToken.symbol}
              </span>
            </div>
            {selectedToken.erc20Address && (
              <p className="mt-1 text-xs text-gray-500">
                ERC20: {truncateAddress(selectedToken.erc20Address, 6, 4)}
              </p>
            )}
            {selectedToken.chain === 'private' &&
              (selectedToken.privateAccounts?.length ?? 0) > 1 && (
                <p className="mt-1 text-xs text-purple-600">
                  Split across {selectedToken.privateAccounts!.length} accounts —
                  a transfer spends from one at a time. Spendable now:{' '}
                  {formatAmount(
                    formatTokenAmount(
                      expectedPrivateAvailable(selectedToken).toString(),
                      selectedToken.decimals
                    )
                  )}{' '}
                  {selectedToken.symbol} (account{' '}
                  {selectedToken.privateAccounts![0].account}).
                </p>
              )}
          </div>
        )}

        {/* Step 2: Recipient */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Recipient</label>
          <Input
            placeholder="0x... / wallet1... (public) or shieldd1... (private)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          {recipient && !recipientChain && (
            <p className="mt-1 text-xs text-red-500">
              Unrecognized address format. Use 0x.../wallet... for public or shieldd1... for private.
            </p>
          )}
          {/* Quick-fill buttons */}
          <div className="mt-1.5 flex flex-wrap gap-2">
            {penumbraAddress && (
              <button
                type="button"
                onClick={() => setRecipient(penumbraAddress)}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                Private Address
              </button>
            )}
            {penumbraAddress && !shieldingRegulated && (
              <button
                type="button"
                disabled={isGeneratingDepositAddr}
                onClick={async () => {
                  setIsGeneratingDepositAddr(true)
                  try {
                    const record = await generateAndSaveEphemeralAddressRecord({
                      accountIndex: currentAccount,
                      purpose: 'generated-deposit',
                      label: 'Generated receive address',
                    })
                    setRecipient(record.penumbraAddress)
                    toast.success('Generated fresh deposit address')
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to generate deposit address')
                  } finally {
                    setIsGeneratingDepositAddr(false)
                  }
                }}
                className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50"
              >
                {isGeneratingDepositAddr ? 'Generating...' : 'Fresh deposit address'}
              </button>
            )}
            {bech32Address && (
              <button
                type="button"
                onClick={() => setRecipient(bech32Address)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                My public address
              </button>
            )}

          </div>
          {shieldingRegulated && recipientChain === 'private' && (
            <p className="mt-1.5 text-xs text-amber-600">
              This is a regulated asset — shield it
              to your registered “Private Address”. Ephemeral deposit
              addresses aren&apos;t in the compliance tree, so notes sent there
              cannot be spent.
            </p>
          )}
        </div>

        {sourceChain === 'private' && recipientChain === 'public' && !canWithdrawPrivateToken(selectedToken) && (
          <p className="text-xs text-amber-600">
            Select a private asset to unshield.
          </p>
        )}
        {/* Transfer mode indicator */}
        {transferMode && selectedToken && recipientChain && (
          <div className={`rounded-lg px-3 py-2 text-sm font-medium ${
            transferMode === 'same-chain'
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {transferLabel}
          </div>
        )}

        {/* Memo */}
        <Input
          label="Memo (optional)"
          placeholder="Optional memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!canSubmit}
          className="w-full"
        >
          {isSubmitting ? 'Sending...' : transferLabel}
        </Button>

        {lastResult && (
          <div
            data-testid="transfer-result"
            className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600">
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                <path d="M4 10.5l4 4 8-9" stroke="white" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-900">
                {lastResult.action} {formatAmount(lastResult.amount)} {lastResult.symbol}
              </p>
              <p className="truncate text-xs text-green-700">to {lastResult.to}</p>
            </div>
          </div>
        )}

        {privateQueue.jobs.length > 0 && (
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Private activity
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {/* All jobs, newest first — confirmed unshields/sends stay
                  visible instead of vanishing the moment they land. */}
              {privateQueue.jobs
                .slice()
                .reverse()
                .map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-gray-700">
                      {job.type === 'private-send' ? 'Private Send' : 'Unshield'} {formatAmount(job.amount)} {job.asset.symbol}
                      {job.recipientLabel ? ` to ${job.recipientLabel}` : ''}
                    </span>
                    <span
                      className={
                        job.status === 'failed'
                          ? 'text-red-600'
                          : job.status === 'confirmed'
                            ? 'text-green-600'
                            : 'text-gray-500'
                      }
                    >
                      {job.error ?? job.statusMessage}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </form>
    </Card>
  )
}

// =============================================================================
// Transfer Handlers
// =============================================================================

/** Public → Public: ERC20 transfer for token balances, bank MsgSend for native */
async function handlePublicSend(
  token: UnifiedToken,
  amount: string,
  recipient: string,
  senderBech32: string,
  queryClient: ReturnType<typeof useQueryClient>,
  toastId: string,
) {
  const amountInMinDenom = parseTokenAmount(amount, token.decimals)

  let results: Awaited<ReturnType<typeof executeTx>>
  if (token.erc20Address) {
    // ERC20 balances live in the contract, not the bank module — a bank send
    // of the erc20:0x… denom fails with "spendable balance 0". Transfer the
    // token directly so the recipient keeps it in ERC20 form.
    const { MOCK_ERC20_ABI } = await import('@/lib/evm')
    const { bech32ToHex } = await import('@/lib/utils')
    const recipientHex = (
      recipient.startsWith('0x') ? recipient : bech32ToHex(recipient)
    ) as `0x${string}`

    results = await executeTx(queryClient, {
      address: token.erc20Address as `0x${string}`,
      abi: MOCK_ERC20_ABI,
      functionName: 'transfer',
      args: [recipientHex, amountInMinDenom],
      successMessage: `Sent ${amount} ${token.symbol}`,
      toastId,
    } as any)
  } else {
    const { hexToBech32 } = await import('@/lib/utils')
    const recipientBech32 = recipient.startsWith('0x') ? hexToBech32(recipient) : recipient

    results = await executeTx(queryClient, {
      msg: MsgSend,
      values: {
        fromAddress: senderBech32,
        toAddress: recipientBech32,
        amount: [{ denom: token.denom, amount: amountInMinDenom.toString() }],
      },
      successMessage: `Sent ${amount} ${token.symbol}`,
      toastId,
    } as any)
  }

  // When a Safe is active this only queued a proposal - executeTx already showed
  // the "Proposed" toast, so don't overwrite it with a "Sent" that didn't happen.
  if (isProposedResult(results)) return null
  toast.success(`Sent ${amount} ${token.symbol}`, { id: toastId })
  return 'Sent'
}

/** Deposit public Bankd funds into Shieldd. */
async function handleShield(
  token: UnifiedToken,
  amount: string,
  recipient: string,
  senderBech32: string,
  senderHex: `0x${string}`,
  queryClient: ReturnType<typeof useQueryClient>,
  toastId: string,
) {
  const amountInMinDenom = parseTokenAmount(amount, token.decimals).toString()

  // The native-token ERC20 alias (0xEeee…) is bank-backed as the native denom.
  const isNativeAlias =
    token.erc20Address?.toLowerCase() ===
    chainConfig.nativeErc20Address.toLowerCase()
  const denom = isNativeAlias ? chainConfig.denom : token.denom

  const transferStep = {
    msg: MsgDeposit,
    values: {
      sender: senderBech32,
      amount: { denom, amount: amountInMinDenom },
      recipient,
    },
    successMessage: `Shielding ${amount} ${token.symbol}`,
    toastId,
  } as any

  if (token.erc20Address && !isNativeAlias) {
    // ERC20 balances live in the contract; the Shieldd deposit spends bank
    // coins, so convert first (same as the assets page's shield modal).
    const [, transferResult] = await executeTx(
      queryClient,
      {
        msg: MsgConvertERC20,
        values: {
          contractAddress: token.erc20Address,
          amount: amountInMinDenom,
          receiver: senderBech32,
          sender: senderHex,
        },
        successMessage: 'Converted to native token',
        toastId,
      } as any,
      transferStep
    )
    assertBroadcast(transferResult)
  } else {
    const [transferResult] = await executeTx(queryClient, transferStep)
    assertBroadcast(transferResult)
  }

  toast.success(`Shielded ${amount} ${token.symbol}`, { id: toastId })
  return 'Shielded'
}
