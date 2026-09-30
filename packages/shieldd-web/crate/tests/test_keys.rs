extern crate core;

use rand_core::OsRng;
use shieldd_keys::keys::{
    AddressIndex, Bip44Path, SeedPhrase, SpendKey, SpendKeyBytes, WalletId, SPENDKEY_LEN_BYTES,
};
use shieldd_keys::{Address, FullViewingKey};
use shieldd_proto::{DomainType, Message};
use shieldd_wasm::keys::{
    forwarding_addr_inner, generate_spend_key, get_address_by_index, get_full_viewing_key,
    get_wallet_id, is_controlled_address,
};

const TEST_SEED_PHRASE: &str = "comfort ten front cycle churn burger oak absent rice ice urge result art couple benefit cabbage frequent obscure hurry trick segment cool job debate";

#[test]
fn generates_spend_key() {
    let slice = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let mut bytes = [0u8; SPENDKEY_LEN_BYTES];
    bytes.copy_from_slice(&slice[0..32]);

    let spend_key = SpendKey::try_from(SpendKeyBytes::from(bytes)).unwrap();
    assert_eq!(
        spend_key.to_string(),
        "shielddspendkey1pgsphqgnltgy7hdspe4v74qefx2slp0v50szuup9fqutw5959gkq7j55fx"
    );
}

#[test]
fn generates_fvk() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let fvk = FullViewingKey::decode(fvk_bytes.as_slice()).unwrap();
    assert_eq!(fvk.to_string(), "shielddfullviewingkey1m3409f50z92qajpkw93wp7d5yumdyfvqqz2pj5h8dp0v28z8svzqh7awek4q262g500pswwd5fmg6u4dv0n4rnag0mvcwjudr5p3grqnhg43u");
}

#[test]
fn generates_wallet_id() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let wallet_id_bytes = get_wallet_id(fvk_bytes.as_slice()).unwrap();
    let wallet_id = WalletId::decode(wallet_id_bytes.as_slice()).unwrap();
    assert_eq!(
        wallet_id.to_string(),
        "shielddwalletid1hz3vq7alehqcxe4kd4xmmw3ue85me7ft90qa72zkc776cenyt58sw558re"
    );
}

#[test]
fn gets_address_by_index() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let address_bytes = get_address_by_index(fvk_bytes.as_slice(), 0, &[]).unwrap();
    let address = Address::decode(address_bytes.as_slice()).unwrap();
    assert_eq!(
        address.to_string(),
        "shieldd1u29dhz4vxgnek6a3vzxlejg0l83wegpu7hgs3yphdvljcnnnh89dvs6lc9hxxw94w464t7lh5x36cxnxyx0"
    );
}

#[test]
fn raises_if_fvk_invalid() {
    let invalid_fvk = vec![0, 1, 2, 3];
    let err = get_wallet_id(invalid_fvk.encode_to_vec().as_slice()).unwrap_err();
    assert_eq!(
        "Wrong byte length, expected 64 but found 4",
        err.to_string()
    );
}

#[test]
fn detects_controlled_addr() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let fvk = FullViewingKey::decode(fvk_bytes.as_slice()).unwrap();
    let addr = fvk.payment_address(AddressIndex::new(0));
    assert!(is_controlled_address(&fvk.encode_to_vec(), &addr.encode_to_vec()).unwrap());
}

#[test]
fn returns_false_on_unknown_addr() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let fvk = FullViewingKey::decode(fvk_bytes.as_slice()).unwrap();
    let other_address =
        SpendKey::from_seed_phrase_bip44(SeedPhrase::generate(OsRng), &Bip44Path::new(0))
            .unwrap()
            .full_viewing_key()
            .incoming()
            .payment_address(AddressIndex::from(0u32));
    assert!(!is_controlled_address(&fvk.encode_to_vec(), &other_address.encode_to_vec()).unwrap());
}

#[test]
fn test_forwarding_addr_sequence_variation() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let fvk = FullViewingKey::decode(fvk_bytes.as_slice()).unwrap();

    // Use two different sequences
    let sequence1 = 1234;
    let sequence2 = 5678;
    let account = Some(1);

    let address1 = forwarding_addr_inner(sequence1, account, &fvk);
    let address2 = forwarding_addr_inner(sequence2, account, &fvk);

    // Check that the addresses are different
    assert_ne!(address1, address2);
}

#[test]
fn test_forwarding_addr_account_variation() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let fvk = FullViewingKey::decode(fvk_bytes.as_slice()).unwrap();

    let sequence = 1234;

    let account1 = Some(1);
    let account2 = Some(2);

    let address1 = forwarding_addr_inner(sequence, account1, &fvk);
    let address2 = forwarding_addr_inner(sequence, account2, &fvk);

    // Check that the addresses are different
    assert_ne!(address1, address2);
}

#[test]
fn test_forwarding_addr_sequence_boundaries() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let fvk = FullViewingKey::decode(fvk_bytes.as_slice()).unwrap();

    let account = Some(1);

    let sequence_min = 0;
    let sequence_max = u16::MAX;

    let address_min = forwarding_addr_inner(sequence_min, account, &fvk);
    let address_max = forwarding_addr_inner(sequence_max, account, &fvk);

    // Check that the addresses are different
    assert_ne!(address_min, address_max);
}

#[test]
fn test_forwarding_addr_same_sequence_and_account() {
    let spend_key = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes = get_full_viewing_key(spend_key.as_slice()).unwrap();
    let fvk = FullViewingKey::decode(fvk_bytes.as_slice()).unwrap();

    let sequence = 1234;
    let account = Some(1);

    let address1 = forwarding_addr_inner(sequence, account, &fvk);
    let address2 = forwarding_addr_inner(sequence, account, &fvk);

    // Check that the addresses are the same
    assert_eq!(address1, address2);
}

#[test]
fn test_forwarding_addr_different_fvks() {
    // Generate first Full Viewing Key
    let spend_key1 = generate_spend_key(TEST_SEED_PHRASE).unwrap();
    let fvk_bytes1 = get_full_viewing_key(spend_key1.as_slice()).unwrap();
    let fvk1 = FullViewingKey::decode(fvk_bytes1.as_slice()).unwrap();

    // Generate second Full Viewing Key with different seed phrase
    const TEST_SEED_PHRASE_2: &str =
        "flag public tonight parrot gospel treat tiny section useless smoke swim armor";
    let spend_key2 = generate_spend_key(TEST_SEED_PHRASE_2).unwrap();
    let fvk_bytes2 = get_full_viewing_key(spend_key2.as_slice()).unwrap();
    let fvk2 = FullViewingKey::decode(fvk_bytes2.as_slice()).unwrap();

    let sequence = 1234;
    let account = Some(1);

    let address1 = forwarding_addr_inner(sequence, account, &fvk1);
    let address2 = forwarding_addr_inner(sequence, account, &fvk2);

    // Check that the addresses are different
    assert_ne!(address1, address2);
}
