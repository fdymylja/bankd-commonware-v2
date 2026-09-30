import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../../../admin/package.json', import.meta.url))
const wrapper = new URL(`file://${require.resolve('@mizufinance/wasm/compliance')}`)
const nativeUrl = new URL('../wasm/index.js', wrapper)
const native = await import(nativeUrl.href)
await native.default({ module_or_path: await readFile(new URL('index_bg.wasm', nativeUrl)) })

test('shipped WASM is built from the monorepo pinned Shieldd revision', async () => {
  const provenance = JSON.parse(await readFile(new URL('../build-provenance.json', nativeUrl)))
  const root = new URL('../../../../', import.meta.url).pathname
  const revision = execFileSync('git', ['-C', `${root}/shieldd`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  assert.equal(provenance.shielddRevision, revision)
  assert.equal(provenance.wasmSha256, createHash('sha256').update(await readFile(new URL('index_bg.wasm', nativeUrl))).digest('hex'))
  assert.equal(provenance.buildProfile, 'development')
})

test('base key derivation and proof construction exports work', () => {
  const spend = native.generate_spend_key('test test test test test test test test test test test junk')
  const fvk = native.get_full_viewing_key(spend)
  assert.ok(native.get_address_by_index(fvk, 0, new Uint8Array(12)).length > 0)
  for (const method of ['build_action_with_proof_result', 'build_action_proof_request', 'authorize', 'witness']) assert.equal(typeof native[method], 'function', method)
  assert.throws(() => native.validateAssetRegistration(new Uint8Array(), 'bankd-9001', 0n))
})
