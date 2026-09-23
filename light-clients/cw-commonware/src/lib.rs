//! 08-wasm light client for bankd. Rust port of `contracts/src/light-client/CommonwareLightClient.sol`.
//!
//! Unlike the Solidity client, this takes tempo's raw certificate: the CosmWasm BLS12-381 host
//! functions work on compressed points, so no relayer side decompression is needed.

pub mod cert;
pub mod contract;
pub mod error;
pub mod header;
pub mod membership;
pub mod msg;
pub mod state;
pub mod types;
pub mod verify;

pub use error::Error;
