// Run against a disposable Commonware localnet and the local browser prover.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launchBrowser, importWallet, ADMIN_URL } from './lib.mjs'
import { createPublicClient, http, parseAbi, parseUnits, zeroAddress } from 'viem'

const client = createPublicClient({ transport: http(process.env.BANKD_RPC_URL || 'http://127.0.0.1:8545') })
const nativeAddress = '0x0000000000000000000000000000004552433230'
const nativeAbi = parseAbi(['function isMinter(address) view returns (bool)', 'event NativeBurn(address indexed caller, address from, uint256 value)'])
const authorityAddress = '0x0000000000000000000000000000000041555448'
const authorityAbi = parseAbi(['function owner() view returns (address)', 'function pendingOwner() view returns (address)'])
const complianceAddress = '0x000000000000000000000000000000434d504c59'
const complianceAbi = parseAbi(['function isFrozen(address) view returns (bool)'])
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } })
const logs = []
const errors = []
const broadcasts = []
page.on('console', message => {
  logs.push(`[${message.type()}] ${message.text()}`)
  if (/\[Transaction\]|\[WASM\]|\[PrivateTransferQueue\]/.test(message.text())) console.log(message.text())
})
page.on('pageerror', error => errors.push(error.message))
page.on('response', async response => {
  if (!response.url().endsWith('/api/rpc')) return
  if (response.status() >= 400) logs.push(`RPC HTTP ${response.status()}: ${JSON.parse(response.request().postData() || '{}').method}`)
  try {
    const request = JSON.parse(response.request().postData() || '{}')
    if (request.method === 'eth_sendRawTransaction') broadcasts.push(await response.json())
  } catch { /* Requests without a JSON body are not broadcasts. */ }
})
const output = process.env.E2E_OUTPUT || '/tmp/bankd-admin-browser'
await mkdir(output, { recursive: true })
async function waitForPrivateConfirmation(type) {
  const deadline = Date.now() + 300000
  while (Date.now() < deadline) {
    const job = await page.evaluate(async type => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('native-wallet')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        const jobs = await new Promise((resolve, reject) => {
          const request = db.transaction('privateTransferJobs').objectStore('privateTransferJobs').getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        return jobs.reverse().find(job => job.type === type)
      } finally { db.close() }
    }, type)
    if (job?.status === 'failed') throw new Error(job.error || 'Private transfer failed')
    if (job?.status === 'confirmed') return job
    await page.waitForTimeout(1000)
  }
  throw new Error(`Timed out waiting for ${type}`)
}
try {
  await importWallet(page)
  await page.getByRole('link', { name: 'Configuration', exact: true }).click()
  await page.getByText('Admin:', { exact: false }).first().waitFor()
  await page.getByRole('button', { name: 'Authorize minter', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled)
  assert.match(await page.locator('body').innerText(), /f39Fd6e51aad88F6F4ce6aB8827279cffFb92266/)
  await page.screenshot({ path: `${output}/configuration.png`, fullPage: true })
  await page.getByRole('link', { name: 'Security', exact: true }).click()
  await page.getByText('127.0.0.1:', { exact: false }).first().waitFor()
  await page.screenshot({ path: `${output}/validators.png`, fullPage: true })
  await page.getByRole('link', { name: 'Transfers', exact: true }).click()
  await page.getByRole('heading', { name: 'Transfers', exact: true }).waitFor()
  await writeFile(`${output}/transfers.txt`, await page.locator('body').innerText())
  console.log('Browser navigation, authority permissions and validator queries passed')
  if (process.env.E2E_INSPECT === '1') {
    console.log(await page.locator('body').innerText())
  } else {
    const recipient = '0x0000000000000000000000000000000000000123'
    const before = await client.getBalance({ address: recipient })
    await page.locator('select').first().selectOption('public:abrl')
    await page.locator('input[placeholder="0.00"]').fill('0.123456789123456789')
    await page.locator('input[placeholder*="shieldd1"]').fill(recipient)
    await page.getByRole('button', { name: 'Public Send', exact: true }).click()
    await page.waitForFunction(() => document.body.innerText.includes('Sent 0.123456789123456789'), null, { timeout: 60000 })
    const after = await client.getBalance({ address: recipient })
    assert.equal(after - before, parseUnits('0.123456789123456789', 18))
    console.log('Public send preserved 18-decimal BRL and committed on the node')
    if (process.env.E2E_PRIVATE !== '0') {
      await page.getByRole('button', { name: 'Private Address', exact: true }).click()
      await page.locator('input[placeholder="0.00"]').fill('1')
      await page.getByRole('button', { name: 'Shield', exact: true }).click()
      await page.waitForFunction(() => Array.from(document.querySelectorAll('select option[data-denom="abrl"]')).some(option => BigInt(option.dataset.spendable || '0') >= 1000000000000000000n), null, { timeout: 180000 })
      await page.waitForFunction(() => document.querySelector('input[placeholder="0.00"]')?.value === '', null, { timeout: 60000 })
      const privateValue = await page.locator('select option[data-denom="abrl"]').first().getAttribute('value')
      assert.ok(privateValue)
      console.log('Shield deposit decrypted and the private wallet synced the funded note')
      await page.locator('select').first().selectOption(privateValue)
      await page.locator('input[placeholder="0.00"]').fill('0.2')
      await page.locator('input[placeholder*="shieldd1"]').fill('shieldd1u29dhz4vxgnek6a3vzxlejg0l83wegpu7hgs3yphdvljcnnnh89dvs6lc9hxxw94w464t7lh5x36cxnxyx0')
      await page.getByRole('button', { name: 'Private Send', exact: true }).click()
      await waitForPrivateConfirmation('private-send')
      const privateBroadcast = broadcasts.find(response => response.result && response !== broadcasts[0] && response !== broadcasts[1])
      assert.ok(privateBroadcast?.result, JSON.stringify(broadcasts))
      const receipt = await client.getTransactionReceipt({ hash: privateBroadcast.result })
      assert.equal(receipt.status, 'success')
      console.log(`Real private transfer committed: ${privateBroadcast.result}`)

      const withdrawalRecipient = '0x0000000000000000000000000000000000000124'
      const withdrawalBefore = await client.getBalance({ address: withdrawalRecipient })
      await page.locator('input[placeholder="0.00"]').fill('0.1')
      await page.locator('input[placeholder*="shieldd1"]').fill(withdrawalRecipient)
      await page.getByRole('button', { name: 'Unshield', exact: true }).click()
      await waitForPrivateConfirmation('private-withdraw')
      assert.equal((await client.getBalance({ address: withdrawalRecipient })) - withdrawalBefore, parseUnits('0.1', 18))
      assert.equal((await client.getTransactionReceipt({ hash: broadcasts[3].result })).status, 'success')
      console.log(`Real private withdrawal credited exactly 0.1 BRL: ${broadcasts[3].result}`)
    }

    if (process.env.E2E_ADMIN !== '0') {
      await page.getByRole('link', { name: 'Configuration', exact: true }).click()
      await page.getByLabel('Minter address', { exact: true }).fill(recipient)
      await page.getByRole('button', { name: 'Authorize minter', exact: true }).click()
      await page.getByText('Minter authorized', { exact: true }).waitFor({ timeout: 60000 })
      assert.equal(await client.readContract({ address: nativeAddress, abi: nativeAbi, functionName: 'isMinter', args: [recipient] }), true)
      await page.locator('li').filter({ hasText: recipient }).getByRole('button', { name: 'Revoke', exact: true }).click()
      await page.getByText('Minter revoked', { exact: true }).waitFor({ timeout: 60000 })
      assert.equal(await client.readContract({ address: nativeAddress, abi: nativeAbi, functionName: 'isMinter', args: [recipient] }), false)
      const owner = await client.readContract({ address: authorityAddress, abi: authorityAbi, functionName: 'owner' })
      await page.getByLabel('New admin address', { exact: true }).fill(recipient)
      await page.getByRole('button', { name: 'Start transfer', exact: true }).click()
      await page.getByText('Ownership transfer started', { exact: true }).waitFor({ timeout: 60000 })
      assert.equal(await client.readContract({ address: authorityAddress, abi: authorityAbi, functionName: 'pendingOwner' }), recipient)
      await page.getByRole('button', { name: 'Cancel transfer', exact: true }).click()
      await page.getByText('Transfer cancelled', { exact: true }).waitFor({ timeout: 60000 })
      assert.equal(await client.readContract({ address: authorityAddress, abi: authorityAbi, functionName: 'pendingOwner' }), zeroAddress)
      assert.equal(await client.readContract({ address: authorityAddress, abi: authorityAbi, functionName: 'owner' }), owner)
      console.log('Live minter grant/revoke and two-step ownership start/cancel passed')

      await page.getByRole('link', { name: 'Assets', exact: true }).click()
      const mintForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Mint BRL', exact: true }) })
      const mintBefore = await client.getBalance({ address: recipient })
      await mintForm.locator('input[placeholder="0x..."]').fill(recipient)
      await mintForm.locator('input[placeholder="0.00"]').fill('0.000000000000000123')
      await mintForm.getByRole('button', { name: 'Mint BRL', exact: true }).click()
      await page.getByText('BRL minted successfully!', { exact: true }).waitFor({ timeout: 60000 })
      assert.equal((await client.getBalance({ address: recipient })) - mintBefore, 123n)
      const burnForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Burn Assets', exact: true }) })
      await burnForm.locator('input').fill('0.000000000000000123')
      await burnForm.getByRole('button', { name: 'Burn Assets', exact: true }).click()
      await page.getByText('Assets burned successfully!', { exact: true }).waitFor({ timeout: 60000 })
      const burnReceipt = await client.getTransactionReceipt({ hash: broadcasts.at(-1).result })
      const burns = await client.getContractEvents({ address: nativeAddress, abi: nativeAbi, eventName: 'NativeBurn', fromBlock: burnReceipt.blockNumber, toBlock: burnReceipt.blockNumber })
      assert.equal(burns[0].args.value, 123n)
      console.log('Live mint and burn preserved 18-decimal fractional amounts')

      await page.getByRole('link', { name: 'Compliance', exact: true }).click()
      const freezeCard = page.getByRole('heading', { name: 'Freeze an account', exact: true }).locator('../..')
      await freezeCard.locator('input').nth(0).fill(recipient)
      await freezeCard.locator('input').nth(1).fill('Disposable localnet test')
      await freezeCard.getByRole('button', { name: 'Freeze account', exact: true }).click()
      await page.getByText('Account frozen', { exact: true }).waitFor({ timeout: 60000 })
      assert.equal(await client.readContract({ address: complianceAddress, abi: complianceAbi, functionName: 'isFrozen', args: [recipient] }), true)
      await freezeCard.getByRole('button', { name: 'Lift the freeze', exact: true }).click()
      await page.getByText('Freeze lifted', { exact: true }).waitFor({ timeout: 60000 })
      assert.equal(await client.readContract({ address: complianceAddress, abi: complianceAbi, functionName: 'isFrozen', args: [recipient] }), false)
      console.log('Live compliance freeze and unfreeze passed')
    }

  }
  assert.deepEqual(errors, [])
} finally {
  await writeFile(`${output}/console.log`, logs.join('\n'))
  await writeFile(`${output}/errors.json`, JSON.stringify(errors))
  await writeFile(`${output}/broadcasts.json`, JSON.stringify(broadcasts, null, 2))
  await page.screenshot({ path: `${output}/last-page.png`, fullPage: true }).catch(() => {})
  await browser.close()
}
