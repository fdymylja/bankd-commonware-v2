import fs from 'fs/promises'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

const SNAPSHOTS_DIR = path.join(process.cwd(), 'data', 'snapshots')

/**
 * Serves a snapshot chunk file. Chunk filenames are reused across chain
 * resets (same chainId, new genesis), so they are NOT safe to cache as
 * immutable — a stale cached chunk poisons the wallet's SCT and produces
 * invalid tx anchors. Serve with no-store so the browser always refetches.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ chunk: string }> }
) {
  const { chunk } = await params

  // Validate filename to prevent path traversal
  if (!/^snapshot-\d+\.bin\.gz$/.test(chunk)) {
    return new NextResponse('Invalid chunk filename', { status: 400 })
  }

  const filePath = path.join(SNAPSHOTS_DIR, chunk)

  try {
    const data = await fs.readFile(filePath)

    return new NextResponse(Buffer.from(data), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'gzip',
        // Chunk contents change when the chain is reset (same filename, new
        // genesis), so never serve a cached copy.
        'Cache-Control': 'no-store',
        // // Immutable — chunk files never change once written
        // 'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new NextResponse('Chunk not found', { status: 404 })
    }
    console.error('[Snapshot] Failed to serve chunk:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
