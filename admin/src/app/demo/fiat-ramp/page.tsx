'use client'

import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { formatUnits } from 'viem'

import { PageContainer } from '@/components/layout'
import { Button, Card, Input } from '@/components/ui'
import { useBalances, useWallet } from '@/hooks'
import { chainConfig } from '@/lib/config'
import { queryKeys } from '@/lib/cosmos'
import type {
  RampAction,
  RampEvent,
  StageKey,
} from '@/lib/fiat-ramp/stages'
import { stagesFor } from '@/lib/fiat-ramp/stages'
import { formatAmount, truncateAddress } from '@/lib/utils'

type CoreAccount = {
  accountNo: string
  clientName: string
  balance: number
  currency: string
}

type RunState = {
  action: RampAction
  done: Set<StageKey>
  txHash?: string
  transactionId?: string
  requestId?: string
  error?: string
  finished: boolean
}

export default function FiatRampPage() {
  const queryClient = useQueryClient()
  const { hexAddress, bech32Address, isConnected } = useWallet()
  const { data: balances = [] } = useBalances(bech32Address ?? null)

  const [amount, setAmount] = useState('100')
  const [core, setCore] = useState<CoreAccount | null>(null)
  const [coreError, setCoreError] = useState<string | null>(null)
  const [run, setRun] = useState<RunState | null>(null)
  const [log, setLog] = useState<string[]>([])
  const running = run !== null && !run.finished
  const logRef = useRef<HTMLDivElement>(null)

  const loadCore = useCallback(async () => {
    try {
      const res = await fetch('/api/fiat-ramp/state', { cache: 'no-store' })
      const body = await res.json()
      if (!body.ok) throw new Error(body.error)
      setCore(body.account)
      setCoreError(null)
    } catch (error) {
      setCoreError(error instanceof Error ? error.message : 'banking core unreachable')
    }
  }, [])

  useEffect(() => {
    loadCore()
    const timer = setInterval(loadCore, 10_000)
    return () => clearInterval(timer)
  }, [loadCore])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const onChain = balances.find((balance) => balance.denom === chainConfig.denom)
  const onChainAmount = onChain
    ? formatUnits(BigInt(onChain.amount), onChain.decimals)
    : '0'

  const submit = async (action: RampAction) => {
    if (!hexAddress) {
      toast.error('Connect an account first')
      return
    }
    setLog([])
    setRun({ action, done: new Set(), finished: false })

    const response = await fetch(`/api/fiat-ramp/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, address: hexAddress }),
    })

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}))
      const message = body.error ?? `bridge call failed (${response.status})`
      setRun((prev) => (prev ? { ...prev, error: message, finished: true } : prev))
      toast.error(message)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        apply(JSON.parse(line) as RampEvent)
      }
    }
  }

  const apply = (event: RampEvent) => {
    if (event.type === 'log') {
      setLog((prev) => [...prev, event.line])
      return
    }
    if (event.type === 'stage') {
      setRun((prev) =>
        prev
          ? {
              ...prev,
              done: new Set(prev.done).add(event.key),
              txHash: event.txHash ?? prev.txHash,
              transactionId: event.transactionId ?? prev.transactionId,
            }
          : prev
      )
      return
    }
    if (event.type === 'done') {
      setRun((prev) =>
        prev ? { ...prev, requestId: event.requestId, finished: true } : prev
      )
      loadCore()
      if (bech32Address) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.balances.byAddress(bech32Address),
        })
      }
      toast.success('Settled on both ledgers')
      return
    }
    setRun((prev) => (prev ? { ...prev, error: event.message, finished: true } : prev))
    toast.error(event.message)
  }

  return (
    <PageContainer
      title="Fiat On/Off Ramp"
      description="Move a customer's fiat between Apache Fineract and the BankD ledger"
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card header="Banking core (Apache Fineract)">
            {coreError ? (
              <p className="text-sm text-red-600">{coreError}</p>
            ) : core ? (
              <>
                <p className="text-sm text-gray-500">
                  {core.clientName} &middot; savings {core.accountNo}
                </p>
                <p className="mt-2 font-mono text-3xl text-gray-900">
                  {formatAmount(String(core.balance))}{' '}
                  <span className="text-lg text-gray-500">{core.currency}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Reading the banking core...</p>
            )}
          </Card>

          <Card header="BankD ledger">
            <p className="font-mono text-sm text-gray-500">
              {hexAddress ? truncateAddress(hexAddress, 10, 8) : 'No account connected'}
            </p>
            <p className="mt-2 font-mono text-3xl text-gray-900">
              {onChainAmount}{' '}
              <span className="text-lg text-gray-500">
                {chainConfig.displayDenom}
              </span>
            </p>
          </Card>
        </div>

        <Card header="Move money">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <Input
                label="Amount"
                value={amount}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                disabled={running}
              />
            </div>
            <Button onClick={() => submit('deposit')} isLoading={running && run?.action === 'deposit'} disabled={running || !isConnected}>
              Deposit to ledger
            </Button>
            <Button
              variant="secondary"
              onClick={() => submit('withdraw')}
              isLoading={running && run?.action === 'withdraw'}
              disabled={running || !isConnected}
            >
              Redeem to fiat
            </Button>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            A deposit debits the customer in the banking core and issues the same
            amount on the ledger. A redemption destroys it on the ledger and
            credits the fiat back.
          </p>
        </Card>

        {run && (
          <Card header="Where the money is">
            <StageRail run={run} />
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <Detail label="Request id" value={run.requestId} />
              <Detail label="Core transaction" value={run.transactionId} />
              <Detail label="Ledger transaction" value={run.txHash} />
            </dl>
            {run.error && (
              <p className="mt-4 text-sm text-red-600">{run.error}</p>
            )}
            {log.length > 0 && (
              <div
                ref={logRef}
                className="mt-4 max-h-48 overflow-y-auto rounded-lg bg-gray-900 p-4 font-mono text-xs text-gray-200"
              >
                {log.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </PageContainer>
  )
}

function StageRail({ run }: { run: RunState }) {
  const stages = stagesFor(run.action)
  const reached = stages.filter((stage) => run.done.has(stage.key)).length
  const percent = stages.length > 1 ? ((reached - 1) / (stages.length - 1)) * 100 : 0

  return (
    <div>
      <div className="relative mb-6 h-1 rounded-full bg-gray-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary-600 transition-all duration-500"
          style={{ width: `${Math.max(0, percent)}%` }}
        />
      </div>
      <ol className="grid gap-4 sm:grid-cols-4">
        {stages.map((stage) => {
          const done = run.done.has(stage.key)
          return (
            <li key={stage.key} className="flex gap-3">
              <span
                className={clsx(
                  'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
                  done
                    ? 'border-primary-600 bg-primary-600'
                    : 'border-gray-300 bg-white'
                )}
              />
              <span>
                <span
                  className={clsx(
                    'block text-sm font-medium',
                    done ? 'text-gray-900' : 'text-gray-400'
                  )}
                >
                  {stage.label}
                </span>
                <span className="block text-xs text-gray-500">{stage.detail}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="truncate font-mono text-gray-900">{value ?? '-'}</dd>
    </div>
  )
}
