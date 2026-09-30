import { NextRequest, NextResponse } from 'next/server'

import { penumbraConfig } from '@/lib/config'
import { embeddedShielddQueryUrl } from '@/lib/native-wallet/penumbra/embedded-shieldd'

export const dynamic = 'force-dynamic'

/** Proxy the current Shieldd nullifier-generation planning window. */
export async function POST(request: NextRequest) {
  try {
    const response = await fetch(
      embeddedShielddQueryUrl(penumbraConfig.grpcUrl, 'NullifierWindow'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text',
          Accept: 'application/grpc-web-text',
        },
        body: await request.text(),
      }
    )
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      )
    }
    return new NextResponse(await response.text(), {
      status: 200,
      headers: { 'Content-Type': 'application/grpc-web-text' },
    })
  } catch (error) {
    console.error('[API] NullifierWindow error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nullifier window' },
      { status: 500 }
    )
  }
}
