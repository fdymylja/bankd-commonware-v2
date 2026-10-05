import { createPublicClient, getAddress, http, type Address } from 'viem'
import { chainConfig } from '../config'
import { bech32ToHex } from '../utils'

let rpcUrl: string | undefined

/** Mobile network settings use the same transport for shared queries and signing. */
export function setChainRpcUrl(url: string): void {
  rpcUrl = url
}

export function getPublicClient() {
  return createPublicClient({
    transport: http(rpcUrl ?? chainConfig.evmRpc),
    batch: { multicall: false },
  })
}
export function evmAddress(value: string): Address {
  return getAddress(value.startsWith('0x') ? value : bech32ToHex(value))
}
