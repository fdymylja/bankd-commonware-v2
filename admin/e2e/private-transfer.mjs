// Requires a funded synthetic wallet and a local development node/prover.
import assert from 'node:assert/strict'
import { fundedOption } from '../../tests/e2e/funding.mjs'
import { launchBrowser, importWallet, log } from './lib.mjs'

const rpc = process.env.NEXT_PUBLIC_PENUMBRA_RPC_URL ?? 'http://127.0.0.1:27657'
const recipient = process.env.RECIPIENT
if (!recipient?.startsWith('shieldd1')) throw new Error('Set RECIPIENT to the test Shieldd address')
const browser = await launchBrowser()
const page = await browser.newPage()
const broadcasts = []
page.on('console', message => log(`[${message.type()}] ${message.text()}`))
page.on('pageerror', error => log(`[pageerror] ${error.stack ?? error.message}`))
page.on('response', async response => {
  if (response.url().includes('broadcast_tx_sync')) {
    try { broadcasts.push(await response.json()) } catch { /* reported by timeout below */ }
  }
})
try {
  await importWallet(page)
  await page.click('a[href="/transfers"]')
  const amount = process.env.AMOUNT ?? '0.001'
  const options = page.locator('select optgroup[label*="Private"] option')
  await options.first().waitFor({ state: 'attached', timeout: 180_000 })
  const fundingDeadline = Date.now() + 180_000
  let funded
  while (Date.now() < fundingDeadline && !funded) {
    const candidates = await options.evaluateAll(elements => elements.map(option => ({
      value: option.value, assetId: option.dataset.assetId, balance: option.dataset.spendable ?? '0', decimals: option.dataset.decimals,
    })))
    funded = fundedOption(candidates, amount, { assetId: process.env.E2E_FEE_ASSET_ID ?? '', budget: process.env.E2E_FEE_BUDGET ?? '0' })
    if (!funded) await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(funded, 'No private asset can cover the requested transfer')
  await page.locator('select').first().selectOption(funded.value)
  await page.fill('input[placeholder="0.00"]', amount)
  await page.fill('input[placeholder*="shieldd1"]', recipient)
  await page.getByRole('button', { name: 'Private Send', exact: true }).click({ timeout: 60_000 })
  const deadline = Date.now() + 240_000
  let accepted
  while (Date.now() < deadline && !accepted) {
    for (const broadcast of broadcasts) {
      assert.equal(broadcast.result?.code, 0, JSON.stringify(broadcast))
      const hash = broadcast.result.hash
      const result = await fetch(`${rpc}/tx?hash=0x${hash}`).then(response => response.json())
      if (result.result?.tx_result) {
        assert.equal(result.result.tx_result.code, 0, JSON.stringify(result))
        accepted = { txHash: hash, height: result.result.height }
      }
    }
    if (!accepted) await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(accepted, 'Browser private transfer was not committed before timeout')
  console.log(JSON.stringify(accepted))
} finally {
  await browser.close()
}
