//! Shieldd privacy layer embedded in bankd v2.
//!
//! [`ShieldExecutor`] drives shieldd's host execution lifecycle (the same one the
//! Go chain reaches over cgo) as a plain Rust library. [`system`] holds the
//! constants tempo needs to anchor the shieldd root in reth state.

mod executor;
mod records;
pub mod system;

pub use executor::{BlockMode, ShieldDeposit, ShieldError, ShieldExecutor, ShieldFee, TxOutcome};
pub use shieldd_sdk_app::{
    app::HostWithdrawal,
    genesis::{AppState, Content},
};
