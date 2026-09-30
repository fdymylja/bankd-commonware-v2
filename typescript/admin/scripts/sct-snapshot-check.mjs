// Checks whether the admin's snapshot chunks reproduce the chain's canonical
// compact blocks. If the snapshot generator is lossy, the SCT built from
// snapshot blocks will diverge from the chain anchor even though a grpc-sourced
// scan matches.
//
// 1) byte-compares snapshot block vs chain block at each height
// 2) scans snapshot blocks through the WASM (bankd genesis logic) and compares
//    the resulting SCT root to the chain anchor at the snapshot's end heights.

// Usage: node scripts/sct-snapshot-check.mjs [--max=H]
// Env: PENUMBRA_GRPC_URL (default http://localhost:8080),
//      ADMIN_URL (default http://localhost:34562),
//      MNEMONIC (default: read from infra/accounts/acc0)

import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WASM_DIR = resolve(__dirname, '../node_modules/@mizufinance/wasm/wasm')
const GRPC = process.env.PENUMBRA_GRPC_URL ?? 'http://localhost:8080'
const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:34562'
const MNEMONIC =
  process.env.MNEMONIC ??
  readFileSync(resolve(__dirname, '../../infra/accounts/acc0'), 'utf8').trim()

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return [m[1], m[2] === '' ? true : m[2]] }))
const MAX = args.max ? Number(args.max) : 10000

const glue = await import(resolve(WASM_DIR, 'index.js'))
glue.initSync({ module: readFileSync(resolve(WASM_DIR, 'index_bg.wasm')) })
const { ViewServer, generate_spend_key, get_full_viewing_key } = glue
const { CompactBlock, CompactBlockRangeRequest, CompactBlockRangeResponse } = await import('@mizufinance/protobuf/shieldd/core/component/compact_block/v1/compact_block_pb')
const { KeyValueRequest, KeyValueResponse } = await import('@mizufinance/protobuf/shieldd/cnidarium/v1/cnidarium_pb')
const { MerkleRoot } = await import('@mizufinance/protobuf/shieldd/crypto/tct/v1/tct_pb')

function frame(b){const f=new Uint8Array(5+b.length);f[1]=(b.length>>>24)&255;f[2]=(b.length>>>16)&255;f[3]=(b.length>>>8)&255;f[4]=b.length&255;f.set(b,5);return f}
function parse(buf){const d=new Uint8Array(buf);const o=[];let p=0;while(p+5<=d.length){const fl=d[p];const l=(d[p+1]<<24)|(d[p+2]<<16)|(d[p+3]<<8)|d[p+4];p+=5;if(p+l>d.length)break;const pl=d.slice(p,p+l);p+=l;if((fl&0x80)===0)o.push(pl)}return o}
async function grpc(s,m,b,stream=false){const r=await fetch(`${GRPC}/${s}/${m}`,{method:'POST',headers:{'Content-Type':'application/grpc-web+proto',Accept:'application/grpc-web+proto'},body:frame(b)});const fr=parse(await r.arrayBuffer());return stream?fr:(fr[0]??null)}
async function chainAnchorHex(h){const req=new KeyValueRequest({key:`sct/tree/anchor_by_height/${h}`});const b=await grpc('shieldd.cnidarium.v1.QueryService','KeyValue',req.toBinary());if(!b)return null;const r=KeyValueResponse.fromBinary(b);if(!r.value?.value)return null;return Buffer.from(MerkleRoot.fromBinary(r.value.value).inner).toString('hex')}
async function chainBlocks(s,e){const req=new CompactBlockRangeRequest({startHeight:BigInt(s),endHeight:BigInt(e),keepAlive:false});const fr=await grpc('shieldd.core.component.compact_block.v1.QueryService','CompactBlockRange',req.toBinary(),true);return fr.map(f=>CompactBlockRangeResponse.fromBinary(f).compactBlock)}

// --- snapshot chunk fetching (mirror snapshot-sync.ts parseChunk) ---
async function snapshotManifest(){const r=await fetch(`${ADMIN}/api/penumbra/snapshot/manifest`,{cache:'no-cache'});return r.json()}
async function* parseChunk(file){
  const r=await fetch(`${ADMIN}/api/penumbra/snapshot/${file}`)
  if(!r.ok)throw new Error(`chunk ${file} ${r.status}`)
  const data=new Uint8Array(await r.arrayBuffer())
  let off=0
  while(off+4<=data.length){
    const len=(data[off]<<24)|(data[off+1]<<16)|(data[off+2]<<8)|data[off+3]; off+=4
    if(len===0||off+len>data.length)break
    yield CompactBlock.fromBinary(data.slice(off,off+len)); off+=len
  }
}
async function snapshotBlocks(max){
  const man=await snapshotManifest()
  const out=[]
  for(const ch of man.chunks){
    if(ch.startHeight>max)break
    for await(const b of parseChunk(ch.file)){ if(Number(b.height)<=max) out.push(b) }
  }
  return {blocks:out, manifest:man}
}

