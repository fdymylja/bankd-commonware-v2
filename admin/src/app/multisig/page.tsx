'use client'

import { fromBech32, toBech32 } from '@cosmjs/encoding'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { type Hex, getAddress, hexToBytes, toHex } from 'viem'

import { PageContainer } from '@/components/layout'
import { Button, Card, Input, Modal } from '@/components/ui'
import { chainConfig } from '@/lib/config'
import { getStargateClient } from '@/lib/cosmos'
import {
  type CreateSafeTxInput,
  type MemberSignatureBlob,
  type MultisigConfig,
  type PendingMultisigTx,
  type UnsignedTxBlob,
  buildShareBlob,
  useMultisig,
} from '@/lib/multisig'
import {
  type PendingSafeTx,
  type SafeMemberSignatureBlob,
  type SafeTxVariant,
  type UnsignedSafeTxBlob,
  getSafeInfo,
} from '@/lib/safe'
import { truncateAddress } from '@/lib/utils'

/** Base units (e.g. ubrl) -> display amount (e.g. "1 BRL"), for humans. */
function formatBalance(baseAmount: string): string {
  const n = Number(baseAmount) / 10 ** chainConfig.decimals
  const pretty = n.toLocaleString(undefined, {
    maximumFractionDigits: chainConfig.decimals,
  })
  return `${pretty} ${chainConfig.displayDenom}`
}

/** The Safe deploys at the multisig's own address - same 20 bytes, hex form. */
function cosmosToEvmHex(bech32: string): string {
  if (!bech32) return ''
  try {
    return getAddress(toHex(fromBech32(bech32).data))
  } catch {
    return ''
  }
}

/** eth_getCode against the local EVM RPC. '0x' (empty) means nothing deployed. */
async function fetchEvmCode(address: string): Promise<string> {
  const res = await fetch(chainConfig.evmRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getCode',
      params: [address, 'latest'],
    }),
  })
  const json = (await res.json()) as { result?: string }
  return json.result ?? '0x'
}

/**
 * A toast that shows a copyable text blob - used for signatures and for the raw
 * chain log on a failed broadcast, so failures can be pasted straight into a bug
 * report instead of squinting at a one-line "code 11".
 */
