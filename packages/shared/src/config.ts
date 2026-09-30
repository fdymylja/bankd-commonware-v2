import { Hex } from 'viem'

// Try NEXT_PUBLIC_ or EXPO_PUBLIC_ env vars, then fallback to default.
// Keep references static so Next.js/Expo can inline public env vars in browser bundles.
const PUBLIC_ENV: Record<string, string | undefined> = {
  PENUMBRA_CHAIN_ID: process.env.NEXT_PUBLIC_PENUMBRA_CHAIN_ID || process.env.EXPO_PUBLIC_PENUMBRA_CHAIN_ID,
  PENUMBRA_RPC_URL: process.env.NEXT_PUBLIC_PENUMBRA_RPC_URL || process.env.EXPO_PUBLIC_PENUMBRA_RPC_URL,
  PENUMBRA_GRPC_URL: process.env.NEXT_PUBLIC_PENUMBRA_GRPC_URL || process.env.EXPO_PUBLIC_PENUMBRA_GRPC_URL,
  PENUMBRA_PROVER_URL: process.env.NEXT_PUBLIC_PENUMBRA_PROVER_URL || process.env.EXPO_PUBLIC_PENUMBRA_PROVER_URL,
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || process.env.EXPO_PUBLIC_RPC_URL,
  REST_URL: process.env.NEXT_PUBLIC_REST_URL || process.env.EXPO_PUBLIC_REST_URL,
  GRPC_WEB: process.env.NEXT_PUBLIC_GRPC_WEB || process.env.EXPO_PUBLIC_GRPC_WEB,
  EVM_RPC: process.env.NEXT_PUBLIC_EVM_RPC || process.env.EXPO_PUBLIC_EVM_RPC,
  EVM_WEBSOCKET: process.env.NEXT_PUBLIC_EVM_WEBSOCKET || process.env.EXPO_PUBLIC_EVM_WEBSOCKET,
}

// Warn when falling back so misconfigured admin/mobile environments do not
// silently connect to localhost endpoints.
const warnedFallbackEnvVars = new Set<string>()

const GET_ENV_VAR = (name: keyof typeof PUBLIC_ENV, fallback = '') => {
  const value = PUBLIC_ENV[name]
  if (value) return value

  if (fallback && !warnedFallbackEnvVars.has(name)) {
    warnedFallbackEnvVars.add(name)
    console.warn(`[config] Missing NEXT_PUBLIC_${name}/EXPO_PUBLIC_${name}; using fallback: ${fallback}`)
  }

  return fallback
}

export const penumbraConfig = {
  chainId: GET_ENV_VAR('PENUMBRA_CHAIN_ID', 'penumbra-local-devnet'),
  rpcUrl: GET_ENV_VAR('PENUMBRA_RPC_URL', 'http://localhost:16657'),
  grpcUrl: GET_ENV_VAR('PENUMBRA_GRPC_URL', 'http://localhost:8080'),
  proverUrl: GET_ENV_VAR('PENUMBRA_PROVER_URL', 'http://localhost:8090'),
}

export const chainConfig = {
  chainId: '9001',
  chainName: 'bankd',
  prettyName: 'Bankd',
  rpc: GET_ENV_VAR('RPC_URL', 'http://localhost:27657'),
  rest: GET_ENV_VAR('REST_URL', 'http://localhost:11317'),
  grpcWeb: GET_ENV_VAR('GRPC_WEB', 'http://localhost:11317'),
  evmRpc: GET_ENV_VAR('EVM_RPC', 'http://localhost:8545'),
  evmWebSocket: GET_ENV_VAR('EVM_WEBSOCKET', 'ws://localhost:8546'),
  bech32Prefix: 'wallet',
  denom: 'ubrl',
  displayDenom: 'BRL',
  decimals: 6,
  coinType: 60, // EVM compatible
  evmChainId: 9001,
  nativeErc20Address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Hex,
} as const

export type ChainConfig = typeof chainConfig
export type PenumbraConfig = typeof penumbraConfig
