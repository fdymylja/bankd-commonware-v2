//! bankd precompiles: Authority, Native, Compliance, BankSend and Shield.
//!
//! Kept in one module so upstream tempo rebases only touch a few registration lines.

pub mod authority;
pub mod bank_send;
pub mod compliance;
pub mod native;
pub mod shield;

pub use authority::Authority;
pub use bank_send::BankSend;
pub use compliance::Compliance;
pub use native::Native;
pub use shield::Shield;

use crate::error::{Result, TempoPrecompileError};
use alloy::primitives::{Address, U256};
use tempo_contracts::precompiles::BankdError;

pub(crate) fn bankd_err(e: BankdError) -> TempoPrecompileError {
    TempoPrecompileError::BankdError(e)
}

/// Moves native BRL between accounts with no compliance checks. Callers do those.
pub(crate) fn move_native(from: Address, to: Address, amount: U256) -> Result<()> {
    let mut storage = crate::storage::StorageCtx;
    let available = storage.balance(from)?;
    let Some(remaining) = available.checked_sub(amount) else {
        return Err(bankd_err(BankdError::insufficient_native_balance(
            from, available, amount,
        )));
    };
    storage.set_balance(from, remaining)?;
    // read `to` after the debit so a self-transfer nets to zero
    let to_balance = storage.balance(to)?;
    let credited = to_balance
        .checked_add(amount)
        .ok_or_else(TempoPrecompileError::under_overflow)?;
    storage.set_balance(to, credited)
}
