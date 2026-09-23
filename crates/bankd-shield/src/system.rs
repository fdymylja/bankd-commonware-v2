//! Where the shieldd app hash lives in reth state.
//!
//! Core writes [`ROOT_SLOT`] and [`HEIGHT_SLOT`] on [`SHIELD_ADDRESS`] at the end
//! of every block, so the shieldd root is covered by the single reth state root.

use alloy_primitives::{Address, B256, U256, address};

/// SHLD precompile address, same as bankd v1. Its storage also holds the shieldd
/// root so no extra system account is needed.
pub const SHIELD_ADDRESS: Address = address!("0x0000000000000000000000000000000053484C44");

/// Slot holding the shieldd app hash committed by the current block.
pub const ROOT_SLOT: U256 = U256::ZERO;

/// Slot holding the shieldd height matching [`ROOT_SLOT`], lets readers detect a
/// stale root without decoding shieldd state.
pub const HEIGHT_SLOT: U256 = U256::from_limbs([1, 0, 0, 0]);

/// Storage writes core applies on [`SHIELD_ADDRESS`] after `commit`.
pub fn root_slot_writes(height: u64, root: B256) -> [(U256, U256); 2] {
    [
        (ROOT_SLOT, U256::from_be_bytes(root.0)),
        (HEIGHT_SLOT, U256::from(height)),
    ]
}

/// Shieldd denom for native BRL (18 decimals, atto-BRL). Unregistered in
/// shieldd's asset registry, so it parses as a plain base denom and gets
/// registered on the first deposit.
pub const BRL_DENOM: &str = "abrl";
