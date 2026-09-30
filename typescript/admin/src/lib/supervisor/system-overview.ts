import { NextResponse } from 'next/server'

import supervisorPolicy from '@/generated/supervisor-indexer-policy.json'
import { chainDefinition } from '@/lib/config'
import type { SupervisorAccess } from '@/lib/supervisor/access'
import { queryChainMetrics } from '@/lib/supervisor/chain-metrics'
import { verifyBlockSignature } from '@/lib/supervisor/signature'

const DEFAULT_GRAPHQL_URLS = [
  'http://localhost:9181/api/v0/graphql',
  'http://localhost:9183/api/v0/graphql',
  'http://localhost:9184/api/v0/graphql',
]
const DEFAULT_COLLECTION_PREFIX = 'Bankd__Brazil'
const COLLECTION_PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/
const DEFAULT_NATIVE_DENOM = 'ubrl'
const UNINITIALIZED_CHANNEL_STATE = 'STATE_UNINITIALIZED_UNSPECIFIED'

type Coin = { denom: string; amount: string }

// ExposureChannel is the slice of an IBC channel position (from chain-metrics)
// that region exposure cares about. Kept structural so tests can pass minimal
// objects.
type ExposureChannel = {
  channelId: string
  state: string
  pendingPacketCount: number
  balances: Coin[]
}

// ExposureRegion is the slice of a registered supervisor region used to key
// exposure off the region's channel into central.
type ExposureRegion = {
  id: string
  label: string
  chainId: string
  ibcChannelToCentral: string
}

type BuildRegionExposureInput = {
  channels: ExposureChannel[]
  regions: ExposureRegion[]
  role: 'federal' | 'regional'
  nativeDenom: string
  regionId?: string
}

export type RegionExposure = {
  regionId: string
  label: string
  chainId: string
  ibcChannelToCentral: string
  channelState: string
  channelOpen: boolean
  pendingSettlements: number
  escrowedNative: Coin
}

// buildRegionExposure derives per-region channel health + in-flight settlements
// + escrowed native from the region registry left-joined onto the live IBC
// channels. federal -> one entry per registered region (idle regions with no
// open channel included, zeroed); regional -> only the entry for regionId.
// Pure: caller passes nativeDenom, no env reads here.
export function buildRegionExposure({
  channels,
  regions,
  role,
  nativeDenom,
  regionId,
}: BuildRegionExposureInput): RegionExposure[] {
  const scoped =
    role === 'federal'
      ? regions
      : regions.filter((region) => region.id === regionId)
  return scoped.map((region) => {
    const channel = channels.find(
      (candidate) => candidate.channelId === region.ibcChannelToCentral
    )
    const channelState = channel?.state ?? UNINITIALIZED_CHANNEL_STATE
    const escrowedAmount = (channel?.balances ?? [])
      .filter((coin) => coin.denom === nativeDenom)
      .reduce((total, coin) => total + BigInt(coin.amount), 0n)
      .toString()
    return {
      regionId: region.id,
      label: region.label,
      chainId: region.chainId,
      ibcChannelToCentral: region.ibcChannelToCentral,
      channelState,
      channelOpen: channelState === 'STATE_OPEN',
      pendingSettlements: channel?.pendingPacketCount ?? 0,
      escrowedNative: { denom: nativeDenom, amount: escrowedAmount },
    }
  })
}

type ShinzoSignature = {
  identity?: string
  type?: string
  value?: string
}

type ShinzoBlock = {
  _docID?: string
  _version?: Array<{
    cid?: string
    signature?: ShinzoSignature
  }>
  hash?: string
  number?: number
  timestamp?: string
}

type ShinzoBlockSignature = {
  blockNumber?: number
  blockHash?: string
  merkleRoot?: string
  signatureIdentity?: string
  signatureType?: string
  signatureValue?: string
}

