import { bytesToHex, concat, hexToBytes, toRlp } from 'viem'

const METHODS = new Set([
  'AppParameters',
  'AssetMetadataById',
  'ComplianceAssetStatus',
  'ComplianceBatchMerkleProofs',
  'ComplianceUserLeaf',
  'KeyValue',
  'NullifierWindow',
  'CompactBlockRange',
  'CommittedTransaction',
])

export function shielddQueryUrl(endpoint: string, method: string): string {
  if (!METHODS.has(method))
    throw new Error(`Unsupported Shieldd query: ${method}`)
  return `${endpoint.replace(/\/$/, '')}/query/${method}`
}

export function rewriteShielddQueryUrl(url: string, endpoint: string): string {
  const path = url.split('?')[0]
  const method = path.slice(path.lastIndexOf('/') + 1)
  if (path.includes('/shieldd.') && METHODS.has(method))
    return shielddQueryUrl(endpoint, method)
  return url
}

/** EIP-2718 envelope from TxShielded: 0x77 || RLP([protobuf transaction]). */
export function wrapShielddTransaction(transaction: Uint8Array): Uint8Array {
  if (!transaction.length) throw new Error('Empty Shieldd transaction')
  return hexToBytes(concat(['0x77', toRlp([bytesToHex(transaction)])]))
}

export function decodeGrpcRequest(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 5 || bytes[0] !== 0)
    throw new Error('Expected one uncompressed gRPC request')
  const size = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(1)
  if (size > 1_048_576 || bytes.length !== size + 5)
    throw new Error('Invalid gRPC request length')
  return bytes.subarray(5)
}

export function encodeGrpcResponses(
  messages: Uint8Array[],
  status = 0,
  message = ''
): Uint8Array {
  const frames = messages.map((bytes) => frame(bytes, 0))
  frames.push(
    frame(
      new TextEncoder().encode(
        `grpc-status: ${status}\r\ngrpc-message: ${encodeURIComponent(message)}\r\n`
      ),
      0x80
    )
  )
  const result = new Uint8Array(frames.reduce((sum, f) => sum + f.length, 0))
  let offset = 0
  for (const bytes of frames) {
    result.set(bytes, offset)
    offset += bytes.length
  }
  return result
}

function frame(bytes: Uint8Array, flags: number): Uint8Array {
  const result = new Uint8Array(5 + bytes.length)
  result[0] = flags
  new DataView(result.buffer).setUint32(1, bytes.length)
  result.set(bytes, 5)
  return result
}
