import { ethers } from 'ethers'

import { chainConfig } from '../config'

// Get provider for EVM JSON-RPC
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(chainConfig.evmRpc)
}

// Parse amount string to bigint with decimals
export function parseAmount(amount: string, decimals: number = chainConfig.decimals): bigint {
  const [whole, fractional = ''] = amount.split('.')
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFractional)
}
