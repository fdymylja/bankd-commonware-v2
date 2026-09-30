import { evmAddress } from '@bankd/shared/chain/client'
import {
  AUTHORITY_ABI,
  AUTHORITY_ADDRESS,
  COMPLIANCE_ABI,
  COMPLIANCE_ADDRESS,
} from '@bankd/shared/evm/bankd'

import { serverPublicClient } from '@/lib/rpc/server'

export type AuditEntry = {
  id: number
  height: number
  action: string
  authority: string
  addresses: string[]
  amount: { denom: string; amount: string }[]
  reason: string
  ref: string
}
export type ComplianceState = {
  height: number
  paused: boolean
  owner: string
  authorityModule: string
  sanctioned: string[]
  frozen: string[]
  entries: AuditEntry[]
}
export async function readAuthorityOwner() {
  return serverPublicClient().readContract({
    address: AUTHORITY_ADDRESS,
    abi: AUTHORITY_ABI,
    functionName: 'owner',
  })
}
export async function readAuthorityModule() {
  return AUTHORITY_ADDRESS
}
export async function readIsBlocked(address: string) {
  const client = serverPublicClient()
  const args = [evmAddress(address)] as const
  const [sanctioned, frozen] = await Promise.all([
    client.readContract({
      address: COMPLIANCE_ADDRESS,
      abi: COMPLIANCE_ABI,
      functionName: 'isSanctioned',
      args,
    }),
    client.readContract({
      address: COMPLIANCE_ADDRESS,
      abi: COMPLIANCE_ABI,
      functionName: 'isFrozen',
      args,
    }),
  ])
  return { sanctioned, frozen }
}
export async function readComplianceState(
  limit = 500
): Promise<ComplianceState> {
  const client = serverPublicClient()
  const [owner, height] = await Promise.all([
    readAuthorityOwner(),
    client.getBlockNumber(),
  ])
  const sanctioned = new Set<string>(),
    frozen = new Set<string>(),
    entries: AuditEntry[] = []
  // Every precompile registry mutation emits an event; errors must not become an empty list.
  for (let start = 0n; start <= height; start += 2000n) {
    const end = start + 1999n > height ? height : start + 1999n
    const logs = await client.getContractEvents({
      address: COMPLIANCE_ADDRESS,
      abi: COMPLIANCE_ABI,
      fromBlock: start,
      toBlock: end,
      strict: true,
    })
    for (const log of logs) {
      const args = log.args as any
      const account = args.account?.toLowerCase()
      if (log.eventName === 'ComplianceFreeze') frozen.add(account)
      if (log.eventName === 'ComplianceUnfreeze') frozen.delete(account)
      if (log.eventName === 'ComplianceAddSanctioned') sanctioned.add(account)
      if (log.eventName === 'ComplianceRemoveSanctioned')
        sanctioned.delete(account)
      entries.push({
        id: entries.length + 1,
        height: Number(log.blockNumber),
        action: log.eventName.replace('Compliance', '').toLowerCase(),
        authority: args.caller,
        addresses: account ? [account] : [args.from, args.to],
        amount:
          args.amount !== undefined
            ? [{ denom: 'abrl', amount: args.amount.toString() }]
            : [],
        reason: '',
        ref: log.transactionHash,
      })
    }
  }
  return {
    height: Number(height),
    paused: false,
    owner,
    authorityModule: AUTHORITY_ADDRESS,
    sanctioned: [...sanctioned],
    frozen: [...frozen],
    entries: entries.slice(-limit).reverse(),
  }
}
