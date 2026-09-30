use rand_core::OsRng;
use shieldd_keys::keys::{AddressIndex, Bip44Path, SeedPhrase, SpendKey};
use shieldd_keys::{Address, FullViewingKey};
use shieldd_proto::core::keys::v1 as pb;
use shieldd_proto::DomainType;
use std::str::FromStr;
use wasm_bindgen::prelude::*;

use crate::error::WasmResult;
use crate::utils;

/// generate a spend key from a seed phrase
/// Arguments:
///     seed_phrase: `string`
/// Returns: `Uint8Array representing inner SpendKey`
#[wasm_bindgen]
pub fn generate_spend_key(seed_phrase: &str) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let seed = SeedPhrase::from_str(seed_phrase)?;
    let path = Bip44Path::new(0);
    let spend_key = SpendKey::from_seed_phrase_bip44(seed, &path)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    Ok(spend_key.encode_to_vec())
}

/// get full viewing key from spend key
/// Arguments:
///     spend_key: `byte representation inner SpendKey`
/// Returns: `Uint8Array representing inner FullViewingKey`
#[wasm_bindgen]
pub fn get_full_viewing_key(spend_key: &[u8]) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let spend_key: SpendKey = SpendKey::decode(spend_key)?;
    let fvk: &FullViewingKey = spend_key.full_viewing_key();
    Ok(fvk.encode_to_vec())
}

/// Wallet id: the hash of a full viewing key, used as an account identifier
/// Arguments:
///     full_viewing_key: `byte representation inner FullViewingKey`
/// Returns: `WalletId`
#[wasm_bindgen]
pub fn get_wallet_id(full_viewing_key: &[u8]) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let fvk: FullViewingKey = FullViewingKey::decode(full_viewing_key)?;
    Ok(fvk.wallet_id().encode_to_vec())
}

/// get address by index using FVK
/// Arguments:
///     full_viewing_key: `byte representation inner FullViewingKey`
///     account: `u32`
///     randomizer: `12 bytes, with 0 bytes representing all 0s implicitly`
/// Returns: `Uint8Array representing inner Address`
#[wasm_bindgen]
pub fn get_address_by_index(
    full_viewing_key: &[u8],
    account: u32,
    randomizer: &[u8],
) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let fvk: FullViewingKey = FullViewingKey::decode(full_viewing_key)?;
    let randomizer: [u8; 12] = randomizer.try_into().unwrap_or_default();
    let address = fvk.incoming().payment_address(AddressIndex {
        account,
        randomizer,
    });
    Ok(address.encode_to_vec())
}

/// get ephemeral (randomizer) address using FVK
/// The derivation tree is like "spend key / address index / ephemeral address" so we must also pass index as an argument
/// Arguments:
///     full_viewing_key: `byte representation inner FullViewingKey`
///     index: `u32`
/// Returns: `Uint8Array representing inner Address`
#[wasm_bindgen]
pub fn get_ephemeral_address(full_viewing_key: &[u8], index: u32) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let fvk: FullViewingKey = FullViewingKey::decode(full_viewing_key)?;
    let address = fvk.ephemeral_address(OsRng, index.into());
    Ok(address.encode_to_vec())
}

/// Returns the AddressIndex of an address.
/// If it is not controlled by the FVK, it returns a `None`
/// Arguments:
///     full_viewing_key: `byte representation inner FullViewingKey`
///     address: `byte representation inner Address`
/// Returns: `Option<AddressIndex>`
#[wasm_bindgen]
pub fn get_index_by_address(full_viewing_key: &[u8], address: &[u8]) -> WasmResult<JsValue> {
    utils::set_panic_hook();

    let address: Address = Address::decode(address)?;
    let fvk: FullViewingKey = FullViewingKey::decode(full_viewing_key)?;
    let index: Option<pb::AddressIndex> = fvk.address_index(&address).map(Into::into);
    let result = serde_wasm_bindgen::to_value(&index)?;
    Ok(result)
}

/// Checks if address is controlled by full viewing key provided
#[wasm_bindgen]
pub fn is_controlled_address(full_viewing_key: &[u8], address: &[u8]) -> WasmResult<bool> {
    utils::set_panic_hook();

    let address: Address = Address::decode(address)?;
    let fvk: FullViewingKey = FullViewingKey::decode(full_viewing_key)?;
    Ok(is_controlled_inner(&fvk, &address))
}

pub fn is_controlled_inner(fvk: &FullViewingKey, address: &Address) -> bool {
    fvk.address_index(address).is_some()
}

#[wasm_bindgen(getter_with_clone)]
pub struct ForwardingAddrResponse {
    /// A noble address that will be used for registration on the noble network
    pub noble_addr_bech32: String,
    /// Byte representation of the noble forwarding address. Used for broadcasting cosmos message.
    pub noble_addr_bytes: Vec<u8>,
    /// The shieldd address that a deposit to the noble address with forward to
    /// Vec encoded `pb::Address`
    pub shieldd_addr_bytes: Vec<u8>,
}

/// Generates an address that can be used as a forwarding address for Noble
/// Returns: Uint8Array representing encoded Address
#[wasm_bindgen]
pub fn get_noble_forwarding_addr(
    sequence: u16,
    full_viewing_key: &[u8],
    channel: &str,
    account: Option<u32>,
) -> WasmResult<ForwardingAddrResponse> {
    let fvk: FullViewingKey = FullViewingKey::decode(full_viewing_key)?;
    let shieldd_addr = forwarding_addr_inner(sequence, account, &fvk);
    let noble_addr = shieldd_addr.noble_forwarding_address(channel);
    Ok(ForwardingAddrResponse {
        noble_addr_bech32: noble_addr.to_string(),
        noble_addr_bytes: noble_addr.bytes(),
        shieldd_addr_bytes: shieldd_addr.encode_to_vec(),
    })
}

/// Noble Randomizer: [0xff; 10] followed by LE16(sequence)
pub fn forwarding_addr_inner(sequence: u16, account: Option<u32>, fvk: &FullViewingKey) -> Address {
    let mut randomizer: [u8; 12] = [0xff; 12]; // Initialize all 12 bytes to 0xff
    let seq_bytes = sequence.to_le_bytes();
    randomizer[10..].copy_from_slice(&seq_bytes); // Replace the last 2 bytes with seq_bytes

    let index = AddressIndex {
        account: account.unwrap_or_default(),
        randomizer,
    };

    fvk.incoming().payment_address(index)
}

#[wasm_bindgen(getter_with_clone)]
pub struct TransparentAddrResponse {
    /// The raw (binary) transparent address
    pub address: Vec<u8>,
    /// The t-address encoding of the transparent address
    pub encoding: String,
}

/// Returns the "truncated" address (t-addr) associated with the account.
#[wasm_bindgen]
pub fn get_transparent_address(full_viewing_key: &[u8]) -> WasmResult<TransparentAddrResponse> {
    let fvk: FullViewingKey = FullViewingKey::decode(full_viewing_key)?;
    let encoding = fvk.incoming().transparent_address();
    let address: Address = encoding.parse().expect("encoding transparent address");

    Ok(TransparentAddrResponse {
        address: address.encode_to_vec(),
        encoding: encoding.to_string(),
    })
}

/// get transmission key (public key for this payment address)
/// Arguments:
///     address: `byte representation inner Address`
/// Returns: `Uint8Array representing inner Address`
#[wasm_bindgen]
pub fn get_transmission_key_by_address(address: &[u8]) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let address: Address = Address::decode(address)?;
    let transmission_key = address.transmission_key();
    Ok(transmission_key.0.to_vec())
}
