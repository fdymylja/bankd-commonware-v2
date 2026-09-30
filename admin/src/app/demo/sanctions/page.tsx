'use client'

/**
 * The x/compliance controls, on one page, against the live chain.
 *
 * Built for clip 04 of the demo recordings. Every control here is a real
 * authority-exec message and every number is read back off the chain, so the
 * page is a thin face over the module rather than a mock. `/security` is the
 * PoA validator page and carries none of this.
 *
 * Only the x/authority owner can sign any of it. On the localnet that is acc0
 * in scripts/dev-genesis.json, which is the same wallet the recording profile
 * imports, so the badge at the top reads green during a take.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { PageContainer } from '@/components/layout'
import { Button, Card, Input } from '@/components/ui'
import {
  exec,
  MsgAddSanctioned,
  MsgFreeze,
  MsgRemoveSanctioned,
  MsgSeize,
  MsgSetGlobalPause,
  MsgUnfreeze,
} from '@/lib/compliance/msgs'
import { chainConfig } from '@/lib/config'
import { executeTx } from '@/lib/evm'
import { useActiveAccount } from '@/lib/multisig'

type AuditEntry = {
  id: number
  height: number
  action: string
  addresses: string[]
  amount: { denom: string; amount: string }[]
  reason: string
  ref: string
}

type State = {
  height: number
  paused: boolean
  owner: string
  authorityModule: string
  sanctioned: string[]
  frozen: string[]
  entries: AuditEntry[]
}

const DENOM = 'ubrl'
const UNITS = 1_000_000

// A real OFAC-listed address out of x/compliance/types/default_sanctioned.go.
// Lazarus Group, uid 27307. The quick-fill exists so a take is one click rather
// than forty-two characters typed on camera.
const OFAC = {
  address: '0x08723392ed15743cc38513c4925f5e6be5c17243',
  entity: 'Lazarus Group',
  ref: 'OFAC SDN uid=27307',
}

// acc1 in scripts/dev-genesis.json. Funded, and nothing else in the demo set
// spends from it, so freezing and seizing here does not disturb another clip.
const TARGET = 'wallet1r6yue0vuyj9m7xw78npspt9drq2tmtvg2p8wt0'

const truncate = (a: string) =>
  a.length > 22 ? `${a.slice(0, 12)}...${a.slice(-8)}` : a

const amount = (coins: { denom: string; amount: string }[]) =>
  coins.map((c) => `${(Number(c.amount) / UNITS).toLocaleString('en-US')}`).join(', ')

export default function SanctionsDemoPage() {
  const queryClient = useQueryClient()
  const { cosmosAddress: walletAddress } = useActiveAccount()
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  const cosmosAddress = mounted ? walletAddress : ''

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/compliance/state', { cache: 'no-store' })
      const body = await res.json()
      if (!body.ok) throw new Error(body.error)
      setState(body as State)
    } catch (error) {
      console.warn('[compliance] state read failed', error)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  const isAuthority =
    !!cosmosAddress && !!state?.owner && cosmosAddress === state.owner

  // Every control goes through here: sign, wait, then read the chain back. The
  // refresh is what puts the new number on screen, so it is never optimistic.
  const send = async (label: string, run: () => Promise<unknown>) => {
    setBusy(label)
    try {
      await run()
      await refresh()
    } catch (error) {
      console.error(`[compliance] ${label} failed`, error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageContainer
      title="Compliance"
      description="Sanctions, freezes, seizure and the network pause"
    >
      <StatusStrip
        state={state}
        connected={cosmosAddress ?? ''}
        isAuthority={isAuthority}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SanctionsCard
          state={state}
          busy={busy}
          disabled={!isAuthority}
          onRemove={(values) =>
            send('unsanction', () =>
              executeTx(queryClient, {
                ...exec(cosmosAddress!, MsgRemoveSanctioned, {
                  authority: state!.authorityModule,
                  addresses: [values.address],
                  reason: values.reason,
                  ref: values.ref,
                }),
                successMessage: 'Account removed from the sanctions list',
              })
            )
          }
          onAdd={(values) =>
            send('sanction', () =>
              executeTx(queryClient, {
                ...exec(cosmosAddress!, MsgAddSanctioned, {
                  authority: state!.authorityModule,
                  addresses: [values.address],
                  reason: values.reason,
                  ref: values.ref,
                }),
                successMessage: 'Account added to the sanctions list',
              })
            )
          }
        />
        <CheckCard />
        <FreezeCard
          state={state}
          busy={busy}
          disabled={!isAuthority}
          onFreeze={(v, freeze) =>
            send('freeze', () =>
              executeTx(queryClient, {
                ...exec(cosmosAddress!, freeze ? MsgFreeze : MsgUnfreeze, {
                  authority: state!.authorityModule,
                  address: v.address,
                  reason: v.reason,
                  ref: v.ref,
                }),
                successMessage: freeze ? 'Account frozen' : 'Freeze lifted',
              })
            )
          }
        />
        <SeizeCard
          recovery={cosmosAddress ?? ''}
          busy={busy}
          disabled={!isAuthority}
          onSeize={(v) =>
            send('seize', () =>
              executeTx(queryClient, {
                ...exec(cosmosAddress!, MsgSeize, {
                  authority: state!.authorityModule,
                  from: v.from,
                  to: v.to,
                  amount: [{ denom: DENOM, amount: String(Math.round(Number(v.amount) * UNITS)) }],
                  reason: v.reason,
                  ref: v.ref,
                }),
                successMessage: 'Funds seized',
              })
            )
          }
        />
      </div>

      <PauseCard
        state={state}
        busy={busy}
        disabled={!isAuthority}
        onSet={(paused, reason, ref) =>
          send('pause', () =>
            executeTx(queryClient, {
              ...exec(cosmosAddress!, MsgSetGlobalPause, {
                authority: state!.authorityModule,
                paused,
                reason,
                ref,
              }),
              successMessage: paused ? 'Network paused' : 'Network resumed',
            })
          )
        }
      />

      <AuditCard state={state} />
    </PageContainer>
  )
}

function StatusStrip({
  state,
  connected,
  isAuthority,
}: {
  state: State | null
  connected: string
  isAuthority: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">Compliance authority</p>
        <p className="mt-1 font-mono text-sm text-gray-500">
          {connected ? truncate(connected) : 'Connect your wallet'}
        </p>
        <span
          className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isAuthority
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isAuthority ? 'Signing enabled' : 'Read only'}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">Network</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
          {state ? state.paused ? 'Paused' : 'Settling' : '...'}
        </p>
        <p className="mt-1 font-mono text-xs text-gray-500">
          block {state?.height ?? 0}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">Blocked accounts</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
          {state ? state.sanctioned.length + state.frozen.length : '...'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {state?.sanctioned.length ?? 0} sanctioned, {state?.frozen.length ?? 0} frozen
        </p>
      </div>
    </div>
  )
}

function SanctionsCard({
  state,
  busy,
  disabled,
  onAdd,
  onRemove,
}: {
  state: State | null
  busy: string | null
  disabled: boolean
  onAdd: (v: { address: string; reason: string; ref: string }) => void
  onRemove: (v: { address: string; reason: string; ref: string }) => void
}) {
  const [address, setAddress] = useState('')
  const [reason, setReason] = useState('')
  const [ref, setRef] = useState('')

  return (
    <Card
      header="Sanctions list"
      headerRight={
        <span className="font-mono text-sm text-gray-500">
          {state?.sanctioned.length ?? 0} accounts
        </span>
      }
    >
      <div className="mb-4 h-32 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3">
        {state?.sanctioned.length ? (
          state.sanctioned.map((a) => (
            <p key={a} className="font-mono text-xs leading-6 text-gray-700">
              {a}
            </p>
          ))
        ) : (
          <p className="text-sm text-gray-400">No accounts on the list</p>
        )}
      </div>

      <div className="space-y-3">
        <Input
          label="Account"
          placeholder="0x... or wallet1..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Reason"
            placeholder="Sanctions designation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Input
            label="Reference"
            placeholder="Case or list reference"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => onAdd({ address, reason, ref })}
            isLoading={busy === 'sanction'}
            disabled={disabled || !address || !reason}
          >
            Add to list
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setAddress(OFAC.address)
              setReason(OFAC.entity)
              setRef(OFAC.ref)
            }}
          >
            Fill from OFAC
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setAddress(TARGET)
              setReason('Designated under investigation')
              setRef('BCB-2026-4471')
            }}
          >
            Fill a customer account
          </Button>
          <Button
            variant="ghost"
            onClick={() => onRemove({ address, reason, ref })}
            isLoading={busy === 'unsanction'}
            disabled={disabled || !address || !reason}
          >
            Remove from list
          </Button>
        </div>
      </div>
    </Card>
  )
}

function CheckCard() {
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<{ sanctioned: boolean; frozen: boolean } | null>(null)
  const [checking, setChecking] = useState(false)

  const run = async () => {
    setChecking(true)
    setResult(null)
    try {
      const res = await fetch(`/api/compliance/check?address=${encodeURIComponent(address)}`, {
        cache: 'no-store',
      })
      const body = await res.json()
      if (!body.ok) throw new Error(body.error)
      setResult({ sanctioned: body.sanctioned, frozen: body.frozen })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'check failed')
    } finally {
      setChecking(false)
    }
  }

  const blocked = result && (result.sanctioned || result.frozen)

  return (
    <Card header="Check an account">
      <p className="mb-4 text-sm text-gray-500">
        The same read the compliance check runs against the sender and every
        recipient of a transaction, before it settles.
      </p>
      <div className="space-y-3">
        <Input
          label="Account"
          placeholder="0x... or wallet1..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button onClick={run} isLoading={checking} disabled={!address}>
            Run check
          </Button>
          <Button variant="secondary" onClick={() => setAddress(OFAC.address)}>
            Use the sanctioned account
          </Button>
        </div>
      </div>

      {result && (
        <div
          className={`mt-4 rounded-md border p-4 ${
            blocked ? 'border-gray-400 bg-gray-100' : 'border-green-200 bg-green-50'
          }`}
        >
          <p className="text-lg font-semibold text-gray-900">
            {blocked ? 'Transaction refused' : 'Transaction allowed'}
          </p>
          <p className="mt-1 font-mono text-xs text-gray-600">
            sanctioned={String(result.sanctioned)} frozen={String(result.frozen)}
          </p>
        </div>
      )}
    </Card>
  )
}

function FreezeCard({
  state,
  busy,
  disabled,
  onFreeze,
}: {
  state: State | null
  busy: string | null
  disabled: boolean
  onFreeze: (v: { address: string; reason: string; ref: string }, freeze: boolean) => void
}) {
  const [address, setAddress] = useState(TARGET)
  const [reason, setReason] = useState('')
  const [ref, setRef] = useState('')
  const frozen = !!state?.frozen.includes(address)

  return (
    <Card
      header="Freeze an account"
      headerRight={
        <span className="font-mono text-sm text-gray-500">
          {state?.frozen.length ?? 0} frozen
        </span>
      }
    >
      <p className="mb-4 text-sm text-gray-500">
        Same enforcement as a sanction, a different reason behind it, and
        reversible in one transaction.
      </p>
      <div className="space-y-3">
        <Input
          label="Account"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Reason"
            placeholder="Investigation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Input
            label="Reference"
            placeholder="Case reference"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => onFreeze({ address, reason, ref }, true)}
            isLoading={busy === 'freeze'}
            disabled={disabled || !address || !reason || frozen}
          >
            Freeze account
          </Button>
          <Button
            variant="secondary"
            onClick={() => onFreeze({ address, reason, ref }, false)}
            disabled={disabled || !address || !reason || !frozen}
          >
            Lift the freeze
          </Button>
        </div>
      </div>
    </Card>
  )
}

function SeizeCard({
  recovery,
  busy,
  disabled,
  onSeize,
}: {
  recovery: string
  busy: string | null
  disabled: boolean
  onSeize: (v: { from: string; to: string; amount: string; reason: string; ref: string }) => void
}) {
  const [from, setFrom] = useState(TARGET)
  const [to, setTo] = useState('')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [ref, setRef] = useState('')
  const [balance, setBalance] = useState<string | null>(null)

  useEffect(() => {
    if (recovery && !to) setTo(recovery)
  }, [recovery, to])

  useEffect(() => {
    let live = true
    const read = async () => {
      try {
        const res = await fetch(
          `${chainConfig.rest}/cosmos/bank/v1beta1/balances/${from}/by_denom?denom=${DENOM}`,
          { cache: 'no-store' }
        )
        const body = await res.json()
        if (live) setBalance(body?.balance?.amount ?? '0')
      } catch {
        if (live) setBalance(null)
      }
    }
    read()
    const t = setInterval(read, 3000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [from])

  return (
    <Card
      header="Seize funds"
      headerRight={
        <span className="font-mono text-sm text-gray-500">
          {balance === null ? '-' : (Number(balance) / UNITS).toLocaleString('en-US')} held
        </span>
      }
    >
      <p className="mb-4 text-sm text-gray-500">
        One transaction moves the balance out and into an account you name. It
        still runs against an account that is already sanctioned.
      </p>
      <div className="space-y-3">
        <Input label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input
          label="Recovery account"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Amount"
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Input
            label="Reason"
            placeholder="Court order"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Input
            label="Reference"
            placeholder="Order number"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>
        <Button
          onClick={() => onSeize({ from, to, amount: value, reason, ref })}
          isLoading={busy === 'seize'}
          disabled={disabled || !from || !to || !value || !reason}
        >
          Seize funds
        </Button>
      </div>
    </Card>
  )
}

function PauseCard({
  state,
  busy,
  disabled,
  onSet,
}: {
  state: State | null
  busy: string | null
  disabled: boolean
  onSet: (paused: boolean, reason: string, ref: string) => void
}) {
  const [reason, setReason] = useState('')
  const [ref, setRef] = useState('')
  const paused = !!state?.paused

  return (
    <Card className="mt-6" header="Network pause">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
        <div className="lg:w-1/3">
          <p className="text-sm text-gray-500">
            One signed transaction stops value moving anywhere on the network,
            for every account, in the block it lands in.
          </p>
          {/* A one-way door, and worth saying out loud on the page rather than
              letting the next person find it the hard way. This admin signs
              through the msgexec precompile, and x/msgexec's screenCompliance
              rejects everything while the pause is on, with no allow-set. So the
              button below cannot lift the pause it just set. The compliance ante
              does exempt authority MsgExec, which is why the CLI still works. */}
          {paused && (
            <p className="mt-3 rounded-md border border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
              Resume will not go through from here. The precompile this page signs
              with is closed while the pause is on. Lift it with a Cosmos
              transaction instead:
              <code className="mt-2 block font-mono text-[11px] leading-5 text-gray-700">
                bankd tx compliance set-global-pause false &quot;reason&quot; &quot;ref&quot;
                --from acc0 --keyring-backend test
              </code>
            </p>
          )}
          <p
            className={`mt-4 text-3xl font-semibold ${
              paused ? 'text-gray-900' : 'text-green-700'
            }`}
          >
            {paused ? 'Paused' : 'Settling'}
          </p>
        </div>

        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <Input
            label="Reason"
            placeholder="Incident response"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Input
            label="Reference"
            placeholder="Incident number"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>

        <Button
          size="lg"
          variant={paused ? 'secondary' : 'primary'}
          onClick={() => onSet(!paused, reason, ref)}
          isLoading={busy === 'pause'}
          disabled={disabled || !reason}
        >
          {paused ? 'Resume the network' : 'Pause the network'}
        </Button>
      </div>
    </Card>
  )
}

