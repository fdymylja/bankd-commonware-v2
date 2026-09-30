import { NextResponse } from 'next/server'

import { penumbraConfig } from '@/lib/config'

/**
 * Proxy endpoint for Penumbra RPC status.
 * Workers can't directly fetch from localhost due to CORS.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const response = await fetch(`${penumbraConfig.rpcUrl}/status`, {
      cache: 'no-store',
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] Failed to fetch Shieldd status:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Shieldd node' },
      { status: 502 }
    )
  }
}