const IDB_TABLES={ephemeralAddresses:'ephemeralAddresses',assets:'ASSETS',auctions:'AUCTIONS',auction_outstanding_reserves:'AUCTION_OUTSTANDING_RESERVES',advice_notes:'ADVICE_NOTES',spendable_notes:'SPENDABLE_NOTES',swaps:'SWAPS',fmd_parameters:'FMD_PARAMETERS',app_parameters:'APP_PARAMETERS',gas_prices:'GAS_PRICES',epochs:'EPOCHS',prices:'PRICES',validator_infos:'VALIDATOR_INFOS',transactions:'TRANSACTIONS',full_sync_height:'FULL_SYNC_HEIGHT',tree_commitments:'TREE_COMMITMENTS',tree_hashes:'TREE_HASHES',tree_last_position:'TREE_LAST_POSITION',tree_last_forgotten:'TREE_LAST_FORGOTTEN',lqt_historical_votes:'LQT_HISTORICAL_VOTES'}
const IDB={name:'snap',version:1,tables:IDB_TABLES}
const rootHex=(vs)=>Buffer.from(MerkleRoot.fromBinary(vs.get_sct_root()).inner).toString('hex')
const hex=(u)=>Buffer.from(u).toString('hex')

async function main(){
  const fvk=get_full_viewing_key(generate_spend_key(MNEMONIC))

  console.log('[snap] fetching chain + snapshot blocks...')
  const [chain, snap] = await Promise.all([chainBlocks(0,MAX), snapshotBlocks(MAX)])
  console.log(`[snap] chain blocks=${chain.length} snapshot blocks=${snap.blocks.length} manifest.latestHeight=${snap.manifest.latestHeight}`)

  // index by height
  const chainByH=new Map(chain.map(b=>[Number(b.height),b]))
  const snapByH=new Map(snap.blocks.map(b=>[Number(b.height),b]))

  // 1) byte comparison — only over heights the chunks actually cover
  // (manifest.latestHeight tracks the chain tip, which runs ahead of the
  // last generated chunk; those heights are not "missing").
  let mism=0, firstMism=null, missing=0
  const chunks=snap.manifest.chunks??[]
  const lastChunkEnd=chunks.length?chunks[chunks.length-1].endHeight:-1
  const maxH=Math.min(MAX, lastChunkEnd)
  for(let h=0;h<=maxH;h++){
    const c=chainByH.get(h), s=snapByH.get(h)
    if(!s){ missing++; if(missing<=5) console.log(`[snap] height ${h} MISSING from snapshot`); continue }
    if(!c){ continue }
    const cb=hex(c.toBinary()), sb=hex(s.toBinary())
    if(cb!==sb){ mism++; if(firstMism===null){firstMism=h; console.log(`[snap] FIRST BYTE MISMATCH at height ${h}`); console.log(`   chain epochRoot=${!!c.epochRoot} payloads=${c.statePayloads.length} nullifiers=${c.nullifiers.length} bytes=${c.toBinary().length}`); console.log(`   snap  epochRoot=${!!s.epochRoot} payloads=${s.statePayloads.length} nullifiers=${s.nullifiers.length} bytes=${s.toBinary().length}`)} }
  }
  console.log(`[snap] byte compare: ${mism} mismatches, ${missing} missing, over 0..${maxH}`)

  // 2) scan snapshot blocks -> root, compare to chain anchor at end
  const vs=await ViewServer.new(fvk,{last_position:null,last_forgotten:null,hashes:[],commitments:[]},IDB)
  const sorted=[...snapByH.keys()].sort((a,b)=>a-b)
  let lastH=-1, broken=null
  for(const h of sorted){
    if(h!==lastH+1){ console.log(`[snap] GAP: jump from ${lastH} to ${h}`) }
    lastH=h
    const b=snapByH.get(h); const by=b.toBinary()
    // Only height 0 is genesis (matches the fixed app behavior).
    if(h===0){ await vs.scan_genesis_chunk(0n,by,false); await vs.genesis_advice(by) }
    else await vs.scan_block(by,false)
  }
  const snapRoot=rootHex(vs)
  const anchor=await chainAnchorHex(lastH)
  console.log(`\n=== snapshot-sourced SCT at height ${lastH} ===`)
  console.log('chain anchor :', anchor)
  console.log('snap root    :', snapRoot, snapRoot===anchor?'✅ MATCH':'❌ DIVERGE')
}
main().then(()=>process.exit(0),(e)=>{console.error('[snap] FATAL',e);process.exit(1)})
