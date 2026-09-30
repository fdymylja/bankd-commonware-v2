'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

type BlockMetric = {
  height: number
  hash: string
  timestamp: string
  transactionCount: number
}

type SystemOverview = {
  viewId: string
  source: string
  access: {
    role: 'federal' | 'regional'
    scope: string
    subject: string
  }
  region: {
    id: string
    label: string
    chainId: string
    singleChainPreview: boolean
  } | null
  collectionPrefix: string
  asOfHeight: number
  recentBlockCount: number
  recentTransactionCount: number
  latestBlock: BlockMetric
  recentBlocks: BlockMetric[]
  provenance: {
    documentId: string
    commitCid: string
    merkleRoot: string
    signer: string
    signatureType: string
  }
  agreement: {
    policy: string
    registeredIndexerCount: number
    requiredSignerCount: number
    observedSignerCount: number
    availableIndexerCount: number
    observedSigners: string[]
    verified: boolean
  }
  reserves: {
    nativeSupply: { denom: string; amount: string }
    voucherSupply: Array<{ denom: string; amount: string }>
    ibcEscrowed: { denom: string; amount: string }
    banks?: Array<{
      bankId: string
      bankAccount: string
      bridgeAddress: string
      paused: boolean
      balances: Array<{ denom: string; amount: string }>
      nativeBalance: string
    }> | null
    reconciliation?: {
      mintedTotal: string
      burnedTotal: string
      netMinted: string
      genesisBaseline: string
      baselineConfigured: boolean
      accountedSupply: string
      nativeSupply: string
      unbackedDelta: string
      consistent: boolean | null
    } | null
  }
  ibc: {
    channelCount: number
    openChannelCount: number
    pendingPacketCount: number
    channels: Array<{
      channelId: string
      state: string
      escrowAddress: string
      balances: Array<{ denom: string; amount: string }>
      pendingPacketCount: number
      regionId: string | null
      regionLabel: string | null
    }>
  }
  regionExposure: Array<{
    regionId: string
    label: string
    chainId: string
    ibcChannelToCentral: string
    channelState: string
    channelOpen: boolean
    pendingSettlements: number
    escrowedNative: { denom: string; amount: string }
  }>
}

type DemoScope = 'federal' | 'br-sp' | 'br-rj'

const demoSubjects: Record<DemoScope, string> = {
  federal: 'federal-supervisor',
  'br-sp': 'sp-supervisor',
  'br-rj': 'rj-supervisor',
}

async function getSystemOverview(scope: DemoScope): Promise<SystemOverview> {
  const path =
    scope === 'federal'
      ? '/api/supervisor/federal/v1/views/system-overview'
      : `/api/supervisor/regional/${scope}/v1/views/system-overview`
  const response = await fetch(path, {
    cache: 'no-store',
    headers: { 'x-supervisor-subject': demoSubjects[scope] },
  })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error ?? 'Unable to load supervisor metrics')
  }
  return body
}

function compact(value: string) {
  if (!value) return 'Unavailable'
  if (value.length < 18) return value
  return `${value.slice(0, 10)}…${value.slice(-6)}`
}

function formatTimestamp(value: string) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatCoin(coin: { denom: string; amount: string }) {
  if (coin.denom !== 'ubrl') {
    return `${BigInt(coin.amount).toLocaleString()} ${coin.denom}`
  }

  const value = BigInt(coin.amount)
  const whole = value / 1_000_000n
  const fractional = (value % 1_000_000n)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '')
    .padEnd(2, '0')

  return `${whole.toLocaleString()}.${fractional} BRL`
}

