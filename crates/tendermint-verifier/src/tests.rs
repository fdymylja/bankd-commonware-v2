use ibc_client_tendermint::types::proto::v1::Header as RawHeader;
use prost::Message;

use crate::{
    fixtures::{self, Update, update},
    *,
};

fn run(u: &Update) -> Result<UpdateOutput, Error> {
    verify_update(&u.params, &u.trusted, &u.header, u.now_ns)
}

#[test]
fn update_happy_path() {
    let u = update();
    let out = run(&u).unwrap();
    assert!(out.new_height.revision_height > out.trusted_height.revision_height);
    assert!(out.new_consensus_state.timestamp_ns > u.trusted.timestamp_ns);
}

#[test]
fn update_bad_inputs() {
    let base = update();
    type Mutate = fn(&mut Update);
    let cases: Vec<(&str, Mutate)> = vec![
        ("wrong chain id", |u| u.params.chain_id = "other-1".into()),
        ("empty chain id", |u| u.params.chain_id = String::new()),
        ("trusting period expired", |u| {
            u.now_ns =
                u.trusted.timestamp_ns + (u.params.trusting_period_secs as u128 + 1) * NANOS_PER_SEC
        }),
        ("header from the future", |u| {
            u.now_ns = u.trusted.timestamp_ns - 3600 * NANOS_PER_SEC
        }),
        ("tampered next validators hash", |u| {
            u.trusted.next_validators_hash[0] ^= 1
        }),
        ("zero trust denominator", |u| u.params.trust_denominator = 0),
        ("trust level below 1/3", |u| {
            u.params.trust_numerator = 1;
            u.params.trust_denominator = 4;
        }),
        ("trust level above 1", |u| {
            u.params.trust_numerator = u.params.trust_denominator + 1
        }),
        ("trusting >= unbonding", |u| {
            u.params.trusting_period_secs = u.params.unbonding_period_secs
        }),
        ("empty header", |u| u.header.clear()),
        ("garbage header", |u| u.header = vec![0xff; 64]),
        ("truncated header", |u| {
            u.header.truncate(u.header.len() / 2)
        }),
        ("timestamp overflow", |u| u.trusted.timestamp_ns = u128::MAX),
    ];
    for (name, mutate) in cases {
        let mut u = Update {
            params: base.params.clone(),
            trusted: base.trusted,
            header: base.header.clone(),
            now_ns: base.now_ns,
        };
        mutate(&mut u);
        assert!(run(&u).is_err(), "{name} should fail");
    }
}

// Flips a bit in every commit signature by editing the raw proto, so fewer than the trust
// threshold of valid signatures remain.
#[test]
fn update_rejects_tampered_signatures() {
    let mut u = update();
    let mut raw = RawHeader::decode(u.header.as_slice()).unwrap();
    let commit = raw.signed_header.as_mut().unwrap().commit.as_mut().unwrap();
    for sig in &mut commit.signatures {
        if let Some(b) = sig.signature.first_mut() {
            *b ^= 1;
        }
    }
    u.header = raw.encode_to_vec();
    assert!(run(&u).is_err());
}

#[test]
fn update_rejects_tampered_app_hash() {
    let mut u = update();
    let mut raw = RawHeader::decode(u.header.as_slice()).unwrap();
    let h = raw.signed_header.as_mut().unwrap().header.as_mut().unwrap();
    h.app_hash[0] ^= 1;
    u.header = raw.encode_to_vec();
    assert!(run(&u).is_err());
}

#[test]
fn membership_happy_path() {
    let (cs, m) = fixtures::membership();
    let proof = hex::decode(&m.proof).unwrap();
    let value = hex::decode(&m.value).unwrap();
    assert!(verify_membership(cs.root, &proof, fixtures::path(&m), value.clone()).unwrap());

    let mut bad_root = cs.root;
    bad_root[0] ^= 1;
    assert!(!verify_membership(bad_root, &proof, fixtures::path(&m), value.clone()).unwrap());

    let mut bad_value = value.clone();
    bad_value[0] ^= 1;
    assert!(!verify_membership(cs.root, &proof, fixtures::path(&m), bad_value).unwrap());

    let mut bad_path = fixtures::path(&m);
    bad_path[1].push(b'x');
    assert!(!verify_membership(cs.root, &proof, bad_path, value).unwrap());
}

