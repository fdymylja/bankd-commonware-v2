import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAddress } from 'viem'

// Account transaction history, read from the Shinzo indexer's DefraDB.
//
// Three tabs, one route:
//   evm     -> `${prefix}__Transaction`  (indexed EVM txs, from/to an address)
//   cosmos  -> `CosmosTx`                (feeder-managed public cosmos index)
//   private -> `ShielddMutationTx`       (feeder-managed private mutations, by height)
//
// All env access and GraphQL interpolation happen here (server-side). Inputs are
// strictly validated before they ever reach a query string. Every tab is a single
// GraphQL POST: evm reads the block time through the Transaction->Block relation,
// cosmos reads a timestamp the feeder denormalized onto each CosmosTx row, and
// private batches the row + block-timestamp queries since its heights are known up
// front.

export const dynamic = 'force-dynamic'

const DEFAULT_URLS = [
  'http://localhost:9181/api/v0/graphql',
  'http://localhost:9183/api/v0/graphql',
  'http://localhost:9184/api/v0/graphql',
]
const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const BECH32_ADDRESS = /^wallet1[02-9ac-hj-np-z]{38,58}$/
const PAGE_SIZE = 25
const MAX_HEIGHTS = 50

type Tab = 'evm' | 'cosmos' | 'private'

type Row = {
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

class IndexerError extends Error {}

/**
 * The indexer answered, but the queried collection isn't in its schema - e.g. the
 * CosmosTx feeder never ran in this environment. That's "not indexed here", not
 * "unreachable", so callers can degrade to an empty result instead of erroring.
 */
class CollectionMissingError extends Error {}

function collectionPrefix(): string {
  const value = process.env.SHINZO_COLLECTION_PREFIX ?? 'Bankd__Brazil'
  if (!PREFIX_PATTERN.test(value)) throw new Error('Invalid collection prefix')
  return value
}

function endpoints(): string[] {
  const configured = (process.env.SHINZO_GRAPHQL_URLS ?? process.env.SHINZO_GRAPHQL_URL)
    ?.split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return configured?.length ? configured : DEFAULT_URLS
}

// postGraphql tries each configured endpoint in order and returns the data from
// the first that answers without transport or GraphQL errors. Each tab issues one
// query, so there is no need to pin follow-up POSTs to the same endpoint.
async function postGraphql(query: string): Promise<Record<string, unknown>> {
  let lastErr: unknown
  for (const url of endpoints()) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new IndexerError(`indexer ${res.status}`)
      const body = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown[] }
      if (body.errors?.length) {
        const msg = body.errors
          .map((e) => (e as { message?: string })?.message ?? '')
          .join('; ')
        // A missing collection is a schema error, identical on every endpoint -
        // don't retry the others, surface it distinctly.
        if (/cannot query field|unknown field|no such type/i.test(msg)) {
          throw new CollectionMissingError(msg)
        }
        throw new IndexerError('indexer query error')
      }
      if (!body.data) throw new IndexerError('indexer query error')
      return body.data
    } catch (err) {
      // Not a transport failure - trying other endpoints won't help.
      if (err instanceof CollectionMissingError) throw err
      lastErr = err
    }
  }
  throw new IndexerError(`no reachable indexer: ${String(lastErr)}`)
}

function parseTab(v: string | null): Tab {
  return v === 'cosmos' || v === 'private' ? v : 'evm'
}

function parsePage(v: string | null): number {
  const n = Number(v)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

function parseHeights(v: string | null): number[] {
  if (!v) return []
  const parts = v.split(',').map((x) => x.trim()).filter(Boolean)
  const out: number[] = []
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error('invalid height')
    out.push(n)
  }
  if (out.length > MAX_HEIGHTS) throw new Error('too many heights')
  return out
}

function toHeight(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isSafeInteger(n) ? n : 0
}

function toTimestamp(v: unknown): string | number | null {
  return typeof v === 'string' || typeof v === 'number' ? v : null
}

