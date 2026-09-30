// src/app/api/penumbra/app-params/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { penumbraConfig } from '@/lib/config'
import { embeddedShielddQueryUrl } from '@/lib/native-wallet/penumbra/embedded-shieldd'
import { shielddFetch as fetch } from '@/lib/rpc/shieldd'

export const dynamic = 'force-dynamic'

/**
 * Proxy for Penumbra AppParameters gRPC-web requests.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    const response = await fetch(
      embeddedShielddQueryUrl(penumbraConfig.grpcUrl, 'AppParameters'),
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
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.text()

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/grpc-web-text',
      },
    })
  } catch (error) {
    console.error('[API] AppParameters error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch app parameters' },
      { status: 500 }
    )
  }
}