type GraphQLResponse = {
  data?: {
    blocks?: ShinzoBlock[]
    latestVersion?: ShinzoBlock[]
    signatures?: ShinzoBlockSignature[]
    transactions?: Array<{ blockNumber?: number }>
  }
  errors?: Array<{ message?: string }>
}

// QuorumSource is one configured endpoint's raw response: the signer it is bound
// to (registered indexer at the same position) plus the BlockSignature docs it
// returned. expectedSigner is undefined for an endpoint with no bound identity.
type QuorumSource = {
  expectedSigner?: string
  signatures: ShinzoBlockSignature[]
}

type ResolveQuorumInput = {
  sources: QuorumSource[]
  latestNumber: number
  latestHash?: string
  registered: Map<string, { signatureType?: string }>
  requiredSignerCount: number
}

export type QuorumResult = {
  agreedSignatures: ShinzoBlockSignature[]
  verified: boolean
}

// resolveQuorum is the security boundary for the "verified" quorum badge. It is
// pure so it can be exhaustively tested against forged inputs. The rules:
//
//  1. Endpoint binding: an endpoint only contributes its own bound signer's
//     attestation, so it can't replay another registered signer's public
//     attestation. At most one attestation per endpoint (a second entry, despite
//     limit: 1, is ignored).
//  2. Cryptographic verification: the attestation's signature must verify over
//     the signed merkle root and anchor to the latest block (height + hash +
//     type). A claimed identity/tuple never counts on its own.
//  3. Commitment grouping: verified attestations group by the exact signed
//     commitment (height : block hash : merkle root) - distinct signers over the
//     SAME signed root.
//  4. Fail closed: exactly one commitment may reach quorum. Zero or multiple
//     qualifying commitments are ambiguous and yield no verified badge, no signer
//     set, and no signed provenance.
export function resolveQuorum({
  sources,
  latestNumber,
  latestHash,
  registered,
  requiredSignerCount,
}: ResolveQuorumInput): QuorumResult {
  const attestations = sources.flatMap(({ expectedSigner, signatures }) => {
    if (!expectedSigner) return []
    const indexer = registered.get(expectedSigner)
    if (!indexer) return []
    const sig = signatures.find(
      (candidate) =>
        candidate.signatureIdentity?.toLowerCase() === expectedSigner &&
        candidate.blockNumber === latestNumber &&
        candidate.blockHash === latestHash &&
        indexer.signatureType === candidate.signatureType &&
        typeof candidate.merkleRoot === 'string' &&
        verifyBlockSignature({
          identity: candidate.signatureIdentity ?? '',
          signatureValue: candidate.signatureValue ?? '',
          merkleRoot: candidate.merkleRoot,
        })
    )
    return sig ? [{ signer: expectedSigner, sig }] : []
  })
  const commitmentGroups = new Map<string, Map<string, ShinzoBlockSignature>>()
  for (const { signer, sig } of attestations) {
    // merkleRoot is hex, so grouping is case-insensitive: mixed-case copies of
    // the same root must land in one group, not split into losing groups.
    const key = `${sig.blockNumber}:${sig.blockHash}:${sig.merkleRoot?.toLowerCase()}`
    const group = commitmentGroups.get(key) ?? new Map()
    group.set(signer, sig)
    commitmentGroups.set(key, group)
  }
  const qualifying = [...commitmentGroups.values()].filter(
    (group) => group.size >= requiredSignerCount
  )
  const agreedGroup = qualifying.length === 1 ? qualifying[0] : undefined
  return {
    agreedSignatures: agreedGroup ? [...agreedGroup.values()] : [],
    verified: agreedGroup !== undefined,
  }
}

function collectionPrefix() {
  const prefix =
    process.env.SHINZO_COLLECTION_PREFIX ?? DEFAULT_COLLECTION_PREFIX
  if (!COLLECTION_PREFIX_PATTERN.test(prefix)) {
    throw new Error('SHINZO_COLLECTION_PREFIX is not a valid GraphQL name')
  }
  return prefix
}

