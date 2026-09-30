// src/lib/multisig/share.ts
/**
 * Import/export a multisig (or Safe) config as a shareable JSON blob, so parties
 * can hand a multisig to each other without re-typing every member pubkey. The
 * cosmos address is deterministic from members+threshold, so an imported config
 * resolves to the exact same multisig; we drop the local `id`/`createdAt` and let
 * the importer's store assign fresh ones.
 */

import { deriveMultisigAddress } from './pubkey'
import type { MultisigConfig, MultisigMember } from './types'

/** A portable multisig/Safe config. No secrets - just members, threshold, addrs. */
export interface MultisigShareBlob {
  kind: 'bankd-multisig-config'
  version: 1
  type: 'cosmos-multisig' | 'safe'
  label: string
  // cosmos-multisig
  threshold?: number
  members?: MultisigMember[]
  cosmosAddress?: string
  // safe (watch-only)
  safeAddress?: string
}

/** Build the shareable blob from a saved config (drops id/createdAt). */
export function buildShareBlob(cfg: MultisigConfig): MultisigShareBlob {
  return {
    kind: 'bankd-multisig-config',
    version: 1,
    type: cfg.type,
    label: cfg.label,
    threshold: cfg.threshold,
    members: cfg.members,
    cosmosAddress: cfg.cosmosAddress,
    safeAddress: cfg.safeAddress,
  }
}

/** Parse + validate a pasted share blob. Throws with a clear message on bad input. */
export function parseShareBlob(text: string): MultisigShareBlob {
  let parsed: MultisigShareBlob
  try {
    parsed = JSON.parse(text) as MultisigShareBlob
  } catch {
    throw new Error('Not valid JSON')
  }
  if (parsed?.kind !== 'bankd-multisig-config') {
    throw new Error('Not a multisig config blob')
  }
  if (parsed.type === 'cosmos-multisig') {
    if (!parsed.members?.length || !parsed.threshold) {
      throw new Error('Config is missing members or threshold')
    }
    if (parsed.members.some((m) => !m.address || !m.pubkeyBase64)) {
      throw new Error('A member is missing its address or pubkey')
    }
    // The cosmos address is deterministic from members+threshold. Re-derive it
    // and reject a blob whose stated address doesn't match - otherwise a tampered
    // members list would resolve to an attacker-chosen account under the label
    // you think you're importing. Fill it in if the blob omitted it.
    const derived = deriveMultisigAddress(parsed.members, parsed.threshold)
    if (parsed.cosmosAddress && parsed.cosmosAddress !== derived) {
      throw new Error('Config address does not match its members/threshold')
    }
    parsed.cosmosAddress = derived
  } else if (parsed.type === 'safe') {
    if (!parsed.safeAddress) throw new Error('Config is missing the Safe address')
  } else {
    throw new Error('Unknown multisig type')
  }
  return parsed
}
