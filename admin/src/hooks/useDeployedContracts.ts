'use client'

import { MOCK_ERC20_ABI } from '@bankd/shared/evm/mockERC20'
import { useQuery } from '@tanstack/react-query'
import { getBytecode, readContract } from '@wagmi/core'
import { type Hex, formatUnits, isAddress } from 'viem'

import { chainDefinition } from '@/lib/config'
import type { ContractInventory, DeployedContract } from '@/lib/contracts/deployed'
import { makeWagmiConfig } from '@/lib/evm/wagmi'

export type Erc20Info = { name: string; symbol: string; decimals: number; totalSupply: bigint; totalSupplyFormatted: string }
export type EnrichedContract = DeployedContract & { hasCode: boolean; erc20: Erc20Info | null }
type EnrichmentOperations = { getCode(address: `0x${string}`): Promise<Hex | undefined>; read(address: `0x${string}`, functionName: 'name'|'symbol'|'decimals'|'totalSupply'): Promise<unknown> }

export function validateContractInventory(value: unknown): ContractInventory {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed contract inventory response')
  const body = value as Record<string, any>
  if (!Array.isArray(body.contracts) || !Number.isSafeInteger(body.identity?.chainId) || !isAddress(body.identity?.wallet) || body.provenance?.source !== 'Shinzo' || body.provenance?.rpcAgreement !== true || !Array.isArray(body.provenance?.signerIds) || typeof body.coverage?.truncated !== 'boolean' || body.limitations?.topLevelCreate !== true) throw new Error('Malformed contract inventory response')
  for (const contract of body.contracts) if (!isAddress(contract?.address) || !isAddress(contract?.deployer) || typeof contract?.txHash !== 'string' || !Number.isSafeInteger(contract?.blockNumber)) throw new Error('Malformed deployed contract row')
  return value as ContractInventory
}
export async function enrichContractInventory(value: unknown, expectedChainId: number, operations: EnrichmentOperations): Promise<Omit<ContractInventory, 'contracts'> & { contracts: EnrichedContract[] }> {
  const inventory = validateContractInventory(value)
  if (inventory.identity.chainId !== expectedChainId || inventory.provenance.rpcAgreement !== true) throw new Error(`Contract inventory chain ${inventory.identity.chainId} does not match configured chain ${expectedChainId}`)
  const contracts = await Promise.all(inventory.contracts.map(async (contract): Promise<EnrichedContract> => {
    const code = await operations.getCode(contract.address).catch(() => undefined)
    const hasCode = !!code && code !== '0x'
    if (!hasCode) return { ...contract, hasCode, erc20: null }
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all(['name','symbol','decimals','totalSupply'].map((fn) => operations.read(contract.address, fn as 'name'|'symbol'|'decimals'|'totalSupply')))
      if (typeof name !== 'string' || typeof symbol !== 'string' || typeof decimals !== 'number' || typeof totalSupply !== 'bigint') throw new Error('Invalid ERC20 metadata')
      return { ...contract, hasCode, erc20: { name, symbol, decimals, totalSupply, totalSupplyFormatted: formatUnits(totalSupply, decimals) } }
    } catch { return { ...contract, hasCode, erc20: null } }
  }))
  return { ...inventory, contracts }
}
async function fetchDeployed(): Promise<unknown> { const response = await fetch('/api/contracts', { cache: 'no-store' }); if (!response.ok) { const body = await response.json().catch(() => ({})) as {error?:string}; throw new Error(body.error ?? `contract index returned HTTP ${response.status}`) } return response.json() }
function wagmiOperations(): EnrichmentOperations { const config=makeWagmiConfig(); return { getCode: (address)=>getBytecode(config,{address}), read: (address,functionName)=>readContract(config,{address,abi:MOCK_ERC20_ABI,functionName} as never) } }
export function useDeployedContracts(options?: { enabled?: boolean }) { return useQuery({ queryKey:['deployedContracts'], queryFn:async()=>enrichContractInventory(await fetchDeployed(),chainDefinition.id,wagmiOperations()), enabled:options?.enabled??true, refetchInterval:15_000 }) }