export function SystemOverview() {
  const [scope, setScope] = useState<DemoScope>('federal')
  const query = useQuery({
    queryKey: ['supervisor-system-overview', scope],
    queryFn: () => getSystemOverview(scope),
    refetchInterval: 5000,
  })

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Disclosure-scoped view
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Requests are authorized against the on-chain x/disclosure grant.
            </div>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-1">
            {(
              [
                ['federal', 'Federal'],
                ['br-sp', 'São Paulo'],
                ['br-rj', 'Rio de Janeiro'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={
                  scope === value
                    ? 'rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm'
                    : 'px-3 py-1.5 text-sm text-gray-600'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {query.data ? (
          <div className="mt-3 text-xs text-gray-600">
            Authorized as{' '}
            <span className="font-mono">{query.data.access.subject}</span> for{' '}
            <span className="font-medium">
              {query.data.access.role}/{query.data.access.scope}
            </span>
            {query.data.region?.singleChainPreview
              ? ` · ${query.data.region.label} is a single-chain preview until regional-${query.data.region.id} is running`
              : ''}
          </div>
        ) : null}
      </div>

      {query.isPending ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
          Waiting for Shinzo metrics…
        </div>
      ) : query.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="font-semibold text-red-900">
            Supervisor data is unavailable
          </h2>
          <p className="mt-2 text-sm text-red-800">{query.error.message}</p>
          <p className="mt-2 text-sm text-red-700">
            Start the localnet and the <code>shinzo-brazil</code> container,
            then this page will reconnect automatically.
          </p>
        </div>
      ) : (
        <SystemOverviewContent data={query.data} />
      )}
    </div>
  )
}

function SystemOverviewContent({ data }: { data: SystemOverview }) {
  const cards = [
    ['Indexed height', data.asOfHeight.toLocaleString()],
    ['Recent blocks', data.recentBlockCount.toLocaleString()],
    ['TXs (recent blocks)', data.recentTransactionCount.toLocaleString()],
    ['Latest block TXs', data.latestBlock.transactionCount.toLocaleString()],
    ['Native supply', formatCoin(data.reserves.nativeSupply)],
    ['IBC escrowed', formatCoin(data.reserves.ibcEscrowed)],
    [
      'Open IBC channels',
      `${data.ibc.openChannelCount} / ${data.ibc.channelCount}`,
    ],
    ['In-flight packets', data.ibc.pendingPacketCount.toLocaleString()],
  ]

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl font-semibold text-gray-900">{value}</div>
            <div className="mt-1 text-sm text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {data.regionExposure?.length ? (
        <RegionExposure regions={data.regionExposure} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent indexed blocks
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Live from {data.collectionPrefix}, refreshed every five seconds.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Height</th>
                  <th className="px-5 py-3">Transactions</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentBlocks.map((block) => (
                  <tr key={block.hash || block.height}>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {block.height.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {block.transactionCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {formatTimestamp(block.timestamp)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
                      {compact(block.hash)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Reporting integrity
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Provenance and cross-indexer agreement.
              </p>
            </div>
            <span
              className={
                data.agreement.verified
                  ? 'rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700'
                  : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700'
              }
            >
              {data.agreement.verified ? 'Verified' : 'Quorum not met'}
            </span>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-gray-500">Indexer agreement</dt>
              <dd className="mt-1 font-medium text-gray-900">
                {data.agreement.observedSignerCount} observed of{' '}
                {data.agreement.requiredSignerCount} required (
                {data.agreement.policy} policy)
              </dd>
              <p className="mt-1 text-xs text-gray-500">
                {data.agreement.availableIndexerCount} of{' '}
                {data.agreement.registeredIndexerCount} registered indexers are
                reachable.
              </p>
            </div>
            <div>
              <dt className="text-gray-500">Agreeing signers</dt>
              <dd className="mt-1 space-y-1 break-all font-mono text-xs text-gray-700">
                {data.agreement.observedSigners.length
                  ? data.agreement.observedSigners.map((signer) => (
                      <div key={signer}>{signer}</div>
                    ))
                  : 'None observed at this height'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Source</dt>
              <dd className="mt-1 font-medium text-gray-900">{data.source}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Commit CID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-gray-700">
                {data.provenance.commitCid || 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Signer</dt>
              <dd className="mt-1 break-all font-mono text-xs text-gray-700">
                {data.provenance.signer || 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Batch Merkle root</dt>
              <dd className="mt-1 break-all font-mono text-xs text-gray-700">
                {data.provenance.merkleRoot || 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Latest block time</dt>
              <dd className="mt-1 text-gray-900">
                {formatTimestamp(data.latestBlock.timestamp)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            IBC reserve positions
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Live balances at deterministic ICS-20 escrow accounts and
            outstanding packet commitments.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Channel</th>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3">Escrow balances</th>
                <th className="px-5 py-3">In flight</th>
                <th className="px-5 py-3">Escrow account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.ibc.channels.map((channel) => (
                <tr key={channel.channelId}>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {channel.channelId}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {channel.state.replace('STATE_', '')}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {channel.balances.length
                      ? channel.balances.map(formatCoin).join(', ')
                      : '0'}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {channel.pendingPacketCount}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">
                    {compact(channel.escrowAddress)}
                  </td>
                </tr>
              ))}
              {data.ibc.channels.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-gray-500"
                  >
                    No transfer channels are available in this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {data.reserves.reconciliation ? (
        <ReserveReconciliation
          reconciliation={data.reserves.reconciliation}
        />
      ) : null}

      {data.reserves.banks ? (
        <PerBankReserves banks={data.reserves.banks} />
      ) : null}
    </>
  )
}

function RegionExposure({
  regions,
}: {
  regions: SystemOverview['regionExposure']
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Cross-region exposure
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Per-region channel health, in-flight settlements, and escrowed native,
          keyed off each region&apos;s channel into central.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">Region</th>
              <th className="px-5 py-3">Channel</th>
              <th className="px-5 py-3">State</th>
              <th className="px-5 py-3">In-flight settlements</th>
              <th className="px-5 py-3">Escrowed native</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {regions.map((region) => (
              <tr key={region.regionId}>
                <td className="px-5 py-3 font-medium text-gray-900">
                  {region.label}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-gray-600">
                  {region.ibcChannelToCentral}
                </td>
                <td className="px-5 py-3 text-gray-700">
                  {region.channelState.replace('STATE_', '')}
                </td>
                <td className="px-5 py-3 text-gray-700">
                  {region.pendingSettlements}
                </td>
                <td className="px-5 py-3 text-gray-700">
                  {formatCoin(region.escrowedNative)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReserveReconciliation({
  reconciliation,
}: {
  reconciliation: NonNullable<SystemOverview['reserves']['reconciliation']>
}) {
  const { consistent } = reconciliation
  const badge =
    consistent === null
      ? {
          text: 'Baseline not configured',
          className:
            'rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600',
        }
      : consistent
        ? {
            text: 'Consistent',
            className:
              'rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700',
          }
        : {
            text: 'Unbacked delta detected',
            className:
              'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700',
          }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Reserve reconciliation
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            On-chain supply integrity: every ubrl change since genesis explained
            by the genesis baseline plus tracked minter accounting.
          </p>
        </div>
        <span className={badge.className}>{badge.text}</span>
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Native supply</dt>
          <dd className="mt-1 font-medium text-gray-900">
            {formatCoin({ denom: 'ubrl', amount: reconciliation.nativeSupply })}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Accounted supply</dt>
          <dd className="mt-1 font-medium text-gray-900">
            {formatCoin({
              denom: 'ubrl',
              amount: reconciliation.accountedSupply,
            })}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Genesis baseline</dt>
          <dd className="mt-1 font-medium text-gray-900">
            {reconciliation.baselineConfigured
              ? formatCoin({
                  denom: 'ubrl',
                  amount: reconciliation.genesisBaseline,
                })
              : 'Set BANKD_GENESIS_NATIVE_SUPPLY to enable'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Net minted (minters)</dt>
          <dd className="mt-1 font-medium text-gray-900">
            {formatCoin({ denom: 'ubrl', amount: reconciliation.netMinted })}
          </dd>
        </div>
        {consistent === false ? (
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Unbacked delta</dt>
            <dd className="mt-1 font-medium text-amber-700">
              {formatCoin({
                denom: 'ubrl',
                amount: reconciliation.unbackedDelta,
              })}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function PerBankReserves({
  banks,
}: {
  banks: NonNullable<SystemOverview['reserves']['banks']>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Per-bank reserves
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Native balances at rest in each bank account. Banks hold minted funds
          pre-forward and returned vouchers awaiting redemption, so a non-zero
          balance is expected.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">Bank ID</th>
              <th className="px-5 py-3">Bridge</th>
              <th className="px-5 py-3">Native balance</th>
              <th className="px-5 py-3">Paused</th>
              <th className="px-5 py-3">Bank account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {banks.map((bank) => (
              <tr key={bank.bankId}>
                <td className="px-5 py-3 font-medium text-gray-900">
                  {bank.bankId}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-gray-600">
                  {compact(bank.bridgeAddress)}
                </td>
                <td className="px-5 py-3 text-gray-700">
                  {formatCoin({ denom: 'ubrl', amount: bank.nativeBalance })}
                </td>
                <td className="px-5 py-3 text-gray-700">
                  {bank.paused ? 'Yes' : 'No'}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-gray-600">
                  {compact(bank.bankAccount)}
                </td>
              </tr>
            ))}
            {banks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                  No banks are registered in the native registry.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
