'use client'

// Account transaction history page (issue #306).
//
// One page, one merged list: EVM, cosmos, and private rows together, newest
// height first. Private rows carry a purple tag; public rows show nothing extra
// and reveal their chain (EVM or Cosmos) in the detail modal. Each source is
// still one API fetch per page view, and per-row private decrypt only happens
// when the user asks for it from the modal.

import { useRouter, useSearchParams } from 'next/navigation'
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'


import { PageContainer } from '@/components/layout'
import { UnlockModal } from '@/components/native-wallet'
import { Button, Card, CopyButton, Modal, Spinner } from '@/components/ui'
import { useWallet } from '@/hooks/useWallet'
import { chainConfig } from '@/lib/config'
import { useMultisig } from '@/lib/multisig'
import { useNativeWallet } from '@/lib/native-wallet'
import { bech32ToHex, getErrorMessage, hexToBech32, truncateAddress } from '@/lib/utils'

import { decryptTx } from './private-history'

const REFRESH_SECONDS = 6

type Kind = 'evm' | 'cosmos' | 'private'

// sanitizePage mirrors the API route's parsePage: a positive safe integer or 1.
// Fractional / out-of-range ?page= values would otherwise show one page while the
// route fetched another.
function sanitizePage(v: string | null): number {
  const n = Number(v)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

type Row = {
  kind: Kind
  hash?: string
  from?: string
  to?: string
  status?: boolean
  code?: number | null
  height: number
  tx_index?: number
  tx_bytes?: string
  msg_types?: string
  timestamp?: string | number | null
}

// Identity being viewed. `source` decides whether private rows can load: only
// the personal wallet holds an FVK, so multisig / arbitrary-address views can't
// decrypt private history.
type Identity = {
  hex?: string
  bech32?: string
  label: string
  source: 'personal' | 'multisig' | 'param'
  error?: string
}

function bothForms(addr: string): { hex?: string; bech32?: string } {
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    const hex = addr.toLowerCase()
    return { hex, bech32: hexToBech32(hex) || undefined }
  }
  if (/^wallet1/.test(addr)) {
    const hex = bech32ToHex(addr).toLowerCase()
    return { hex: hex || undefined, bech32: addr }
  }
  return {}
}

// Heights are read off the screen, so they get separators. Long bare digit runs
// are the thing nobody can check at a glance.
function formatHeight(height: Row['height']): string {
  if (height === null || height === undefined) return '-'
  const n = Number(height)
  return Number.isFinite(n) ? n.toLocaleString() : String(height)
}

function formatTime(ts: Row['timestamp']): string {
  if (ts === null || ts === undefined || ts === '') return '-'
  const asNum = typeof ts === 'number' ? ts : Number(ts)
  const date = Number.isFinite(asNum)
    ? new Date(asNum > 1e12 ? asNum : asNum * 1000)
    : new Date(String(ts))
  return Number.isNaN(date.getTime()) ? String(ts) : date.toLocaleTimeString()
}

function StatusBadge({ label, tone }: { label: string; tone: 'green' | 'red' | 'gray' | 'purple' }) {
  const cls = {
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-gray-100 text-gray-600',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
  }[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

function successBadge(ok: boolean) {
  return ok ? <StatusBadge label="Success" tone="green" /> : <StatusBadge label="Failed" tone="red" />
}

function rowStatus(row: Row) {
  if (row.kind === 'evm') return successBadge(Boolean(row.status))
  if (row.code === null || row.code === undefined) return <StatusBadge label="Unknown" tone="gray" />
  return successBadge(row.code === 0)
}

function HashCell({ hash }: { hash?: string }) {
  if (!hash) return <span className="text-gray-400">-</span>
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[13px] text-gray-700">
      {truncateAddress(hash)}
      {/* copy must not bubble into the row's open-modal click */}
      <span onClick={(e) => e.stopPropagation()}>
        <CopyButton value={hash} />
      </span>
    </span>
  )
}

// JsonBlock colorizes an already pretty-printed JSON string (keys, strings,
// numbers, literals). Anything that isn't valid JSON (e.g. base64 ciphertext)
// renders as plain text.
function JsonBlock({ text }: { text: string }) {
  const nodes = useMemo(() => {
    try {
      JSON.parse(text)
    } catch {
      return null
    }
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g
    const out: ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index))
      const cls = m[2]
        ? 'text-sky-700'
        : m[1]
          ? 'text-emerald-700'
          : /^[tfn]/.test(m[0])
            ? 'text-rose-600'
            : 'text-amber-600'
      out.push(
        <span key={i++} className={cls}>
          {m[2] ? m[1] : m[0]}
        </span>
      )
      if (m[2]) out.push(m[2])
      last = re.lastIndex
    }
    out.push(text.slice(last))
    return out
  }, [text])
  return (
    <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-3 text-xs">
      {nodes ?? text}
    </pre>
  )
}

