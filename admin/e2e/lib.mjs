// Shared helpers for the admin browser e2e scripts.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:34562'
export const MNEMONIC =
  process.env.MNEMONIC ??
  'test test test test test test test test test test test junk'
export const PASSWORD = 'e2e-test-password-1'

export const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)

/**
 * Launch Chromium: explicit CHROMIUM_PATH, then playwright's managed browser,
 * then the system Chrome channel. HEADFUL=1 shows the window.
 */
export async function launchBrowser() {
  const headless = !process.env.HEADFUL
  if (process.env.CHROMIUM_PATH) {
    return chromium.launch({ headless, executablePath: process.env.CHROMIUM_PATH })
  }
  try {
    return await chromium.launch({ headless })
  } catch {
    log("Playwright's chromium not installed; falling back to system Chrome")
    try {
      return await chromium.launch({ headless, channel: 'chrome' })
    } catch {
      throw new Error(
        'No usable browser. Run `pnpm exec playwright install chromium` ' +
          'or set CHROMIUM_PATH.'
      )
    }
  }
}

/** Import the wallet from the mnemonic with password auth; ends unlocked. */
export async function importWallet(page, mnemonic = MNEMONIC) {
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('text=Setup Wallet', { timeout: 60000 })
  // Clicking immediately after load can land before React hydration attaches
  // the handler (a no-op), so retry until the modal actually opens.
  const importTab = page.locator('text=Import Existing')
  for (let attempt = 0; attempt < 20 && (await importTab.count()) === 0; attempt++) {
    await page.click('text=Setup Wallet')
    await page.waitForTimeout(500)
  }
  await importTab.click()
  await page.fill('textarea', mnemonic)
  await page.click('text=Traditional password protection')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm Password').fill(PASSWORD)
  await page.click('button:has-text("Import Wallet")')
  await page.waitForSelector('button[title="Lock wallet"]', { timeout: 120000 })
  log('Wallet imported and unlocked')
}

/**
 * Navigate to the assets page via client-side nav (a full page load drops the
 * in-memory key and re-locks the wallet) and wait for the view-server sync to
 * reach the chain tip.
 */
export async function gotoAssetsAndWaitForSync(page, consoleLines, timeoutMs) {
  await page.click('a[href="/assets"]')
  await page.waitForSelector('text=Regulated Asset Setup', { timeout: 60000 })

  const unlockBtn = page.locator('button:has-text("Unlock Wallet")')
  if ((await unlockBtn.count()) > 0) {
    log('Wallet re-locked; unlocking...')
    await unlockBtn.first().click()
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.click('button:has-text("Unlock")')
    await page.waitForSelector('button[title="Lock wallet"]', { timeout: 60000 })
  }

  const ready = page.locator(
    'text=Wallet is unlocked and synced.'
  )
  const deadline = Date.now() + timeoutMs
  let lastLogged = ''
  while (Date.now() < deadline) {
    if ((await ready.count()) > 0) {
      log('Wallet synced to tip')
      return
    }
    await page.waitForTimeout(3000)
    const last = consoleLines.filter((l) => l.includes('height')).at(-1)
    if (last && last !== lastLogged) {
      lastLogged = last
      log(`sync... ${last.slice(0, 160)}`)
    }
  }
  throw new Error(`Sync did not reach tip within ${timeoutMs}ms`)
}