function blockTimestamp(value?: string) {
  if (!value) return ''
  if (/^\d+$/.test(value)) {
    return new Date(Number(value) * 1000).toISOString()
  }
  return value
}

function metricsQuery(prefix: string) {
  const blockCollection = `${prefix}__Block`
  const signatureCollection = `${prefix}__BlockSignature`

  return `query SupervisorSystemOverview {
    blocks: ${blockCollection}(order: {number: DESC}, limit: 24) {
      _docID
      number
      timestamp
      hash
    }
    # Only the newest block's commit CID is ever read, and _version walks the
    # commit DAG per block: 0.39s for 24 of them against 0.07s without, on a
    # localnet at height 1244. Ask for the one we use.
    latestVersion: ${blockCollection}(order: {number: DESC}, limit: 1) {
      _version {
        cid
      }
    }
    # A window, not just the newest. resolveQuorum looks for a signature matching
    # the PRIMARY endpoint's latest block, and the three indexers commit
    # independently, so one of them being a block ahead or behind used to mean it
    # offered nothing and quorum read "0 observed of 2 required" while every
    # generator was in fact signing every block. Eight candidates costs ~0.1s and
    # weakens nothing: the match still requires the exact block number and hash,
    # the registered signer identity, and a verifying signature.
    signatures: ${signatureCollection}(order: {blockNumber: DESC}, limit: 8) {
      blockNumber
      blockHash
      merkleRoot
      signatureIdentity
      signatureType
      signatureValue
    }
  }`
}

// Transaction counts for a window of blocks, WITHOUT the COUNT sub-aggregate.
//
// `COUNT(transactions: {})` on the block list was the single most expensive thing
// this route did, and it did not scale: measured against a localnet at height 883,
// the same query was 0.05s without it and 9.13s with it, and asking for ONE block
// instead of 24 still cost 11.93s. The limit made no difference because the
// aggregate walks the whole related collection per request rather than per block,
// so the cost tracks total chain length. By ~2000 blocks it was timing out at 90s
// and the supervisor page sat on "Waiting for Shinzo metrics…".
//
// Selecting the transactions in the window directly and counting them here is
// 0.04s and stays flat, because the filter bounds the scan. DefraDB has no `_gte`,
// hence `_gt: floor - 1`.
function transactionsQuery(prefix: string, oldestBlockNumber: number) {
  return `query SupervisorRecentTransactions {
    transactions: ${prefix}__Transaction(filter: {blockNumber: {_gt: ${oldestBlockNumber - 1}}}) {
      blockNumber
    }
  }`
}

/** blockNumber -> how many transactions landed in it, for the blocks we were given. */
async function transactionCounts(
  url: string,
  prefix: string,
  blocks: ShinzoBlock[]
) {
  const counts = new Map<number, number>()
  const numbers = blocks
    .map((block) => block.number)
    .filter((n): n is number => typeof n === 'number')
  if (!numbers.length) return counts
  for (const n of numbers) counts.set(n, 0)
  const oldest = Math.min(...numbers)
  try {
    const result = await queryIndexer(url, transactionsQuery(prefix, oldest))
    const rows = (result.data?.transactions ?? []) as Array<{
      blockNumber?: number
    }>
    for (const row of rows) {
      if (typeof row.blockNumber !== 'number') continue
      if (!counts.has(row.blockNumber)) continue
      counts.set(row.blockNumber, (counts.get(row.blockNumber) ?? 0) + 1)
    }
  } catch {
    // A failure here costs the transaction column, not the whole page. Heights,
    // hashes and the agreement panel are all still real, so degrade rather than 503.
  }
  return counts
}

function graphqlUrls() {
  const configured =
    process.env.SHINZO_GRAPHQL_URLS ?? process.env.SHINZO_GRAPHQL_URL
  const urls = configured
    ? configured
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean)
    : DEFAULT_GRAPHQL_URLS
  if (
    process.env.NODE_ENV === 'production' &&
    urls.some((url) => !url.startsWith('https://'))
  ) {
    throw new Error('Production indexer endpoints must use authenticated HTTPS')
  }
  return urls
}

