/** Public transfers, native BRL Shield deposits and EVM host withdrawals. */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { executeTx, type TransactionProgressCallback } from '@/lib/evm/execute'
import { publicTransferCall, shieldDepositCall, ibcTransferCall } from '@/lib/commonware/transactions'
import { getEVMAccount } from '@/lib/native-wallet/evm-keys'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import { useWallet } from './useWallet'
import { useIBCChannels } from './useIBCChannels'

export type TransferType = 'public' | 'shield' | 'unshield'
export type TransferStatus = 'idle' | 'preparing' | 'signing' | 'broadcasting' | 'confirming' | 'confirmed' | 'error'
export interface TransferState { status: TransferStatus; message: string; txHash?: string; error?: string }
type Amount = { amount: string; denom: string; decimals: number; symbol?: string }

export function useTransfer() {
  const [state, setState] = useState<TransferState>({ status: 'idle', message: '' })
  const queryClient = useQueryClient()
  const { hexAddress } = useWallet()
  const bridge = usePenumbraBridge()
  const addressRef = useRef(bridge.penumbraAddress)
  addressRef.current = bridge.penumbraAddress
  const { data: channels } = useIBCChannels()
  const activeChannel = useMemo(() => channels?.find(c => c.state === 3 && c.clientStatus === 'Active')?.channelId ?? null, [channels])
  const busy = useRef(false)
  const run = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return false
    busy.current = true
    setState({ status: 'preparing', message: 'Preparing transfer...' })
    try {
      if (!hexAddress) throw new Error('Wallet not connected')
      await action()
      await queryClient.invalidateQueries()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transfer failed'
      setState(previous => ({ ...previous, status: 'error', message, error: message }))
      return false
    } finally { busy.current = false }
  }, [hexAddress, queryClient])
  const onProgress: TransactionProgressCallback = useCallback(p => setState({ status: p.step, message: p.message, txHash: p.txHash }), [])

  const sendSameChain = useCallback((params: Amount & { recipient: string }) => run(async () => {
    await executeTx(getEVMAccount(), queryClient, [{ ...publicTransferCall(params.recipient, params.amount, params.denom, params.decimals), successMessage: 'Transfer confirmed!' }], onProgress)
  }), [run, queryClient, onProgress])

  const sendPublicTransfer = useCallback((params: Amount & { recipient: string; channel?: string; memo?: string }) => run(async () => {
    const clientId = params.channel || activeChannel
    if (!clientId) throw new Error('No active IBC client is configured')
    await executeTx(getEVMAccount(), queryClient, [{ ...ibcTransferCall(clientId, params.recipient, params.amount, params.denom, params.decimals, params.memo), successMessage: 'IBC transfer submitted; awaiting relay' }], onProgress)
  }), [run, activeChannel, queryClient, onProgress])

  const shield = useCallback((params: Amount) => run(async () => {
    if (!addressRef.current) throw new Error('Shieldd receive address is not available')
    await executeTx(getEVMAccount(), queryClient, [{ ...shieldDepositCall(addressRef.current, params.amount, params.denom, params.decimals), successMessage: 'Shield deposit confirmed!' }], onProgress)
  }), [run, queryClient, onProgress])

  // The withdrawal interface takes integer base units, like the original wallet.
  const unshield = useCallback((params: { amount: string; denom: string; sourceChannel?: string; symbol?: string }) => run(async () => {
    if (params.denom !== 'abrl') throw new Error('Only native BRL can be withdrawn on this chain')
    setState({ status: 'signing', message: 'Building ZK proof...' })
    const result = await bridge.withdraw({ amount: params.amount, denom: params.denom, destinationAddress: hexAddress!, onProgress: (step, message) =>
      setState({ status: step === 'confirming' || step === 'syncing' ? 'confirming' : 'signing', message }) })
    if (!result.success) {
      setState({ status: 'error', message: result.error || 'Withdrawal failed', error: result.error, txHash: result.txHash })
      throw new Error(result.error || 'Withdrawal failed')
    }
    setState({ status: 'confirmed', message: 'Withdrawal confirmed!', txHash: result.txHash })
  }), [run, bridge, hexAddress])

  const reset = useCallback(() => setState({ status: 'idle', message: '' }), [])
  return { state, activeChannel, sendSameChain, sendPublicTransfer, shield, unshield, reset }
}
