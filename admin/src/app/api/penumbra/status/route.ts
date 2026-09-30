import { NextResponse } from 'next/server'

import { rpc } from '@/lib/rpc/server'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const block = await rpc<{ number: string } | null>('eth_getBlockByNumber', ['finalized', false])
    if (!block) throw new Error('Chain has no finalized block')
    return NextResponse.json({ height: BigInt(block.number).toString() })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Chain unavailable' }, { status: 502 })
  }
}
