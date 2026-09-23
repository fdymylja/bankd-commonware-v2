//! The client's own data: what goes in the 08-wasm `data` fields and the proof bytes.
//! All JSON, bytes as 0x hex.

use alloy_primitives::{Address, Bytes, FixedBytes, B256};
use serde::{Deserialize, Serialize};

use crate::verify::G2_COMPRESSED;

/// A committee's compressed G2 group key, valid for one epoch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EpochKey {
    pub epoch: u64,
    pub key: FixedBytes<G2_COMPRESSED>,
}

/// `ClientState.data`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClientState {
    /// ICS26Router whose storage holds the commitments.
    pub router: Address,
    /// Simplex namespace, `TEMPO` on bankd.
    pub namespace: Bytes,
    pub epoch_length: u64,
    pub latest_height: u64,
    #[serde(default)]
    pub frozen: bool,
    /// Keys for the latest epoch and, after a boundary block, the next one. Older ones are pruned.
    pub keys: Vec<EpochKey>,
}

impl ClientState {
    pub fn key(&self, epoch: u64) -> Option<[u8; G2_COMPRESSED]> {
        self.keys.iter().find(|k| k.epoch == epoch).map(|k| k.key.0)
    }
}

/// `ConsensusState.data`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsensusState {
    /// Block timestamp in seconds.
    pub timestamp: u64,
    pub state_root: B256,
}

/// `ClientMessage.data`: a finalized header.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Header {
    /// RLP TempoHeader. Its keccak is the certified payload.
    pub header_rlp: Bytes,
    /// Tempo's `Finalization`, the `certificate` from `consensus_getFinalization`.
    pub certificate: Bytes,
}

/// The `proof` bytes of (non)membership checks, from `eth_getProof` on the router.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MembershipProof {
    /// RLP account `[nonce, balance, storage_root, code_hash]`, proven by `account_proof`.
    pub account: Bytes,
    pub account_proof: Vec<Bytes>,
    pub storage_proof: Vec<Bytes>,
}