async function evmRows(prefix: string, address: string, page: number): Promise<{ rows: Row[]; hasMore: boolean }> {
  const offset = (page - 1) * PAGE_SIZE
  // Shinzo indexes addresses in EIP-55 checksummed form, so match both casings.
  const forms = [...new Set([address, getAddress(address)])].map((a) => `"${a}"`).join(', ')
  // The block time rides along on the Transaction->Block relation, so the page and
  // its timestamps come back in this one POST.
  const query = `query { txs: ${prefix}__Transaction(filter: {_or: [{from: {_in: [${forms}]}}, {to: {_in: [${forms}]}}]}, order: {blockNumber: DESC}, limit: ${PAGE_SIZE + 1}, offset: ${offset}) { hash from to status blockNumber block { timestamp } } }`
  const data = await postGraphql(query)
  const raw = (data.txs as Array<Record<string, unknown>>) ?? []
  const hasMore = raw.length > PAGE_SIZE
  const rows: Row[] = raw.slice(0, PAGE_SIZE).map((t) => ({
    hash: typeof t.hash === 'string' ? t.hash : undefined,
    from: typeof t.from === 'string' ? t.from : undefined,
    to: typeof t.to === 'string' ? t.to : undefined,
    status: t.status === true,
    height: toHeight(t.blockNumber),
    timestamp: toTimestamp((t.block as { timestamp?: unknown } | null)?.timestamp),
  }))
  return { rows, hasMore }
}

async function cosmosRows(bech32: string, page: number): Promise<{ rows: Row[]; hasMore: boolean }> {
  const offset = (page - 1) * PAGE_SIZE
  // timestamp is denormalized onto CosmosTx by the feeder, so one POST is enough.
  const query = `query { txs: CosmosTx(filter: {addresses: {_like: "%${bech32}%"}}, order: {height: DESC}, limit: ${PAGE_SIZE + 1}, offset: ${offset}) { hash height code msg_types timestamp } }`
  const data = await postGraphql(query)
  const raw = (data.txs as Array<Record<string, unknown>>) ?? []
  const hasMore = raw.length > PAGE_SIZE
  const rows: Row[] = raw.slice(0, PAGE_SIZE).map((t) => ({
    hash: typeof t.hash === 'string' ? t.hash : undefined,
    height: toHeight(t.height),
    code: typeof t.code === 'number' ? t.code : 0,
    msg_types: typeof t.msg_types === 'string' ? t.msg_types : '',
    timestamp: toTimestamp(t.timestamp),
  }))
  return { rows, hasMore }
}

