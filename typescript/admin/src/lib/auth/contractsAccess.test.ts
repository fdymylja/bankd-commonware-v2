import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { authorizeContractsRequest } from './contractsAccess'
const original = { ...process.env }
test.afterEach(() => { process.env = { ...original }; globalThis.fetch = originalFetch })
const originalFetch = globalThis.fetch
const grant = (subject: string) => { globalThis.fetch = async () => new Response(JSON.stringify({ subjects: [Buffer.from(subject).toString('base64')] }), { status: 200 }) }

test('development auth is default denied and explicit server identity succeeds', async () => {
  Object.assign(process.env, { NODE_ENV: 'development' }); delete process.env.CONTRACTS_DEV_AUTH
  assert.equal((await authorizeContractsRequest(new NextRequest('http://x'))).granted, false)
  process.env.CONTRACTS_DEV_AUTH = 'true'; process.env.CONTRACTS_DEV_SUBJECT = 'admin'; process.env.CONTRACTS_DEV_WALLET = '0x00000000000000000000000000000000000000aa'; grant('admin')
  const result = await authorizeContractsRequest(new NextRequest('http://x', { headers: { 'x-supervisor-wallet': '0x00000000000000000000000000000000000000bb' } }))
  assert.equal(result.granted, true)
  if (result.granted) assert.equal(result.access.wallet, '0x00000000000000000000000000000000000000AA')
})

test('production requires trusted proxy headers and valid wallet', async () => {
  Object.assign(process.env, { NODE_ENV: 'production' }); delete process.env.SUPERVISOR_TRUST_PROXY_AUTH
  let result = await authorizeContractsRequest(new NextRequest('http://x'))
  assert.equal(result.granted && result.access.wallet, false)
  process.env.SUPERVISOR_TRUST_PROXY_AUTH = 'true'
  result = await authorizeContractsRequest(new NextRequest('http://x', { headers: { 'x-supervisor-subject': 'admin', 'x-supervisor-wallet': 'bad' } }))
  assert.equal(result.granted, false)
  if (!result.granted) assert.equal(result.response.status, 401)
})
