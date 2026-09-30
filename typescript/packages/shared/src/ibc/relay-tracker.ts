import { decodeEventLog, encodePacked, keccak256, type Hex } from 'viem'
import { getPublicClient } from '../chain/client'
import { getIBCChannels, getLatestBlockHeight, getTxByEthereumHash } from '../chain/queries'
import { IBC_ROUTER_ABI, IBC_ROUTER_ADDRESS } from '../evm/bankd'

export async function extractPacketSequenceFromTx(ethTxHash: Hex) {
  const receipt = await getTxByEthereumHash(ethTxHash)
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== IBC_ROUTER_ADDRESS.toLowerCase()) continue
    try {
      const event = decodeEventLog({ abi: IBC_ROUTER_ABI, eventName: 'SendPacket', data: log.data, topics: log.topics })
      const packet = event.args.packet
      return { sequence: packet.sequence, sourceChannel: packet.sourceClient, sourcePort: packet.payloads[0]?.sourcePort ?? 'transfer', destChannel: packet.destClient, destPort: packet.payloads[0]?.destPort ?? 'transfer' }
    } catch { /* Other router events are not outgoing packets. */ }
  }
  return null
}
export const getBlockHeight = getLatestBlockHeight
export function packetCommitmentPath(clientId: string, sequence: bigint, kind: 1 | 2 | 3 = 1): Hex {
  return keccak256(encodePacked(['string', 'uint8', 'uint64'], [clientId, kind, sequence]))
}
export async function checkPacketCommitmentExists(clientId: string, sequence: bigint, _portId: string): Promise<boolean> {
  const value = await getPublicClient().readContract({ address: IBC_ROUTER_ADDRESS, abi: IBC_ROUTER_ABI, functionName: 'getCommitment', args: [packetCommitmentPath(clientId, sequence)] })
  return BigInt(value) !== 0n
}
// A cleared commitment can also mean timeout. Only an actual ack event confirms acknowledgement.
export async function checkPacketAcknowledgement(clientId: string, sequence: bigint, _portId: string): Promise<boolean> {
  const logs = await getPublicClient().getContractEvents({ address: IBC_ROUTER_ADDRESS, abi: IBC_ROUTER_ABI, eventName: 'AckPacket', args: { sequence }, fromBlock: 0n, toBlock: 'latest' })
  return logs.some(log => log.args.packet?.sourceClient === clientId && log.args.packet?.sequence === sequence)
}
export async function checkPacketReceipt(clientId: string, portId: string, minHeight: number): Promise<boolean> {
  const logs = await getPublicClient().getContractEvents({ address: IBC_ROUTER_ADDRESS, abi: IBC_ROUTER_ABI, eventName: 'WriteAcknowledgement', fromBlock: BigInt(minHeight), toBlock: 'latest' })
  return logs.some(log => log.args.packet?.destClient === clientId && log.args.packet?.payloads.some(payload => payload.destPort === portId))
}
export async function getIBCChannelMap(portId = 'transfer') {
  const penumbraToBankd = new Map<string, string>()
  const bankdToPenumbra = new Map<string, string>()
  for (const route of await getIBCChannels()) {
    if (route.portId !== portId) continue
    if (!penumbraToBankd.has(route.counterparty.channelId)) penumbraToBankd.set(route.counterparty.channelId, route.clientId)
    bankdToPenumbra.set(route.clientId, route.counterparty.channelId)
  }
  return { penumbraToBankd, bankdToPenumbra }
}
export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