function AuditCard({ state }: { state: State | null }) {
  const entries = state?.entries ?? []
  return (
    <Card className="mt-6" header="Audit log" noPadding>
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-6 py-3">Id</th>
            <th className="px-6 py-3">Action</th>
            <th className="px-6 py-3">Accounts</th>
            <th className="px-6 py-3">Amount</th>
            <th className="px-6 py-3">Reason</th>
            <th className="px-6 py-3">Reference</th>
            <th className="px-6 py-3">Block</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.length === 0 && (
            <tr>
              <td className="px-6 py-6 text-gray-400" colSpan={7}>
                No entries yet
              </td>
            </tr>
          )}
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="px-6 py-3 font-mono tabular-nums text-gray-500">{e.id}</td>
              <td className="px-6 py-3 font-mono text-gray-900">{e.action}</td>
              <td className="px-6 py-3 font-mono text-xs text-gray-600">
                {e.addresses.map(truncate).join(' -> ')}
              </td>
              <td className="px-6 py-3 tabular-nums text-gray-700">{amount(e.amount)}</td>
              <td className="px-6 py-3 text-gray-700">{e.reason}</td>
              <td className="px-6 py-3 font-mono text-xs text-gray-500">{e.ref}</td>
              <td className="px-6 py-3 font-mono tabular-nums text-gray-500">{e.height}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
