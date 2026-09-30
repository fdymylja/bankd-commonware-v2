// src/lib/safe/types.ts
/**
 * Types for the native EVM-Safe host surface. Mirrors the cosmos-multisig
 * paste-blob flow (see multisig/types.ts) but for Safe `execTransaction`:
 * propose -> collect owner sigs -> execute.
 *
 * uint256 fields are kept as decimal strings so a SafeTx round-trips through
 * JSON (paste blobs) and IndexedDB without bigint serialization headaches.
 */

import type { Hex } from 'viem'

/**
 * A Safe transaction - the 10 fields `getTransactionHash` / `execTransaction`
 * take. `value`, gas fields and `nonce` are decimal strings (wei / raw units).
 */
export interface SafeTx {
  to: Hex
  /** wei, decimal string. */
  value: string
  data: Hex
  /** 0 = CALL, 1 = DELEGATECALL. Always 0 here. */
  operation: number
  safeTxGas: string
  baseGas: string
  gasPrice: string
  gasToken: Hex
  refundReceiver: Hex
  /** the Safe nonce this tx was built against, decimal string. */
  nonce: string
}

/** A pending (partially signed) Safe transaction. */
export interface PendingSafeTx {
  id: string
  /** MultisigConfig.id of the owning Safe wallet. */
  safeId: string
  safeAddress: Hex
  /** EVM chain id the Safe lives on. */
  chainId: number
  safeTx: SafeTx
  /** contract-computed EIP-712 digest owners sign (the raw hash). */
  safeTxHash: Hex
  /** duplicated from safeTx for quick display / stale-nonce checks. */
  nonce: string
  /** short human summary for the pending list. */
  summary: string
  /** lowercased owner address -> 65-byte `r||s||v` signature hex. */
  signatures: Record<string, Hex>
  createdAt: number
}

/**
 * Paste-blob the initiator exports: each owner imports it, signs the
 * `safeTxHash`, and returns a {@link SafeMemberSignatureBlob}.
 */
export interface UnsignedSafeTxBlob {
  kind: 'bankd-safe-unsigned-tx'
  safe: {
    label: string
    safeAddress: Hex
    chainId: number
  }
  tx: {
    safeTx: SafeTx
    safeTxHash: Hex
    nonce: string
    summary: string
  }
}

/** An owner's signature contribution back to the initiator. */
export interface SafeMemberSignatureBlob {
  kind: 'bankd-safe-member-signature'
  safeAddress: Hex
  safeTxHash: Hex
  ownerAddress: Hex
  signature: Hex
}

/**
 * Sentinel returned by `executeTx` when a Safe is the active wallet: instead of
 * broadcasting, the step was enqueued as a Safe proposal. Callers that only
 * toast success ignore it; callers that read a broadcast result (transaction
 * hash, deployed address, decoded response) must narrow it out first - see
 * `assertBroadcast` in src/lib/evm/execute.ts. It's a separate type (not a field
 * on ExecuteTransactionResult) so tsc flags every unsafe result read.
 */
export interface ProposedTransactionResult {
  status: 'proposed'
  /** id of the PendingSafeTx that was enqueued. */
  pendingSafeTxId: string
  /**
   * For a deploy step, the CREATE2 address it will deploy to. Known up front (the
   * proposal executes later from the co-sign modal), so callers can save it now.
   */
  contractAddress?: Hex
}

/** Which kind of Safe tx the propose form is building. */
export type SafeTxVariant =
  | 'native-send'
  | 'cosmos-send'
  | 'authority-send'
  | 'add-owner'
  | 'change-threshold'