function copyToast(title: string, body: string, kind: 'success' | 'error' = 'success') {
  toast.custom(
    (t) => (
      <div
        className={`max-w-md rounded-lg border bg-white p-3 shadow-lg ${
          kind === 'error' ? 'border-red-200' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium text-gray-900">{title}</div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-2 font-mono text-xs text-gray-700">
          {body}
        </pre>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(body)
            toast.success('Copied')
          }}
          className="mt-2 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          Copy
        </button>
      </div>
    ),
    { duration: kind === 'error' ? 15000 : 8000 }
  )
}

function buildUnsignedBlob(
  cfg: MultisigConfig,
  tx: PendingMultisigTx
): UnsignedTxBlob {
  return {
    kind: 'bankd-multisig-unsigned-tx',
    multisig: {
      label: cfg.label,
      threshold: cfg.threshold ?? 0,
      members: cfg.members ?? [],
      cosmosAddress: cfg.cosmosAddress ?? '',
    },
    tx: {
      chainId: tx.chainId,
      accountNumber: tx.accountNumber,
      sequence: tx.sequence,
      bodyBytesB64: tx.bodyBytesB64,
      fee: tx.fee,
      signDocJson: tx.signDocJson,
      summary: tx.summary,
    },
  }
}

function PendingTxCard({ tx, cfg }: { tx: PendingMultisigTx; cfg: MultisigConfig }) {
  const { signAsInitiator, addMemberSignature, broadcastPending, deletePending } =
    useMultisig()
  const [sigInput, setSigInput] = useState('')
  const [busy, setBusy] = useState(false)

  const threshold = cfg.threshold ?? 0
  const count = Object.keys(tx.signatures).length
  const ready = count >= threshold

  const copyBlob = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify(buildUnsignedBlob(cfg, tx), null, 2)
    )
    toast.success('Unsigned tx copied')
  }

  const importSig = async () => {
    try {
      const raw = sigInput.trim()
      if (!raw.startsWith('{')) {
        throw new Error(
          'That looks like a raw signature. Paste the full signature blob (the co-signer\'s "Copy signature" / auto-copied JSON), which includes who signed.'
        )
      }
      const parsed = JSON.parse(raw) as MemberSignatureBlob
      if (parsed.kind !== 'bankd-multisig-member-signature')
        throw new Error('Not a member signature blob')
      await addMemberSignature(tx.id, parsed.memberAddress, parsed.signatureB64)
      setSigInput('')
      toast.success('Signature added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid signature blob')
    }
  }

  /** Wrap a member's raw sig into the shareable blob (carries who signed). */
  const sigBlob = (memberAddress: string, signatureB64: string): MemberSignatureBlob => ({
    kind: 'bankd-multisig-member-signature',
    cosmosAddress: cfg.cosmosAddress ?? '',
    memberAddress,
    signatureB64,
  })

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const doSign = async () => {
    setBusy(true)
    try {
      const blob = await signAsInitiator(tx.id)
      // Auto-copy the full signature blob (carries who signed) so a co-signer
      // can paste it straight back to the initiator to broadcast.
      await navigator.clipboard.writeText(JSON.stringify(blob, null, 2))
      toast.success(
        `Signed as ${truncateAddress(blob.memberAddress)} - signature blob copied. Send it to the initiator.`
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sign failed')
    } finally {
      setBusy(false)
    }
  }

  const copySig = async (memberAddress: string, sig: string) => {
    await navigator.clipboard.writeText(
      JSON.stringify(sigBlob(memberAddress, sig), null, 2)
    )
    toast.success('Signature blob copied')
  }

  const doBroadcast = async () => {
    setBusy(true)
    try {
      const res = await broadcastPending(tx.id)
      if (res.code === 0) {
        toast.success(`Broadcast: ${res.transactionHash}`)
      } else {
        // Surface the full chain response for debugging, copyable.
        const debug = [
          `code: ${res.code}`,
          `codespace/txhash: ${res.transactionHash}`,
          `gasUsed/gasWanted: ${res.gasUsed}/${res.gasWanted}`,
          `rawLog: ${res.rawLog}`,
        ].join('\n')
        copyToast(`Broadcast failed (code ${res.code})`, debug, 'error')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Broadcast failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {tx.summary ?? 'Transaction'}
          </div>
          <div className="text-xs text-gray-500">
            seq {tx.sequence} · acct {tx.accountNumber}
          </div>
        </div>
        <div
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {count} / {threshold} signatures
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <Button size="sm" variant="secondary" onClick={copyBlob}>
          Copy unsigned
        </Button>
        <Button size="sm" onClick={doSign} isLoading={busy}>
          Sign as me
        </Button>
        <Button
          size="sm"
          onClick={doBroadcast}
          disabled={!ready}
          isLoading={busy}
          // Gray until every signature is in; turns blue (primary) at quorum.
          className={ready ? undefined : '!bg-gray-200 !text-gray-400'}
        >
          Broadcast
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => run(() => deletePending(tx.id), 'Deleted')}
        >
          Delete
        </Button>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-500">
          Signatures ({count}/{threshold}){ready ? ' · quorum reached' : ''}
        </div>
        {(cfg.members ?? []).map((m) => {
          const sig = tx.signatures[m.address]
          return (
            <div
              key={m.address}
              className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1"
            >
              <span className="font-mono text-xs text-gray-600">
                {truncateAddress(m.address)}
              </span>
              {sig ? (
                <button
                  onClick={() => copySig(m.address, sig)}
                  title="Copy signature blob (share with the initiator)"
                  className="flex items-center gap-1 font-mono text-xs text-green-600 hover:text-green-700"
                >
                  <span>✓</span>
                  <span className="max-w-[10rem] truncate">{sig}</span>
                </button>
              ) : (
                <span className="text-xs text-gray-300">unsigned</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <textarea
          value={sigInput}
          onChange={(e) => setSigInput(e.target.value)}
          placeholder="Paste a member signature blob to add…"
          className="h-20 w-full rounded-lg border border-gray-300 p-2 font-mono text-xs"
        />
        <Button size="sm" variant="secondary" onClick={importSig} disabled={!sigInput.trim()}>
          Add member signature
        </Button>
      </div>
    </Card>
  )
}

type SafeStatus = 'loading' | 'deployed' | 'none'

interface SafeState {
  safeAddress: string
  status: SafeStatus
  check: () => Promise<void>
}

/**
 * Tracks whether a Safe is deployed at this multisig's own address. Re-checks
 * whenever `refreshKey` changes (e.g. after a deploy is broadcast) and on demand.
 * Lifted into a hook so the surface can both show the address and hide the
 * Deploy Safe card once one exists.
 */
function useSafeStatus(
  cosmosAddress: string | undefined,
  refreshKey: number
): SafeState {
  const safeAddress = useMemo(
    () => cosmosToEvmHex(cosmosAddress ?? ''),
    [cosmosAddress]
  )
  const [status, setStatus] = useState<SafeStatus>('loading')

  const check = useCallback(async () => {
    if (!safeAddress) return setStatus('none')
    setStatus('loading')
    try {
      const code = await fetchEvmCode(safeAddress)
      setStatus(code && code !== '0x' ? 'deployed' : 'none')
    } catch {
      setStatus('none')
    }
  }, [safeAddress])

  useEffect(() => {
    void check()
  }, [check, refreshKey])

  return { safeAddress, status, check }
}

/** The multisig's native-token (ubrl) balance; null while loading / on error. */
function useNativeBalance(
  cosmosAddress: string | undefined,
  refreshKey: number
): string | null {
  const [balance, setBalance] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!cosmosAddress) return
      try {
        const client = await getStargateClient()
        const coin = await client.getBalance(cosmosAddress, chainConfig.denom)
        if (!cancelled) setBalance(coin.amount)
      } catch {
        if (!cancelled) setBalance(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [cosmosAddress, refreshKey])

  return balance
}

/** Default top-up amount (display units, BRL) - enough to cover deploy + a batch of txs. */
const DEFAULT_FUND_AMOUNT = '0.05'

/**
 * Popup to send funds from the connected personal account to the multisig, so it
 * can cover deploy fees and transactions. Opened from the "Add funds" button by
 * the balance; available any time (before deploy or later). Amount is in display
 * units (BRL).
 */
function FundModal({
  isOpen,
  onClose,
  onFunded,
}: {
  isOpen: boolean
  onClose: () => void
  onFunded: () => void
}) {
  const { fundMultisig } = useMultisig()
  const [amount, setAmount] = useState(DEFAULT_FUND_AMOUNT)
  const [busy, setBusy] = useState(false)

  const fund = async () => {
    const display = Number(amount)
    if (!amount.trim() || !Number.isFinite(display) || display <= 0) {
      return toast.error('Enter an amount')
    }
    const base = BigInt(Math.round(display * 10 ** chainConfig.decimals)).toString()
    setBusy(true)
    try {
      const res = await fundMultisig(base)
      if (res.code === 0) {
        toast.success(`Funded: ${res.transactionHash}`)
        setAmount(DEFAULT_FUND_AMOUNT)
        onFunded()
        onClose()
      } else {
        copyToast(
          `Funding failed (code ${res.code})`,
          `code: ${res.code}\ngasUsed/gasWanted: ${res.gasUsed}/${res.gasWanted}\nrawLog: ${res.rawLog}`,
          'error'
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Funding failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add funds" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Send {chainConfig.displayDenom} from your personal account to this
          multisig.
        </p>
        <Input
          label={`Amount (${chainConfig.displayDenom})`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={DEFAULT_FUND_AMOUNT}
        />
        <Button onClick={fund} isLoading={busy} className="w-full">
          Fund from personal account
        </Button>
      </div>
    </Modal>
  )
}

function DeploySafeCard({ cfg }: { cfg: MultisigConfig }) {
  const { createPendingDeploySafe, signAsInitiator } = useMultisig()
  const [busy, setBusy] = useState(false)

  const deploy = async () => {
    setBusy(true)
    try {
      const tx = await createPendingDeploySafe()
      try {
        // Signature shows up in the pending tx's signatures list below.
        await signAsInitiator(tx.id)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Auto-sign skipped')
      }
      toast.success('Deploy Safe tx created - collect signatures below')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deploy failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Deploy Safe</h3>
      <p className="text-sm text-gray-500">
        Deploy a Gnosis Safe at this multisig&apos;s own address ({cfg.threshold} of{' '}
        {cfg.members?.length} owners = the members). One-time per address. Fund the
        multisig first, then deploy.
      </p>
      <Button onClick={deploy} isLoading={busy}>
        Deploy Safe
      </Button>
    </Card>
  )
}

function CosmosMultisigSurface({ cfg }: { cfg: MultisigConfig }) {
  const { pendingTxs, pendingSafeTxs, createPendingSend, signAsInitiator } =
    useMultisig()
  const [balanceNonce, setBalanceNonce] = useState(0)
  const safe = useSafeStatus(cfg.cosmosAddress, pendingTxs.length)
  // Live Safe state for EVM proposals raised against this multisig's Safe (they
  // land in pendingSafeTxs and are shown alongside the cosmos pending list).
  const safeLive = useSafeLive(safe.safeAddress, pendingSafeTxs.length)
  const balance = useNativeBalance(cfg.cosmosAddress, pendingTxs.length + balanceNonce)
  const hasBalance = balance !== null && Number(balance) > 0
  const [showFund, setShowFund] = useState(false)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const copySafe = async () => {
    await navigator.clipboard.writeText(safe.safeAddress)
    toast.success('Safe address copied')
  }

  const newSend = async () => {
    if (!to.trim() || !amount.trim()) return toast.error('Recipient and amount required')
    setBusy(true)
    try {
      const tx = await createPendingSend({ toAddress: to.trim(), amount: amount.trim() })
      // initiator auto-signs
      try {
        await signAsInitiator(tx.id)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Auto-sign skipped')
      }
      setTo('')
      setAmount('')
      toast.success('Unsigned tx created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/*
        Safe (EVM) address == this multisig's own 20 bytes, once deployed. To
        drive that Safe (propose/sign/execute, owner mgmt), add it as a 'safe'
        wallet from the switcher - see SafeSurface below.
      */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{cfg.label}</h3>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(
                JSON.stringify(buildShareBlob(cfg), null, 2)
              )
              toast.success('Multisig config copied - share it to add this multisig elsewhere')
            }}
          >
            Share
          </Button>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Cosmos Address</dt>
            <dd className="break-all font-mono text-gray-800">{cfg.cosmosAddress}</dd>
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Safe (EVM) Address</dt>
            <dd className="flex items-center gap-2">
              {safe.status === 'loading' ? (
                <span className="text-gray-400">checking…</span>
              ) : safe.status === 'deployed' ? (
                <button
                  onClick={copySafe}
                  title={`Copy ${safe.safeAddress}`}
                  className="break-all font-mono text-gray-800 hover:text-gray-900"
                >
                  {safe.safeAddress}
                </button>
              ) : (
                <span className="text-gray-400">Not Deployed</span>
              )}
              <button
                onClick={safe.check}
                title="Refresh Safe status"
                className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
              >
                ↻
              </button>
            </dd>
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Balance</dt>
            <dd className="flex items-center gap-3">
              <span className="font-mono text-gray-800">
                {balance === null ? '—' : formatBalance(balance)}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setShowFund(true)}>
                Add funds
              </Button>
            </dd>
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Threshold</dt>
            <dd className="text-gray-800">
              {cfg.threshold} of {cfg.members?.length}
            </dd>
          </div>
        </dl>

        <div className="mt-2 border-t border-gray-100 pt-4">
          <div className="mb-2 text-sm text-gray-500">Members</div>
          <div className="space-y-1">
            {cfg.members?.map((m) => (
              <div key={m.address} className="break-all font-mono text-xs text-gray-600">
                {m.address}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Fund popup, opened from the "Add funds" button by the balance. */}
      <FundModal
        isOpen={showFund}
        onClose={() => setShowFund(false)}
        onFunded={() => setBalanceNonce((n) => n + 1)}
      />

      {/* Deploy is one-time; needs a balance for fees, hidden once deployed. */}
      {hasBalance && safe.status !== 'deployed' && <DeploySafeCard cfg={cfg} />}

      {/* Sends run through the deployed Safe, so gate this on deployment. */}
      {safe.status === 'deployed' && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">New send</h3>
          <Input label="Recipient" value={to} onChange={(e) => setTo(e.target.value)} placeholder="wallet1..." />
          <Input
            label="Amount (base units, ubrl)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000000"
          />
          <Button onClick={newSend} isLoading={busy}>
            Create + sign
          </Button>
        </Card>
      )}

      {/* Cosmos-side pending txs (Safe deploy, native sends). Only shown when
          there are any - otherwise it's a confusing second empty list next to
          the Safe (EVM) pending section below. */}
      {pendingTxs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Pending cosmos transactions ({pendingTxs.length})
          </h3>
          {pendingTxs.map((tx) => (
            <PendingTxCard key={tx.id} tx={tx} cfg={cfg} />
          ))}
        </div>
      )}

      {/* EVM proposals (deploys, sends, etc.) raised against this multisig's
          Safe from any feature page show up here too, not just the co-sign
          modal - sign / execute them right on the page. The import box is always
          here so a co-signer can paste a proposal to load + sign it. */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Pending Safe transactions ({pendingSafeTxs.length})
        </h3>
        <ImportUnsignedTxCard />
        {pendingSafeTxs.length === 0 ? (
          <p className="text-sm text-gray-500">No pending Safe transactions.</p>
        ) : (
          pendingSafeTxs.map((tx) => (
            <SafePendingTxCard
              key={tx.id}
              cfg={cfg}
              tx={tx}
              threshold={safeLive.threshold}
              liveNonce={safeLive.nonce}
            />
          ))
        )}
      </div>
    </div>
  )
}

/** hex EVM addr -> bech32 `wallet1...` (same 20 bytes), for cosmos-side reads. */
function evmHexToCosmos(hex: string): string {
  if (!hex) return ''
  try {
    return toBech32(chainConfig.bech32Prefix, hexToBytes(getAddress(hex) as Hex))
  } catch {
    return ''
  }
}

function buildSafeUnsignedBlob(
  cfg: MultisigConfig,
  tx: PendingSafeTx
): UnsignedSafeTxBlob {
  return {
    kind: 'bankd-safe-unsigned-tx',
    safe: {
      label: cfg.label,
      safeAddress: tx.safeAddress,
      chainId: tx.chainId,
    },
    tx: {
      safeTx: tx.safeTx,
      safeTxHash: tx.safeTxHash,
      nonce: tx.nonce,
      summary: tx.summary,
    },
  }
}

interface SafeLive {
  owners: string[]
  threshold: number
  /** decimal string, or null on error / while loading. */
  nonce: string | null
  loading: boolean
  reload: () => void
}

/** Live owners/threshold/nonce off the Safe contract. */
function useSafeLive(safeAddress: string, refreshKey: number): SafeLive {
  const [state, setState] = useState<{
    owners: string[]
    threshold: number
    nonce: string | null
  }>({ owners: [], threshold: 0, nonce: null })
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!safeAddress) return
    setLoading(true)
    getSafeInfo(safeAddress)
      .then((info) => {
        if (!cancelled)
          setState({
            owners: info.owners,
            threshold: info.threshold,
            nonce: info.nonce,
          })
      })
      .catch(() => {
        if (!cancelled) setState({ owners: [], threshold: 0, nonce: null })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [safeAddress, refreshKey, tick])

  return { ...state, loading, reload: () => setTick((t) => t + 1) }
}

function SafePendingTxCard({
  cfg,
  tx,
  threshold,
  liveNonce,
}: {
  cfg: MultisigConfig
  tx: PendingSafeTx
  threshold: number
  liveNonce: string | null
}) {
  const {
    signSafeAsInitiator,
    addSafeMemberSignature,
    executePendingSafe,
    deletePendingSafe,
  } = useMultisig()
  const [sigInput, setSigInput] = useState('')
  const [busy, setBusy] = useState(false)

  const signers = Object.keys(tx.signatures)
  const count = signers.length
  const ready = threshold > 0 && count >= threshold
  // A newer proposal already moved the Safe past this nonce -> this one can't
  // execute (its hash no longer matches). Warn and block.
  const stale = liveNonce !== null && liveNonce !== tx.nonce

  const copyBlob = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify(buildSafeUnsignedBlob(cfg, tx), null, 2)
    )
    toast.success('Unsigned Safe tx copied')
  }

  const doSign = async () => {
    setBusy(true)
    try {
      const blob = await signSafeAsInitiator(tx.id)
      toast.success(`Signed as ${truncateAddress(blob.ownerAddress)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sign failed')
    } finally {
      setBusy(false)
    }
  }

  const importSig = async () => {
    try {
      const parsed = JSON.parse(sigInput) as SafeMemberSignatureBlob
      if (parsed.kind !== 'bankd-safe-member-signature')
        throw new Error('Not a Safe member signature blob')
      if (parsed.safeTxHash !== tx.safeTxHash)
        throw new Error('Signature is for a different Safe tx')
      await addSafeMemberSignature(tx.id, parsed.signature)
      setSigInput('')
      toast.success('Signature added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid signature blob')
    }
  }

  const copySig = async (sig: string) => {
    await navigator.clipboard.writeText(sig)
    toast.success('Signature copied')
  }

  const doExecute = async () => {
    setBusy(true)
    try {
      const { transactionHash, deployedAddress } = await executePendingSafe(tx.id)
      if (deployedAddress) {
        copyToast('Executed - contract deployed', deployedAddress)
      } else {
        toast.success(`Executed: ${transactionHash}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execute failed'
      // Surface the full error (revert reasons can be long) as a copyable toast.
      copyToast('Execute failed', msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    setBusy(true)
    try {
      await deletePendingSafe(tx.id)
      toast.success('Deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">{tx.summary}</div>
          <div className="text-xs text-gray-500">nonce {tx.nonce}</div>
        </div>
        <div
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {count} / {threshold} signatures
        </div>
      </div>

      {stale && (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          Stale: Safe is now at nonce {liveNonce}. This tx was built for nonce{' '}
          {tx.nonce} and can&apos;t execute - delete and recreate it.
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <Button size="sm" variant="secondary" onClick={copyBlob}>
          Copy unsigned
        </Button>
        <Button size="sm" onClick={doSign} isLoading={busy}>
          Sign as me
        </Button>
        <Button
          size="sm"
          onClick={doExecute}
          disabled={!ready || stale}
          isLoading={busy}
          className={ready && !stale ? undefined : '!bg-gray-200 !text-gray-400'}
        >
          Execute
        </Button>
        <Button size="sm" variant="danger" onClick={doDelete}>
          Delete
        </Button>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-500">
          Signatures ({count}/{threshold}){ready ? ' · quorum reached' : ''}
        </div>
        {count === 0 ? (
          <div className="text-xs text-gray-300">No signatures yet</div>
        ) : (
          signers.map((owner) => (
            <div
              key={owner}
              className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1"
            >
              <span className="font-mono text-xs text-gray-600">
                {truncateAddress(owner)}
              </span>
              <button
                onClick={() => copySig(tx.signatures[owner])}
                title="Copy signature"
                className="flex items-center gap-1 font-mono text-xs text-green-600 hover:text-green-700"
              >
                <span>✓</span>
                <span className="max-w-[10rem] truncate">
                  {tx.signatures[owner]}
                </span>
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <textarea
          value={sigInput}
          onChange={(e) => setSigInput(e.target.value)}
          placeholder="Paste an owner signature blob to add…"
          className="h-20 w-full rounded-lg border border-gray-300 p-2 font-mono text-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={importSig}
          disabled={!sigInput.trim()}
        >
          Add owner signature
        </Button>
      </div>
    </Card>
  )
}

const SAFE_VARIANTS: { key: SafeTxVariant; label: string }[] = [
  { key: 'native-send', label: 'Native send' },
  { key: 'cosmos-send', label: 'Cosmos send' },
  { key: 'authority-send', label: 'Authority exec' },
  { key: 'add-owner', label: 'Add owner' },
  { key: 'change-threshold', label: 'Change threshold' },
]

function SafeProposeCard() {
  const { createPendingSafeTx, signSafeAsInitiator } = useMultisig()
  const [variant, setVariant] = useState<SafeTxVariant>('native-send')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [owner, setOwner] = useState('')
  const [threshold, setThreshold] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setTo('')
    setAmount('')
    setOwner('')
    setThreshold('')
  }

  const buildInput = (): CreateSafeTxInput => {
    switch (variant) {
      case 'native-send':
        if (!to.trim() || !amount.trim())
          throw new Error('Recipient and amount required')
        return { variant, to: to.trim(), amountDisplay: amount.trim() }
      case 'cosmos-send':
        if (!to.trim() || !amount.trim())
          throw new Error('Recipient and amount required')
        return { variant, toBech32: to.trim(), amount: amount.trim() }
      case 'authority-send':
        if (!to.trim() || !amount.trim())
          throw new Error('Recipient and amount required')
        return { variant, toBech32: to.trim(), amount: amount.trim() }
      case 'add-owner': {
        const t = Number(threshold)
        if (!owner.trim() || !Number.isInteger(t) || t < 1)
          throw new Error('Owner address and a valid threshold required')
        return { variant, owner: owner.trim(), threshold: t }
      }
      case 'change-threshold': {
        const t = Number(threshold)
        if (!Number.isInteger(t) || t < 1)
          throw new Error('A valid threshold required')
        return { variant, threshold: t }
      }
    }
  }

  const propose = async () => {
    setBusy(true)
    try {
      const input = buildInput()
      const tx = await createPendingSafeTx(input)
      // Initiator auto-signs, mirroring the cosmos flow.
      try {
        await signSafeAsInitiator(tx.id)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Auto-sign skipped')
      }
      reset()
      toast.success('Safe tx proposed - collect signatures below')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Propose failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Propose Safe tx</h3>

      <div className="flex flex-wrap gap-2">
        {SAFE_VARIANTS.map((v) => (
          <button
            key={v.key}
            onClick={() => setVariant(v.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              variant === v.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {variant === 'native-send' && (
        <>
          <Input
            label="Recipient (0x...)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x..."
          />
          <Input
            label={`Amount (${chainConfig.displayDenom})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
          />
        </>
      )}

      {(variant === 'cosmos-send' || variant === 'authority-send') && (
        <>
          <Input
            label="Recipient (wallet1...)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="wallet1..."
          />
          <Input
            label={`Amount (base units, ${chainConfig.denom})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000000"
          />
          {variant === 'authority-send' && (
            <p className="text-xs text-gray-500">
              Sends from the authority module account via
              authority.MsgExec - proves the Safe can drive x/authority. Requires
              ownership already transferred to this Safe.
            </p>
          )}
        </>
      )}

      {variant === 'add-owner' && (
        <>
          <Input
            label="New owner (0x...)"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="0x..."
          />
          <Input
            label="New threshold"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="2"
          />
        </>
      )}

      {variant === 'change-threshold' && (
        <Input
          label="New threshold"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="2"
        />
      )}

      <Button onClick={propose} isLoading={busy}>
        Propose + sign
      </Button>
    </Card>
  )
}

function SafeSurface({ cfg }: { cfg: MultisigConfig }) {
  const { pendingSafeTxs } = useMultisig()
  const safeAddress = cfg.safeAddress ?? ''
  const cosmosAddress = useMemo(() => evmHexToCosmos(safeAddress), [safeAddress])
  const live = useSafeLive(safeAddress, pendingSafeTxs.length)
  const balance = useNativeBalance(cosmosAddress, pendingSafeTxs.length)

  const copyAddr = async () => {
    await navigator.clipboard.writeText(safeAddress)
    toast.success('Safe address copied')
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            {cfg.label} (Safe)
          </h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  JSON.stringify(buildShareBlob(cfg), null, 2)
                )
                toast.success('Safe config copied - share it to add this Safe elsewhere')
              }}
            >
              Share
            </Button>
            <button
              onClick={live.reload}
              title="Refresh Safe state"
              className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
            >
              ↻
            </button>
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Safe (EVM) Address</dt>
            <dd>
              <button
                onClick={copyAddr}
                title={`Copy ${safeAddress}`}
                className="break-all font-mono text-gray-800 hover:text-gray-900"
              >
                {safeAddress}
              </button>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Cosmos Address</dt>
            <dd className="break-all font-mono text-gray-800">{cosmosAddress}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Balance</dt>
            <dd className="font-mono text-gray-800">
              {balance === null ? '—' : formatBalance(balance)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Threshold</dt>
            <dd className="text-gray-800">
              {live.loading
                ? 'checking…'
                : `${live.threshold} of ${live.owners.length}`}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-gray-500">Nonce</dt>
            <dd className="font-mono text-gray-800">
              {live.nonce ?? (live.loading ? 'checking…' : '—')}
            </dd>
          </div>
        </dl>

        {live.owners.length > 0 && (
          <div className="mt-2 border-t border-gray-100 pt-4">
            <div className="mb-2 text-sm text-gray-500">Owners</div>
            <div className="space-y-1">
              {live.owners.map((o) => (
                <div
                  key={o}
                  className="break-all font-mono text-xs text-gray-600"
                >
                  {o}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <SafeProposeCard />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Pending transactions ({pendingSafeTxs.length})
        </h3>
        {pendingSafeTxs.length === 0 ? (
          <p className="text-sm text-gray-500">No pending transactions.</p>
        ) : (
          pendingSafeTxs.map((tx) => (
            <SafePendingTxCard
              key={tx.id}
              cfg={cfg}
              tx={tx}
              threshold={live.threshold}
              liveNonce={live.nonce}
            />
          ))
        )}
      </div>
    </div>
  )
}

/**
 * Paste an unsigned-tx blob (the initiator's "Copy unsigned") to load it as a
 * signable pending tx - the co-signer half of the offline flow. Auto-creates the
 * multisig from the blob if this browser doesn't have it, then switches to it.
 */
function ImportUnsignedTxCard() {
  const { importPendingTx } = useMultisig()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const doImport = async () => {
    setBusy(true)
    try {
      const parsed = JSON.parse(text) as UnsignedTxBlob
      if (parsed.kind !== 'bankd-multisig-unsigned-tx') {
        throw new Error('Not an unsigned multisig tx blob')
      }
      const tx = await importPendingTx(parsed)
      setText('')
      toast.success(`Imported "${tx.summary ?? 'transaction'}" - sign it below`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid unsigned tx blob')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">
        Import unsigned tx to sign
      </h3>
      <p className="text-sm text-gray-500">
        Got a proposal from another signer? Paste their &quot;Copy unsigned&quot;
        blob to load it as a pending tx you can sign. Creates the multisig for you
        if you don&apos;t have it yet.
      </p>
      <input
        type="text"
        value={text}
        onChange={(e) => {
          // Condense pasted JSON to a single line; leave partial input as typed.
          const v = e.target.value
          try {
            setText(JSON.stringify(JSON.parse(v)))
          } catch {
            setText(v)
          }
        }}
        placeholder='Paste unsigned tx JSON {"kind":"bankd-multisig-unsigned-tx",...}'
        className="w-full truncate rounded-lg border border-gray-300 p-2 font-mono text-xs"
      />
      <Button
        variant="secondary"
        onClick={doImport}
        isLoading={busy}
        disabled={!text.trim()}
      >
        Import + sign
      </Button>
    </Card>
  )
}

export default function MultisigPage() {
  const { activeWallet, activeMultisig, wallets } = useMultisig()

  const activeSafe = useMemo(() => {
    if (activeWallet === 'personal') return null
    const w = wallets.find((x) => x.id === activeWallet.multisigId)
    return w?.type === 'safe' ? w : null
  }, [activeWallet, wallets])

  return (
    <PageContainer
      title="Multisig"
      description="Multisig wallets. Switch back to your personal account any time from the header."
    >
      <div className="space-y-6">
        {activeMultisig ? (
          <CosmosMultisigSurface cfg={activeMultisig} />
        ) : activeSafe ? (
          <SafeSurface cfg={activeSafe} />
        ) : (
          <>
            <Card className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">No multisig selected</h3>
              <p className="text-sm text-gray-500">
                Use the wallet switcher in the header to add a multisig or select an existing one.
                {wallets.length === 0 && ' No multisig wallets yet.'}
              </p>
            </Card>
            {/* Still allow a co-signer to paste a proposal - it creates the
                multisig from the blob and switches to it. */}
            <ImportUnsignedTxCard />
          </>
        )}
      </div>
    </PageContainer>
  )
}
