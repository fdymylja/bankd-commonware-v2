import { useSyncExternalStore } from 'react'
import { setChainRpcUrl } from '@bankd/shared/chain/client'

export type NetworkSettings = { rpcUrl: string; proverUrl: string }

export function endpoint(value: string): string {
  const parsed = new URL(value.trim())
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Enter an absolute HTTP or HTTPS endpoint')
  }
  return parsed.toString().replace(/\/$/, '')
}

let settings: NetworkSettings = {
  rpcUrl: endpoint(process.env.EXPO_PUBLIC_EVM_RPC || process.env.EXPO_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'),
  proverUrl: endpoint(process.env.EXPO_PUBLIC_PENUMBRA_PROVER_URL || 'http://127.0.0.1:8090'),
}
const listeners = new Set<() => void>()
setChainRpcUrl(settings.rpcUrl)

export const getNetworkSettings = () => settings

export function setNetworkSettings(value: NetworkSettings): void {
  settings = { rpcUrl: endpoint(value.rpcUrl), proverUrl: endpoint(value.proverUrl) }
  setChainRpcUrl(settings.rpcUrl)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useNetworkSettings() {
  return useSyncExternalStore(subscribe, getNetworkSettings, getNetworkSettings)
}
