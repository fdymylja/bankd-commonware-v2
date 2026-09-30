import { NextRequest, NextResponse } from 'next/server'

import { penumbraConfig } from '@/lib/config'
import { embeddedShielddQueryUrl } from '@/lib/native-wallet/penumbra/embedded-shieldd'

export const dynamic = 'force-dynamic'

/**
 * Returns whether a given SCT anchor (Merkle root, lowercase hex) was ever a
 * real chain root, read from cnidarium key `sct/tree/anchor_lookup/{anchor}`.
 *
 * This mirrors the chain's own `check_claimed_anchor` performed at broadcast,
 * so it is the exact, race-free pre-flight check for "provided anchor is not a
 * valid SCT root" — unlike comparing against `anchor_by_height`, it does not
 * depend on agreeing with the sync height, which skews at the chain tip.
 * Penumbra retains every historical anchor forever.
 */
function grpcWebTextRequest(requestBytes: Uint8Array): string {
  const frame = new Uint8Array(5 + requestBytes.length)
  frame[0] = 0
  const len = requestBytes.length
  frame[1] = (len >> 24) & 0xff
  frame[2] = (len >> 16) & 0xff
  frame[3] = (len >> 8) & 0xff
  frame[4] = len & 0xff
  frame.set(requestBytes, 5)
  return Buffer.from(frame).toString('base64')
}

function decodeGrpcWebText(base64Response: string): Buffer {
  const chunks = base64Response.match(/[A-Za-z0-9+/]+=*=*/g) || []
  return Buffer.concat(chunks.map((c) => Buffer.from(c, 'base64')))
}

function firstDataFrame(base64Response: string): Uint8Array | null {
  const bytes = decodeGrpcWebText(base64Response)
  let offset = 0
  while (offset + 5 <= bytes.length) {
    const flags = bytes[offset]
    const msgLen =
      (bytes[offset + 1] << 24) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 8) |
      bytes[offset + 4]
    offset += 5
    if (msgLen === 0 || offset + msgLen > bytes.length) break
    if (flags === 0) return bytes.slice(offset, offset + msgLen)
    offset += msgLen
  }
  return null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ anchor: string }> }
) {
  try {
    const { anchor } = await params
    if (!/^[0-9a-fA-F]{64}$/.test(anchor)) {
      return NextResponse.json({ error: 'invalid anchor' }, { status: 400 })
    }

    const { KeyValueRequest, KeyValueResponse } = await import(
      '@mizufinance/protobuf/shieldd/cnidarium/v1/cnidarium_pb'
    )

    const req = new KeyValueRequest({
      key: `sct/tree/anchor_lookup/${anchor.toLowerCase()}`,
    })
    const response = await fetch(
      embeddedShielddQueryUrl(penumbraConfig.grpcUrl, 'KeyValue'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text',
          Accept: 'application/grpc-web-text',
        },
        body: grpcWebTextRequest(req.toBinary()),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: `upstream ${response.status}` },
        { status: 502 }
      )
    }

    const frame = firstDataFrame(await response.text())
    if (!frame) {
      return NextResponse.json({ found: false })
    }
    const kv = KeyValueResponse.fromBinary(frame)
    return NextResponse.json({
      found: Boolean(kv.value?.value && kv.value.value.length > 0),
    })
  } catch (error) {
    console.error('[API] anchor-lookup failed:', error)
    return NextResponse.json(
      { error: 'failed to query anchor' },
      { status: 502 }
    )
  }
}
