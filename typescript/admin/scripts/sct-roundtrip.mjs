// SCT persist→reload round-trip diagnostic.
//
// Isolates whether the bug is in the live scan (in-memory tree) or in the
// persist→reload round-trip (saveScanResult/loadStoredTree → WASM load_tree).
//
// Uses the genesis wallet FVK (owns notes) so the Keep/Forget + delete_ranges
// persistence path is exercised. Compares, at the final synced height H:
//   - liveRoot   : the scanning ViewServer's in-memory root
//   - reloadRoot : root after replicating bankd saveScanResult/loadStoredTree
//   - chainAnchor: chain's canonical anchor_by_height(H)
//
// Usage: node scripts/sct-roundtrip.mjs [--max=H] [--flush=N] [--mode=bankd|fixed]
//   --flush=N : flush every N blocks (in addition to note-blocks + tip). default 50
//   --mode    : genesis handling (fixed = 0 only [current app behavior],
//               bankd = 0&1 [reproduces the historical bug])
//
// Env: PENUMBRA_GRPC_URL (default http://localhost:8080),
//      MNEMONIC (default: read from infra/accounts/acc0)

import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WASM_DIR = resolve(__dirname, '../node_modules/@mizufinance/wasm/wasm')
const GRPC = process.env.PENUMBRA_GRPC_URL ?? 'http://localhost:8080'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/)
    return [m[1], m[2] === '' ? true : m[2]]
  }),
)
const MAX = args.max ? Number(args.max) : 2000
const FLUSH_EVERY = args.flush ? Number(args.flush) : 50
const MODE = args.mode || 'fixed'
const MNEMONIC =
  process.env.MNEMONIC ??
  readFileSync(resolve(__dirname, '../../infra/accounts/acc0'), 'utf8').trim()

const glue = await import(resolve(WASM_DIR, 'index.js'))
glue.initSync({ module: readFileSync(resolve(WASM_DIR, 'index_bg.wasm')) })
const { ViewServer, generate_spend_key, get_full_viewing_key } = glue

const { CompactBlockRangeRequest, CompactBlockRangeResponse } = await import(
  '@mizufinance/protobuf/shieldd/core/component/compact_block/v1/compact_block_pb'
)
const { KeyValueRequest, KeyValueResponse } = await import(
  '@mizufinance/protobuf/shieldd/cnidarium/v1/cnidarium_pb'
)
const { MerkleRoot } = await import(
  '@mizufinance/protobuf/shieldd/crypto/tct/v1/tct_pb'
)

