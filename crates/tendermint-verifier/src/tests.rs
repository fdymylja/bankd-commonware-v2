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