function registeredIndexers() {
  return new Map(
    supervisorPolicy.indexers.map((indexer) => [
      indexer.identity.toLowerCase(),
      indexer,
    ])
  )
}

// anchorChainTip checks the indexer-reported tip against the trusted EVM RPC:
// a fabricated tip (height beyond the real chain head, or a different chain)
// fails closed. Mirrors the head check in deployed.ts's rpcAnchor.
async function anchorChainTip(latestNumber: number) {
  const rpc = chainDefinition.rpcUrls.default.http[0]
  const call = async (method: string) => {
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const body = (await response.json()) as { result?: unknown; error?: unknown }
    if (!response.ok || body.error) {
      throw new Error('RPC chain-tip anchor unavailable')
    }
    return body.result
  }
  const chainId = Number(BigInt(String(await call('eth_chainId'))))
  if (chainId !== chainDefinition.id) {
    throw new Error('RPC chain mismatch')
  }
  const head = Number(BigInt(String(await call('eth_blockNumber'))))
  if (latestNumber > head) {
    throw new Error('Indexer ahead of chain head')
  }
}

async function queryIndexer(url: string, query: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) {
    throw new Error(`Shinzo GraphQL returned HTTP ${response.status}`)
  }
  const result = (await response.json()) as GraphQLResponse
  if (result.errors?.length) {
    throw new Error(
      result.errors.map((error) => error.message ?? 'Unknown error').join('; ')
    )
  }
  return result
}

