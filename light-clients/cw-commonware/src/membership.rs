//! Commitment proofs against a bankd state root. Mirrors `CommonwareLightClient._prepare`:
//! an MPT account proof for the ICS26 router, then a storage proof for the commitment slot.

use alloy_primitives::{keccak256, Address, Bytes, B256, U256};
use alloy_rlp::{Decodable, Encodable};
use alloy_trie::{nodes::TrieNode, proof::verify_proof, Nibbles};

use crate::{types::MembershipProof, Error};

/// ERC-7201 slot of ibc-contracts' `IBCStoreUpgradeable`, same constant the Besu client uses.
pub const IBCSTORE_STORAGE_SLOT: B256 =
    alloy_primitives::b256!("1260944489272988d9df285149b5aa1b0f48f2136d6f416159f840a3e0747600");

/// Storage slot of `commitments[keccak(path)]` in the router.
pub fn commitment_slot(path: &[u8]) -> B256 {
    let mut buf = [0u8; 64];
    buf[..32].copy_from_slice(keccak256(path).as_slice());
    buf[32..].copy_from_slice(IBCSTORE_STORAGE_SLOT.as_slice());
    keccak256(buf)
}

/// Checks `path` holds `value` (or nothing, when `value` is `None`) in `router`'s storage.
///
/// `key_path` comes from ibc-go. With the EVM counterparty prefix `[""]` it's a single element.
pub fn verify(
    state_root: B256,
    router: Address,
    key_path: &[Vec<u8>],
    proof: &MembershipProof,
    value: Option<&[u8]>,
) -> Result<(), Error> {
    let [path] = key_path else {
        return Err(Error::InvalidPath);
    };

    // The account leaf is given in full, since verify_proof checks an exact value.
    verify_proof(
        state_root,
        Nibbles::unpack(keccak256(router)),
        Some(proof.account.to_vec()),
        &proof.account_proof,
    )
    .map_err(|e| Error::InvalidProof(format!("account: {e}")))?;
    let storage_root =
        storage_root(&proof.account).ok_or(Error::InvalidProof("account rlp".into()))?;

    let expected = match value {
        Some(v) => {
            let v: [u8; 32] = v.try_into().map_err(|_| Error::InvalidValueLength)?;
            // Storage leaves hold rlp(uint256), leading zeros stripped. A zero value is absence.
            let mut out = Vec::new();
            U256::from_be_bytes(v).encode(&mut out);
            Some(out)
        }
        None => None,
    };
    verify_proof(
        storage_root,
        Nibbles::unpack(keccak256(commitment_slot(path))),
        expected,
        &proof.storage_proof,
    )
    .map_err(|e| Error::InvalidProof(format!("storage: {e}")))
}

/// `storage_root` of an rlp account `[nonce, balance, storage_root, code_hash]`.
fn storage_root(mut account: &[u8]) -> Option<B256> {
    let h = alloy_rlp::Header::decode(&mut account).ok()?;
    if !h.list || h.payload_length != account.len() {
        return None;
    }
    u64::decode(&mut account).ok()?;
    U256::decode(&mut account).ok()?;
    let root = B256::decode(&mut account).ok()?;
    B256::decode(&mut account).ok()?;
    account.is_empty().then_some(root)
}

/// The account rlp from the last node of an account proof, for relayers and tests that only
/// have the proof nodes.
pub fn account_from_proof(account_proof: &[Bytes]) -> Option<Bytes> {
    let last = account_proof.last()?;
    match TrieNode::decode(&mut last.as_ref()).ok()? {
        TrieNode::Leaf(leaf) => Some(Bytes::from(leaf.value)),
        _ => None,
    }
}
