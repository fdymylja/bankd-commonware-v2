// src/lib/multisig/types.ts
/**
 * Types for the Cosmos-SDK multisig wallet (and Safe watch-only entries).
 *
 * Everything here is public data: member pubkeys, threshold, addresses. No
 * secrets ever touch this module - the initiator's signing key is pulled from
 * the unlocked native wallet only at signing time.
 */

/** eth_secp256k1 pubkey typeUrl used by chain accounts (cosmos/evm). */
export const ETH_SECP256K1_PUBKEY_TYPE =
  '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey'

/** LegacyAminoPubKey typeUrl - the on-chain multisig pubkey wrapper. */
export const LEGACY_AMINO_PUBKEY_TYPE =
  '/cosmos.crypto.multisig.LegacyAminoPubKey'

/** A single member of a cosmos multisig. */
export interface MultisigMember {
  /** bech32 (`wallet1...`) account address of the member. */
  address: string
  /** compressed 33-byte secp256k1 pubkey, base64. */
  pubkeyBase64: string
}

/** A saved multisig/Safe wallet config. */
export interface MultisigConfig {
  id: string
  label: string
  type: 'cosmos-multisig' | 'safe'
  createdAt: number
  // cosmos-multisig
  threshold?: number
  members?: MultisigMember[]
  cosmosAddress?: string
  // safe (watch-only)
  safeAddress?: string
}

/** A pending (partially signed) multisig transaction. */
export interface PendingMultisigTx {
  id: string
  multisigId: string
  chainId: string
  accountNumber: number
  sequence: number
  /** proto-encoded TxBody bytes, base64. */
  bodyBytesB64: string
  fee: {
    amount: string
    gas: string
  }
  /** the amino StdSignDoc each member signs, JSON-stringified. */
  signDocJson: string
  /** memberAddress -> base64 `[R||S]` signature. */
  signatures: Record<string, string>
  /** short human summary for the pending list. */
  summary?: string
  createdAt: number
}

/** Which wallet the UI is currently acting as. */
export type ActiveWallet = 'personal' | { multisigId: string }

/**
 * Paste-blob exchanged between co-signers: the initiator exports this, each
 * member imports it, signs, and returns a `MemberSignatureBlob`.
 */
export interface UnsignedTxBlob {
  kind: 'bankd-multisig-unsigned-tx'
  multisig: {
    label: string
    threshold: number
    members: MultisigMember[]
    cosmosAddress: string
  }
  tx: {
    chainId: string
    accountNumber: number
    sequence: number
    bodyBytesB64: string
    fee: { amount: string; gas: string }
    signDocJson: string
    summary?: string
  }
}

/** A member's contribution back to the initiator. */
export interface MemberSignatureBlob {
  kind: 'bankd-multisig-member-signature'
  cosmosAddress: string
  memberAddress: string
  signatureB64: string
}
