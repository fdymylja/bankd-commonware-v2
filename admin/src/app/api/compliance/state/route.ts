import { NextResponse } from 'next/server'

import { readComplianceState } from '@/lib/compliance/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sanctions, freezes, the pause flag and the audit log, read live off the chain. */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await readComplianceState()) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'chain unreachable'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
