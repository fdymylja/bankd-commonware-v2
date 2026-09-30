// src/lib/safe/chain.ts
/**
 * Live Safe reads via raw `eth_call` against the chain's EVM RPC (same shape as
 * page.tsx's fetchEvmCode). We let the Safe contract compute its own EIP-712
 * digest through `getTransactionHash` rather than reconstructing the domain by
 * hand - provably matches what `execTransaction` will verify.
 */

'use client'

import {
  type Hex,
  decodeFunctionResult,
  encodeFunctionData,
} from 'viem'

import { chainConfig } from '@/lib/config'

import { SAFE_ABI } from './abi'
import { safeTxHashArgs } from './tx'
import type { SafeTx } from './types'

/** Live owners/threshold/nonce of a Safe. */
export interface SafeInfo {
  owners: Hex[]
  threshold: number
  /** decimal string. */
  nonce: string
}

/** POST an `eth_call` to the configured EVM RPC, returning the raw result hex. */
async function ethCall(to: string, data: Hex): Promise<Hex> {
  const res = await fetch(chainConfig.evmRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  })
  const json = (await res.json()) as {
    result?: string
    error?: { message?: string }
  }
  if (json.error) throw new Error(json.error.message ?? 'eth_call failed')
  return (json.result ?? '0x') as Hex
}

async function readSafe<T>(
  addr: string,
  functionName: 'nonce' | 'getOwners' | 'getThreshold'
): Promise<T> {
  const data = encodeFunctionData({ abi: SAFE_ABI, functionName })
  const result = await ethCall(addr, data)
  return decodeFunctionResult({ abi: SAFE_ABI, functionName, data: result }) as T
}

/** Fetch owners, threshold and current nonce for a Safe. */
export async function getSafeInfo(addr: string): Promise<SafeInfo> {
  const [owners, threshold, nonce] = await Promise.all([
    readSafe<readonly Hex[]>(addr, 'getOwners'),
    readSafe<bigint>(addr, 'getThreshold'),
    readSafe<bigint>(addr, 'nonce'),
  ])
  return {
    owners: [...owners],
    threshold: Number(threshold),
    nonce: nonce.toString(),
  }
}

/** Just the current nonce (decimal string) - used for the stale-nonce guard. */
export async function getSafeNonce(addr: string): Promise<string> {
  const nonce = await readSafe<bigint>(addr, 'nonce')
  return nonce.toString()
}

/**
 * Ask the Safe to compute the EIP-712 digest for a SafeTx. Owners sign this raw
 * hash. `getTransactionHash` is a view call, so no state changes.
 */
export async function getSafeTxHash(addr: string, tx: SafeTx): Promise<Hex> {
  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'getTransactionHash',
    args: safeTxHashArgs(tx),
  })
  const result = await ethCall(addr, data)
  return decodeFunctionResult({
    abi: SAFE_ABI,
    functionName: 'getTransactionHash',
    data: result,
  }) as Hex
}
