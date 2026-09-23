//! Runs the Solidity client's fixture (`contracts/test/fixtures/lc.json`) through the wasm client.
//! Real vectors: headers built with tempo-primitives, certs signed by a commonware 3-of-4 DKG.

use std::collections::BTreeMap;

use cosmwasm_std::testing::MockApi;
use cw_commonware::{
    verify::{dkg_outcome_identity, verify_header, Params, G2_COMPRESSED},
    Error,
};
use serde_json::Value;

const FIXTURE: &str = include_str!("../../../contracts/test/fixtures/lc.json");

fn hex_bytes(v: &Value) -> Vec<u8> {
    hex::decode(v.as_str().unwrap().trim_start_matches("0x")).unwrap()
}

fn num(v: &Value) -> u64 {
    v.as_str()
        .map(|s| s.parse().unwrap())
        .or(v.as_u64())
        .unwrap()
}

struct Fixture {
    json: Value,
    namespace: Vec<u8>,
    epoch_length: u64,
}

impl Fixture {
    fn load() -> Self {
        let json: Value = serde_json::from_str(FIXTURE).unwrap();
        Self {
            namespace: hex_bytes(&json["namespace"]),
            epoch_length: num(&json["epochLength"]),
            json,
        }
    }

    fn key(&self, name: &str) -> [u8; G2_COMPRESSED] {
        hex_bytes(&self.json[name]).try_into().unwrap()
    }

    fn update(&self, i: usize) -> (Vec<u8>, Vec<u8>) {
        let u = &self.json["updates"][i];
        (
            hex_bytes(&u["headerRlp"]),
            hex_bytes(&u["tempoCertificate"]),
        )
    }

    fn params(&self, latest_height: u64) -> Params<'_> {
        Params {
            namespace: &self.namespace,
            epoch_length: self.epoch_length,
            latest_height,
        }
    }
}

#[test]
fn verifies_all_updates_and_rotates_key() {
    let f = Fixture::load();
    let api = MockApi::default();
    let mut keys = BTreeMap::from([(0u64, f.key("epoch0KeyCompressed"))]);
    let mut latest = 0;

    for (i, u) in f.json["updates"].as_array().unwrap().iter().enumerate() {
        let (header, cert) = f.update(i);
        let v = verify_header(
            &api,
            &f.params(latest),
            |e| keys.get(&e).copied(),
            &header,
            &cert,
        )
        .unwrap_or_else(|e| panic!("update {i}: {e}"));

        assert_eq!(v.height, num(&u["height"]));
        assert_eq!(v.timestamp, num(&u["timestamp"]));
        assert_eq!(v.state_root.to_vec(), hex_bytes(&u["stateRoot"]));
        if let Some((epoch, key)) = v.next_key {
            // Height 9 is the last block of epoch 0 and hands over to the epoch 1 committee.
            assert_eq!((v.height, epoch), (9, 1));
            assert_eq!(key, f.key("epoch1KeyCompressed"));
            keys.insert(epoch, key);
        }
        latest = latest.max(v.height);
    }
    assert!(
        keys.contains_key(&1),
        "boundary header didn't rotate the key"
    );
}

#[test]
fn rejects_bad_certificates() {
    let f = Fixture::load();
    let api = MockApi::default();
    let k0 = f.key("epoch0KeyCompressed");
    let k1 = f.key("epoch1KeyCompressed");
    let (header, cert) = f.update(0);
    let only_k0 = |e: u64| (e == 0).then_some(k0);

    // Wrong committee.
    let err = verify_header(&api, &f.params(0), |_| Some(k1), &header, &cert).unwrap_err();
    assert_eq!(err, Error::InvalidSignature);

    // Signature from a different block (update 1's vote signature spliced into update 0's cert).
    let (_, other) = f.update(1);
    let mut spliced = cert.clone();
    let sig = cert.len() - 96;
    spliced[sig..sig + 48].copy_from_slice(&other[other.len() - 96..other.len() - 48]);
    let err = verify_header(&api, &f.params(0), only_k0, &header, &spliced).unwrap_err();
    assert_eq!(err, Error::InvalidSignature);

    // Header that isn't the certified payload.
    let (other_header, _) = f.update(1);
    let err = verify_header(&api, &f.params(0), only_k0, &other_header, &cert).unwrap_err();
    assert_eq!(err, Error::PayloadMismatch);

    // No key for epoch 1 yet.
    let (h2, c2) = f.update(2);
    let err = verify_header(&api, &f.params(0), only_k0, &h2, &c2).unwrap_err();
    assert_eq!(err, Error::UnknownEpoch(1));

    // Epoch 0 header once the client is in epoch 1.
    let err = verify_header(&api, &f.params(12), only_k0, &header, &cert).unwrap_err();
    assert_eq!(
        err,
        Error::StaleEpoch {
            epoch: 0,
            latest: 1
        }
    );

    // Truncated cert.
    let err = verify_header(
        &api,
        &f.params(0),
        only_k0,
        &header,
        &cert[..cert.len() - 1],
    )
    .unwrap_err();
    assert!(matches!(err, Error::MalformedCertificate(_)));
}

#[test]
fn reads_dkg_outcome() {
    let f = Fixture::load();
    let (epoch, identity) = dkg_outcome_identity(&hex_bytes(&f.json["dkgOutcome"])).unwrap();
    assert_eq!(epoch, 1);
    assert_eq!(identity, f.key("epoch1KeyCompressed"));
}
