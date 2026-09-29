//! Cosmos style addresses. `address = ripemd160(sha256(compressed_pubkey))`,
//! keys derived at `m/44'/118'/0'/0/{index}`.

use alloy_primitives::Address;
use bech32::{Bech32, Hrp};
use coins_bip32::prelude::XPriv;
use coins_bip39::{English, Mnemonic};
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};

/// Human readable prefix for Juno.
pub const JUNO_HRP: &str = "juno";

/// Errors from derivation and bech32 handling.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid mnemonic: {0}")]
    Mnemonic(String),
    #[error("key derivation: {0}")]
    Derivation(String),
    #[error("invalid hrp: {0}")]
    Hrp(#[from] bech32::primitives::hrp::Error),
    #[error("bech32 encode: {0}")]
    Encode(#[from] bech32::EncodeError),
    #[error("bech32 decode: {0}")]
    Decode(#[from] bech32::DecodeError),
    #[error("expected hrp {expected}, got {got}")]
    WrongHrp { expected: String, got: String },
    #[error("expected 20 byte address, got {0}")]
    BadLength(usize),
}

/// Cosmos derivation path for account index `index`.
pub fn derivation_path(index: u32) -> String {
    format!("m/44'/118'/0'/0/{index}")
}

/// Derives the private key bytes from a BIP39 mnemonic at `m/44'/118'/0'/0/{index}`.
pub fn private_key_from_mnemonic(phrase: &str, index: u32) -> Result<[u8; 32], Error> {
    let mnemonic =
        Mnemonic::<English>::new_from_phrase(phrase).map_err(|e| Error::Mnemonic(e.to_string()))?;
    let seed = mnemonic
        .to_seed(None)
        .map_err(|e| Error::Mnemonic(e.to_string()))?;
    let root = XPriv::root_from_seed(&seed, None).map_err(|e| Error::Derivation(e.to_string()))?;
    let child = root
        .derive_path(derivation_path(index).as_str())
        .map_err(|e| Error::Derivation(e.to_string()))?;
    let signing: &coins_bip32::ecdsa::SigningKey = child.as_ref();
    Ok(signing.to_bytes().into())
}

/// Generates a new 24 word BIP39 mnemonic.
pub fn generate_mnemonic() -> String {
    Mnemonic::<English>::new_with_count(&mut rand::thread_rng(), 24)
        .expect("24 is a valid word count")
        .to_phrase()
}

/// 33 byte compressed secp256k1 public key for a private key.
pub fn compressed_pubkey(private_key: &[u8; 32]) -> Result<[u8; 33], Error> {
    let signing = coins_bip32::ecdsa::SigningKey::from_bytes(private_key.into())
        .map_err(|e| Error::Derivation(e.to_string()))?;
    Ok(signing
        .verifying_key()
        .to_encoded_point(true)
        .as_bytes()
        .try_into()
        .expect("compressed point is 33 bytes"))
}

/// Cosmos address from a 33 byte compressed secp256k1 public key.
pub fn address_from_compressed_pubkey(pubkey: &[u8; 33]) -> Address {
    let sha = Sha256::digest(pubkey);
    let rip = Ripemd160::digest(sha);
    Address::from_slice(&rip)
}

/// Bech32 encodes the address with `hrp`.
pub fn to_bech32(hrp: &str, address: &Address) -> Result<String, Error> {
    Ok(bech32::encode::<Bech32>(
        Hrp::parse(hrp)?,
        address.as_slice(),
    )?)
}

/// Decodes a bech32 address, requiring `hrp`.
pub fn from_bech32(hrp: &str, s: &str) -> Result<Address, Error> {
    let (got, data) = bech32::decode(s)?;
    if got.as_str() != hrp {
        return Err(Error::WrongHrp {
            expected: hrp.to_string(),
            got: got.to_string(),
        });
    }
    if data.len() != 20 {
        return Err(Error::BadLength(data.len()));
    }
    Ok(Address::from_slice(&data))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Bech32 / cosmos-sdk test vector: hub key from the "abandon ... about" mnemonic.
    const ABANDON: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    #[test]
    fn roundtrip_bech32() {
        let a = Address::repeat_byte(7);
        let s = to_bech32(JUNO_HRP, &a).unwrap();
        assert!(s.starts_with("juno1"));
        assert_eq!(from_bech32(JUNO_HRP, &s).unwrap(), a);
        assert!(from_bech32("cosmos", &s).is_err());
    }

    fn juno_address(index: u32) -> String {
        let sk = private_key_from_mnemonic(ABANDON, index).unwrap();
        let pk = compressed_pubkey(&sk).unwrap();
        to_bech32(JUNO_HRP, &address_from_compressed_pubkey(&pk)).unwrap()
    }

    // Expected values come from `junod keys add --recover [--index N]`.
    #[test]
    fn matches_junod() {
        assert_eq!(
            juno_address(0),
            "juno19rl4cm2hmr8afy4kldpxz3fka4jguq0a2jwxcf"
        );
        assert_eq!(
            juno_address(1),
            "juno1jrkmdcwgq94uaamx6zax2luewlhf7u4k229237"
        );
    }
}
