import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { ComplianceLeaf, AssetPolicy, MsgRegisterAsset, MsgRegisterUser } from '@mizufinance/protobuf/shieldd/core/component/compliance/v1/compliance_pb'

const wrapper = import.meta.resolve('@mizufinance/wasm/compliance')
const nativeUrl = new URL('../wasm/index.js', wrapper)
const native = await import(nativeUrl.href)
await native.default({ module_or_path: await readFile(new URL('index_bg.wasm', nativeUrl)) })

test('packaged SDK rejects registrations without issued grants and certificates', () => {
  const now = BigInt(Math.floor(Date.now() / 1000))
  assert.throws(() => native.validateAssetRegistration(new MsgRegisterAsset().toBinary(), 'chain', now))
  assert.throws(() => native.validateUserRegistration(new MsgRegisterUser().toBinary(), new AssetPolicy().toBinary(), 'chain', now))
})


test('packaged SDK provenance and schemas match embedded Shieldd', async () => {
  const provenance = JSON.parse(await readFile(new URL('../build-provenance.json', nativeUrl)))
  const revision = execFileSync('git', ['-C', new URL('../../../shieldd', import.meta.url).pathname, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  assert.equal(provenance.shielddRevision, revision)
  assert.equal(provenance.buildProfile, 'development')
  assert.equal(provenance.wasmSha256, createHash('sha256').update(await readFile(new URL('index_bg.wasm', nativeUrl))).digest('hex'))
  assert.equal(ComplianceLeaf.fields.find(9), undefined)
  assert.equal('auditKeys' in new ComplianceLeaf(), false)
})


test('mobile and admin ship identical WASM and provenance', async () => {
  const mobileRequire = createRequire(new URL('../../mobile/penumbra-bridge-build/package.json', import.meta.url))
  const mobileModule = new URL(`file://${mobileRequire.resolve('@mizufinance/embedded-shieldd-wasm/build')}`)
  const mobileRoot = new URL('../', mobileModule)
  assert.deepEqual(await readFile(new URL('wasm/index_bg.wasm', mobileRoot)), await readFile(new URL('index_bg.wasm', nativeUrl)))
  assert.deepEqual(JSON.parse(await readFile(new URL('build-provenance.json', mobileRoot))), JSON.parse(await readFile(new URL('../build-provenance.json', nativeUrl))))
})

test('the supported address-index boundaries and disclosure exports are present in shipped WASM', () => {
  const spend = native.generate_spend_key('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
  const fvk = native.get_full_viewing_key(spend)
  for (const index of [0, 0xffffffff]) {
    assert.ok(native.get_address_by_index(fvk, index, new Uint8Array(12)).length > 0)
  }
  assert.equal(typeof native.prepare_orbis_packages, 'function')
  assert.equal(typeof native.disclosure_prepare, 'function')
  assert.equal(typeof native.disclosure_export, 'function')
  assert.equal(typeof native.disclosure_confirm_acceptance, 'function')
  assert.throws(() => native.disclosure_export('{}', 'openings'))
})

// Public transaction captured by run 35159768277 from a disposable Bankd chain.
// This checks package cryptography and bindings; live acceptance is tested separately.
test('shipped WASM exports and verifies both formats for a real regulated transaction', async () => {
  const input = JSON.parse(await readFile(new URL('./fixtures/accepted-disclosure.json', import.meta.url)))
  const mnemonic = 'comfort ten front cycle churn burger oak absent rice ice urge result art couple benefit cabbage frequent obscure hurry trick segment cool job debate'
  const fvk = native.get_full_viewing_key(native.generate_spend_key(mnemonic))
  for (const method of ['openings', 'payload-keys']) {
    input.request.outputs[0].memo = method === 'payload-keys'
    const witness = native.disclosure_prepare(JSON.stringify(input.request), JSON.stringify([input.transaction]), fvk)
    const packageJson = native.disclosure_export(witness, method)
    native.disclosure_verify(packageJson)
    const height = input.request.outputs[0].reference.height
    const blocks = JSON.stringify([{ height, transactions: [input.transaction] }])
    const result = JSON.parse(native.disclosure_confirm_acceptance(packageJson, input.request.chain_id, blocks))
    assert.equal(result.cryptography_verified, true)
    assert.deepEqual(result.acceptance.Confirmed, { chain_id: input.request.chain_id, heights: [height] })
    assert.throws(() => native.disclosure_confirm_acceptance(packageJson, 'wrong-chain', blocks))
  }
})
