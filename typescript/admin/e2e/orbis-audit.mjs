import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { launchBrowser, importWallet, gotoAssetsAndWaitForSync, ADMIN_URL, REPO_ROOT, PASSWORD } from './lib.mjs'
import { commitShieldd } from './transactions.mjs'
import { manualSamples, verificationSamples } from './orbis-samples.mjs'

const participants = JSON.parse(await readFile(process.env.AUDIT_DEMO_FIXTURES, 'utf8'))
const genesis = JSON.parse(await readFile(resolve(REPO_ROOT, 'scripts/dev-genesis.json'), 'utf8'))
const output = process.env.AUDIT_DEMO_OUTPUT
const browser = await launchBrowser()
const wallets = []
const transfers = []
const runs = []
const setupOnly = process.env.AUDIT_DEMO_SETUP_ONLY === 'true'
const samples = setupOnly ? manualSamples : verificationSamples
async function main() {
try {
  // Each participant has a separate wallet; CI reuses three proofs across audits.
  for (const participant of participants) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
    const page = await context.newPage()
    const logs = []
    page.on('console', message => logs.push(message.text()))
    await importWallet(page, genesis.accounts.find(account => account.name === participant.account).mnemonic)
    await gotoAssetsAndWaitForSync(page, logs, 300_000)
    const fixture = participant.fixture
    await page.getByLabel('Base denom', { exact: true }).fill(fixture.denom)
    if (!wallets.length) {
      await page.getByLabel('Issued asset registration (JSON)').fill(JSON.stringify(fixture.asset))
      await commitShieldd(page, page.getByRole('button', { name: 'Register regulated asset', exact: true }), 'complianceRegisterAsset')
    }
    await page.getByLabel('Issued user registration (JSON)').fill(JSON.stringify(fixture.user))
    await page.getByLabel('User address index').fill('0')
    await commitShieldd(page, page.getByRole('button', { name: 'Register this wallet for regulated asset', exact: true }), 'complianceRegisterUser')
    wallets.push({ page, logs, participant })
  }
  for (const sender of new Set(samples.map(sample => sample.sender))) {
    const { participant } = wallets.find(wallet => wallet.participant.name === sender)
    const funding = samples.filter(sample => sample.sender === sender).reduce((sum, sample) => sum + sample.amount, 20000)
    execFileSync('pnpm', ['--dir', 'mobile', 'exec', 'tsx', 'e2e/embedded-shieldd-deposit.ts'], {
      cwd: REPO_ROOT, env: { ...process.env, MOBILE_E2E_SHIELDD_RECIPIENT: participant.fixture.address, MOBILE_E2E_DEPOSIT_DENOM: participant.fixture.denom, MOBILE_E2E_DEPOSIT_AMOUNT: String(funding) },
      stdio: 'inherit', timeout: 60_000,
    })
  }
  for (const [index, sample] of samples.entries()) {
    const { page, participant, logs } = wallets.find(wallet => wallet.participant.name === sample.sender)
    const receiver = participants.find(participant => participant.name === sample.receiver)
    console.log(`Sample ${index + 1}/${samples.length}: ${sample.sender} → ${sample.receiver}, ${sample.amount}`)
    await gotoAssetsAndWaitForSync(page, logs, 180_000)
    await page.click('a[href="/transfers"]')
    let selected
    const deadline = Date.now() + 180_000
    while (!selected && Date.now() < deadline) {
      const options = await page.locator('select optgroup[label*="Private"] option').evaluateAll(elements => elements.map(option => ({
        value: option.value, denom: option.dataset.denom, balance: option.dataset.spendable ?? '0', decimals: Number(option.dataset.decimals ?? 0),
      })))
      selected = options.find(option => option.denom === participant.fixture.denom && BigInt(option.balance) >= BigInt(sample.amount))
      if (!selected) await page.waitForTimeout(1000)
    }
    assert.ok(selected, 'Registered participant has private funds')
    await page.locator('select').first().selectOption(selected.value)
    await page.fill('input[placeholder="0.00"]', (sample.amount / 10 ** selected.decimals).toFixed(selected.decimals))
    await page.fill('input[placeholder*="shieldd1"]', receiver.fixture.address)
    const transaction = await commitShieldd(page, page.getByRole('button', { name: 'Private Send', exact: true }), 'transfer', index === 0 ? async () => {
      await expect(page.getByText('Building proof', { exact: true })).toBeVisible()
      await page.click('a[href="/assets"]')
      await page.click('a[href="/transfers"]')
    } : undefined)
    transfers.push({ ...transaction, ...sample })
  }
  const page = wallets[0].page
  const deadline = Date.now() + 180_000
  while (true) {
    const response = await page.request.get(`${ADMIN_URL}/api/audit-demo/objects`)
    const payload = await response.json()
    if (response.ok() && transfers.every(tx => payload.transactions.some(row => row.bankdTxHash === tx.hash.toLowerCase() && row.auditable))) {
      assert.equal(payload.transactions.filter(row => row.auditable).length, samples.length, 'Navigating during a transfer must not rebroadcast it')
      break
    }
    if (Date.now() > deadline) throw new Error(`Sealed packages did not attach: ${JSON.stringify(payload).slice(0, 300)}`)
    await page.waitForTimeout(2000)
  }
  if (setupOnly) {
    await writeFile(resolve(output, 'setup-result.json'), JSON.stringify({ transfers }, null, 2))
    return
  }
  await page.route('**/api/audit-demo/objects', route => route.fulfill({ json: { transactions: [] } }))
  await page.click('a[href="/demo/audit"]')
  await page.getByText('No encrypted Shieldd transactions are indexed yet.', { exact: true }).waitFor()
  await page.screenshot({ path: resolve(output, 'legal-audit-empty.png'), fullPage: true })
  await page.unroute('**/api/audit-demo/objects')
  await page.click('a[href="/assets"]')
  await page.click('a[href="/demo/audit"]')
  await page.getByRole('heading', { name: 'Orbis Legal Audit', exact: true }).waitFor()
  await page.getByLabel('User', { exact: true }).selectOption('Charlie')
  await page.getByText('3 auditable transactions in this range', { exact: true }).waitFor()
  await expect(page.getByText('No audit has run in this session.', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Prepare disclosure preview' })).toHaveCount(0)
  await page.screenshot({ path: resolve(output, 'legal-audit-initial.png'), fullPage: true })

  async function request(expected = 'completed') {
    const response = page.waitForResponse(response => /\/api\/audit-demo\/(audit-subject|investigate-time|audit-transaction)$/.test(response.url()), { timeout: 240_000 })
    await page.getByRole('button', { name: 'Request audit', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Auditing' }).waitFor()
    const payload = await (await response).json()
    assert.equal(payload.run?.status, expected, JSON.stringify(payload))
    runs.push(payload.run)
    await page.getByRole('button', { name: 'Request audit', exact: true }).waitFor()
    return payload.run
  }
  const regular = await request()
  assert.equal(regular.result.objects.length, 4)
  assert.ok(regular.result.objects.filter(row => row.field !== 'amount').every(row => row.alias === 'Charlie'))
  await expect(page.getByLabel('Audit tier', { exact: true })).toHaveValue('extended')
  await expect(page.getByText('2 fields revealed', { exact: true })).toHaveCount(2)
  // Changing the next request keeps already released fields visible.
  let release
  let intercepted
  const arrived = new Promise(resolve => { intercepted = resolve })
  const held = new Promise(resolve => { release = resolve })
  await page.route('**/api/audit-demo/audit-subject', async route => {
    intercepted()
    await held
    await route.fulfill({ json: { run: regular } })
  })
  await page.getByRole('button', { name: 'Request audit', exact: true }).click()
  await arrived
  await page.getByLabel('User', { exact: true }).selectOption('Alice')
  release()
  await page.getByRole('button', { name: 'Request audit', exact: true }).waitFor()
  await expect(page.getByText('2 fields revealed', { exact: true })).toHaveCount(2)
  await page.unroute('**/api/audit-demo/audit-subject')
  await page.getByLabel('User', { exact: true }).selectOption('Charlie')
  await page.getByLabel('Audit tier', { exact: true }).selectOption('extended')
  const extended = await request()
  assert.equal(extended.result.objects.length, 6)
  await expect(page.getByText('3 fields revealed', { exact: true })).toHaveCount(2)
  await page.screenshot({ path: resolve(output, 'legal-audit-extended.png'), fullPage: true })
  await page.getByLabel('User', { exact: true }).selectOption('Alice')
  await page.getByRole('tab', { name: 'Unrestricted', exact: true }).click()
  await expect(page.getByText('3 fields revealed', { exact: true })).toHaveCount(2)
  await page.locator('details').first().locator('summary').click()
  await page.getByRole('button', { name: 'View audited transaction', exact: true }).first().click()
  await expect(page.getByText('3 fields revealed', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Clear audit results', exact: true }).click()
  await expect(page.locator('details')).toHaveCount(0)
  await expect(page.getByText(/fields? revealed/)).toHaveCount(0)
  await page.reload()
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.locator('button[title="Lock wallet"]')).toBeVisible()
  await expect(page.getByLabel('User', { exact: true })).toHaveValue('Charlie')
  await expect(page.getByText('No audit has run in this session.', { exact: true })).toBeVisible()
  assert.deepEqual((await (await page.request.get(`${ADMIN_URL}/api/audit-demo/state`)).json()).state.runs, [])

  await page.getByRole('tab', { name: 'Unrestricted', exact: true }).click()
  await expect(page.getByText('3 fields revealed', { exact: true })).toHaveCount(0)
  const amount = await request()
  assert.equal(amount.result.objects.length, 3)
  assert.ok(amount.result.objects.every(row => row.field === 'amount' && row.value === '1000'))
  await page.getByLabel('amount', { exact: true }).uncheck()
  await page.getByLabel('sender', { exact: true }).check()
  await page.getByLabel('receiver', { exact: true }).check()
  const identities = await request()
  assert.equal(identities.result.objects.length, 6)
  assert.ok(identities.result.objects.every(row => row.field !== 'amount'))
  await page.getByLabel('Search by', { exact: true }).selectOption('tx_id')
  await page.getByLabel('Transaction ID', { exact: true }).selectOption(transfers[2].hash.toLowerCase())
  const specific = await request()
  assert.equal(specific.result.objects.length, 2)
  assert.ok(specific.result.objects.every(row => row.output_ref.bankd_tx_hash === transfers[2].hash.toLowerCase()))
  await page.getByRole('button', { name: 'Clear audit results', exact: true }).click()

  // Repeating exactly the successful request must use live PRE again, never a cached result.
  execFileSync('bash', ['-euc', 'source shieldd/scripts/lib/common.sh; ensure_orbis_images; run_orbis_compose "$COMPLIANCE_REPO_ROOT/deployments/orbis/docker-compose.yml" stop node1 node2 node3'], {
    cwd: REPO_ROOT, env: process.env, stdio: 'inherit', timeout: 90_000,
  })
  const failed = await request('failed')
  assert.equal(failed.result, undefined)
  await expect(page.getByText(/fields? revealed/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clear audit results', exact: true })).toBeEnabled()
  await page.screenshot({ path: resolve(output, 'legal-audit-unavailable.png'), fullPage: true })
  await writeFile(resolve(output, 'browser-result.json'), JSON.stringify({ passed: true, live_pre: true, unavailable_rejected: true, transfers, runs }, null, 2))
} finally {
  await browser.close()
}
}
await main()
