import { NextRequest, NextResponse } from 'next/server'

import { readIsBlocked } from '@/lib/compliance/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** What the compliance ante would decide about one account. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim() ?? ''
  if (!address) {
    return NextResponse.json({ ok: false, error: 'no address' }, { status: 400 })
  }
  try {
    return NextResponse.json({ ok: true, address, ...(await readIsBlocked(address)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'chain unreachable'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
