'use client'

import { ATOMIC_SWAP_ABI, ERC20_ABI } from '@bankd/shared/evm/atomicSwap'
import { isWhitelistedForPrivateExecution } from '@bankd/shared/penumbra'
import type { FullViewingKey } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { type Hex, formatUnits, getAddress, parseUnits } from 'viem'

import { PageContainer } from '@/components/layout'
import {
  Button,
  ButtonSelect,
  Card,
  CopyButton,
  Input,
  Modal,
} from '@/components/ui'
import {
  PenumbraBalance,
  useAllOrders,
  useAvPVerification,
  useCustomTokenBalances,
  useCustomTokens,
  useEphemeralAddressRecords,
  useOrder,
  useOrderCounter,
  usePenumbra,
  usePenumbraBalances,
  useTokenDecimals,
  useTokenSymbol,
  useWallet,
} from '@/hooks'
import {
  AtomicSwapOrderWithId,
  type AvPTransferInfo,
  ZERO_ADDRESS,
} from '@/lib/evm'
import { executeTx } from '@/lib/evm/execute'
import { useActiveAccount } from '@/lib/multisig'
import {
  formatAmount,
  getErrorMessage,
  isValidHexAddress,
  truncateAddress,
} from '@/lib/utils'
import { PenumbraTransparentAddress } from '@/store/penumbra'

const STORAGE_KEY = 'bankd-atomicswap-address'

