// Run the shipped WASM in Chromium and compare its private Transfer witness to native Rust.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'))
const wrapper = import.meta.resolve('@mizufinance/wasm/compliance')
const wasm = new URL('../wasm/', wrapper)
const assets = new Map([
  ['/index.js', ['text/javascript', await readFile(new URL('index.js', wasm))]],
  ['/index_bg.wasm', ['application/wasm', await readFile(new URL('index_bg.wasm', wasm))]],
])
const server = createServer((request, response) => {
  if (request.url === '/') { response.end('<!doctype html><title>Private WASM parity test</title>'); return }
  const asset = assets.get(request.url)
  if (!asset) { response.writeHead(404).end(); return }
  response.writeHead(200, { 'Content-Type': asset[0] }).end(asset[1])
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  try { browser = await chromium.launch({ headless: true }) }
  catch { browser = await chromium.launch({ headless: true, channel: 'chrome' }) }
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const result = await page.evaluate(async input => {
    const api = await import('/index.js')
    await api.default({ module_or_path: '/index_bg.wasm' })
    const request = api.build_action_proof_request(
      new Uint8Array(input.plan), new Uint8Array(input.action),
      new Uint8Array(input.fvk), new Uint8Array(input.witness),
    )
    return { family: request.family, matches: request.witness.length === input.expected.length &&
      Array.from(request.witness).every((value, index) => value === input.expected[index]) }
  }, fixture)
  assert.deepEqual(result, { family: 'transfer', matches: true })
  console.log('Chromium WASM Transfer witness matches native Rust exactly.')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
