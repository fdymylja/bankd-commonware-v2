import { Hex } from 'viem'

import { getIbcClient, getStargateClient } from '../cosmos/client'
import { getTxByEthereumHash } from '../cosmos/queries'
import { chainConfig } from '../config'

/**
 * Extract the packet sequence number from a Cosmos transaction's events.
 * Looks for the `send_packet` event with `packet_sequence` attribute.
 *
 * @param ethTxHash - The Ethereum transaction hash (0x-prefixed)
 */
export async function extractPacketSequenceFromTx(
  ethTxHash: Hex
): Promise<{
  sequence: bigint
  sourceChannel: string
  sourcePort: string
  destChannel: string
  destPort: string
} | null> {
  // Get the Cosmos tx from the Ethereum tx hash
  const tx = await getTxByEthereumHash(ethTxHash)

  if (!tx) {
    return null
  }

  // Look for send_packet event
  for (const event of tx.events) {
    if (event.type === 'send_packet') {
      let sequence: string | undefined
      let sourceChannel: string | undefined
      let sourcePort: string | undefined
      let destChannel: string | undefined
      let destPort: string | undefined

      for (const attr of event.attributes) {
        if (attr.key === 'packet_sequence') {
          sequence = attr.value
        } else if (attr.key === 'packet_src_channel') {
          sourceChannel = attr.value
        } else if (attr.key === 'packet_src_port') {
          sourcePort = attr.value
        } else if (attr.key === 'packet_dst_channel') {
          destChannel = attr.value
        } else if (attr.key === 'packet_dst_port') {
          destPort = attr.value
        }
      }

      if (sequence && sourceChannel && destChannel && sourcePort && destPort) {
        return {
          sequence: BigInt(sequence),
          sourceChannel,
          destChannel,
          sourcePort,
          destPort,
        }
      }
    }
  }

  return null
}

/**
 * Get the current block height on Bankd.
 * Call this BEFORE initiating an incoming IBC transfer to track it.
 */
export async function getBlockHeight(): Promise<number> {
  const client = await getStargateClient()
  return client.getHeight()
}

/**
 * Check if a packet commitment still exists.
 * Returns true if the commitment exists (packet not yet fully processed).
 * When the ack is received and processed, the commitment is deleted.
 */
export async function checkPacketCommitmentExists(
  channelId: string,
  sequence: bigint,
  portId: string
): Promise<boolean> {
  try {
    const client = await getIbcClient()
    const response = await client.core.channel.v1.packetCommitment({
      channelId,
      portId,
      sequence,
    })
    // If we get a commitment back, packet hasn't been acked yet
    return !!response.commitment
  } catch {
    // NotFound means commitment doesn't exist (packet was acked)
    return false
  }
}

/**
 * Check if a packet acknowledgement exists for a given sequence.
 * Returns true if the packet has been acknowledged (relay complete).
 *
 * Checks if the packet commitment has been cleared, which happens when
 * the ack is received and processed.
 */
export async function checkPacketAcknowledgement(
  channelId: string,
  sequence: bigint,
  portId: string
): Promise<boolean> {
  // Check if commitment has been cleared (most reliable indicator)
  const commitmentExists = await checkPacketCommitmentExists(
    channelId,
    sequence,
    portId
  )

  // Commitment cleared = ack was processed
  return !commitmentExists
}

/**
 * Check if a packet has been received on a channel (for incoming transfers).
 * Returns true if the packet has been processed.
 *
 * Searches for recv_packet events on Bankd that match the channel/port
 * and occurred after the specified block height.
 */
export async function checkPacketReceipt(
  channelId: string,
  portId: string,
  minHeight: number
): Promise<boolean> {
  const query = `recv_packet.packet_dst_channel='${channelId}' AND recv_packet.packet_dst_port='${portId}' AND tx.height>=${minHeight}`

  try {
    const client = await getStargateClient()
    // Search for recv_packet events on this channel after the start block
    const txs = await client.searchTx(query)
    if (txs.length > 0) return true
  } catch {
    // Fall back to direct CometBFT /tx_search below. This is especially useful
    // in React Native, where CosmJS search can fail silently while plain fetch
    // to the same RPC endpoint succeeds.
  }

  try {
    const params = new URLSearchParams({
      query: `"${query}"`,
      per_page: '1',
    })
    const response = await fetch(`${chainConfig.rpc}/tx_search?${params.toString()}`)
    if (!response.ok) return false
    const data = (await response.json()) as { result?: { total_count?: string; txs?: unknown[] } }
    const totalCount = Number(data.result?.total_count ?? data.result?.txs?.length ?? 0)
    return totalCount > 0
  } catch {
    return false
  }
}

/**
 * Build bidirectional channel mappings between Bankd and its IBC counterparties.
 *
 * Queries all Bankd IBC channels once and returns two maps:
 * - `penumbraToBankd`: Penumbra channel ID → Bankd channel ID
 *   (e.g. Penumbra's "channel-0" → Bankd's "channel-0")
 * - `bankdToPenumbra`: Bankd channel ID → Penumbra channel ID
 *   (e.g. Bankd's "channel-0" → Penumbra's "channel-0")
 *
 * `penumbraToBankd` is useful for resolving `destinationChannel` on Penumbra
 * balances whose denoms contain the Penumbra-side channel.
 *
 * `bankdToPenumbra` is useful for resolving which Penumbra channel a Bankd-side
 * IBC denom originated from.
 */
export async function getIBCChannelMap(
  portId: string = 'transfer'
): Promise<{ penumbraToBankd: Map<string, string>; bankdToPenumbra: Map<string, string> }> {
  const penumbraToBankd = new Map<string, string>()
  const bankdToPenumbra = new Map<string, string>()
  try {
    const client = await getIbcClient()
    const response = await client.core.channel.v1.channels({
      pagination: undefined,
    })
    for (const ch of response.channels) {
      if (ch.portId === portId && ch.counterparty?.channelId && ch.channelId) {
        // Multiple local channels can share the same counterparty channel in
        // multi-chain local dev (e.g. Brazil and Swiss both connect to
        // Penumbra channel-0). Preserve the first/open primary mapping instead
        // of letting later channels overwrite it; otherwise an asset whose
        // denom contains transfer/channel-0 can incorrectly derive an EEM
        // destination for channel-1 while the actual packet is received on
        // channel-0.
        if (!penumbraToBankd.has(ch.counterparty.channelId)) {
          penumbraToBankd.set(ch.counterparty.channelId, ch.channelId)
        }
        bankdToPenumbra.set(ch.channelId, ch.counterparty.channelId)
      }
    }
  } catch {
    // Return empty maps on error
  }
  return { penumbraToBankd, bankdToPenumbra }
}

/**
 * Format elapsed time for display.
 */
export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}
