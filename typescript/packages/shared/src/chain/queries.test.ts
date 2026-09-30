import * as bankd from '../evm/bankd'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiParameters,
  isAddress,
} from 'viem'
import {
  getBalances,
  getIBCClients,
  getNativeParams,
  getValidators,
} from './queries'
import { IBC_ROUTER_ABI, NATIVE_ABI } from '../evm/bankd'
import {
  packetCommitmentPath,
  checkPacketCommitmentExists,
} from '../ibc/relay-tracker'

const address = '0x1111111111111111111111111111111111111111'
const originalFetch = globalThis.fetch
function mockRpc(
  result: (request: { method: string; params: any[] }) => unknown
) {
  globalThis.fetch = (async (_url, init) => {
    const request = JSON.parse(init!.body as string)
    return Response.json({
      jsonrpc: '2.0',
      id: request.id,
      result: result(request),
    })
  }) as typeof fetch
}

test('native balance query preserves 18 decimal base units and uses eth_getBalance', async () => {
  mockRpc((request) => {
    assert.equal(request.method, 'eth_getBalance')
    return '0x112210f4b16c1cb2'
  })
  try {
    assert.deepEqual(await getBalances(address), [
      {
        name: 'Brazilian Real',
        symbol: 'BRL',
        decimals: 18,
        denom: 'abrl',
        amount: '1234567890987654322',
        erc20Address: null,
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('IBC client discovery decodes the router tuple event and light-client state', async () => {
  const log = {
    address: '0x4be2f106a550b243b60fa279228f4e94b1ef8aec',
    blockHash: `0x${'ab'.repeat(32)}`,
    blockNumber: '0x1',
    transactionHash: `0x${'cd'.repeat(32)}`,
    transactionIndex: '0x0',
    logIndex: '0x0',
    removed: false,
    topics: encodeEventTopics({
      abi: IBC_ROUTER_ABI,
      eventName: 'ICS02ClientAdded',
    }),
    data: encodeAbiParameters(
      parseAbiParameters('string, (string, bytes[]), address'),
      ['client-0', ['client-1', ['0x01']], address]
    ),
  }
  let calls = 0
  mockRpc((request) => {
    if (request.method === 'eth_getCode') return '0x01'
    if (request.method === 'eth_getLogs') return [log]
    assert.equal(request.method, 'eth_call')
    return [
      encodeAbiParameters(parseAbiParameters('address'), [address]),
      encodeAbiParameters(
        parseAbiParameters('(string clientId, bytes[] merklePrefix)'),
        [{ clientId: 'client-1', merklePrefix: ['0x01'] }]
      ),
      encodeAbiParameters(parseAbiParameters('uint256'), [
        1000000000000000000n,
      ]),
      encodeAbiParameters(parseAbiParameters('bytes'), [
        encodeAbiParameters(
          parseAbiParameters('(address, (uint64, uint64), uint64, bool)'),
          [[address, [0n, 12n], 10n, false]]
        ),
      ]),
    ][calls++]
  })
  try {
    const [route] = await getIBCClients()
    assert.equal(route.clientId, 'client-0')
    assert.equal(route.counterpartyClientId, 'client-1')
    assert.equal(route.status, 'Active')
    assert.equal(route.height, 12n)
    assert.equal(route.escrowed, 1000000000000000000n)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('IBC commitment uses ICS24 packed uint64 sequence, and RPC errors propagate', async () => {
  assert.equal(packetCommitmentPath('client-0', 1n).length, 66)
  assert.notEqual(
    packetCommitmentPath('client-0', 1n),
    packetCommitmentPath('client-0', 1n, 2)
  )
  globalThis.fetch = (async () =>
    Response.json({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'node down' },
    })) as typeof fetch
  try {
    await assert.rejects(
      checkPacketCommitmentExists('client-0', 1n, 'transfer')
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('all precompile addresses are accepted by the EVM client', () => {
  for (const [name, value] of Object.entries(bankd))
    if (name.endsWith('_ADDRESS'))
      assert.equal(isAddress(value as string), true, name)
})
