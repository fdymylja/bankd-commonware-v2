import { createPublicClient, getAddress, http, type Address } from 'viem'
import { chainConfig } from '../config'
import { bech32ToHex } from '../utils'

export function getPublicClient() {
  return createPublicClient({
    transport: http(chainConfig.evmRpc),
    batch: { multicall: false },
  })
}
export function evmAddress(value: string): Address {
  return getAddress(value.startsWith('0x') ? value : bech32ToHex(value))
}