async function fetchRows(url: string, kind: Kind): Promise<{ rows: Row[]; hasMore: boolean }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load')
  const body = await res.json()
  return { rows: (body.rows ?? []).map((r: Omit<Row, 'kind'>) => ({ ...r, kind })), hasMore: Boolean(body.hasMore) }
}

function AccountView() {
  const router = useRouter()
  const params = useSearchParams()
  const { hexAddress } = useWallet()
  const { activeWallet, activeMultisig } = useMultisig()
  const wallet = useNativeWallet()

  // Sanitize exactly like the API route (positive safe int, else 1) so the page we
  // display can never disagree with the page the route actually fetched.
  const page = sanitizePage(params.get('page'))
  const addressParam = params.get('address') ?? ''

  // Identity resolution: ?address= override -> active multisig -> personal.
  const identity: Identity = useMemo(() => {
    if (addressParam) {
      const forms = bothForms(addressParam)
      return { ...forms, label: addressParam, source: 'param' }
    }
    if (activeWallet !== 'personal') {
      if (activeMultisig?.type === 'safe') {
        const addr = activeMultisig.safeAddress
        if (!addr) return { label: 'Multisig', source: 'multisig', error: 'Safe address missing' }
        return { ...bothForms(addr), label: activeMultisig.label, source: 'multisig' }
      }
      const addr = activeMultisig?.cosmosAddress
      if (!addr) return { label: 'Multisig', source: 'multisig', error: 'Multisig address missing' }
      return { ...bothForms(addr), label: activeMultisig?.label ?? 'Multisig', source: 'multisig' }
    }
    if (!hexAddress) return { label: 'No wallet', source: 'personal', error: 'Connect or unlock a wallet' }
    return { ...bothForms(hexAddress), label: 'Personal', source: 'personal' }
  }, [addressParam, activeWallet, activeMultisig, hexAddress])

  const [rows, setRows] = useState<Row[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Row | null>(null)
  const [deltas, setDeltas] = useState<Record<string, { amount: bigint; decimals: number }>>({})
  const [refreshTick, setRefreshTick] = useState(0)
  const [countdown, setCountdown] = useState(REFRESH_SECONDS)
  const lastHeightRef = useRef<number | null>(null)
  const haveRowsRef = useRef(false)

  // Auto-refresh: count down every second; at zero, check the node and refetch
  // only when a new block has actually landed, so the refresh rate is
  // block-gated with a REFRESH_SECONDS floor.
  useEffect(() => {
    let remaining = REFRESH_SECONDS
    const id = setInterval(async () => {
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
        return
      }
      remaining = REFRESH_SECONDS
      setCountdown(REFRESH_SECONDS)
      try {
        const res = await fetch(`${chainConfig.rpc}/status`, { cache: 'no-store' })
        const body = await res.json()
        const h = Number(body?.result?.sync_info?.latest_block_height)
        if (Number.isFinite(h) && h !== lastHeightRef.current) {
          lastHeightRef.current = h
          setRefreshTick((t) => t + 1)
        }
      } catch {
        // node hiccup; try again next tick
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const [showUnlock, setShowUnlock] = useState(false)

  const setPage = useCallback(
    (next: number) => {
      const sp = new URLSearchParams(params.toString())
      sp.set('page', String(next))
      router.replace(`/account?${sp.toString()}`)
    },
    [params, router]
  )

  // Fetch one page from every source in parallel and merge, newest height first.
  useEffect(() => {
    let cancelled = false
    setError(null)

    async function load() {
      const jobs: Promise<{ rows: Row[]; hasMore: boolean }>[] = []
      if (identity.hex) {
        jobs.push(fetchRows(`/api/account/txs?tab=evm&page=${page}&address=${encodeURIComponent(identity.hex)}`, 'evm'))
      }
      if (identity.bech32) {
        jobs.push(
          fetchRows(`/api/account/txs?tab=cosmos&page=${page}&address=${encodeURIComponent(identity.bech32)}`, 'cosmos')
        )
      }
      // HACK(penumbra-migration): no FVK note scan until the fork-native wallet
      // lands, so private rows are the chain-wide indexer list, not per-wallet.
      jobs.push(fetchRows(`/api/account/txs?tab=private&page=${page}`, 'private'))
      if (jobs.length === 0) {
        setRows([])
        setHasMore(false)
        setError(identity.error ?? 'No address for this identity')
        return
      }
      // Background block-driven refreshes stay silent; the spinner is only for
      // the first load, when there is nothing on screen yet.
      if (!haveRowsRef.current) setLoading(true)
      const results = await Promise.all(jobs)
      if (cancelled) return
      const merged = results
        .flatMap((r) => r.rows)
        .sort((a, b) => b.height - a.height || (a.tx_index ?? 0) - (b.tx_index ?? 0))
      haveRowsRef.current = merged.length > 0
      setRows(merged)
      setHasMore(results.some((r) => r.hasMore))
    }

    load()
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, identity, refreshTick])

  // Change column: per-row native balance delta at each row's height, fetched
  // from the node once the page of rows lands. Private rows stay blank.
  useEffect(() => {
    setDeltas({})
    if (rows.length === 0) return
    let cancelled = false
    ;(async () => {
      const out: Record<string, { amount: bigint; decimals: number }> = {}
      await Promise.all(
        rows.map(async (row, i) => {
          const d = await nativeDelta(row, identity.hex, identity.bech32).catch(() => null)
          if (d) out[rowKey(row, i)] = d
        })
      )
      if (!cancelled) setDeltas(out)
    })()
    return () => {
      cancelled = true
    }
  }, [rows, identity.hex, identity.bech32])

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div>
            <div className="text-sm text-gray-500">Viewing</div>
            <div className="mt-1 font-mono text-sm text-gray-900">
              {identity.label}
              {identity.bech32 ? ` · ${truncateAddress(identity.bech32)}` : ''}
            </div>
            {identity.error && (
              <div className="mt-1">
                <StatusBadge label={identity.error} tone="red" />
              </div>
            )}
          </div>
          <HeaderStats hex={identity.hex} bech32={identity.bech32} />
        </div>
      </Card>

      <Card noPadding>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No transactions found.</div>
        ) : (
          <TxTable rows={rows} identityHex={identity.hex} deltas={deltas} countdown={countdown} onSelect={setDetail} />
        )}
      </Card>

      {/* HACK(penumbra-migration): see the private fetch above. */}
      <div className="text-xs text-gray-500">
        Private rows show all on-chain private activity; per-wallet filtering and decrypt need the fork-native wallet
        migration.
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <span className="text-sm text-gray-500">Page {page}</span>
        <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>

      {detail && (
        <TxDetailModal
          row={detail}
          identityHex={identity.hex}
          identityBech32={identity.bech32}
          onUnlockNeeded={() => setShowUnlock(true)}
          onClose={() => setDetail(null)}
        />
      )}

      <UnlockModal
        isOpen={showUnlock}
        onClose={() => setShowUnlock(false)}
        onUnlock={async (password) => {
          await wallet.unlock(password)
        }}
        onUnlockWithPasskey={wallet.hasPasskey ? async () => wallet.unlockWithPasskey() : undefined}
        hasPasskey={wallet.hasPasskey}
      />
    </div>
  )
}

// HeaderStats: live chain + account summary inline in the top card. Polls the
// node every 5s; values persist through a failed poll so a hiccup doesn't blank
// the UI.
function HeaderStats({ hex, bech32 }: { hex?: string; bech32?: string }) {
  const [height, setHeight] = useState<number | null>(null)
  const [balance, setBalance] = useState<bigint | null>(null)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch(`${chainConfig.rpc}/status`, { cache: 'no-store' })
        const body = await res.json()
        const h = Number(body?.result?.sync_info?.latest_block_height)
        if (!cancelled && Number.isFinite(h)) setHeight(h)
      } catch {
        // node unreachable; keep the last known height
      }
      if (!hex) return
      try {
        const res = await fetch(chainConfig.evmRpc, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [hex, 'latest'] }),
        })
        const body = await res.json()
        if (!cancelled && body.result) setBalance(BigInt(body.result))
      } catch {
        // keep last known balance
      }
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [hex])

  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div>
        <div className="text-sm text-gray-500">Current block</div>
        <div className="mt-1 font-mono text-lg leading-6 text-gray-900">{height ?? '-'}</div>
        <div className="mt-1 text-xs text-gray-400">
          {chainConfig.prettyName} · chain {chainConfig.chainId}
        </div>
      </div>
      <div>
        <div className="text-sm text-gray-500">Balance</div>
        <div className="mt-1 font-mono text-lg leading-6 text-gray-900">
          {/* EVM reports the 6-decimal ubrl base scaled to wei-style 18 decimals */}
          {balance !== null
            ? (Number(balance) / 1e18).toLocaleString('pt-BR', { maximumFractionDigits: 6 })
            : '-'}
          <span className="ml-1 text-sm text-gray-500">{chainConfig.displayDenom}</span>
        </div>
        {(bech32 || hex) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            {bech32 && (
              <span className="inline-flex items-center gap-1 font-mono">
                {truncateAddress(bech32)}
                <CopyButton value={bech32} />
              </span>
            )}
            {hex && (
              <span className="inline-flex items-center gap-1 font-mono">
                {truncateAddress(hex)}
                <CopyButton value={hex} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// rowDirection: EVM rows know their sender; cosmos rows fall back to the sign of
// the native-token delta; private rows stay unknown until decrypted.
function rowDirection(row: Row, identityHex?: string, delta?: { amount: bigint }): 'in' | 'out' | null {
  if (row.kind === 'evm' && identityHex) {
    return row.from?.toLowerCase() === identityHex ? 'out' : 'in'
  }
  if (delta && delta.amount !== BigInt(0)) return delta.amount > BigInt(0) ? 'in' : 'out'
  return null
}

// Banking-app style direction cue: a soft round icon, incoming money arrives
// (green, down-left), outgoing money leaves (gray, up-right). Failed or
// no-movement rows get a "-" in the same circle so the column stays even.
function DirectionIcon({ dir, sealed = false }: { dir: 'in' | 'out' | null; sealed?: boolean }) {
  const isIn = dir === 'in'
  // A private row has a direction, we just cannot read it, which is the point of
  // the row. A padlock says that; a dash reads as "nothing happened here".
  const label = sealed ? 'Encrypted' : dir === null ? 'No movement' : isIn ? 'Incoming' : 'Outgoing'
  return (
    <span
      title={label}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        sealed ? 'bg-purple-100 text-purple-700' : isIn ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
      }`}
    >
      <span aria-hidden>{sealed ? '\u{1F512}' : dir === null ? '-' : isIn ? '\u2199' : '\u2197'}</span>
    </span>
  )
}

function rowFailed(row: Row): boolean {
  if (row.kind === 'evm') return !row.status
  return row.code !== null && row.code !== undefined && row.code !== 0
}

// Friendly names for the common msg types; anything unknown falls back to the
// type URL's last segment ("...v1.MsgFreeze" -> "Freeze").
const MSG_LABELS: Record<string, string> = {
  '/cosmos.bank.v1beta1.MsgSend': 'Bank send',
  '/cosmos.bank.v1beta1.MsgMultiSend': 'Bank multi-send',
  '/mizufinance.shieldd.v1.MsgDeposit': 'Shield deposit',
  '/ibc.applications.transfer.v1.MsgTransfer': 'IBC transfer',
}

function msgLabel(typeUrl: string): string {
  return MSG_LABELS[typeUrl] ?? typeUrl.split('.').pop()?.replace(/^Msg/, '') ?? typeUrl
}

// infoCell: what happened, in words - the action plus the counterparty when we
// know it. The full type URLs and addresses stay available in the detail modal.
function infoCell(row: Row, dir: 'in' | 'out' | null): ReactNode {
  if (row.kind === 'evm') {
    // Names the action, the way the cosmos rows do, rather than reading out a
    // truncated hex address. The counterparty is in the modal either way, and
    // one word per row is what makes the table scannable next to Bank send.
    return <span>{dir === 'in' ? 'EVM receive' : 'EVM send'}</span>
  }
  if (row.kind === 'cosmos') {
    const labels = (row.msg_types ?? '').split(/[\s,]+/).filter(Boolean).map(msgLabel)
    return <span>{labels.join(', ') || '-'}</span>
  }
  return <span className="text-gray-500">Encrypted transfer</span>
}

function TxTable({
  rows,
  identityHex,
  deltas,
  countdown,
  onSelect,
}: {
  rows: Row[]
  identityHex?: string
  deltas: Record<string, { amount: bigint; decimals: number }>
  countdown: number
  onSelect: (row: Row) => void
}) {
  // Mintscan-style layout: every column hugs its content (w-px + nowrap) and the
  // trailing empty cell soaks up the remaining card width, so the data stays in
  // one compact left-aligned cluster.
  const hug = 'w-px whitespace-nowrap px-4 py-4'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <tr>
            <th className={hug}>Hash</th>
            <th className={hug}>Info</th>
            <th className={`${hug} text-right`}>Change (BRL)</th>
            <th className={`${hug} text-right`}>Height</th>
            <th className={hug}>Time</th>
            <th className={hug}>Status</th>
            <th className="px-4 py-4 text-right font-normal normal-case tracking-normal text-gray-400">
              refreshing in {countdown}s
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="cursor-pointer hover:bg-gray-50" onClick={() => onSelect(row)}>
              <td className={hug}>
                <HashCell hash={row.hash} />
              </td>
              <td className={hug}>
                <span className="inline-flex items-center gap-2">
                  <DirectionIcon
                    dir={rowFailed(row) ? null : rowDirection(row, identityHex, deltas[rowKey(row, i)])}
                    sealed={row.kind === 'private'}
                  />
                  {infoCell(row, rowDirection(row, identityHex, deltas[rowKey(row, i)]))}
                </span>
              </td>
              <td className={`${hug} text-right tabular-nums`}>
                <ChangeCell delta={deltas[rowKey(row, i)]} />
              </td>
              <td className={`${hug} text-right font-mono tabular-nums text-gray-900`}>
                {formatHeight(row.height)}
              </td>
              <td className={`${hug} font-mono text-[13px] text-gray-500`}>{formatTime(row.timestamp)}</td>
              <td className={hug}>
                <span className="inline-flex items-center gap-1.5">
                  {rowStatus(row)}
                  {row.kind === 'private' && <StatusBadge label="Private" tone="purple" />}
                </span>
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const KIND_LABEL: Record<Kind, string> = { evm: 'EVM', cosmos: 'Cosmos', private: 'Private' }

function fmtNative(amount: bigint, decimals: number, signed = false): string {
  const value = Number(amount) / 10 ** decimals
  const text = value.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
  return `${signed && value > 0 ? '+' : ''}${text} ${chainConfig.displayDenom}`
}

type BalancePair = { before: bigint; after: bigint }

// TODO(nice-to-have): index the native-token balance per account per height (in
// the feeder or shinzo) so these diffs come from the indexer instead of live node
// queries - the EVM path only works while the node keeps full historical state
// (--pruning=nothing).
async function evmBalancesAt(height: number, hex: string): Promise<BalancePair> {
  const at = async (h: number) => {
    const res = await fetch(chainConfig.evmRpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [hex, `0x${h.toString(16)}`],
      }),
    })
    const body = await res.json()
    if (body.error) throw new Error(body.error.message ?? 'RPC error')
    return BigInt(body.result)
  }
  const [before, after] = await Promise.all([at(height - 1), at(height)])
  return { before, after }
}

// parseNativeCoins sums the native-denom portion of a coins string like
// "40000ubrl" or "1uatom,40000ubrl".
function parseNativeCoins(coins: string): bigint {
  let total = BigInt(0)
  for (const part of coins.split(',')) {
    const m = part.trim().match(/^(\d+)(.+)$/)
    if (m && m[2] === chainConfig.denom) total += BigInt(m[1])
  }
  return total
}

// cosmosEventDelta reads the address's native-token movement straight out of the
// tx's coin_spent / coin_received events, so it needs no historical state.
async function cosmosEventDelta(hash: string, bech32: string): Promise<bigint> {
  const res = await fetch(`${chainConfig.rpc}/tx?hash=0x${hash}`)
  const body = await res.json()
  if (body.error) throw new Error(body.error.data ?? 'tx query failed')
  const events = (body.result?.tx_result?.events ?? []) as Array<{
    type: string
    attributes?: Array<{ key: string; value: string }>
  }>
  let delta = BigInt(0)
  for (const ev of events) {
    if (ev.type !== 'coin_spent' && ev.type !== 'coin_received') continue
    const attrs = new Map((ev.attributes ?? []).map((a) => [a.key, a.value]))
    const addr = ev.type === 'coin_spent' ? attrs.get('spender') : attrs.get('receiver')
    if (addr !== bech32) continue
    const amount = parseNativeCoins(attrs.get('amount') ?? '')
    delta += ev.type === 'coin_spent' ? -amount : amount
  }
  return delta
}

async function nativeDelta(row: Row, hex?: string, bech32?: string): Promise<{ amount: bigint; decimals: number } | null> {
  if (row.kind === 'evm' && hex && row.height >= 2) {
    const b = await evmBalancesAt(row.height, hex)
    // EVM balances are wei-style 18-decimals regardless of the 6-decimal ubrl base.
    return { amount: b.after - b.before, decimals: 18 }
  }
  if (row.kind === 'cosmos' && bech32 && row.hash) {
    return { amount: await cosmosEventDelta(row.hash, bech32), decimals: chainConfig.decimals }
  }
  // Private balances are only visible through the FVK, not per-height on chain.
  return null
}

async function nativeBalanceDiff(row: Row, hex?: string, bech32?: string): Promise<[string, string][] | null> {
  if (row.kind === 'evm' && hex && row.height >= 2) {
    const b = await evmBalancesAt(row.height, hex)
    return [
      ['Balance before', fmtNative(b.before, 18)],
      ['Balance after', fmtNative(b.after, 18)],
      ['Change', fmtNative(b.after - b.before, 18, true)],
    ]
  }
  const d = await nativeDelta(row, hex, bech32)
  return d ? [['Change', fmtNative(d.amount, d.decimals, true)]] : null
}

function rowKey(row: Row, i = 0): string {
  return `${row.kind}-${row.hash ?? `${row.height}-${row.tx_index ?? i}`}`
}

// ChangeCell renders the bare signed number; the column header names the denom.
function ChangeCell({ delta }: { delta?: { amount: bigint; decimals: number } }) {
  if (!delta || delta.amount === BigInt(0)) return <span className="text-gray-400">-</span>
  const value = Number(delta.amount) / 10 ** delta.decimals
  const gained = delta.amount > BigInt(0)
  return (
    <span className={`font-mono text-[13px] font-medium tabular-nums ${gained ? 'text-green-600' : 'text-red-600'}`}>
      {`${gained ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}`}
    </span>
  )
}

// TxDetailModal shows one transaction in depth: the indexed row fields up top,
// then the node's own record fetched when the modal opens - tx + receipt over
// EVM JSON-RPC, tx_result over CometBFT RPC. Private rows have nothing readable
// on chain, so they show the stored ciphertext and decrypt on demand.
function TxDetailModal({
  row,
  identityHex,
  identityBech32,
  onUnlockNeeded,
  onClose,
}: {
  row: Row
  identityHex?: string
  identityBech32?: string
  onUnlockNeeded: () => void
  onClose: () => void
}) {
  const [fields, setFields] = useState<[string, string][]>([])
  const [balances, setBalances] = useState<[string, string][]>([])
  const [raw, setRaw] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [decrypted, setDecrypted] = useState<string | null>(null)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  const [decrypting, setDecrypting] = useState(false)

  const handleDecrypt = useCallback(async () => {
    if (!row.tx_bytes) return
    setDecrypting(true)
    setDecryptError(null)
    try {
      const txv = await decryptTx(row.tx_bytes)
      setDecrypted(JSON.stringify(txv.toJson(), null, 2))
    } catch (err) {
      const msg = getErrorMessage(err)
      if (/lock/i.test(msg)) {
        onUnlockNeeded()
      } else {
        setDecryptError(msg)
      }
    } finally {
      setDecrypting(false)
    }
  }, [row, onUnlockNeeded])

  // Balance diff loads independently of the node record; if the node can't serve
  // historical state the section just stays absent.
  useEffect(() => {
    let cancelled = false
    nativeBalanceDiff(row, identityHex, identityBech32)
      .then((b) => {
        if (!cancelled && b) setBalances(b)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [row, identityHex, identityBech32])

  useEffect(() => {
    let cancelled = false

    async function evmDetail() {
      const post = async (method: string) => {
        const res = await fetch(chainConfig.evmRpc, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [row.hash] }),
        })
        const body = await res.json()
        if (body.error) throw new Error(body.error.message ?? 'RPC error')
        return body.result as Record<string, string> | null
      }
      const [tx, receipt] = await Promise.all([post('eth_getTransactionByHash'), post('eth_getTransactionReceipt')])
      if (cancelled) return
      const out: [string, string][] = []
      // EVM balances are wei-style 18-decimals regardless of the 6-decimal ubrl base.
      if (tx?.value) out.push(['Value', `${Number(BigInt(tx.value)) / 1e18} ${chainConfig.displayDenom}`])
      if (tx?.nonce) out.push(['Nonce', String(Number(BigInt(tx.nonce)))])
      if (receipt?.gasUsed) out.push(['Gas used', String(Number(BigInt(receipt.gasUsed)))])
      if (receipt?.logs) out.push(['Logs', String((receipt.logs as unknown as unknown[]).length)])
      setFields(out)
      setRaw(JSON.stringify({ transaction: tx, receipt }, null, 2))
    }

    async function cosmosDetail() {
      const res = await fetch(`${chainConfig.rpc}/tx?hash=0x${row.hash}`)
      const body = await res.json()
      if (body.error) throw new Error(body.error.data ?? 'tx query failed')
      if (cancelled) return
      const result = body.result as { tx_result?: { gas_wanted?: string; gas_used?: string; events?: unknown[] } }
      const out: [string, string][] = []
      if (result.tx_result?.gas_used) out.push(['Gas', `${result.tx_result.gas_used} / ${result.tx_result.gas_wanted}`])
      if (result.tx_result?.events) out.push(['Events', String(result.tx_result.events.length)])
      setFields(out)
      setRaw(JSON.stringify(result, null, 2))
    }

    if (row.kind === 'private') {
      setFields([['Ciphertext', `${Math.floor(((row.tx_bytes ?? '').length * 3) / 4)} bytes`]])
      setRaw(row.tx_bytes || null)
      return
    }
    ;(row.kind === 'evm' ? evmDetail() : cosmosDetail()).catch((err) => {
      if (!cancelled) setFetchError(getErrorMessage(err))
    })
    return () => {
      cancelled = true
    }
  }, [row])

  const baseFields: [string, string][] = [
    ['Height', String(row.height || '-')],
    ['Time', formatTime(row.timestamp)],
  ]
  if (row.kind === 'evm') {
    baseFields.push(['From', row.from ?? '-'], ['To', row.to ?? '-'])
  }
  if (row.kind === 'cosmos' && row.msg_types) baseFields.push(['Messages', row.msg_types])
  if (row.kind === 'private') baseFields.push(['Index', String(row.tx_index ?? '-')])

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      title={
        <span className="inline-flex items-center gap-2">
          Transaction
          <StatusBadge label={KIND_LABEL[row.kind]} tone={row.kind === 'private' ? 'purple' : 'gray'} />
          {rowStatus(row)}
        </span>
      }
    >
      <div className="space-y-3 text-sm">
        {row.hash && (
          <div className="flex items-center gap-1 break-all font-mono text-xs text-gray-700">
            {row.hash}
            <CopyButton value={row.hash} />
          </div>
        )}
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          {[...baseFields, ...fields, ...balances].map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-gray-500">{k}</dt>
              <dd className="break-all font-mono text-xs leading-5 text-gray-900">{v}</dd>
            </Fragment>
          ))}
        </dl>
        {row.kind === 'private' && (
          <div className="space-y-2">
            <Button size="sm" variant="secondary" disabled={!row.tx_bytes || decrypting} onClick={handleDecrypt}>
              {decrypting ? 'Decrypting…' : 'Decrypt'}
            </Button>
            {decryptError && <div className="text-xs text-red-600">{decryptError}</div>}
            {decrypted && (
              <div>
                <div className="text-xs font-medium uppercase text-gray-500">Decrypted</div>
                <JsonBlock text={decrypted} />
              </div>
            )}
          </div>
        )}
        {fetchError ? (
          <div className="text-xs text-red-600">Node lookup failed: {fetchError}</div>
        ) : raw ? (
          <JsonBlock text={raw} />
        ) : (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function AccountPage() {
  return (
    <PageContainer title="Account" description="Your public and private transaction history">
      <Suspense fallback={<Spinner />}>
        <AccountView />
      </Suspense>
    </PageContainer>
  )
}
