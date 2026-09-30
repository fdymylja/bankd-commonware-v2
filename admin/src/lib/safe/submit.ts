// src/lib/safe/submit.ts
/**
 * Execute a fully-signed Safe tx. Submits `execTransaction` from the connected
 * personal account (pays gas; min-gas-price is 0 on the testnet), reusing the
 * native EVM write path.
 *
 * A stale-nonce guard runs first: two proposals built at the same Safe nonce
 * can't both execute, so we re-fetch the live nonce and refuse if it advanced
 * past the pending tx's nonce.
 */

'use client'

import { type Hex, decodeEventLog } from 'viem'

import { writeEthContractAndWait } from '@/lib/evm/write'

import { CREATE_CALL_ABI, CREATE_CALL_ADDRESS, SAFE_ABI } from './abi'
import { getSafeInfo, getSafeNonce } from './chain'
import { concatSignatures } from './sign'
import { safeTxExecArgs } from './tx'
import type { PendingSafeTx } from './types'

/** Outcome of executing a Safe tx: always a hash, plus a deployed address when
 * the tx ran a CreateCall deployment. */
export interface SafeExecResult {
  transactionHash: Hex
  deployedAddress?: Hex
}

/** Pull the deployed address out of a CreateCall ContractCreation log, if any. */
function findDeployedAddress(logs: readonly { address: string; data: Hex; topics: [] }[]): Hex | undefined {
  for (const log of logs) {
    if (log.address.toLowerCase() !== CREATE_CALL_ADDRESS.toLowerCase()) continue
    try {
      const parsed = decodeEventLog({
        abi: CREATE_CALL_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'ContractCreation') {
        return (parsed.args as { newContract: Hex }).newContract
      }
    } catch {
      // not the event we're after
    }
  }
  return undefined
}

/**
 * Concatenate collected owner signatures (ascending order), re-check the live
 * nonce, then submit `execTransaction`. Throws on a stale nonce or if too few
 * owner signatures are present.
 */
export async function executeSafeTx(
  pending: PendingSafeTx
): Promise<SafeExecResult> {
  const info = await getSafeInfo(pending.safeAddress)

  // Stale-nonce guard: if the chain nonce moved past what this tx was built
  // against, its hash no longer matches and execution would revert.
  if (info.nonce !== pending.nonce) {
    throw new Error(
      `Stale nonce: Safe is at nonce ${info.nonce}, this tx was built for ${pending.nonce}. Recreate it.`
    )
  }

  const signerCount = Object.keys(pending.signatures).length
  if (signerCount < info.threshold) {
    throw new Error(
      `Need ${info.threshold} signatures, have ${signerCount}`
    )
  }

  const signatures = concatSignatures(pending.signatures)
  const receipt = await writeEthContractAndWait({
    address: pending.safeAddress,
    abi: SAFE_ABI,
    functionName: 'execTransaction',
    args: safeTxExecArgs(pending.safeTx, signatures),
  })
  return {
    transactionHash: receipt.transactionHash,
    deployedAddress: findDeployedAddress(
      receipt.logs as unknown as { address: string; data: Hex; topics: [] }[]
    ),
  }
}

/** Re-export so callers can surface a live-vs-pending nonce warning. */
export { getSafeNonce }
