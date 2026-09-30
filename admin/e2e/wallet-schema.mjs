import assert from 'node:assert/strict'
import { ADMIN_URL, launchBrowser } from './lib.mjs'

const browser = await launchBrowser()
const page = await browser.newPage()
const errors = []
page.on('console', message => errors.push(message.text()))
page.on('pageerror', error => errors.push(error.message))
try {
  await page.route(`${ADMIN_URL}/sdk-schema-fixture`, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Disposable wallet schema fixture</title>',
  }))
  await page.goto(`${ADMIN_URL}/sdk-schema-fixture`)
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('native-wallet', 3)
    request.onsuccess = () => { request.result.close(); resolve() }
    request.onerror = () => reject(request.error)
  }))
  await page.goto(ADMIN_URL)
  const deadline = Date.now() + 30_000
  while (!errors.some(error => error.includes('Stale prototype wallet format')) && Date.now() < deadline) {
    await page.waitForTimeout(100)
  }
  assert.ok(errors.some(error => error.includes('Stale prototype wallet format')), errors.join('\n'))
  const version = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('native-wallet')
    request.onsuccess = () => { const version = request.result.version; request.result.close(); resolve(version) }
    request.onerror = () => reject(request.error)
  }))
  assert.equal(version, 3, 'Stale wallet was silently upgraded')
  console.log('Stale admin wallet rejected; database version preserved')
} finally { await browser.close() }
