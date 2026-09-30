import { NextResponse } from 'next/server'
import { clearAuditHistory, readState } from '@/lib/audit-demo/store'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const state = await readState()
    return NextResponse.json({
      state: {
        users: state.users.map(({ name, slug }) => ({ name, slug })),
        runs: state.runs,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Audit demo setup is unavailable' },
      { status: 503 }
    )
  }
}

export async function DELETE() {
  try {
    await clearAuditHistory()
    return NextResponse.json({ cleared: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to clear audit history' },
      { status: 503 }
    )
  }
}