function frame(b) {
  const f = new Uint8Array(5 + b.length)
  f[1] = (b.length >>> 24) & 255
  f[2] = (b.length >>> 16) & 255
  f[3] = (b.length >>> 8) & 255
  f[4] = b.length & 255
  f.set(b, 5)
  return f
}
function parse(buf) {
  const d = new Uint8Array(buf)
  const o = []
  let p = 0
  while (p + 5 <= d.length) {
    const fl = d[p]
    const l = (d[p + 1] << 24) | (d[p + 2] << 16) | (d[p + 3] << 8) | d[p + 4]
    p += 5
    if (p + l > d.length) break
    const pl = d.slice(p, p + l)
    p += l
    if ((fl & 0x80) === 0) o.push(pl)
  }
  return o
}
async function grpc(service, method, reqBytes, stream = false) {
  const res = await fetch(`${GRPC}/${service}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web+proto',
      Accept: 'application/grpc-web+proto',
    },
    body: frame(reqBytes),
  })
  const frames = parse(await res.arrayBuffer())
  return stream ? frames : (frames[0] ?? null)
}
async function chainAnchorHex(height) {
  const req = new KeyValueRequest({ key: `sct/tree/anchor_by_height/${height}` })
  const b = await grpc('shieldd.cnidarium.v1.QueryService', 'KeyValue', req.toBinary())
  if (!b) return null
  const resp = KeyValueResponse.fromBinary(b)
  if (!resp.value?.value) return null
  return Buffer.from(MerkleRoot.fromBinary(resp.value.value).inner).toString('hex')
}
async function fetchBlocksRange(start, end) {
  const req = new CompactBlockRangeRequest({
    startHeight: BigInt(start),
    endHeight: BigInt(end),
    keepAlive: false,
  })
  const frames = await grpc(
    'shieldd.core.component.compact_block.v1.QueryService',
    'CompactBlockRange',
    req.toBinary(),
    true,
  )
  return frames.map((f) => CompactBlockRangeResponse.fromBinary(f).compactBlock)
}
async function fetchBlocks(start, end) {
  const BATCH = 10000
  let all = []
  for (let s = start; s <= end; s += BATCH) {
    const e = Math.min(s + BATCH - 1, end)
    const part = await fetchBlocksRange(s, e)
    all = all.concat(part)
    if (part.length === 0) break
    process.stdout.write(`\r[rt] fetched ${all.length} blocks (up to ${e})...`)
  }
  process.stdout.write('\n')
  return all
}

const IDB_TABLES = {
  ephemeralAddresses: 'ephemeralAddresses', assets: 'ASSETS', auctions: 'AUCTIONS',
  auction_outstanding_reserves: 'AUCTION_OUTSTANDING_RESERVES', advice_notes: 'ADVICE_NOTES',
  spendable_notes: 'SPENDABLE_NOTES', swaps: 'SWAPS', fmd_parameters: 'FMD_PARAMETERS',
  app_parameters: 'APP_PARAMETERS', gas_prices: 'GAS_PRICES', epochs: 'EPOCHS', prices: 'PRICES',
  validator_infos: 'VALIDATOR_INFOS', transactions: 'TRANSACTIONS', full_sync_height: 'FULL_SYNC_HEIGHT',
  tree_commitments: 'TREE_COMMITMENTS', tree_hashes: 'TREE_HASHES', tree_last_position: 'TREE_LAST_POSITION',
  tree_last_forgotten: 'TREE_LAST_FORGOTTEN', lqt_historical_votes: 'LQT_HISTORICAL_VOTES',
}
const IDB = { name: 'rt', version: 1, tables: IDB_TABLES }

function rootHex(vs) {
  return Buffer.from(MerkleRoot.fromBinary(vs.get_sct_root()).inner).toString('hex')
}
const encPos = (p) => p.epoch * 65536 * 65536 + p.block * 65536 + p.commitment

// In-memory replica of bankd's IndexedDB SCT stores
class Store {
  constructor() {
    this.hashes = new Map() // `${pos}:${height}` -> StoreHash
    this.commitments = new Map() // commitment.inner(string) -> StoreCommitment
    this.lastPosition = undefined
    this.lastForgotten = undefined
  }
  // mirror saveScanResult()
  apply(sctUpdates) {
    if (sctUpdates.set_position) this.lastPosition = sctUpdates.set_position
    if (sctUpdates.set_forgotten !== undefined && sctUpdates.set_forgotten !== null)
      this.lastForgotten = sctUpdates.set_forgotten
    for (const hash of sctUpdates.store_hashes ?? []) {
      const pos = encPos(hash.position)
      this.hashes.set(`${pos}:${hash.height}`, hash)
    }
    for (const c of sctUpdates.store_commitments ?? []) {
      this.commitments.set(innerKey(c.commitment.inner), c)
    }
    for (const dr of sctUpdates.delete_ranges ?? []) {
      const startPos = encPos(dr.positions.start)
      const endPos = encPos(dr.positions.end)
      for (const key of [...this.hashes.keys()]) {
        const [posStr, heightStr] = key.split(':')
        const position = parseInt(posStr, 10)
        const height = parseInt(heightStr, 10)
        if (position >= startPos && position < endPos && height < dr.below_height) {
          this.hashes.delete(key)
        }
      }
    }
  }
  // mirror loadStoredTree()
  toStoredTree() {
    const hashes = [...this.hashes.values()].sort((a, b) => {
      const pa = encPos(a.position), pb = encPos(b.position)
      if (pa !== pb) return pa - pb
      return a.height - b.height
    })
    return {
      last_position: this.lastPosition ?? { Position: { epoch: 0, block: 0, commitment: 0 } },
      last_forgotten: this.lastForgotten ?? 0n,
      hashes,
      commitments: [...this.commitments.values()],
    }
  }
}
function innerKey(inner) {
  // commitment.inner may be a Uint8Array-like object {0:..} or array
  if (inner instanceof Uint8Array) return Buffer.from(inner).toString('hex')
  if (Array.isArray(inner)) return Buffer.from(inner).toString('hex')
  return Buffer.from(Object.values(inner)).toString('hex')
}

async function scanInto(vs, blocks, onFlush) {
  let lastFlush = -1
  for (const block of blocks) {
    const h = Number(block.height)
    const isGenesis = MODE === 'bankd' ? h === 0 || h === 1 : h === 0
    const by = block.toBinary()
    let wantsFlush
    if (isGenesis) {
      await vs.scan_genesis_chunk(0n, by, false)
      wantsFlush = await vs.genesis_advice(by)
    } else {
      wantsFlush = await vs.scan_block(by, false)
    }
    const atTip = h === Number(blocks[blocks.length - 1].height)
    if (wantsFlush || h - lastFlush >= FLUSH_EVERY || atTip) {
      const f = vs.flush_updates()
      onFlush?.(h, f.sct_updates, wantsFlush)
      lastFlush = h
    }
  }
}

async function main() {
  console.log(`[rt] mode=${MODE} max=${MAX} flushEvery=${FLUSH_EVERY}`)
  const fvk = get_full_viewing_key(generate_spend_key(MNEMONIC))

  console.log(`[rt] fetching blocks 0..${MAX}...`)
  const blocks = await fetchBlocks(0, MAX)
  const H = Number(blocks[blocks.length - 1].height)
  console.log(`[rt] got ${blocks.length} blocks, last height ${H}`)

  // --- pass 1: live scan with incremental flush+save (bankd replica) ---
  const store = new Store()
  const vsLive = await ViewServer.new(fvk, { last_position: null, last_forgotten: null, hashes: [], commitments: [] }, IDB)
  let flushCount = 0
  let noteFlushes = []
  await scanInto(vsLive, blocks, (h, upd, wants) => {
    store.apply(upd)
    flushCount++
    if (wants) noteFlushes.push(h)
  })
  const liveRoot = rootHex(vsLive)
  console.log(`[rt] flushes=${flushCount} note-flush heights=${noteFlushes.join(',') || '(none)'}`)
  console.log(`[rt] store: hashes=${store.hashes.size} commitments=${store.commitments.size} lastForgotten=${store.lastForgotten}`)

  // --- reload from incremental store ---
  const storedIncr = store.toStoredTree()
  const vsReloadIncr = await ViewServer.new(fvk, storedIncr, IDB)
  const reloadIncrRoot = rootHex(vsReloadIncr)

  // --- pass 2: single full flush (position 0) → store → reload ---
  const store2 = new Store()
  const vsLive2 = await ViewServer.new(fvk, { last_position: null, last_forgotten: null, hashes: [], commitments: [] }, IDB)
  // scan with NO intermediate flush, then one flush at end
  for (const block of blocks) {
    const h = Number(block.height)
    const isGenesis = MODE === 'bankd' ? h === 0 || h === 1 : h === 0
    const by = block.toBinary()
    if (isGenesis) { await vsLive2.scan_genesis_chunk(0n, by, false); await vsLive2.genesis_advice(by) }
    else await vsLive2.scan_block(by, false)
  }
  const live2Root = rootHex(vsLive2)
  store2.apply(vsLive2.flush_updates().sct_updates)
  const storedSingle = store2.toStoredTree()
  const vsReloadSingle = await ViewServer.new(fvk, storedSingle, IDB)
  const reloadSingleRoot = rootHex(vsReloadSingle)
  console.log(`[rt] single-flush store: hashes=${store2.hashes.size} commitments=${store2.commitments.size}`)

  const chain = await chainAnchorHex(H)

  console.log('\n=== RESULTS at height', H, '===')
  console.log('chain anchor      :', chain)
  console.log('live root (incr)  :', liveRoot, liveRoot === chain ? '✅' : '❌')
  console.log('live root (single):', live2Root, live2Root === chain ? '✅' : '❌')
  console.log('reload (incr)     :', reloadIncrRoot, reloadIncrRoot === chain ? '✅' : '❌')
  console.log('reload (single)   :', reloadSingleRoot, reloadSingleRoot === chain ? '✅' : '❌')

  // diff stores if incr reload diverges but single matches
  if (reloadIncrRoot !== chain && reloadSingleRoot === chain) {
    console.log('\n[rt] => INCREMENTAL persistence is the bug. Diffing stores:')
    const incrKeys = new Set(store.hashes.keys())
    const singleKeys = new Set(store2.hashes.keys())
    const extra = [...incrKeys].filter((k) => !singleKeys.has(k))
    const missing = [...singleKeys].filter((k) => !incrKeys.has(k))
    console.log(`   hashes only-in-incremental (stale, ${extra.length}):`, extra.slice(0, 20).join(' '))
    console.log(`   hashes only-in-single (missing, ${missing.length}):`, missing.slice(0, 20).join(' '))
    const ic = new Set(store.commitments.keys()), sc = new Set(store2.commitments.keys())
    console.log(`   commitments incr=${ic.size} single=${sc.size} extra-in-incr:`, [...ic].filter(k=>!sc.has(k)).length, 'missing:', [...sc].filter(k=>!ic.has(k)).length)
  }
}
main().then(() => process.exit(0), (e) => { console.error('[rt] FATAL', e); process.exit(1) })