export default function AvPSwapPage() {
  const queryClient = useQueryClient()
  const { hexAddress } = useWallet()
  const { transparentAddress, fullViewingKey } = usePenumbra()
  const [contractAddress, setContractAddress] = useState<Hex | null>(null)
  const [addressInput, setAddressInput] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<bigint | null>(null)
  const { data: selectedOrder } = useOrder(contractAddress, selectedOrderId)

  // Verify contract exists by trying to read orderCounter
  const {
    data: orderCounter,
    isLoading: isVerifying,
    isError: isContractInvalid,
  } = useOrderCounter(contractAddress)

  const isContractVerified =
    contractAddress &&
    !isVerifying &&
    !isContractInvalid &&
    orderCounter !== undefined

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



  return (
    <PageContainer
      title="AvP Swap Demo"
      description="Atomic Payment-vs-Payment swap demonstration using the AtomicSwap contract"
    >
      {/* Contract Configuration */}
      <Card
        header="Contract Configuration"
        className="mb-6"
      >
        <div className="flex gap-4">
          <Input
            label="AtomicSwap Contract Address"
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
            No AtomicSwap contract found at this address
          </p>
        )}
        {isContractVerified && (
          <p className="mt-2 text-sm text-green-600">
            Connected to: {truncateAddress(contractAddress, 10, 8)}
          </p>
        )}
        {!hexAddress && (
          <p className="mt-2 text-sm text-yellow-600">
            Connect your wallet to view balances
          </p>
        )}
      </Card>

      {!contractAddress ? (
        <Card>
          <p className="py-8 text-center text-gray-500">
            Enter the AtomicSwap contract address above to get started.
          </p>
        </Card>
      ) : !isContractVerified ? (
        <Card>
          <p className="py-8 text-center text-gray-500">
            {isVerifying
              ? 'Verifying contract...'
              : 'Enter a valid AtomicSwap contract address to get started.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <PlaceOrderForm
                contractAddress={contractAddress}
                transparentAddress={transparentAddress}
                fullViewingKey={fullViewingKey}
              />
            </div>
            <div className="order-1 min-h-[400px] lg:order-2 lg:min-h-0 lg:h-auto">
              <ActiveOrdersList
                contractAddress={contractAddress}
                selectedOrderId={selectedOrderId}
                onSelectOrder={setSelectedOrderId}
              />
            </div>
          </div>

          <Modal
            isOpen={selectedOrderId !== null}
            onClose={() => setSelectedOrderId(null)}
            title={
              <span className="flex items-center gap-2">
                Order #{selectedOrderId?.toString() ?? ''}
                {selectedOrder &&
                  (selectedOrder.isActive ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Active
                    </span>
                  ) : selectedOrder.isCancelled ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Cancelled
                    </span>
                  ) : (
                    <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Completed
                    </span>
                  ))}
              </span>
            }
            size="lg"
          >
            <OrderDetailsContent
              contractAddress={contractAddress}
              orderId={selectedOrderId}
              onClose={() => setSelectedOrderId(null)}
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
// Place Order Form
// ============================================================================

// Unified token type for the selector
type UnifiedToken = {
  id: string
  symbol: string
  address: Hex
  balance: bigint
  balanceFormatted: string
  decimals: number
  isPrivate: boolean
  // For private tokens, store the Penumbra balance reference
  penumbraBalance?: PenumbraBalance
}

function PlaceOrderForm({
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
  // The seller is whoever places the order - the active account (the multisig
  // when one is selected, else personal). Balances must be read for that account
  // so the sell-asset list and the over-sell guard reflect what can actually be
  // delivered at execute time, not the personal wallet's holdings.
  const { evmAddress: sellerAddress } = useActiveAccount()
  const { tokens: savedTokens } = useCustomTokens()
  const { data: evmBalances = [] } = useCustomTokenBalances(
    savedTokens,
    sellerAddress ?? null
  )
  const { data: penumbraBalances = [] } = usePenumbraBalances()

  const [selectedSellToken, setSelectedSellToken] =
    useState<UnifiedToken | null>(null)
  const [sellAmount, setSellAmount] = useState('')
  const [buyToken, setBuyToken] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [whitelistedBuyer, setWhitelistedBuyer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Build deduplicated list of verified on-chain tokens for the buy asset selector.
  // Combines EVM balances (already verified by useCustomTokenBalances) and
  // Penumbra IBC balances that have resolved ERC20 addresses.
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

  const buyTokenData = knownTokens.find(
    (t) => t.address.toLowerCase() === buyToken.toLowerCase()
  )


  // Build unified token list
  const unifiedTokens: UnifiedToken[] = [
    // EVM tokens (transparent)
    ...evmBalances.map((token) => ({
      id: `evm-${token.address}`,
      symbol: token.symbol,
      address: token.address,
      balance: token.balance,
      balanceFormatted: token.balanceFormatted,
      decimals: token.decimals,
      isPrivate: false,
    })),
    // Penumbra tokens (private) - only IBC assets with valid ERC20 addresses
    ...penumbraBalances
      .filter((balance) => balance.isIBC && balance.erc20Address)
      .map((balance) => ({
        id: `penumbra-${balance.assetId}`,
        symbol: balance.symbol,
        address: balance.erc20Address!,
        balance: BigInt(balance.amount),
        balanceFormatted: balance.amountFormatted,
        decimals: balance.decimals,
        isPrivate: true,
        penumbraBalance: balance,
      })),
  ]
    .filter((t) => t.balance > 0n)
    .sort((a, b) => a.symbol.localeCompare(b.symbol))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSellToken) {
      toast.error('Please select an asset to sell')
      return
    }

    if (!isValidHexAddress(buyToken)) {
      toast.error('Invalid buy asset address')
      return
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      toast.error('Invalid sell amount')
      return
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast.error('Invalid buy amount')
      return
    }

    if (whitelistedBuyer && !isValidHexAddress(whitelistedBuyer)) {
      toast.error('Invalid authorized buyer address')
      return
    }

    const sellAmountWei = parseUnits(sellAmount, selectedSellToken.decimals)

    // Can't sell more than the seller actually holds - the order would just
    // revert at execute time (transferFrom exceeds balance). Block it up front.
    if (sellAmountWei > selectedSellToken.balance) {
      toast.error(
        `Insufficient balance: you have ${selectedSellToken.balanceFormatted} ${selectedSellToken.symbol}`
      )
      return
    }

    const buyDecimals = buyTokenData?.decimals ?? 18
    const buyAmountWei = parseUnits(buyAmount, buyDecimals)
    const buyer = whitelistedBuyer ? (whitelistedBuyer as Hex) : ZERO_ADDRESS

    setIsSubmitting(true)

    // Route to appropriate handler based on token type
    if (selectedSellToken.isPrivate) {
      await handleSubmitPrivate(
        selectedSellToken.address,
        sellAmountWei,
        buyAmountWei,
        buyer
      )
    } else {
      await handleSubmitTransparent(
        selectedSellToken.address,
        sellAmountWei,
        buyAmountWei,
        buyer
      )
    }

    setIsSubmitting(false)
  }

  const handleSubmitTransparent = async (
    sellTokenAddress: Hex,
    sellAmountWei: bigint,
    buyAmountWei: bigint,
    buyer: Hex
  ) => {
    if (!hexAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      await executeTx(
        queryClient,
        {
          address: sellTokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contractAddress, sellAmountWei],
          successMessage: 'Asset approved',
        },
        {
          address: contractAddress,
          abi: ATOMIC_SWAP_ABI,
          functionName: 'placeOrder',
          args: [
            sellAmountWei,
            sellTokenAddress,
            buyAmountWei,
            buyToken as Hex,
            buyer,
          ],
          successMessage: 'Order placed successfully!',
        }
      )

      // Reset form
      setSellAmount('')
      setBuyAmount('')
      setWhitelistedBuyer('')
      setSelectedSellToken(null)

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['atomicSwap'] })
      queryClient.invalidateQueries({ queryKey: ['erc20'] })
    } catch (error) {
      console.error('Failed to place order:', error)
    }
  }

  const handleSubmitPrivate = async (
    sellTokenAddress: Hex,
    sellAmountWei: bigint,
    buyAmountWei: bigint,
    buyer: Hex
  ) => {
    toast.error(
      'The private payment leg needs the Shieldd ICS withdrawal plumbing removed in 9971009c. ' +
        'Public settlement works.'
    )
  }

  return (
    <Card header="Place Order (Sell)">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Unified Token Selector */}
        <ButtonSelect
          label="Sell Asset"
          value={selectedSellToken?.id ?? null}
          onChange={(id) => {
            const token = unifiedTokens.find((t) => t.id === id)
            setSelectedSellToken(token ?? null)
          }}
          options={unifiedTokens.map((t) => ({
            value: t.id,
            label: t.symbol,
            detail: formatAmount(t.balanceFormatted),
            badge: t.isPrivate ? 'Private' : 'Public',
            tooltip: t.address,
            variant: t.isPrivate ? 'purple' : 'primary',
          }))}
          emptyMessage="No assets available. Deploy assets on the Assets page."
        />

        <Input
          label="Sell Amount"
          type="number"
          placeholder="0.00"
          value={sellAmount}
          onChange={(e) => setSellAmount(e.target.value)}
          hint={
            selectedSellToken
              ? `Balance: ${formatAmount(selectedSellToken.balanceFormatted)}`
              : undefined
          }
        />
        <ButtonSelect
          label="Buy Asset"
          value={buyTokenData?.address ?? null}
          onChange={(addr) => setBuyToken(addr)}
          options={knownTokens.map((t) => ({
            value: t.address,
            label: t.symbol,
            tooltip: t.address,
          }))}
          emptyMessage="No assets available. Deploy assets on the Assets page."
        />
        <Input
          label="Buy Amount"
          type="number"
          placeholder="0.00"
          value={buyAmount}
          onChange={(e) => setBuyAmount(e.target.value)}
          hint="Amount of buy asset you want to receive"
        />
        <Input
          label="Authorized Buyer (Optional)"
          placeholder="0x... or leave empty for open order"
          value={whitelistedBuyer}
          onChange={(e) => setWhitelistedBuyer(e.target.value)}
          hint="Restrict who can execute this order"
        />

        {/* Show intermediate address for private token sales */}
        {/* {selectedSellToken?.isPrivate && !!intermediateAddress && (
          <div className="rounded-lg bg-purple-50 p-3">
            <p className="text-xs font-medium text-purple-700">
              Your IBC Seller Address:
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
            !selectedSellToken ||
            (selectedSellToken.isPrivate ? !fullViewingKey : !hexAddress)
          }
          className={`w-full ${selectedSellToken?.isPrivate ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
        >
          Place Order
        </Button>
      </form>
    </Card>
  )
}

// ============================================================================
// Orders List (Active and Inactive)
// ============================================================================

function ActiveOrdersList({
  contractAddress,
  selectedOrderId,
  onSelectOrder,
}: {
  contractAddress: Hex
  selectedOrderId: bigint | null
  onSelectOrder: (id: bigint) => void
}) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useAllOrders(contractAddress)

  const activeOrders = data?.active ?? []
  const inactiveOrders = data?.inactive ?? []

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['atomicSwap'] })
  }

  return (
    <Card
      noPadding
      className="flex h-full flex-col"
      containerClassName="flex-1 min-h-0 overflow-hidden"
      header="Orders"
      headerRight={
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      }
    >
      {isLoading ? (
        <p className="p-6 text-sm text-gray-500">Loading orders...</p>
      ) : activeOrders.length === 0 && inactiveOrders.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">No orders found</p>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Active Orders */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active ({activeOrders.length})
            </h4>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-gray-400">No active orders</p>
            ) : (
              <div className="space-y-2">
                {activeOrders.map((order) => (
                  <OrderListItem
                    key={order.id.toString()}
                    order={order}
                    isSelected={selectedOrderId === order.id}
                    onSelect={() => onSelectOrder(order.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed/Cancelled Orders */}
          {inactiveOrders.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Completed / Cancelled ({inactiveOrders.length})
              </h4>
              <div className="space-y-2">
                {inactiveOrders.map((order) => (
                  <OrderListItem
                    key={order.id.toString()}
                    order={order}
                    isSelected={selectedOrderId === order.id}
                    onSelect={() => onSelectOrder(order.id)}
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

function OrderListItem({
  order,
  isSelected,
  onSelect,
  inactive,
}: {
  order: AtomicSwapOrderWithId
  isSelected: boolean
  onSelect: () => void
  inactive?: boolean
}) {
  const { data: sellSymbol } = useTokenSymbol(order.sellToken)
  const { data: buySymbol } = useTokenSymbol(order.buyToken)
  const { data: sellDecimals } = useTokenDecimals(order.sellToken)
  const { data: buyDecimals } = useTokenDecimals(order.buyToken)

  const sellAmountFormatted =
    sellDecimals !== undefined && sellDecimals !== null
      ? formatAmount(formatUnits(order.sellAmount, sellDecimals))
      : '...'
  const buyAmountFormatted =
    buyDecimals !== undefined && buyDecimals !== null
      ? formatAmount(formatUnits(order.buyAmount, buyDecimals))
      : '...'

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
          Order #{order.id.toString()}
        </span>
        <div className="flex gap-1">
          {order.isActive ? (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Active
            </span>
          ) : order.isCancelled ? (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Cancelled
            </span>
          ) : (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
              Completed
            </span>
          )}
          {/* {order.sellerIBCAddr && (
            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              IBC
            </span>
          )} */}
        </div>
      </div>
      <p
        className={`mt-1 text-sm ${inactive ? 'text-gray-400' : 'text-gray-600'}`}
      >
        {sellAmountFormatted}{' '}
        {sellSymbol || truncateAddress(order.sellToken, 4, 4)}{' '}
        <span className="text-gray-400">→</span> {buyAmountFormatted}{' '}
        {buySymbol || truncateAddress(order.buyToken, 4, 4)}
      </p>
      <p
        className={`mt-1 text-xs ${inactive ? 'text-gray-400' : 'text-gray-500'}`}
      >
        Seller: {truncateAddress(order.seller, 6, 4)}
      </p>
    </button>
  )
}

// ============================================================================
// Order Details Modal Content
// ============================================================================

function OrderDetailsContent({
  contractAddress,
  orderId,
  onClose,
  transparentAddress,
  fullViewingKey,
}: {
  contractAddress: Hex
  orderId: bigint | null
  onClose: () => void
  transparentAddress: PenumbraTransparentAddress | null
  fullViewingKey: FullViewingKey | null
}) {
  const queryClient = useQueryClient()
  const { hexAddress } = useWallet()

  const [isExecuting, setIsExecuting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)

  const { data: order, isLoading } = useOrder(contractAddress, orderId)

  // Get balances for the buy token from both public (EVM) and private (Penumbra)
  const { tokens: savedTokens } = useCustomTokens()
  const { data: evmBalances = [] } = useCustomTokenBalances(
    savedTokens,
    hexAddress ?? null
  )
  const { data: penumbraBalances = [] } = usePenumbraBalances()

  // Find the matching IBC balance that can be used to execute this order
  const matchingBalance = order
    ? penumbraBalances.find(
        (b) =>
          b.isIBC &&
          b.erc20Address &&
          b.erc20Address.toLowerCase() === order.buyToken.toLowerCase()
      )
    : undefined


  const { data: sellTokenSymbol } = useTokenSymbol(order?.sellToken ?? null)
  const { data: buyTokenSymbol } = useTokenSymbol(order?.buyToken ?? null)
  const { data: sellDecimals } = useTokenDecimals(order?.sellToken ?? null)
  const { data: buyDecimals } = useTokenDecimals(order?.buyToken ?? null)

  // Build payment options for the buy token
  const evmBalance = order
    ? evmBalances.find(
        (t) => t.address.toLowerCase() === order.buyToken.toLowerCase()
      )
    : undefined

  const paymentOptions: {
    value: string
    label: string
    detail: string
    badge: string
    variant: 'primary' | 'purple'
    tooltip?: string
  }[] = []
  if (evmBalance && evmBalance.balance > 0n) {
    paymentOptions.push({
      value: 'public',
      label: evmBalance.symbol,
      detail: formatAmount(evmBalance.balanceFormatted),
      badge: 'Public',
      variant: 'primary',
      tooltip: evmBalance.address,
    })
  }
  if (matchingBalance && BigInt(matchingBalance.amount) > 0n) {
    paymentOptions.push({
      value: 'private',
      label: matchingBalance.symbol,
      detail: formatAmount(matchingBalance.amountFormatted),
      badge: 'Private',
      variant: 'purple',
      tooltip: matchingBalance.erc20Address ?? undefined,
    })
  }

  const isPrivatePayment = paymentMethod === 'private'

  // Auto-select if only one payment option
  useEffect(() => {
    if (paymentOptions.length === 1) {
      setPaymentMethod(paymentOptions[0].value)
    }
  }, [paymentOptions.length])

  const handleExecuteEVM = async () => {
    if (!hexAddress || !order || orderId === null) return

    setIsExecuting(true)

    try {
      await executeTx(
        queryClient,
        {
          address: order.buyToken,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contractAddress, order.buyAmount],
          successMessage: 'Asset approved',
        },
        {
          address: contractAddress,
          abi: ATOMIC_SWAP_ABI,
          functionName: 'executeOrder',
          args: [orderId],
          successMessage: 'Order executed successfully!',
        }
      )

      // Close modal and refresh
      onClose()
      queryClient.invalidateQueries({ queryKey: ['atomicSwap'] })
      queryClient.invalidateQueries({ queryKey: ['erc20'] })
    } catch (error) {
      console.error('Failed to execute order:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleExecutePrivate = async () => {
    toast.error(
      'The private payment leg needs the Shieldd ICS withdrawal plumbing removed in 9971009c. ' +
        'Public settlement works.'
    )
  }

  const handleCancel = async () => {
    if (!hexAddress || !order || orderId === null) return

    setIsCancelling(true)

    try {
      await executeTx(queryClient, {
        address: contractAddress,
        abi: ATOMIC_SWAP_ABI,
        functionName: 'cancelOrder',
        args: [orderId],
        successMessage: 'Order cancelled successfully!',
      })

      // Close modal and refresh
      onClose()
      queryClient.invalidateQueries({ queryKey: ['atomicSwap'] })
    } catch (error) {
      console.error('Failed to cancel order:', error)
    } finally {
      setIsCancelling(false)
    }
  }

  const isUserSeller =
    order &&
    hexAddress &&
    order.seller.toLowerCase() === hexAddress.toLowerCase()

  // Load registry records for ephemeral address matching
  const { data: registryRecords = [] } = useEphemeralAddressRecords()

  // Check if IBC user can execute (their intermediate address matches whitelist)
  const isIBCUserWhitelisted =
    order &&
    isWhitelistedForPrivateExecution(
      order.whitelistedBuyer,
      ZERO_ADDRESS,
      registryRecords,
    )

  const canExecute =
    order &&
    order.isActive &&
    (order.whitelistedBuyer === ZERO_ADDRESS ||
      (hexAddress &&
        order.whitelistedBuyer.toLowerCase() === hexAddress.toLowerCase()))

  // Can execute via IBC if: order is active, user has matching IBC balance, and whitelist allows
  const canExecuteIBC =
    order && order.isActive && !!matchingBalance && isIBCUserWhitelisted

  if (isLoading) {
    return (
      <p className="py-4 text-sm text-gray-500">Loading order details...</p>
    )
  }

  if (!order) {
    return <p className="py-4 text-sm text-red-500">Order not found</p>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Swap Details
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem
            label="Seller"
            value={truncateAddress(order.seller, 8, 6)}
            mono
          />
          <DetailItem
            label="Buyer"
            value={
              order.whitelistedBuyer === ZERO_ADDRESS
                ? 'Open'
                : truncateAddress(order.whitelistedBuyer, 8, 6)
            }
          />
          <DetailItem
            label="Sell Asset"
            value={
              sellDecimals !== undefined && sellDecimals !== null
                ? `${formatAmount(formatUnits(order.sellAmount, sellDecimals))} ${sellTokenSymbol || ''}`
                : '...'
            }
          />
          <DetailItem
            label="Buy Asset"
            value={
              buyDecimals !== undefined && buyDecimals !== null
                ? `${formatAmount(formatUnits(order.buyAmount, buyDecimals))} ${buyTokenSymbol || ''}`
                : '...'
            }
          />
        </div>
      </div>

      {/* AvP Compliance Report - only for completed orders */}
      {!order.isActive && !order.isCancelled && (
        <AvPComplianceReport
          contractAddress={contractAddress}
          orderId={orderId}
        />
      )}

      {order.isActive && !isUserSeller && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Action
          </h4>

          {paymentOptions.length > 0 ? (
            <div className="space-y-3">
              <ButtonSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={paymentOptions}
                fullWidth
              />
              <Button
                onClick={isPrivatePayment ? handleExecutePrivate : handleExecuteEVM}
                isLoading={isExecuting}
                disabled={!paymentMethod}
                className={`w-full ${isPrivatePayment ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
              >
                Execute Order
              </Button>
            </div>
          ) : (
            <p className="py-2 text-sm text-yellow-600">
              No balance available for the required asset.
            </p>
          )}
        </div>
      )}

      {/* Cancel button for seller */}
      {order.isActive && isUserSeller && (
        <div className="border-t border-gray-200 pt-4">
          <Button
            variant="danger"
            onClick={handleCancel}
            isLoading={isCancelling}
            disabled={!hexAddress}
            className="w-full"
          >
            Cancel Order
          </Button>
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

// ============================================================================
// AvP Compliance Report
// ============================================================================

function AvPComplianceReport({
  contractAddress,
  orderId,
}: {
  contractAddress: Hex
  orderId: bigint | null
}) {
  const [verifyEnabled, setVerifyEnabled] = useState(false)
  const {
    data: verification,
    isLoading,
    error,
  } = useAvPVerification(contractAddress, orderId, verifyEnabled)

  return (
    <div className="space-y-3 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          AvP Compliance
        </h4>
        {!verification && !isLoading && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVerifyEnabled(true)}
          >
            Verify Compliance
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
          <span className="text-sm text-gray-500">
            Running compliance verification...
          </span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">
          Verification failed: {getErrorMessage(error)}
        </p>
      )}

      {verification && (
        <div className="space-y-4">
          {/* Verdict */}
          <div className="rounded-lg bg-gray-50 p-3">
            {verification.compliant ? (
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                  AvP COMPLIANT
                </span>
                <span className="text-xs text-gray-500">
                  BIS CPSS-IOSCO PFMI 2012
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  NON-COMPLIANT
                </span>
              </div>
            )}
          </div>

          {/* Core Checks */}
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckItem label="Atomic Execution" passed={verification.atomic} />
            <CheckItem
              label="Bidirectional Transfer"
              passed={verification.bidirectionalTransfer}
            />
            <CheckItem
              label="Settlement Finality"
              passed={verification.success}
            />
            <CheckItem
              label="Participants Identified"
              passed={verification.participantsIdentified}
            />
            <CheckItem
              label="Authorization Check"
              passed={verification.authorizationCheck}
            />
            <CheckItem
              label="All Risks Eliminated"
              passed={verification.risksEliminated}
            />
          </div>

          {/* Settlement Details */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Settlement
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500">Tx Hash</dt>
                <dd className="mt-1 flex items-center gap-1 font-mono text-sm text-gray-900">
                  {truncateAddress(verification.txHash, 10, 8)}
                  <CopyButton value={verification.txHash} />
                </dd>
              </div>
              <DetailItem
                label="Block"
                value={verification.blockNumber.toString()}
              />
              <DetailItem
                label="Settlement Time"
                value={new Date(verification.timestamp * 1000).toLocaleString()}
              />
              <DetailItem
                label="Gas Used"
                value={verification.gasUsed.toLocaleString()}
              />
            </div>
          </div>

          {/* Order Lifecycle */}
          {verification.orderTimeline && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Order Lifecycle
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Placed"
                  value={new Date(
                    verification.orderTimeline.creationTimestamp * 1000
                  ).toLocaleString()}
                />
                <DetailItem
                  label="Executed"
                  value={new Date(
                    verification.orderTimeline.executionTimestamp * 1000
                  ).toLocaleString()}
                />
                <DetailItem
                  label="Wait Time"
                  value={formatDuration(
                    verification.orderTimeline.intentToExecutionSeconds
                  )}
                />
                <DetailItem label="Settlement" value="Instant (single block)" />
              </div>
            </div>
          )}

          {/* Verified Transfers */}
          {(verification.transfersA2B.length > 0 ||
            verification.transfersB2A.length > 0) && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Verified Transfers
              </h4>
              <div className="space-y-2">
                {verification.transfersA2B.length > 0 && (
                  <TransferSummary
                    direction="A → B"
                    transfers={verification.transfersA2B}
                  />
                )}
                {verification.transfersB2A.length > 0 && (
                  <TransferSummary
                    direction="B → A"
                    transfers={verification.transfersB2A}
                  />
                )}
              </div>
            </div>
          )}

          {/* Pre-Settlement Validation */}
          {verification.preSettlement && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Pre-Settlement Validation
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                <CheckItem
                  label="Party A Approval Valid"
                  passed={verification.preSettlement.partyAApprovalValid}
                />
                <CheckItem
                  label="Party B Approval Valid"
                  passed={verification.preSettlement.partyBApprovalValid}
                />
                <CheckItem
                  label="Party A Sufficient Funds"
                  passed={verification.preSettlement.partyASufficientFunds}
                />
                <CheckItem
                  label="Party B Sufficient Funds"
                  passed={verification.preSettlement.partyBSufficientFunds}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={passed ? 'text-green-600' : 'text-red-600'}>
        {passed ? '\u2713' : '\u2717'}
      </span>
      <span className="text-gray-700">{label}</span>
    </div>
  )
}

function TransferSummary({
  direction,
  transfers,
}: {
  direction: string
  transfers: AvPTransferInfo[]
}) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-xs font-medium text-gray-500">{direction}</span>
      {transfers.map((t, i) => (
        <TransferLine key={i} transfer={t} />
      ))}
    </div>
  )
}

function TransferLine({ transfer }: { transfer: AvPTransferInfo }) {
  const { data: symbol } = useTokenSymbol(transfer.token)
  const { data: decimals } = useTokenDecimals(transfer.token)

  const formattedAmount =
    decimals !== undefined && decimals !== null
      ? formatAmount(formatUnits(transfer.amount, decimals))
      : transfer.amount.toString()

  return (
    <p className="mt-1 text-sm text-gray-700">
      <span className="font-mono text-xs text-gray-500">
        {truncateAddress(transfer.from, 6, 4)}
      </span>
      <span className="mx-1 text-gray-400">{'\u2192'}</span>
      <span className="font-mono text-xs text-gray-500">
        {truncateAddress(transfer.to, 6, 4)}
      </span>
      <span className="ml-2 font-medium">
        {formattedAmount} {symbol || truncateAddress(transfer.token, 4, 4)}
      </span>
    </p>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}
