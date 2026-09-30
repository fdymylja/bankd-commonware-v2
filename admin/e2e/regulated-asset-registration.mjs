// Real browser registration and regulated self-transfer. Supply public grants from
// Shieldd's offline registration_fixture example; never mint committee keys in the browser.
import assert from 'node:assert/strict'
import { commitShieldd } from './transactions.mjs'
import { waitForSelfTransferNotes } from './wallet-state.mjs'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { MsgRegisterAsset } from '@mizufinance/protobuf/shieldd/core/component/compliance/v1/compliance_pb'
import { noteSnapshot } from '../../tests/e2e/browser-diagnostics.mjs'
import { fundedOption } from '../../tests/e2e/funding.mjs'
import { launchBrowser, importWallet, gotoAssetsAndWaitForSync, log, PASSWORD } from './lib.mjs'

assert.ok(process.env.REGISTRATION_FIXTURE, 'Set REGISTRATION_FIXTURE to public signed fixture JSON')
const fixture = JSON.parse(await readFile(process.env.REGISTRATION_FIXTURE, 'utf8'))
assert.equal(fixture.synthetic_committee, true, 'Only disposable synthetic fixtures are supported')
const rpc = process.env.NEXT_PUBLIC_PENUMBRA_RPC_URL ?? 'http://127.0.0.1:27657'
const status = await fetch(`${rpc}/status`).then(r => r.json())
assert.equal(status.result?.node_info?.network, fixture.chain_id, 'Fixture belongs to another chain')

const wrapper = import.meta.resolve('@mizufinance/wasm/compliance')
const wasmUrl = new URL('../wasm/index.js', wrapper)
const wasm = await import(wasmUrl.href)
await wasm.default({ module_or_path: await readFile(new URL('index_bg.wasm', wasmUrl)) })
const asset = MsgRegisterAsset.fromJson(fixture.asset)
const now = BigInt(Math.floor(Date.now() / 1000))
wasm.validateAssetRegistration(asset.toBinary(), fixture.chain_id, now)
assert.throws(() => wasm.validateAssetRegistration(asset.toBinary(), `${fixture.chain_id}-wrong`, now))
const unsigned = asset.clone()
unsigned.assetRegistrationGrant = undefined
assert.throws(() => wasm.validateAssetRegistration(unsigned.toBinary(), fixture.chain_id, now))
const mismatch = asset.clone()
mismatch.dailyVolumeLimit[0] ^= 1
assert.throws(() => wasm.validateAssetRegistration(mismatch.toBinary(), fixture.chain_id, now))

const browser = await launchBrowser()
const page = await browser.newPage()
const logs = []
page.on('console', message => { logs.push(message.text()); log(message.text()) })
page.on('pageerror', error => log(error.message))


