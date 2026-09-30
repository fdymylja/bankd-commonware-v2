'use client'

import {
  checkPacketAcknowledgement,
  checkPacketReceipt,
  extractPacketSequenceFromTx,
  formatElapsedTime,
} from '@bankd/shared/ibc/relay-tracker'
import toast from 'react-hot-toast'
import { Hex } from 'viem'


// Re-export pure functions from shared
export {
  extractPacketSequenceFromTx,
  getBlockHeight,
  checkPacketAcknowledgement,
  checkPacketReceipt,
  checkPacketCommitmentExists,
  formatElapsedTime,
} from '@bankd/shared/ibc/relay-tracker'

const DEFAULT_POLL_INTERVAL_MS = 1000
const DEFAULT_TIMEOUT_MS = 60 * 1000 // 1 minute

/**
 * Parameters for tracking outgoing IBC transfers (Bankd → external chain)
 */
export interface TrackOutgoingIBCParams {
  /** The Ethereum tx hash from executeTx result (0x-prefixed) */
  txHash: Hex
  /** Source channel on Bankd (e.g., "channel-0") */
  sourceChannel: string
  /** Existing toast ID to update with progress */
  toastId: string
  /** Optional callback when relay completes successfully */
  onComplete?: () => void
  /** Optional callback when relay fails or times out */
  onError?: (error: string) => void
  /** Poll interval in ms (default: 2000) */
  pollInterval?: number
  /** Timeout in ms (default: 120000 / 2 minutes) */
  timeout?: number
}

/**
 * Parameters for tracking incoming IBC transfers (Penumbra → Bankd)
 */
export interface TrackIncomingIBCParams {
  /** Channel on Bankd side where packet will arrive */
  destinationChannel: string
  /** Block height to start searching from (get this before initiating the transfer) */
  startBlockHeight: number
  /** Existing toast ID to update with progress */
  toastId: string
  /** Optional callback when relay completes successfully */
  onComplete?: () => void
  /** Optional callback when relay fails or times out */
  onError?: (error: string) => void
  /** Poll interval in ms (default: 2000) */
  pollInterval?: number
  /** Timeout in ms (default: 120000 / 2 minutes) */
  timeout?: number
}

/**
 * Track an outgoing IBC transfer (Bankd → external chain).
 *
 * This function will:
 * 1. Extract the packet sequence from the transaction
 * 2. Poll for the packet acknowledgement on Bankd (from the destination chain's ack)
 * 3. Update the toast with progress
 * 4. Resolve when the packet is acknowledged or timeout/error occurs
 */
export async function trackOutgoingIBC(
  params: TrackOutgoingIBCParams
): Promise<void> {
  const {
    txHash,
    sourceChannel,
    toastId,
    onComplete,
    onError,
    pollInterval = DEFAULT_POLL_INTERVAL_MS,
    timeout = DEFAULT_TIMEOUT_MS,
  } = params

  const startTime = Date.now()

  // Extract packet info from the transaction
  const packetInfo = await extractPacketSequenceFromTx(txHash)

  if (!packetInfo) {
    const errorMsg = 'Could not extract IBC packet info from transaction'
    toast.error(errorMsg, { id: toastId })
    onError?.(errorMsg)
    return
  }

  // Verify the channel matches
  if (packetInfo.sourceChannel !== sourceChannel) {
    console.warn(
      `Channel mismatch: expected ${sourceChannel}, got ${packetInfo.sourceChannel}`
    )
  }

  // Update toast to show we're waiting for relay
  toast.loading(`Waiting for transaction to finalize... (0s)`, { id: toastId })

  return new Promise<void>((resolve) => {
    const poll = async () => {
      const elapsed = Date.now() - startTime

      // Check for timeout
      if (elapsed >= timeout) {
        const errorMsg = `Relay timed out after ${formatElapsedTime(elapsed)}`
        toast.error(errorMsg, { id: toastId })
        onError?.(errorMsg)
        resolve()
        return
      }

      // Check if packet has been acknowledged (ack comes back from destination)
      const isAcked = await checkPacketAcknowledgement(
        sourceChannel,
        packetInfo.sequence,
        packetInfo.sourcePort
      )

      if (isAcked) {
        toast.success('Cross-chain transfer complete!', { id: toastId })
        onComplete?.()
        resolve()
        return
      }

      // Update toast with elapsed time
      toast.loading(
        `Waiting for transaction to finalize... (${formatElapsedTime(elapsed)})`,
        { id: toastId }
      )

      // Schedule next poll
      setTimeout(poll, pollInterval)
    }

    // Start polling
    poll()
  })
}

/**
 * Track an incoming IBC transfer (Penumbra → Bankd).
 *
 * This function will:
 * 1. Poll for recv_packet events on Bankd after the start block height
 * 2. Update the toast with progress
 * 3. Resolve when the packet is received or timeout/error occurs
 */
export async function trackIncomingIBC(
  params: TrackIncomingIBCParams
): Promise<void> {
  const {
    destinationChannel,
    startBlockHeight,
    toastId,
    onComplete,
    onError,
    pollInterval = DEFAULT_POLL_INTERVAL_MS,
    timeout = DEFAULT_TIMEOUT_MS,
  } = params

  const startTime = Date.now()

  // Update toast to show we're waiting for relay
  toast.loading(`Waiting for transaction to finalize... (0s)`, { id: toastId })

  return new Promise<void>((resolve) => {
    const poll = async () => {
      const elapsed = Date.now() - startTime

      // Check for timeout
      if (elapsed >= timeout) {
        const errorMsg = `Relay timed out after ${formatElapsedTime(elapsed)}`
        toast.error(errorMsg, { id: toastId })
        onError?.(errorMsg)
        resolve()
        return
      }

      // Check if packet has been received on Bankd after our start block
      const isReceived = await checkPacketReceipt(
        destinationChannel,
        'transfer',
        startBlockHeight
      )

      if (isReceived) {
        toast.success('Cross-chain transfer complete!', { id: toastId })
        onComplete?.()
        resolve()
        return
      }

      // Update toast with elapsed time
      toast.loading(
        `Waiting for transaction to finalize... (${formatElapsedTime(elapsed)})`,
        { id: toastId }
      )

      // Schedule next poll
      setTimeout(poll, pollInterval)
    }

    // Start polling
    poll()
  })
}
