import { NextRequest, NextResponse } from 'next/server'

import { penumbraConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

/**
 * Proxy endpoint for Penumbra compact blocks via gRPC-web.
 * Workers can't directly fetch from localhost due to CORS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    
    const response = await fetch(
      `${penumbraConfig.grpcUrl}/shieldd.core.component.compact_block.v1.QueryService/CompactBlock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text',
          'Accept': 'application/grpc-web-text',
        },
        body,
      }
    )

    if (!response.ok) {
      return new NextResponse(
        `Upstream error: ${response.status}`,
        { status: response.status }
      )
    }

    const data = await response.text()
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/grpc-web-text',
      },
    })
  } catch (error) {
    console.error('[API] Failed to fetch compact block:', error)
    return new NextResponse('Failed to connect to Shieldd node', { 
      status: 502,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}
