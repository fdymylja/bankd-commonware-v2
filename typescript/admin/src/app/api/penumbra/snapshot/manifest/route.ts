import { NextResponse } from 'next/server'

import { checkAndGenerate, isSnapshotGenerating } from '@/lib/snapshot/generator'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const manifest = await checkAndGenerate()

    return NextResponse.json(manifest, {
      headers: {
        'Cache-Control': 'no-cache',
        ...(isSnapshotGenerating() ? { 'X-Snapshot-Generating': 'true' } : {}),
      },
    })
  } catch (error) {
    console.error('[Snapshot] Failed to serve manifest:', error)
    return NextResponse.json(
      { error: 'Failed to generate snapshot manifest' },
      { status: 500 }
    )
  }
}
