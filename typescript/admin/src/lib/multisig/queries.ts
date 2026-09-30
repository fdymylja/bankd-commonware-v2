// src/lib/multisig/queries.ts
/**
 * On-chain lookups for building a multisig. A member's pubkey is only known to
 * the chain once that account has signed at least one tx - before that we fall
 * back to manual paste in the UI.
 */

import { getStargateClient } from '@/lib/cosmos'

/**
 * Fetch a member's compressed secp256k1 pubkey (base64) from chain state.
 * Returns null when the account has never signed (no pubkey recorded yet).
 */
export async function fetchMemberPubkey(address: string): Promise<string | null> {
  const client = await getStargateClient()
  const account = await client.getAccount(address)
  return account?.pubkey?.value ?? null
}
