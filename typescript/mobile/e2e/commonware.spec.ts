import { test, expect, type Page } from '@playwright/test'
import { createPublicClient, http, parseUnits } from 'viem'

const mnemonic = 'test test test test test test test test test test test junk'
const receiverMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const password = 'mobile-e2e-password'
const rpc = createPublicClient({ transport: http(process.env.BANKD_RPC_URL || 'http://127.0.0.1:8545') })
const sender = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

async function importWallet(page: Page, phrase = mnemonic) {
  await page.goto('/')
  await page.getByText('Import Existing Wallet', { exact: true }).click()
  await page.locator('textarea').fill(phrase)
  await page.getByText('Continue', { exact: true }).click()
  await page.getByPlaceholder('Enter password (min 8 characters)').fill(password)
  await page.getByPlaceholder('Re-enter password').fill(password)
  await page.getByText('Import Wallet', { exact: true }).last().click()
  await expect(page.getByText('Public BRL', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('iframe[title="Shieldd wallet engine"]')).toHaveCount(1)
}

/** Exercise the actual bundled engine's message protocol for balance verification. */
async function command(page: Page, type: string, params: Record<string, unknown> = {}): Promise<any> {
  await page.waitForFunction(() => document.querySelector<HTMLIFrameElement>('iframe[title="Shieldd wallet engine"]')?.contentDocument?.readyState === 'complete')
  return page.evaluate(({type, params}) => new Promise((resolve, reject) => {
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Shieldd wallet engine"]')!
    const requestId = `e2e-${crypto.randomUUID()}`
    const timeout = setTimeout(() => { window.removeEventListener('message', receive);reject(new Error(`${type} timed out`)) }, 30_000)
    function receive(event: MessageEvent) {
      if (event.source !== frame.contentWindow || event.data?.channel !== 'bankd-wallet-shieldd') return
      const message = JSON.parse(event.data.message)
      if (message.requestId !== requestId) return
      clearTimeout(timeout);window.removeEventListener('message', receive)
      if (message.type === 'error' || message.success === false) reject(new Error(message.error || message.message))
      else resolve(message)
    }
    window.addEventListener('message', receive)
    frame.contentWindow!.postMessage(JSON.stringify({ type, requestId, ...params }), window.location.origin)
  }), {type, params})
}
async function privateBalance(page: Page) {
  const result = await command(page, 'getBalances')
  return (result.balances as { amount: string }[]).reduce((sum, b) => sum + BigInt(b.amount), 0n).toString()
}
async function waitForBalance(page: Page, amount: bigint) {
  await expect.poll(() => privateBalance(page), { timeout: 120_000, intervals: [1000] }).toBe(amount.toString())
}

// Requires a funded disposable Commonware chain, its read-only wallet RPC, and prover.
test('mobile wallet import, exact BRL transfers, shielding, private send, withdrawal and lock', async ({ page, browser }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const submitted: string[] = []
  page.on('response', async response => {
    try {
      if (JSON.parse(response.request().postData() || '{}').method === 'eth_sendRawTransaction') {
        const result = await response.json()
        if (result.result) submitted.push(result.result)
      }
    } catch { /* Asset requests have no JSON body. */ }
  })
  await importWallet(page)
  console.log('Wallet imported in the 390px mobile viewport')
  await expect.poll(async () => (await command(page,'getSyncStatus')).isSynced, {timeout:120_000}).toBe(true)
  const initialBalance = BigInt(await privateBalance(page))
  const deposit = parseUnits('1.000000000000000123',18)
  await page.getByLabel('BRL amount',{exact:true}).fill('1.000000000000000123')
  await page.getByText('Shield', {exact:true}).click()
  await waitForBalance(page,initialBalance+deposit)
  console.log('Shield deposit decrypted with all 18 decimals')
  await expect(page.getByLabel('BRL amount',{exact:true})).toHaveValue('')
  expect((await rpc.getTransaction({hash:submitted[0] as `0x${string}`})).value).toBe(deposit)
  await page.screenshot({path:testInfo.outputPath('funded-wallet.png')})

  const receiver = await browser.newPage({viewport:{width:390,height:844}})
  await importWallet(receiver,receiverMnemonic)
  await expect.poll(async () => (await command(receiver,'getSyncStatus')).isSynced,{timeout:120_000}).toBe(true)
  const initialReceiverBalance = BigInt(await privateBalance(receiver))
  const receiveAddress = (await command(receiver,'getAddress',{accountIndex:0})).address as string
  expect(receiveAddress).toMatch(/^shieldd1/)

  await page.getByRole('tab',{name:/Transfers$/}).click()
  await page.getByText('Select a token',{exact:true}).click()
  await page.getByRole('button',{name:'BRL private balance',exact:true}).click()
  await page.getByLabel('Amount',{exact:true}).fill('0.200000000000000001')
  await page.getByPlaceholder('shieldd1...').fill(receiveAddress)
  await page.getByRole('button',{name:'Send',exact:true}).click()
  const sent = parseUnits('0.200000000000000001',18)
  await waitForBalance(receiver,initialReceiverBalance+sent)
  console.log('Private transfer proved, finalized and decrypted by a second wallet')
  await waitForBalance(page,initialBalance+deposit-sent)
  await expect(page.getByLabel('Amount',{exact:true})).toHaveValue('')
  expect((await rpc.getTransactionReceipt({hash:submitted[1] as `0x${string}`})).status).toBe('success')

  await page.getByText('Home',{exact:true}).last().click()
  const beforeWithdrawal = await rpc.getBalance({address:sender})
  const withdrawal = parseUnits('0.100000000000000123',18)
  await page.getByLabel('BRL amount',{exact:true}).fill('0.100000000000000123')
  await page.getByText('Withdraw',{exact:true}).click()
  await expect.poll(async () => (await rpc.getBalance({address:sender})) - beforeWithdrawal,{timeout:120_000}).toBe(withdrawal)
  await waitForBalance(page,initialBalance+deposit-sent-withdrawal)
  console.log('Withdrawal credited the EVM recipient by the exact BRL amount')
  await expect(page.getByLabel('BRL amount',{exact:true})).toHaveValue('')
  expect((await rpc.getTransactionReceipt({hash:submitted[2] as `0x${string}`})).status).toBe('success')

  // Public send goes through the same form and credits the exact 18-decimal amount.
  const publicRecipient = '0x0000000000000000000000000000000000000123'
  const beforeSend = await rpc.getBalance({address:publicRecipient})
  await page.getByRole('tab',{name:/Transfers$/}).click()
  await page.getByText('Public',{exact:true}).click()
  await page.getByText('Select a token',{exact:true}).click()
  await page.getByRole('button',{name:'BRL public balance',exact:true}).click()
  await page.getByLabel('Amount',{exact:true}).fill('0.123456789123456789')
  await page.getByPlaceholder('0x...').fill(publicRecipient)
  await page.getByRole('button',{name:'Send',exact:true}).click()
  await expect.poll(async () => (await rpc.getBalance({address:publicRecipient})) - beforeSend,{timeout:60_000}).toBe(parseUnits('0.123456789123456789',18))
  await expect(page.getByLabel('Amount',{exact:true})).toHaveValue('')

  await page.getByText('Settings',{exact:true}).last().click()
  // Settings changes must affect the running clients and survive lock/unlock.
  await page.getByText('EVM RPC',{exact:true}).click()
  await page.getByLabel('Network endpoint',{exact:true}).fill('ftp://invalid.example')
  await page.getByText('Save',{exact:true}).click()
  await expect(page.getByText('Enter an absolute HTTP or HTTPS endpoint',{exact:true})).toBeVisible()
  await page.getByLabel('Network endpoint',{exact:true}).fill('http://localhost:8545')
  await page.getByText('Save',{exact:true}).click()
  await expect(page.getByText('http://localhost:8545',{exact:true})).toBeVisible()
  await expect.poll(async () => (await command(page,'getSyncStatus')).isSynced,{timeout:120_000}).toBe(true)
  await waitForBalance(page,initialBalance+deposit-sent-withdrawal)
  console.log('Saved RPC settings restarted the engine and restored the correct wallet')
  await page.getByText('Lock Wallet',{exact:true}).click()
  await expect(page.getByText('Enter your password to unlock',{exact:true})).toBeVisible()
  await expect(page.locator('iframe[title="Shieldd wallet engine"]')).toHaveCount(0)
  await page.getByPlaceholder('Enter your password').fill(password)
  await page.getByRole('button',{name:'Unlock',exact:true}).click()
  await expect(page.getByText('Public BRL',{exact:true})).toBeVisible()
  await expect.poll(async () => (await command(page,'getSyncStatus')).isSynced,{timeout:120_000}).toBe(true)
  await waitForBalance(page,initialBalance+deposit-sent-withdrawal)
  console.log('Lock removed the private engine; unlock restored the persisted wallet')
  await testInfo.attach('transactions' ,{body:JSON.stringify({submitted,deposit:deposit.toString(),privateSend:sent.toString(),withdrawal:withdrawal.toString()},null,2),contentType:'application/json'})
  expect(errors).toEqual([])
  await receiver.close()
})
