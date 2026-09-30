import {
  AppParametersRequest, AppParametersResponse,
  CommittedTransactionRequest, CommittedTransactionResponse,
} from '@mizufinance/protobuf/shieldd/core/app/v1/app_pb'

export interface DisclosureSelection {
  transactionId: string
  height: string
  action: number
  output: number
}

const MAX_RESPONSE = 96 * 1024 + 16

export function validateDisclosureSelection(selection: DisclosureSelection): void {
  if (!/^[0-9a-f]{64}$/.test(selection.transactionId)) throw new Error('Expected a canonical Shieldd transaction ID')
  if (!/^[1-9][0-9]*$/.test(selection.height) || !Number.isSafeInteger(Number(selection.height))) {
    throw new Error('Expected a positive, safe integer block height')
  }
  for (const index of [selection.action, selection.output]) {
    if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) throw new Error('Invalid output selector')
  }
}

/** A bounded unary response must include an explicit successful gRPC status. */
export function decodeDisclosureResponse(raw: Uint8Array, headerStatus: string | null): Uint8Array {
  let message: Uint8Array | undefined
  let status = headerStatus
  let offset = 0
  let trailersSeen = false
  while (offset < raw.length) {
    if (raw.length - offset < 5) throw new Error('Truncated gRPC frame')
    const flags = raw[offset]
    const length = new DataView(raw.buffer, raw.byteOffset + offset + 1, 4).getUint32(0, false)
    offset += 5
    if (length > MAX_RESPONSE || length > raw.length - offset) throw new Error('Invalid gRPC message length')
    const frame = raw.subarray(offset, offset + length)
    offset += length
    if (trailersSeen) throw new Error('Unexpected data after gRPC trailers')
    if (flags === 0x80) {
      trailersSeen = true
      const matches = [...new TextDecoder().decode(frame).matchAll(/^grpc-status:\s*(\d+)\s*$/gmi)]
      if (matches.length !== 1) throw new Error('Missing or ambiguous gRPC status')
      const trailerStatus = matches[0]?.[1]
      if (status !== null && status !== trailerStatus) throw new Error('Conflicting gRPC status')
      status = trailerStatus ?? null
    } else if (flags === 0 && !message) {
      message = frame
    } else {
      throw new Error('Unexpected gRPC response frame')
    }
  }
  if (status !== '0') throw new Error(`Node query unavailable (gRPC status ${status ?? 'missing'})`)
  if (!message) throw new Error('Node returned no response')
  return message
}

async function unary(endpoint: string, method: string, request: Uint8Array): Promise<Uint8Array> {
  const frame = new Uint8Array(request.length + 5)
  new DataView(frame.buffer).setUint32(1, request.length, false)
  frame.set(request, 5)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/mizufinance.shieldd.v1.Query/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/grpc-web+proto', accept: 'application/grpc-web+proto' },
    body: frame,
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  })
  if (!response.ok || !response.body) throw new Error(`Node query unavailable (HTTP ${response.status})`)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_RESPONSE + 4096) throw new Error('Node response exceeds size limit')
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
  }
  const raw = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length }
  return decodeDisclosureResponse(raw, response.headers.get('grpc-status'))
}

export async function committedDisclosureTransaction(endpoint: string, chainId: string, selection: DisclosureSelection): Promise<string> {
  validateDisclosureSelection(selection)
  const params = AppParametersResponse.fromBinary(await unary(endpoint, 'AppParameters', new AppParametersRequest().toBinary()))
  if (params.appParameters?.chainId !== chainId) throw new Error('Node chain does not match the disclosure request')
  const request = new CommittedTransactionRequest({
    blockHeight: BigInt(selection.height),
    transactionId: Uint8Array.from(selection.transactionId.match(/../g)!, value => parseInt(value, 16)),
  })
  const response = CommittedTransactionResponse.fromBinary(await unary(endpoint, 'CommittedTransaction', request.toBinary()))
  if (response.blockHeight !== BigInt(selection.height) || !response.transaction) throw new Error('Transaction was not accepted at the selected height')
  // The pure Shieldd verifier checks the canonical transaction ID and selected output.
  const bytes = response.transaction.toBinary()
  if (bytes.length > 96 * 1024) throw new Error('Committed transaction exceeds size limit')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function disclosureRequest(chainId: string, selection: DisclosureSelection, method: 'openings' | 'payload-keys'): string {
  validateDisclosureSelection(selection)
  if (method !== 'openings' && method !== 'payload-keys') throw new Error('Unsupported disclosure method')
  return JSON.stringify({
    version: 1, chain_id: chainId, recipient: null, challenge: null, total: null,
    outputs: [{
      reference: { transaction_id: selection.transactionId, height: Number(selection.height), action: { Body: selection.action }, output: selection.output },
      amount: true, asset: true, recipient: true, predicate: null, memo: method === 'payload-keys', spending_control: false,
    }],
  })
}
