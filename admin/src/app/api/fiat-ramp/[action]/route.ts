import { spawn } from 'node:child_process'

import { NextRequest, NextResponse } from 'next/server'

import { bridgeCommand, coreConfig, toMinorUnits } from '@/lib/fiat-ramp/server'
import type { RampAction, RampEvent } from '@/lib/fiat-ramp/stages'
import { stageFromLog } from '@/lib/fiat-ramp/stages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS: RampAction[] = ['deposit', 'withdraw']

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  const action = params.action as RampAction
  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { ok: false, error: `Unknown fiat ramp action: ${params.action}` },
      { status: 404 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    amount?: string
    address?: string
    requestId?: string
  }
  const cfg = coreConfig()
  const address = (body.address ?? '').trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json(
      { ok: false, error: `not a valid customer address: ${address}` },
      { status: 400 }
    )
  }

  let minor: bigint
  try {
    minor = toMinorUnits(body.amount ?? '', cfg.decimals)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid amount'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  if (minor <= 0n) {
    return NextResponse.json(
      { ok: false, error: 'amount must be greater than zero' },
      { status: 400 }
    )
  }

  // The request id is the idempotency key for the fiat leg. Re-sending the same
  // one is how a failed run is retried without moving money twice.
  const requestId = body.requestId?.trim() || `${action}-${Date.now()}`
  const { cmd, args, cwd } = bridgeCommand([
    action,
    action === 'deposit' ? '--to' : '--from',
    address,
    '--amount',
    minor.toString(),
    '--currency',
    cfg.currency,
    '--decimals',
    String(cfg.decimals),
    '--chain-decimals',
    String(cfg.chainDecimals),
    '--request-id',
    requestId,
  ])

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (event: RampEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))

      send({ type: 'stage', key: 'requested', at: new Date().toISOString() })

      const child = spawn(cmd, args, { cwd, env: process.env })
      let pending = ''
      let lastError = ''

      const consume = (chunk: Buffer) => {
        pending += chunk.toString('utf8')
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          send({ type: 'log', line })
          if (line.includes('level=ERROR') || line.startsWith('error:')) {
            lastError = line
          }
          const stage = stageFromLog(line)
          if (stage) {
            send({ type: 'stage', at: new Date().toISOString(), ...stage })
          }
        }
      }

      child.stderr.on('data', consume)
      child.stdout.on('data', consume)
      child.on('error', (error) => {
        send({ type: 'error', message: error.message })
        controller.close()
      })
      child.on('close', (code) => {
        if (pending.trim()) send({ type: 'log', line: pending })
        if (code === 0) {
          send({ type: 'done', requestId })
        } else {
          send({
            type: 'error',
            message: lastError || `bridge exited with code ${code}`,
          })
        }
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