export async function systemOverviewResponse(
  access: SupervisorAccess,
  regionID?: string
) {
  try {
    const region = regionID
      ? supervisorPolicy.regions.find((candidate) => candidate.id === regionID)
      : undefined
    if (regionID && !region) {
      return NextResponse.json(
        { error: 'Unknown supervisor region' },
        { status: 404 }
      )
    }
    const prefix = collectionPrefix()
    const urls = graphqlUrls()
    if (urls.length > supervisorPolicy.indexers.length) {
      throw new Error('More Shinzo endpoints than registered indexer identities')
    }
    const [results, chainMetrics] = await Promise.all([
      Promise.allSettled(
        urls.map((url) => queryIndexer(url, metricsQuery(prefix)))
      ),
      queryChainMetrics(
        region?.ibcChannelToCentral,
        access.role === 'federal'
      ),
    ])
    const available = results.flatMap((result, index) =>
      result.status === 'fulfilled'
        ? [
            {
              url: urls[index],
              // Bind this endpoint to the registered signer at the same
              // position. An endpoint may only contribute its own bound signer's
              // attestation, so it can't replay another registered signer's
              // public attestation toward quorum.
              expectedSigner:
                supervisorPolicy.indexers[index]?.identity.toLowerCase(),
              result: result.value,
            },
          ]
        : []
    )
    const primary = available[0]
    if (!primary) {
      throw new Error('No registered Shinzo indexer responded')
    }

    const blocks = primary.result.data?.blocks ?? []
    const latest = blocks[0]
    if (!latest || typeof latest.number !== 'number') {
      return NextResponse.json(
        { error: 'Shinzo is connected but has not indexed a block yet' },
        { status: 503 }
      )
    }

    await anchorChainTip(latest.number)

    const txCounts = await transactionCounts(primary.url, prefix, blocks)
    const txIn = (block: ShinzoBlock) =>
      typeof block.number === 'number' ? (txCounts.get(block.number) ?? 0) : 0
    const recentTransactionCount = blocks.reduce(
      (count, block) => count + txIn(block),
      0
    )
    const registered = registeredIndexers()
    const registeredIndexerCount =
      supervisorPolicy.agreement.registeredIndexerCount
    const requiredSignerCount = supervisorPolicy.agreement.requiredSignerCount
    const { agreedSignatures, verified } = resolveQuorum({
      sources: available.map(({ expectedSigner, result }) => ({
        expectedSigner,
        signatures: result.data?.signatures ?? [],
      })),
      latestNumber: latest.number,
      latestHash: latest.hash,
      registered,
      requiredSignerCount,
    })
    const signature = agreedSignatures[0]
    const version = primary.result.data?.latestVersion?.[0]?._version?.[0]
    const observedSignerCount = agreedSignatures.length
    const nativeDenom =
      process.env.BANKD_NATIVE_DENOM ?? DEFAULT_NATIVE_DENOM
    const channelRegions = new Map(
      supervisorPolicy.regions.map((candidate) => [
        candidate.ibcChannelToCentral,
        candidate,
      ])
    )
    const regionExposure = buildRegionExposure({
      channels: chainMetrics.ibc.channels,
      regions: supervisorPolicy.regions,
      role: access.role,
      nativeDenom,
      regionId: region?.id,
    })
    const body = {
      viewId: 'system-overview',
      source: 'shinzo',
      access,
      region: region
        ? {
            ...region,
            singleChainPreview: true,
          }
        : null,
      collectionPrefix: prefix,
      asOfHeight: latest.number,
      recentBlockCount: blocks.length,
      recentTransactionCount,
      latestBlock: {
        height: latest.number,
        hash: latest.hash ?? '',
        timestamp: blockTimestamp(latest.timestamp),
        transactionCount: txIn(latest),
      },
      recentBlocks: blocks.map((block) => ({
        height: block.number ?? 0,
        hash: block.hash ?? '',
        timestamp: blockTimestamp(block.timestamp),
        transactionCount: txIn(block),
      })),
      provenance: {
        documentId: latest._docID ?? '',
        commitCid: version?.cid ?? '',
        merkleRoot: signature?.merkleRoot ?? '',
        signer: signature?.signatureIdentity ?? '',
        signatureType: signature?.signatureType ?? '',
      },
      agreement: {
        policy: supervisorPolicy.agreement.threshold,
        registeredIndexerCount,
        requiredSignerCount,
        observedSignerCount,
        availableIndexerCount: available.length,
        observedSigners: agreedSignatures.map(
          (observed) => observed.signatureIdentity ?? ''
        ),
        verified,
      },
      reserves: {
        nativeSupply: chainMetrics.nativeSupply,
        voucherSupply: chainMetrics.voucherSupply,
        ibcEscrowed: chainMetrics.escrowedNative,
        banks: chainMetrics.banks ?? null,
        reconciliation: chainMetrics.reconciliation ?? null,
      },
      ibc: {
        ...chainMetrics.ibc,
        channels: chainMetrics.ibc.channels.map((channel) => {
          const matched = channelRegions.get(channel.channelId)
          return {
            ...channel,
            regionId: matched?.id ?? null,
            regionLabel: matched?.label ?? null,
          }
        }),
      },
      regionExposure,
      chainAsOfHeight: chainMetrics.asOfHeight,
    }

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'no-store',
        'X-View-Id': body.viewId,
        'X-As-Of-Height': String(body.asOfHeight),
        'X-Chain-As-Of-Height': String(body.chainAsOfHeight),
        'X-Commit-Cid': body.provenance.commitCid,
        'X-Disclosure-Role': access.role,
        'X-Disclosure-Scope': access.scope,
        ...(region ? { 'X-Region-Id': region.id } : {}),
        'X-Indexer-Set': body.agreement.observedSigners.join(','),
        'X-Indexer-Quorum': `${observedSignerCount}/${requiredSignerCount}`,
      },
    })
  } catch (error) {
    console.error('[supervisor] Failed to build system overview:', error)
    return NextResponse.json(
      { error: 'Failed to query Supervisor data sources' },
      { status: 502 }
    )
  }
}
