'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { PageContainer } from '@/components/layout'
import { Button, Card, Input, Select } from '@/components/ui'
import { useAuditDemo } from '@/hooks/useAuditDemo'
import type {
  AuditField,
  AuditRun,
  OrbisAuditRow,
} from '@/lib/audit-demo/types'

type EncryptedTransaction = {
  height: number
  blockTimeUnix: number
  bankdTxHash: string
  shielddTxHash: string
  txIndex: number
  actionIndex: number | null
  outputIndex: number | null
  encryptedPayload: string
  auditable: boolean
}

type AuditModeTab = 'restricted' | 'unrestricted'
type DisclosureTier = 'regular' | 'extended'
type ScopeKind = 'time_range' | 'tx_id'

export default function AuditDemoPage() {
  const { state, submittingAction, runAction } = useAuditDemo()
  const users = state?.users ?? []
  const requestRef = useRef<HTMLDivElement>(null)
  const transactionsRef = useRef<HTMLDivElement>(null)
  const [transactions, setTransactions] = useState<EncryptedTransaction[]>([])
  const [auditMode, setAuditMode] = useState<AuditModeTab>('restricted')
  const [user, setUser] = useState('')
  const [tier, setTier] = useState<DisclosureTier>('regular')
  const [unrestrictedFields, setUnrestrictedFields] = useState<AuditField[]>([
    'amount',
  ])
  const [scopeKind, setScopeKind] = useState<ScopeKind>('time_range')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [selectedTxId, setSelectedTxId] = useState('')
  const [clearing, setClearing] = useState(false)
  const [sessionRuns, setSessionRuns] = useState<AuditRun[]>([])
  const [visibleRuns, setVisibleRuns] = useState<AuditRun[]>([])
  const scopeIdentity = JSON.stringify([user, auditMode, scopeKind, startTime, endTime, selectedTxId])
  const currentScopeRef = useRef(scopeIdentity)
  currentScopeRef.current = scopeIdentity

  useEffect(() => {
    if (!user && users.length > 0) {
      setUser(
        users.find((user) => user.slug === 'charlie')?.name ?? users[0].name
      )
    }
  }, [user, users])

  useEffect(() => {
    fetch('/api/audit-demo/objects', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as {
          transactions?: EncryptedTransaction[]
          error?: string
        }
        if (!response.ok) {
          throw new Error(
            payload.error ?? 'Failed to load encrypted transactions'
          )
        }
        return payload
      })
      .then((payload) => {
        const rows = payload.transactions ?? []
        setTransactions(rows)
        const auditable = rows.find((row) => row.auditable)
        if (auditable) setSelectedTxId(auditable.bankdTxHash)
        const range = demoTimestampRange(rows, 'restricted')
        if (range) {
          setStartTime(range.start)
          setEndTime(range.end)
        }
      })
      .catch((error) => toast.error(errorMessage(error)))
  }, [])

  useEffect(() => {
    if (state?.runs) setSessionRuns(state.runs)
  }, [state?.runs])

  const disclosures = useMemo(() => disclosureMap(visibleRuns), [visibleRuns])
  const revealedRows = transactions.filter(
    (row) => disclosures.get(transactionKey(row))?.size
  ).length
  const selectableTransactions = uniqueTransactions(
    transactions.filter((row) => row.auditable)
  )
  const activeScopeKind = auditMode === 'restricted' ? 'time_range' : scopeKind
  const transactionsInScope = useMemo(() => {
    const auditable = transactions.filter((row) => row.auditable)
    if (activeScopeKind === 'tx_id') {
      return auditable.some((row) => row.bankdTxHash === selectedTxId) ? 1 : 0
    }
    const startUnix = toUnix(startTime)
    const endUnix = toUnix(endTime)
    if (!Number.isFinite(startUnix) || !Number.isFinite(endUnix)) return 0
    return auditable.filter(
      (row) => row.blockTimeUnix >= startUnix && row.blockTimeUnix <= endUnix
    ).length
  }, [activeScopeKind, endTime, selectedTxId, startTime, transactions])

  const clearAudit = async () => {
    setClearing(true)
    try {
      const response = await fetch('/api/audit-demo/state', { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to clear audit history')
      setVisibleRuns([])
      setSessionRuns([])
      setTier('regular')
      toast.dismiss()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setClearing(false)
    }
  }

  const requestAudit = async () => {
    const scope =
      activeScopeKind === 'time_range'
        ? {
            kind: 'time_range' as const,
            startUnix: toUnix(startTime),
            endUnix: toUnix(endTime),
          }
        : { kind: 'tx_id' as const, txId: selectedTxId }
    const restricted = auditMode === 'restricted'
    const action = restricted
      ? 'audit-subject'
      : activeScopeKind === 'time_range'
        ? 'investigate-time'
        : 'audit-transaction'

    try {
      const payload = (await runAction(action, {
        ...(restricted
          ? {
              subject: user,
            }
          : {}),
        fields: restricted ? fieldsForTier(tier) : unrestrictedFields,
        scope,
      })) as { run?: AuditRun }
      if (!payload.run) throw new Error('Audit result was not returned')
      setSessionRuns((current) => prependRun(current, payload.run!))
      if (payload.run.status !== 'completed') throw new Error(payload.run.error ?? 'Audit failed')
      if (currentScopeRef.current === scopeIdentity) viewAuditedTransaction(payload.run)
      if (restricted && tier === 'regular') setTier('extended')
      toast.success('Audit completed')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const viewAuditedTransaction = (run: AuditRun) => {
    setVisibleRuns((current) => prependRun(current, run))
    window.requestAnimationFrame(() =>
      transactionsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    )
  }

  const prepareTransactionAudit = (txId: string) => {
    setAuditMode('unrestricted')
    setUnrestrictedFields(['sender', 'receiver'])
    setScopeKind('tx_id')
    setSelectedTxId(txId)
    window.requestAnimationFrame(() =>
      requestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  }

  const selectAuditMode = (mode: AuditModeTab) => {
    setAuditMode(mode)
    setScopeKind('time_range')
    if (mode === 'restricted') {
      setTier('regular')
    } else {
      setUnrestrictedFields(['amount'])
    }
    const range = demoTimestampRange(transactions, mode)
    if (range) {
      setStartTime(range.start)
      setEndTime(range.end)
    }
  }

  const selectUser = (nextUser: string) => {
    setUser(nextUser)
    setTier('regular')
  }

  return (
    <PageContainer
      title="Orbis Legal Audit"
      description="Request authorized access to encrypted private transfers"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Encrypted rows" value={transactions.length} />
          <Metric
            label="Revealed rows"
            value={revealedRows}
            success={revealedRows > 0}
          />
          <Metric label="Audit history" value={sessionRuns.length} />
        </div>

        <div ref={requestRef}>
          <Card header="Legal audit request">
            <div
              className="mb-6 flex gap-6 border-b border-gray-200"
              role="tablist"
              aria-label="Audit mode"
            >
              <AuditTab
                active={auditMode === 'restricted'}
                onClick={() => selectAuditMode('restricted')}
              >
                Restricted
              </AuditTab>
              <AuditTab
                active={auditMode === 'unrestricted'}
                onClick={() => selectAuditMode('unrestricted')}
              >
                Unrestricted
              </AuditTab>
            </div>

            <div
              className={`grid gap-4 ${
                auditMode === 'restricted' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'
              }`}
            >
              {auditMode === 'restricted' ? (
                <>
                  <Select
                    label="User"
                    value={user}
                    onChange={(event) => selectUser(event.target.value)}
                    options={users.map((user) => ({
                      value: user.name,
                      label: user.name,
                    }))}
                    placeholder="Select a user"
                  />
                  <div>
                    <Select
                      label="Audit tier"
                      value={tier}
                      onChange={(event) =>
                        setTier(event.target.value as DisclosureTier)
                      }
                      options={[
                        { value: 'regular', label: 'Regular' },
                        { value: 'extended', label: 'Extended' },
                      ]}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {tier === 'regular'
                        ? 'User and amount'
                        : 'Adds the counterparty'}
                    </p>
                  </div>
                </>
              ) : (
                <fieldset className="lg:col-span-2">
                  <legend className="mb-2 block text-sm font-medium text-gray-700">
                    Access fields
                  </legend>
                  <div className="flex min-h-10 flex-wrap items-center gap-4 rounded-lg border border-gray-300 px-3 py-2">
                    {(['sender', 'receiver', 'amount'] as const).map(
                      (field) => (
                        <label
                          key={field}
                          className="flex cursor-pointer items-center gap-2 text-sm capitalize text-gray-700"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={unrestrictedFields.includes(field)}
                            onChange={(event) =>
                              setUnrestrictedFields((current) =>
                                event.target.checked
                                  ? [...current, field]
                                  : current.filter((item) => item !== field)
                              )
                            }
                          />
                          {field}
                        </label>
                      )
                    )}
                  </div>
                </fieldset>
              )}

              {auditMode === 'unrestricted' && (
                <Select
                  label="Search by"
                  value={scopeKind}
                  onChange={(event) =>
                    setScopeKind(event.target.value as ScopeKind)
                  }
                  options={[
                    { value: 'time_range', label: 'Timestamp range' },
                    { value: 'tx_id', label: 'Transaction ID' },
                  ]}
                />
              )}
            </div>

            {activeScopeKind === 'time_range' ? (
              <div className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="datetime-local"
                    step={1}
                    label="From"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    step={1}
                    label="To"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {transactionsInScope} auditable transaction
                  {transactionsInScope === 1 ? '' : 's'} in this range
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <Select
                  label="Transaction ID"
                  value={selectedTxId}
                  onChange={(event) => setSelectedTxId(event.target.value)}
                  options={selectableTransactions.map((row) => ({
                    value: row.bankdTxHash,
                    label: shortHash(row.bankdTxHash),
                  }))}
                  placeholder="Select a transaction"
                />
              </div>
            )}

            <Button
              className="mt-5"
              onClick={requestAudit}
              isLoading={Boolean(submittingAction)}
              disabled={
                clearing ||
                (auditMode === 'restricted'
                  ? !user
                  : unrestrictedFields.length === 0) ||
                (activeScopeKind === 'time_range'
                  ? !startTime || !endTime
                  : !selectedTxId)
              }
            >
              {submittingAction ? 'Auditing…' : 'Request audit'}
            </Button>
            {submittingAction && (
              <p className="mt-3 text-sm text-gray-600" role="status">
                Auditing {transactionsInScope || 'selected'} encrypted
                transaction
                {transactionsInScope === 1 ? '' : 's'}. Results will appear in
                the table when complete.
              </p>
            )}
          </Card>
        </div>

        <div ref={transactionsRef}>
          <Card header="Encrypted transactions">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600">
                Audited fields are revealed in place. All other values remain
                encrypted.
              </p>
              {(visibleRuns.length > 0 || sessionRuns.length > 0) && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={clearing || Boolean(submittingAction)}
                  onClick={clearAudit}
                >
                  Clear audit results
                </Button>
              )}
            </div>
            {transactions.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                No encrypted Shieldd transactions are indexed yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-3 font-medium">Timestamp</th>
                      <th className="px-3 py-3 font-medium">Transaction</th>
                      <th className="px-3 py-3 font-medium">Sender</th>
                      <th className="px-3 py-3 font-medium">Receiver</th>
                      <th className="px-3 py-3 font-medium">Amount</th>
                      <th className="px-3 py-3 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {transactions.map((row) => {
                      const values = disclosures.get(transactionKey(row))
                      return (
                        <tr key={transactionKey(row)}>
                          <td className="whitespace-nowrap px-3 py-4 text-gray-600">
                            {formatTimestamp(row.blockTimeUnix)}
                          </td>
                          <td className="px-3 py-4">
                            <button
                              type="button"
                              className="font-mono text-xs font-medium text-primary-700 hover:underline disabled:text-gray-500 disabled:no-underline"
                              title={row.bankdTxHash}
                              disabled={!row.auditable}
                              onClick={() =>
                                prepareTransactionAudit(row.bankdTxHash)
                              }
                            >
                              {shortHash(row.bankdTxHash)}
                            </button>
                          </td>
                          <DisclosureCell
                            value={values?.get('sender')}
                            encryptedPayload={row.encryptedPayload}
                          />
                          <DisclosureCell
                            value={values?.get('receiver')}
                            encryptedPayload={row.encryptedPayload}
                          />
                          <DisclosureCell
                            value={values?.get('amount')}
                            encryptedPayload={row.encryptedPayload}
                            amount
                          />
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3 whitespace-nowrap">
                              {values?.size ? (
                                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                  {values.size} field
                                  {values.size === 1 ? '' : 's'} revealed
                                </span>
                              ) : (
                                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                  Encrypted
                                </span>
                              )}
                              {row.auditable &&
                                values?.has('amount') &&
                                (!values.has('sender') ||
                                  !values.has('receiver')) && (
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-primary-700 hover:underline"
                                    onClick={() =>
                                      prepareTransactionAudit(row.bankdTxHash)
                                    }
                                  >
                                    Audit transaction
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card header="Audit history">
          {sessionRuns.length === 0 ? (
            <p className="text-sm text-gray-500">
              No audit has run in this session.
            </p>
          ) : (
            <div className="space-y-3">
              {sessionRuns.slice(0, 10).map((run) => (
                <details
                  key={run.request.requestId}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <summary className="cursor-pointer text-sm font-medium text-gray-900">
                    {labelForRun(run)} · {formatTimestamp(run.completedAt)}
                  </summary>
                  <div className="mt-4 grid gap-3 text-sm text-gray-600 md:grid-cols-2">
                    <HistoryValue label="Scope" value={scopeLabel(run)} />
                    <HistoryValue label="Status" value={statusLabel(run)} />
                    <HistoryValue label="Type" value={typeLabel(run)} />
                  </div>
                  {run.status === 'completed' && run.result && (
                    <Button
                      className="mt-4"
                      size="sm"
                      variant="secondary"
                      onClick={() => viewAuditedTransaction(run)}
                    >
                      View audited transaction
                    </Button>
                  )}
                </details>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  )
}

function AuditTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
        active
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Metric({
  label,
  value,
  success = false,
}: {
  label: string
  value: number
  success?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${
          success ? 'text-green-700' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function DisclosureCell({
  value,
  encryptedPayload,
  amount = false,
}: {
  value?: string
  encryptedPayload: string
  amount?: boolean
}) {
  return (
    <td className="max-w-48 px-3 py-4">
      {value ? (
        <span
          className={amount ? 'font-medium text-gray-900' : 'font-mono text-xs'}
          title={value}
        >
          {amount ? value : displayParty(value)}
        </span>
      ) : (
        <span
          className="font-mono text-xs tracking-widest text-gray-400"
          title={`Encrypted payload: ${encryptedPayload}`}
        >
          ••••••••
        </span>
      )}
    </td>
  )
}

function HistoryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-gray-700">{label}:</span> {value}
    </div>
  )
}

function disclosureMap(runs: AuditRun[]) {
  const disclosed = new Map<string, Map<AuditField, string>>()
  for (const run of [...runs].reverse()) {
    if (run.status !== 'completed') continue
    for (const row of run.result?.objects ?? []) {
      if (row.status !== 'decrypt_succeeded' || !row.field || !row.value) {
        continue
      }
      const key = auditRowKey(row)
      const fields = disclosed.get(key) ?? new Map<AuditField, string>()
      fields.set(
        row.field,
        row.field === 'amount'
          ? row.value
          : (row.alias ?? 'KYC alias unavailable')
      )
      disclosed.set(key, fields)
    }
  }
  return disclosed
}

function auditRowKey(row: OrbisAuditRow) {
  return outputKey(
    row.output_ref.bankd_tx_hash,
    row.output_ref.action_index,
    row.output_ref.output_index
  )
}

function transactionKey(row: EncryptedTransaction) {
  return outputKey(row.bankdTxHash, row.actionIndex, row.outputIndex)
}

function outputKey(
  bankdTxHash: string,
  actionIndex: number | null,
  outputIndex: number | null
) {
  return `${bankdTxHash.toLowerCase()}:${actionIndex ?? 'x'}:${
    outputIndex ?? 'x'
  }`
}

function fieldsForTier(tier: DisclosureTier): AuditField[] {
  return tier === 'regular' ? ['amount'] : ['amount', 'sender', 'receiver']
}

function uniqueTransactions(rows: EncryptedTransaction[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = row.bankdTxHash.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function demoTimestampRange(rows: EncryptedTransaction[], mode: AuditModeTab) {
  const timestamps = uniqueTransactions(rows.filter((row) => row.auditable))
    .map((row) => row.blockTimeUnix)
    .sort((left, right) => left - right)
  const selected =
    mode === 'restricted' ? timestamps.slice(0, 3) : timestamps.slice(-5)
  if (selected.length === 0) return undefined

  const first = selected[0] * 1000
  const last = selected[selected.length - 1] * 1000
  return {
    start: dateTimeInput(first),
    end: dateTimeInput(last),
  }
}

function prependRun(runs: AuditRun[], run: AuditRun) {
  return [
    run,
    ...runs.filter((item) => item.request.requestId !== run.request.requestId),
  ]
}

function labelForRun(run: AuditRun) {
  return run.request.subject
    ? `${run.request.subject} · ${tierLabel(run.request.fields)}`
    : `Unrestricted · ${run.request.fields.join(', ')}`
}

function tierLabel(fields: AuditField[]) {
  return fields.includes('sender') || fields.includes('receiver')
    ? 'Extended audit'
    : 'Regular audit'
}

function statusLabel(run: AuditRun) {
  if (run.status === 'completed') return 'Granted'
  if (run.status === 'denied') return 'Denied'
  return 'Failed'
}

function typeLabel(run: AuditRun) {
  if (!run.request.subject) return 'Unrestricted'
  const tier = tierLabel(run.request.fields).replace(' audit', '').toLowerCase()
  return `Restricted, ${tier}`
}

function scopeLabel(run: AuditRun) {
  const scope = run.request.scope
  if (scope.kind === 'tx_id') return `Transaction ${shortHash(scope.txId)}`
  if (scope.kind === 'time_range') {
    return `${formatTimestamp(scope.startUnix)} – ${formatTimestamp(
      scope.endUnix
    )}`
  }
  return 'All indexed transactions'
}

function displayParty(value: string) {
  return value.startsWith('shieldd') ? shortHash(value) : value
}

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

function formatTimestamp(value: number | string) {
  return (
    typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  ).toLocaleString()
}

function dateTimeInput(timestamp: number) {
  const date = new Date(
    timestamp - new Date(timestamp).getTimezoneOffset() * 60_000
  )
  return date.toISOString().slice(0, 19)
}

function toUnix(value: string) {
  return Math.floor(new Date(value).getTime() / 1000)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Audit request failed'
}
