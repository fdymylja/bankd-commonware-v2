/**
 * useTransfer — Execute public, Shieldd deposit, and Shieldd withdrawal flows.
 *
 * Public send: MsgTransfer via EVM MsgExec precompile (IBC transfer from Bankd)
 * Shield:      MsgDeposit into Bankd's embedded Shieldd
 * Unshield:    HostWithdrawal from embedded Shieldd back to Bankd
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { MsgTransfer } from '@bankd/shared/proto/ibc/applications/transfer/v1/tx'
import { MsgConvertERC20 } from '@bankd/shared/proto/cosmos/evm/erc20/v1/tx'
import { MsgSend } from '@bankd/shared/proto/cosmos/bank/v1beta1/tx'
import { parseTokenAmount, hexToBech32 } from '@bankd/shared/utils'

import { executeCosmosTx } from '@/lib/cosmos/execute'
import { executeTx, type TransactionProgressCallback } from '@/lib/evm/execute'
import { getEVMAccount } from '@/lib/native-wallet/evm-keys'
import { MsgDeposit } from '@bankd/shared/shieldd/msg-deposit'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import { useWallet } from './useWallet'
import { useIBCChannels } from './useIBCChannels'
// Transaction history is now built from Penumbra sync events, not manual calls

// =============================================================================
// Types
// =============================================================================

export type TransferType = 'public' | 'shield' | 'unshield'

export type TransferStatus =
  | 'idle'
  | 'preparing'
  | 'signing'
  | 'broadcasting'
  | 'confirming'
  | 'confirmed'
  | 'error'

export interface TransferState {
  status: TransferStatus
  message: string
  txHash?: string
  error?: string
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Ensure address is in bech32 format for Cosmos protobufs.
 * Converts 0x... EVM addresses to wallet1... bech32.
 */
function toBech32Address(address: string): string {
  if (address.startsWith('0x')) {
    return hexToBech32(address)
  }
  return address
}

/** IBC timeout: 10 minutes in nanoseconds */
function getIBCTimeoutTimestamp(): bigint {
  return BigInt(Date.now() + 10 * 60 * 1000) * BigInt(1_000_000)
}

// =============================================================================
// Hook
// =============================================================================

