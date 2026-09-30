import { NextResponse } from 'next/server'

import { coreConfig, readCoreAccount } from '@/lib/fiat-ramp/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The customer's fiat balance, read live from the banking core. */
export async function GET() {
  const cfg = coreConfig()
  try {
    const account = await readCoreAccount(cfg)
    return NextResponse.json({ ok: true, account, decimals: cfg.decimals })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'banking core unreachable'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
