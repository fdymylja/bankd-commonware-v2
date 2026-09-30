import { NextRequest, NextResponse } from 'next/server'

import { penumbraConfig } from '@/lib/config'
import { embeddedShielddQueryUrl } from '@/lib/native-wallet/penumbra/embedded-shieldd'
import { shielddFetch as fetch } from '@/lib/rpc/shieldd'

export const dynamic = 'force-dynamic'

/**
 * Proxy endpoint for Penumbra CompactBlockRange streaming RPC via gRPC-web.
 * Fetches a range of compact blocks in a single request instead of one-by-one.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    const response = await fetch(
      embeddedShielddQueryUrl(penumbraConfig.grpcUrl, 'CompactBlockRange'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text',
          Accept: 'application/grpc-web-text',
        },
        body,
      }
    )

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, {
        status: response.status,
      })
    }

    const data = await response.text()
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/grpc-web-text',
      },
    })
  } catch (error) {
    console.error('[API] Failed to fetch compact block range:', error)
    return new NextResponse('Failed to connect to Shieldd node', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