// privateRows fetches the ShielddMutationTx rows at a page's heights (known up
// front from the client's local activity scan) and their block timestamps in one
// POST. Pagination is done client-side over the heights list, so hasMore is not
// meaningful here and is left false.
//
// HACK(penumbra-migration): the wallet wasm can't scan fork-format notes yet, so
// the client has no way to learn its own heights. With no heights param we serve
// the chain-wide ShielddMutationTx list, newest first, so private activity still
// flows end to end. Remove once the fork-native wallet migration lands.
async function privateRows(prefix: string, heights: number[], page: number): Promise<{ rows: Row[]; hasMore: boolean }> {
  if (heights.length === 0) {
    const offset = (page - 1) * PAGE_SIZE
    const listQuery = `query { txs: ShielddMutationTx(order: [{height: DESC}, {tx_index: ASC}], limit: ${PAGE_SIZE + 1}, offset: ${offset}) { height tx_index tx_bytes code } }`
    const listData = await postGraphql(listQuery)
    const raw = (listData.txs as Array<Record<string, unknown>>) ?? []
    const hasMore = raw.length > PAGE_SIZE
    const pageRows = raw.slice(0, PAGE_SIZE)
    const pageHeights = [...new Set(pageRows.map((t) => toHeight(t.height)))].filter((h) => h > 0)
    const ts = new Map<number, string | number | null>()
    if (pageHeights.length > 0) {
      const blockData = await postGraphql(
        `query { blocks: ${prefix}__Block(filter: {number: {_in: [${pageHeights.join(',')}]}}) { number timestamp } }`
      )
      for (const b of (blockData.blocks as Array<{ number?: unknown; timestamp?: unknown }>) ?? []) {
        ts.set(toHeight(b.number), (b.timestamp as string | number | null) ?? null)
      }
    }
    const rows: Row[] = pageRows.map((t) => ({
      height: toHeight(t.height),
      tx_index: typeof t.tx_index === 'number' ? t.tx_index : 0,
      tx_bytes: typeof t.tx_bytes === 'string' ? t.tx_bytes : '',
      code: typeof t.code === 'number' ? t.code : null,
      timestamp: ts.get(toHeight(t.height)) ?? null,
    }))
    return { rows, hasMore }
  }
  const inList = [...new Set(heights)].join(',')
  const query = `query { txs: ShielddMutationTx(filter: {height: {_in: [${inList}]}}, order: [{height: DESC}, {tx_index: ASC}]) { height tx_index tx_bytes code } blocks: ${prefix}__Block(filter: {number: {_in: [${inList}]}}) { number timestamp } }`
  const data = await postGraphql(query)
  const ts = new Map<number, string | number | null>()
  for (const b of (data.blocks as Array<{ number?: unknown; timestamp?: unknown }>) ?? []) {
    ts.set(toHeight(b.number), (b.timestamp as string | number | null) ?? null)
  }
  const rows: Row[] = ((data.txs as Array<Record<string, unknown>>) ?? []).map((t) => ({
    height: toHeight(t.height),
    tx_index: typeof t.tx_index === 'number' ? t.tx_index : 0,
    tx_bytes: typeof t.tx_bytes === 'string' ? t.tx_bytes : '',
    code: typeof t.code === 'number' ? t.code : null,
    timestamp: ts.get(toHeight(t.height)) ?? null,
  }))
  return { rows, hasMore: false }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const tab = parseTab(params.get('tab'))
  const page = parsePage(params.get('page'))

  let prefix: string
  try {
    prefix = collectionPrefix()
  } catch {
    return NextResponse.json({ error: 'Invalid collection prefix' }, { status: 500 })
  }

  try {
    let result: { rows: Row[]; hasMore: boolean }
    if (tab === 'evm') {
      const address = (params.get('address') ?? '').toLowerCase()
      if (!HEX_ADDRESS.test(address)) {
        return NextResponse.json({ error: 'Invalid hex address' }, { status: 400 })
      }
      result = await evmRows(prefix, address, page)
    } else if (tab === 'cosmos') {
      const address = params.get('address') ?? ''
      if (!BECH32_ADDRESS.test(address)) {
        return NextResponse.json({ error: 'Invalid bech32 address' }, { status: 400 })
      }
      result = await cosmosRows(address, page)
    } else {
      let heights: number[]
      try {
        heights = parseHeights(params.get('heights'))
      } catch {
        return NextResponse.json({ error: 'Invalid heights' }, { status: 400 })
      }
      result = await privateRows(prefix, heights, page)
    }

    return NextResponse.json({
      tab,
      page,
      pageSize: PAGE_SIZE,
      hasMore: result.hasMore,
      rows: result.rows,
    })
  } catch (err) {
    // Collection isn't indexed in this environment (e.g. the CosmosTx /
    // ShielddMutationTx feeder never ran) - show that tab as empty rather than
    // erroring the whole page. Applies to any tab uniformly.
    if (err instanceof CollectionMissingError) {
      return NextResponse.json({
        tab,
        page,
        pageSize: PAGE_SIZE,
        hasMore: false,
        rows: [],
      })
    }
    if (err instanceof IndexerError) {
      return NextResponse.json({ error: 'Indexer unreachable' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 })
  }
}