export function useTransfer() {
  const [state, setState] = useState<TransferState>({
    status: 'idle',
    message: '',
  })

  const queryClient = useQueryClient()
  const { bech32Address, hexAddress } = useWallet()
  const bridge = usePenumbraBridge()
  const penumbraAddrRef = useRef(bridge.penumbraAddress)
  penumbraAddrRef.current = bridge.penumbraAddress
  const { data: channels } = useIBCChannels()

  // Pick the lowest-numbered open + active channel
  const activeChannel = useMemo(() => {
    if (!channels || channels.length === 0) return null
    const open = channels
      .filter((c) => c.state === 3 /* STATE_OPEN */ && c.clientStatus === 'Active')
      .sort((a, b) => {
        const numA = parseInt(a.channelId.replace('channel-', ''), 10)
        const numB = parseInt(b.channelId.replace('channel-', ''), 10)
        return numA - numB
      })
    return open[0]?.channelId ?? null
  }, [channels])

  /**
   * Send a same-chain (Bankd → Bankd) transfer via MsgSend.
   * Works with both 0x and wallet1... addresses.
   */
  const sendSameChain = useCallback(
    async (params: {
      recipient: string
      amount: string
      denom: string
      decimals: number
    }) => {
      const { recipient, amount, denom, decimals } = params

      if (!bech32Address) {
        setState({ status: 'error', message: 'Wallet not connected', error: 'Wallet not connected' })
        return false
      }

      setState({ status: 'preparing', message: 'Preparing transfer...' })

      try {
        const account = getEVMAccount()
        const amountInMinDenom = parseTokenAmount(amount, decimals).toString()

        const onProgress: TransactionProgressCallback = (p) => {
          setState({
            status: p.step as TransferStatus,
            message: p.message,
            txHash: p.txHash,
          })
        }

        await executeTx(
          account,
          queryClient,
          [
            {
              msg: MsgSend as any,
              values: {
                fromAddress: bech32Address,
                toAddress: toBech32Address(recipient),
                amount: [{ denom, amount: amountInMinDenom }],
              },
              successMessage: 'Transfer sent!',
            },
          ],
          onProgress
        )

        setState({ status: 'confirmed', message: 'Transfer confirmed!' })
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transfer failed'
        setState({ status: 'error', message, error: message })
        return false
      }
    },
    [bech32Address, queryClient]
  )

  /**
   * Send a public IBC transfer from Bankd to another chain.
   * Used for cross-chain sends (to Penumbra addresses).
   */
  const sendPublicTransfer = useCallback(
    async (params: {
      recipient: string
      amount: string
      denom: string
      decimals: number
      channel?: string
      memo?: string
      symbol?: string
    }) => {
      const { recipient, amount, denom, decimals, channel, memo } = params

      if (!bech32Address) {
        setState({ status: 'error', message: 'Wallet not connected', error: 'Wallet not connected' })
        return false
      }

      setState({ status: 'preparing', message: 'Preparing transfer...' })

      try {
        const account = getEVMAccount()
        const amountInMinDenom = parseTokenAmount(amount, decimals).toString()
        const sourceChannel = channel || activeChannel
        if (!sourceChannel) {
          setState({ status: 'error', message: 'No active IBC channel found', error: 'No active IBC channel' })
          return false
        }

        const onProgress: TransactionProgressCallback = (p) => {
          setState({
            status: p.step as TransferStatus,
            message: p.message,
            txHash: p.txHash,
          })
        }

        // For ERC20 tokens, convert to native bank balance first
        const steps: any[] = []
        const isERC20 = denom.startsWith('erc20:')

        if (isERC20 && hexAddress) {
          steps.push({
            msg: MsgConvertERC20 as any,
            values: {
              contractAddress: denom.slice(6), // strip 'erc20:' prefix
              amount: amountInMinDenom,
              receiver: bech32Address,
              sender: hexAddress,
            },
            successMessage: 'Converted to native token',
          })
        }

        steps.push({
          msg: MsgTransfer as any,
          values: {
            sourcePort: 'transfer',
            sourceChannel,
            token: {
              denom,
              amount: amountInMinDenom,
            },
            sender: bech32Address,
            receiver: toBech32Address(recipient),
            timeoutHeight: undefined,
            timeoutTimestamp: getIBCTimeoutTimestamp(),
            memo: memo || '',
          },
          successMessage: 'Transfer sent!',
        })

        await executeTx(account, queryClient, steps, onProgress)

        setState({ status: 'confirmed', message: 'Transfer confirmed!' })
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transfer failed'
        setState({ status: 'error', message, error: message })
        return false
      }
    },
    [bech32Address, queryClient, activeChannel, bridge.penumbraAddress]
  )

  /** Deposit Bankd funds into the embedded Shieldd account. */
  const shield = useCallback(
    async (params: {
      amount: string
      denom: string
      decimals: number
      channel?: string
      symbol?: string
    }) => {
      const penumbraAddr = penumbraAddrRef.current
      if (!penumbraAddr) {
        setState({ status: 'error', message: 'Shieldd address not available', error: 'Shieldd not synced' })
        return false
      }

      if (!bech32Address) {
        setState({ status: 'error', message: 'Wallet not connected', error: 'Wallet not connected' })
        return false
      }

      setState({ status: 'preparing', message: 'Preparing Shieldd deposit...' })

      try {
        const account = getEVMAccount()
        const amountInMinDenom = parseTokenAmount(params.amount, params.decimals).toString()
        const messages: any[] = []

        if (params.denom.startsWith('erc20:')) {
          if (!hexAddress) throw new Error('EVM wallet address not available')
          messages.push({
            msg: MsgConvertERC20 as any,
            values: {
              contractAddress: params.denom.slice(6),
              amount: amountInMinDenom,
              receiver: bech32Address,
              sender: hexAddress,
            },
          })
        }

        messages.push({
          msg: MsgDeposit,
          values: {
            sender: bech32Address,
            amount: {
              denom: params.denom,
              amount: amountInMinDenom,
            },
            recipient: penumbraAddr,
          },
        })

        await executeCosmosTx(
          account,
          bech32Address,
          messages,
          (progress) => {
            setState({
              status: progress.step as TransferStatus,
              message: progress.message,
              txHash: progress.txHash,
            })
          },
        )

        setState({ status: 'confirmed', message: 'Shieldd deposit confirmed!' })
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Shieldd deposit failed'
        setState({ status: 'error', message, error: message })
        return false
      }
    },
    [bech32Address, hexAddress]
  )

  /** Withdraw embedded Shieldd funds to the connected Bankd account. */
  const unshield = useCallback(
    async (params: {
      amount: string
      denom: string
      sourceChannel?: string
      symbol?: string
    }) => {
      if (!bech32Address) {
        setState({ status: 'error', message: 'Wallet not connected', error: 'Wallet not connected' })
        return false
      }

      setState({ status: 'preparing', message: 'Preparing withdrawal...' })

      try {
        setState({ status: 'signing', message: 'Building ZK proof...' })

        const result = await bridge.withdraw({
          amount: params.amount,
          denom: params.denom,
          destinationAddress: bech32Address,
        })

        if (result.success) {
          setState({ status: 'confirmed', message: 'Withdrawal confirmed!', txHash: result.txHash })
          return true
        } else {
          setState({ status: 'error', message: result.error || 'Withdrawal failed', error: result.error })
          return false
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Withdrawal failed'
        setState({ status: 'error', message, error: message })
        return false
      }
    },
    [bech32Address, bridge]
  )

  const reset = useCallback(() => {
    setState({ status: 'idle', message: '' })
  }, [])

  return {
    state,
    activeChannel,
    sendSameChain,
    sendPublicTransfer,
    shield,
    unshield,
    reset,
  }
}