#[test]
fn non_membership_happy_path() {
    let (cs, m) = fixtures::non_membership();
    let proof = hex::decode(&m.proof).unwrap();
    assert!(verify_membership(cs.root, &proof, fixtures::path(&m), vec![]).unwrap());

    let mut bad_root = cs.root;
    bad_root[31] ^= 1;
    assert!(!verify_membership(bad_root, &proof, fixtures::path(&m), vec![]).unwrap());

    // The same proof must not pass as membership of some value.
    assert!(!verify_membership(cs.root, &proof, fixtures::path(&m), vec![1]).unwrap());
}

#[test]
fn membership_bad_inputs() {
    let (cs, m) = fixtures::membership();
    let value = hex::decode(&m.value).unwrap();
    assert!(verify_membership(cs.root, &[], fixtures::path(&m), value.clone()).is_ok_and(|ok| !ok));
    assert!(verify_membership(cs.root, &[0xff; 32], fixtures::path(&m), value.clone()).is_err());
    let proof = hex::decode(&m.proof).unwrap();
    assert!(
        !verify_membership(
            cs.root,
            &proof[..proof.len() / 2],
            fixtures::path(&m),
            value.clone()
        )
        .unwrap_or(false)
    );
    assert!(!verify_membership(cs.root, &proof, vec![], value).unwrap_or(false));
}

#[test]
fn misbehaviour_same_header_is_not_misbehaviour() {
    let u = update();
    let out = check_misbehaviour(
        &u.params, &u.trusted, &u.trusted, &u.header, &u.header, u.now_ns,
    )
    .unwrap();
    assert!(!out.detected);
}

#[test]
fn misbehaviour_bad_inputs() {
    let u = update();
    assert!(
        check_misbehaviour(
            &u.params,
            &u.trusted,
            &u.trusted,
            &u.header,
            &[1, 2, 3],
            u.now_ns
        )
        .is_err()
    );
    let mut p = u.params.clone();
    p.chain_id = "other-1".into();
    assert!(
        check_misbehaviour(&p, &u.trusted, &u.trusted, &u.header, &u.header, u.now_ns).is_err()
    );
}

// Manual check of relayer output (`bankd-relayer tm-header`) against a live gaia:
// TM_LIVE_JSON=/path/to/out.json cargo test -p tempo-tendermint-verifier live -- --ignored
#[test]
#[ignore]
fn live_header_from_relayer() {
    let path = std::env::var("TM_LIVE_JSON").expect("TM_LIVE_JSON");
    let v: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let hex32 = |k: &str| -> [u8; 32] {
        hex::decode(v[k].as_str().unwrap().trim_start_matches("0x"))
            .unwrap()
            .try_into()
            .unwrap()
    };
    let trusted = ConsensusState {
        timestamp_ns: v["trusted_timestamp_ns"].as_str().unwrap().parse().unwrap(),
        root: hex32("trusted_root"),
        next_validators_hash: hex32("trusted_next_validators_hash"),
    };
    let params = Params {
        chain_id: v["chain_id"].as_str().unwrap().into(),
        trust_numerator: 1,
        trust_denominator: 3,
        trusting_period_secs: 14 * 24 * 3600,
        unbonding_period_secs: 21 * 24 * 3600,
        max_clock_drift_secs: 15,
    };
    let header = hex::decode(v["header"].as_str().unwrap().trim_start_matches("0x")).unwrap();
    let now_ns = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let out = verify_update(&params, &trusted, &header, now_ns).unwrap();
    eprintln!("verified: {out:?}");
}

// Manual check of `bankd-relayer tm-proof` output. TM_PROOF is the tm-proof stdout file,
// TM_KEY the store key, TM_ROOT the app hash of the header at the printed proof height,
// TM_VALUE_HEX the expected value (empty for non-membership).
#[test]
#[ignore]
fn live_proof_from_relayer() {
    let out = std::fs::read_to_string(std::env::var("TM_PROOF").expect("TM_PROOF")).unwrap();
    let proof = hex::decode(
        out.split_whitespace()
            .nth(1)
            .unwrap()
            .trim_start_matches("0x"),
    )
    .unwrap();
    let root: [u8; 32] = hex::decode(std::env::var("TM_ROOT").expect("TM_ROOT"))
        .unwrap()
        .try_into()
        .unwrap();
    let value = hex::decode(std::env::var("TM_VALUE_HEX").unwrap_or_default()).unwrap();
    let path = vec![
        b"ibc".to_vec(),
        std::env::var("TM_KEY").unwrap().into_bytes(),
    ];
    assert!(verify_membership(root, &proof, path, value).unwrap());
}
