import { createPublicClient, http } from 'viem'

export function bankdRpcUrl() {
  return process.env.BANKD_RPC_URL || 'http://127.0.0.1:8545'
}
export function serverPublicClient() {
  return createPublicClient({ transport: http(bankdRpcUrl()) })
}
export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(bankdRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok)
    throw new Error(`Bankd RPC returned HTTP ${response.status}`)
  const body = await response.json()
  if (body.error) throw new Error(body.error.message || 'Bankd RPC failed')
  return body.result as T
}