try {
  await importWallet(page)
  await gotoAssetsAndWaitForSync(page, logs, 600_000)
  // The signed JSON is authoritative; no old DK/ring configuration fields are filled.
  assert.equal(await page.getByLabel('DK public key hex').count(), 0)
  await page.getByLabel('Base denom', { exact: true }).fill(fixture.denom)
  await page.getByLabel('Issued asset registration (JSON)').fill(JSON.stringify(fixture.asset))
  const registeredAsset = await commitShieldd(page, page.getByRole('button', { name: 'Register regulated asset', exact: true }), 'complianceRegisterAsset')
  await page.getByLabel('Issued user registration (JSON)').fill(JSON.stringify(fixture.user))
  await page.getByLabel('User address index').fill('0')
  const registeredUser = await commitShieldd(page, page.getByRole('button', { name: 'Register this wallet for regulated asset', exact: true }), 'complianceRegisterUser')
  // Regulated policy and user registration must precede the asset's first issuance.
  execFileSync('pnpm', ['--dir', 'mobile', 'exec', 'tsx', 'e2e/embedded-shieldd-deposit.ts'], {
    cwd: resolve(import.meta.dirname, '../..'),
    env: { ...process.env, MOBILE_E2E_SHIELDD_RECIPIENT: fixture.address, MOBILE_E2E_DEPOSIT_DENOM: fixture.denom },
    stdio: 'inherit', timeout: 60_000,
  })
  await page.click('a[href="/transfers"]')
  const amount = process.env.AMOUNT ?? '0.001'
  let funded
  const deadline = Date.now() + 180_000
  while (!funded && Date.now() < deadline) {
    const candidates = await page.locator('select optgroup[label*="Private"] option').evaluateAll(elements => elements.map(option => ({
      value: option.value, assetId: option.dataset.assetId, denom: option.dataset.denom, balance: option.dataset.spendable ?? '0', decimals: option.dataset.decimals,
    })))
    funded = fundedOption(candidates, amount, { assetId: process.env.E2E_FEE_ASSET_ID ?? '', budget: process.env.E2E_FEE_BUDGET ?? '0' }, option => option.denom === fixture.denom)
    if (!funded) await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(funded, 'Registered asset must have enough private funds')
  await page.locator('select').first().selectOption(funded.value)
  await page.fill('input[placeholder="0.00"]', amount)
  await page.fill('input[placeholder*="shieldd1"]', fixture.address)
  const transferInputs = JSON.parse(await noteSnapshot(page, 'native-wallet'))
  const transfer = await commitShieldd(page, page.getByRole('button', { name: 'Private Send', exact: true }), 'transfer')
  if (process.env.DISCLOSURE_OUTPUT_DIRECTORY) {
    const directory = process.env.DISCLOSURE_OUTPUT_DIRECTORY
    const selection = { transactionId: transfer.transactionId, height: transfer.height, action: transfer.actionIndex, output: 0 }
    const request = { version: 1, chain_id: fixture.chain_id, recipient: null, challenge: null, total: null,
      outputs: [{ reference: { transaction_id: selection.transactionId, height: Number(selection.height), action: { Body: selection.action }, output: 0 },
        amount: true, asset: true, recipient: true, predicate: null, memo: false, spending_control: false }] }
    await writeFile(resolve(directory, 'accepted.json'), JSON.stringify({ request, transaction: transfer.transaction }))
    await writeFile(resolve(directory, 'selection.json'), JSON.stringify(selection))
    // Wait for the just-accepted transfer to be scanned before comparing note state.
    await gotoAssetsAndWaitForSync(page, logs, 180_000)
    await page.goto(new URL('/debug/native-wallet', page.url()).href)
    // A full navigation locks the wallet and opens its password modal automatically.
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Unlock', exact: true }).click()
    await page.locator('button[title="Lock wallet"]').waitFor({ timeout: 60_000 })
    await waitForSelfTransferNotes(page, 'native-wallet', transfer, transferInputs)
    const notesBefore = await noteSnapshot(page, 'native-wallet')
    await page.getByLabel('Shieldd transaction ID', { exact: true }).fill(selection.transactionId)
    await page.getByLabel('Accepted block height', { exact: true }).fill(selection.height)
    await page.getByLabel('Action index', { exact: true }).fill(String(selection.action))
    await page.getByLabel('Output index', { exact: true }).fill('4294967296')
    await page.getByRole('button', { name: 'Prepare disclosure preview', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Invalid output selector' }).waitFor()
    await page.getByLabel('Output index', { exact: true }).fill('0')
    for (const method of ['openings', 'payload-keys']) {
      await page.getByLabel('Evidence', { exact: true }).selectOption(method)
      await page.getByRole('button', { name: 'Prepare disclosure preview', exact: true }).click()
      const button = page.getByRole('button', { name: 'Download disclosure', exact: true })
      const error = page.locator('section[aria-label="Voluntary disclosure export"]').getByRole('alert')
      await button.or(error).first().waitFor({ timeout: 60_000 })
      if (await error.isVisible()) throw new Error(`Disclosure export failed: ${await error.textContent()}`)
      const download = page.waitForEvent('download')
      await button.click()
      await (await download).saveAs(resolve(directory, `browser-${method}.json`))
    }
    assert.equal(await noteSnapshot(page, 'native-wallet'), notesBefore, 'Disclosure changed wallet notes or reservations')
  }
  console.log(JSON.stringify({ synthetic_committee: true, registeredAsset, registeredUser, transfer }))
} finally {
  await browser.close()
}
