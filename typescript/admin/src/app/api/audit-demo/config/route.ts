import { NextResponse } from 'next/server'
import { readState } from '@/lib/audit-demo/store'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  if (!process.env.AUDIT_DEMO_STATE) return new Response(null, { status: 204 })
  try {
    return NextResponse.json((await readState()).delivery)
  } catch {
    return NextResponse.json(
      { error: 'Orbis demo is not configured' },
      { status: 503 }
    )
  }
}
