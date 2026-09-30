import { NextRequest, NextResponse } from 'next/server'
import { audit } from '@/lib/audit-demo/engine'
import { normalizeRequest } from '@/lib/audit-demo/request'
import type { AuditRequest } from '@/lib/audit-demo/types'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  let normalized: AuditRequest
  try {
    const raw = await request.text()
    if (raw.length > 8192) throw new Error('Audit request too large')
    normalized = normalizeRequest(params.action, JSON.parse(raw))
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid audit request',
      },
      { status: 400 }
    )
  }
  try {
    const run = await audit(normalized)
    return NextResponse.json(
      { run },
      {
        status:
          run.status === 'completed'
            ? 200
            : run.status === 'denied'
              ? 403
              : 503,
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Audit history unavailable',
      },
      { status: 503 }
    )
  }
}
