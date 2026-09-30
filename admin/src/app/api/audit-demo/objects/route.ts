import { NextRequest, NextResponse } from 'next/server'
import { attach } from '@/lib/audit-demo/engine'
import { candidates, transactionRows } from '@/lib/audit-demo/index'
import { readState } from '@/lib/audit-demo/store'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const [state, rows] = await Promise.all([readState(), candidates()])
    return NextResponse.json({
      transactions: transactionRows(rows, state.packages),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Audit data unavailable',
      },
      { status: 503 }
    )
  }
}
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    if (raw.length > 2 * 1024 * 1024)
      throw new Error('Package upload too large')
    const result = await attach(JSON.parse(raw))
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Package attachment failed',
      },
      { status: 503 }
    )
  }
}
