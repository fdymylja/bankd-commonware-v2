import {
  decodeGrpcRequest,
  encodeGrpcResponses,
  shielddQueryUrl,
} from '@bankd/shieldd-web'
import { type Hex, bytesToHex, hexToBytes } from 'viem'

import { rpc } from './server'

export async function shielddFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const method = url.split('/').at(-1) || ''
  shielddQueryUrl('', method)
  const isText =
    new Headers(init?.headers).get('Content-Type')?.includes('grpc-web-text') ??
    false
  const raw = isText
    ? new Uint8Array(Buffer.from(String(init?.body || ''), 'base64'))
    : new Uint8Array(await new Response(init?.body).arrayBuffer())
  let frames: Uint8Array
  try {
    const messages = await rpc<Hex[]>('bankd_shieldQuery', [
      method,
      bytesToHex(decodeGrpcRequest(raw)),
    ])
    frames = encodeGrpcResponses(messages.map((message) => hexToBytes(message)))
  } catch (error) {
    frames = encodeGrpcResponses(
      [],
      13,
      error instanceof Error ? error.message : 'Shieldd query failed'
    )
  }
  return new Response(
    isText ? Buffer.from(frames).toString('base64') : frames,
    {
      headers: {
        'Content-Type': isText
          ? 'application/grpc-web-text'
          : 'application/grpc-web+proto',
      },
    }
  )
}
