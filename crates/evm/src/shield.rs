//! Hooks that run the embedded shieldd state machine inside block execution.
//!
//! tempo-evm only sees these traits; the node plugs in `bankd-shield`. Keeping shieldd
//! behind a trait keeps its heavy dependency graph out of this crate and lets tests use a
//! mock.

use alloy_primitives::{Address, B256, U256};
use std::{fmt::Debug, sync::Arc};

/// Storage slot on `SHIELD_ADDRESS` holding the shieldd root of the latest block.
pub const SHIELD_ROOT_SLOT: U256 = U256::ZERO;
/// Storage slot on `SHIELD_ADDRESS` holding the height matching [`SHIELD_ROOT_SLOT`].
pub const SHIELD_HEIGHT_SLOT: U256 = U256::from_limbs([1, 0, 0, 0]);

/// A deposit the SHLD precompile escrowed, forwarded to shieldd after its tx commits.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShieldDepositInput {
    /// EVM account that sent the BRL (refunded if shieldd refuses the deposit).
    pub sender: Address,
    /// Shieldd recipient address string.
    pub recipient: String,
    /// Amount in wei.
    pub amount: U256,
    /// Hash of the tx that emitted the deposit.
    pub tx_hash: B256,
    /// Index of that tx in the block.
    pub tx_index: u32,
    /// Index of the deposit log within the tx.
    pub msg_index: u32,
}

/// Outcome of one shielded (0x77) tx.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShieldTxOutcome {
    /// Applied. Each payout moves BRL from the SHLD escrow to an EVM account.
    Accepted {
        /// `(recipient, wei)` payouts from shielded withdrawals.
        payouts: Vec<(Address, U256)>,
    },
    /// Included but failed, shieldd state unchanged.
    Rejected(String),
}

/// One block's exclusive use of the shieldd engine. Dropping it without `finish` abandons
/// the block (a cancelled payload build, a failed validation).
pub trait ShieldSession: Send {
    /// Starts block `height` on the shieldd root its parent left in the root slot.
    fn begin_block(&mut self, parent_root: B256, height: u64, timestamp: u64)
    -> Result<(), String>;
    /// Returns false when shieldd refused the deposit and the escrow must be refunded.
    fn deposit(&mut self, deposit: ShieldDepositInput) -> Result<bool, String>;
    /// Applies a shielded tx payload.
    fn deliver_tx(&mut self, payload: &[u8]) -> Result<ShieldTxOutcome, String>;
    /// Ends the block and returns the shieldd root to write into the root slot. Nothing
    /// is persisted until consensus finalizes the block.
    fn finish(&mut self) -> Result<B256, String>;
}

/// Source of [`ShieldSession`]s, one block at a time.
pub trait ShieldEngine: Send + Sync + Debug {
    /// Blocks until no other block holds the engine.
    fn session(&self) -> Box<dyn ShieldSession>;

    /// Persists the finalized block whose shieldd root is `root` (and its unfinalized
    /// ancestors), dropping candidates on dead forks. Idempotent per height.
    fn finalize(&self, root: B256, height: u64) -> Result<(), String>;

    /// Pool check of a 0x77 payload (proof, fee, nullifiers) against finalized state.
    fn check_tx(&self, payload: &[u8]) -> Result<(), String>;

    /// Snapshots finalized shieldd state to disk for an offline wallet to sync from.
    /// Returns the checkpoint dir and the finalized height it holds.
    fn checkpoint(&self) -> Result<(std::path::PathBuf, u64), String> {
        Err("checkpoints not supported".to_owned())
    }

    /// Bounded protobuf queries against finalized state for browser wallets.
    fn query(&self, _method: &str, _request: &[u8]) -> Result<Vec<Vec<u8>>, String> {
        Err("shield queries not supported".to_owned())
    }
}

/// Shared handle stored in the EVM config.
pub type ShieldHandle = Arc<dyn ShieldEngine>;
