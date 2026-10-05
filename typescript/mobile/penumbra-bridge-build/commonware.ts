import { KeyValueRequest, KeyValueResponse } from '@mizufinance/protobuf/shieldd/cnidarium/v1/cnidarium_pb'
import { bytesToHex, hexToBytes, type Hex } from 'viem'
import { decodeGrpcRequest, encodeGrpcResponses, wrapShielddTransaction } from '@bankd/shieldd-web'
export { wrapShielddTransaction }

type Fetch = typeof globalThis.fetch

export async function rpc<T>(url: string, method: string, params: unknown[] = [], fetcher: Fetch = globalThis.fetch): Promise<T> {
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!response.ok) throw new Error(`Commonware RPC returned HTTP ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(data.error.message || 'Commonware RPC failed')
  if (!('result' in data)) throw new Error('Commonware RPC returned no result')
  return data.result as T
}

const QUERIES = new Set(['AppParameters', 'AssetMetadataById', 'ComplianceAssetStatus', 'ComplianceBatchMerkleProofs', 'ComplianceUserLeaf', 'KeyValue', 'NullifierWindow', 'CompactBlockRange', 'CommittedTransaction'])

/** Adapt the browser SDK's gRPC-web requests directly to the node wallet RPC. */
export function createShielddFetch(endpoint: () => string, fetcher: Fetch): Fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!url.includes('/shieldd.') && !url.includes('/mizufinance.shieldd.') && !url.includes('/query/')) {
      return fetcher(input, init)
    }
    const method = new URL(url).pathname.split('/').at(-1) || ''
    if (!QUERIES.has(method)) throw new Error(`Unsupported Shieldd query: ${method}`)
    const request = new Request(input, init)
    const text = request.headers.get('content-type')?.includes('grpc-web-text') ?? false
    const payload = text
      ? Uint8Array.from(atob(await request.text()), character => character.charCodeAt(0))
      : new Uint8Array(await request.arrayBuffer())
    const messages = await rpc<Hex[]>(endpoint(), 'bankd_shieldQuery', [method, bytesToHex(decodeGrpcRequest(payload))], fetcher)
    const frames = encodeGrpcResponses(messages.map(message => hexToBytes(message)))
    let encoded = ''
    if (text) {
      for (const byte of frames) encoded += String.fromCharCode(byte)
      encoded = btoa(encoded)
    }
    return new Response(text ? encoded : new Uint8Array(frames), { headers: { 'content-type': text ? 'application/grpc-web-text' : 'application/grpc-web+proto' } })
  }
}

export const getFinalizedHeight = async (url: string) => {
  const block = await rpc<{ number: Hex } | null>(url, 'eth_getBlockByNumber', ['finalized', false])
  if (!block) throw new Error('No finalized block is available')
  return Number(BigInt(block.number))
}

export async function broadcast(url: string, transaction: Uint8Array): Promise<Hex> {
  const hash = await rpc<Hex>(url, 'eth_sendRawTransaction', [bytesToHex(wrapShielddTransaction(transaction))])
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Invalid transaction hash from node')
  return hash
}

export async function waitForConfirmation(url: string, hash: Hex, timeoutMs = 60_000, intervalMs = 500): Promise<number> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const receipt = await rpc<{ status: Hex; blockNumber: Hex } | null>(url, 'eth_getTransactionReceipt', [hash])
    if (receipt) {
      if (BigInt(receipt.status) !== 1n) throw new Error(`Shieldd transaction reverted: ${hash}`)
      const height = Number(BigInt(receipt.blockNumber))
      if (await getFinalizedHeight(url) >= height) return height
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Confirmation timed out; check transaction ${hash} before retrying`)
}

/** The node accepts only roots that were committed in finalized Shieldd state. */
export async function assertCommittedAnchor(url: string, anchor: Uint8Array | undefined): Promise<void> {
  if (!anchor || anchor.length !== 32) throw new Error('Transaction witness has no valid SCT anchor')
  const key = `sct/tree/anchor_lookup/${bytesToHex(anchor).slice(2)}`
  const request = new KeyValueRequest({ key })
  const messages = await rpc<Hex[]>(url, 'bankd_shieldQuery', ['KeyValue', bytesToHex(request.toBinary())])
  const response = messages[0] ? KeyValueResponse.fromBinary(hexToBytes(messages[0])) : undefined
  if (!response?.value?.value?.length) throw new Error('Wallet SCT is out of sync; use Clear Cache & Resync before sending')
}
