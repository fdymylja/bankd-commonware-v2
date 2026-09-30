import { NextRequest, NextResponse } from 'next/server'

import { bankdRpcUrl } from '@/lib/rpc/server'

export const dynamic = 'force-dynamic'
const methods = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBalance', 'eth_getCode', 'eth_getStorageAt', 'eth_call', 'eth_estimateGas', 'eth_fillTransaction', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getTransactionCount', 'eth_sendRawTransaction', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getLogs', 'web3_clientVersion', 'net_version'])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requests = Array.isArray(body) ? body : [body]
    if (!requests.length || requests.length > 100 || requests.some(item => !methods.has(item.method) || !Array.isArray(item.params ?? []))) {
      return NextResponse.json({ error: 'RPC method is not allowed' }, { status: 400 })
    }
    const response = await fetch(bankdRpcUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(30_000) })
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'RPC unavailable' }, { status: 502 })
  }
}
