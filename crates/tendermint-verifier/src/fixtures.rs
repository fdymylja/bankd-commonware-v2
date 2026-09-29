//! Fixtures from the ibc-contracts tendermint-light-client crate, for tests.

use ibc_client_tendermint::types::proto::v1::{
    ClientState as RawClientState, ConsensusState as RawConsensusState,
};
use prost::Message;
use serde::Deserialize;

use crate::{ConsensusState, NANOS_PER_SEC, Params};

pub const UPDATE: &str = include_str!(
    "../../../contracts/lib/ibc-contracts/packages/tendermint-light-client/fixtures/update_client_happy_path.json"
);
pub const MEMBERSHIP: &str = include_str!(
    "../../../contracts/lib/ibc-contracts/packages/tendermint-light-client/fixtures/verify_membership_key_0.json"
);
pub const NON_MEMBERSHIP: &str = include_str!(
    "../../../contracts/lib/ibc-contracts/packages/tendermint-light-client/fixtures/verify_non-membership_key_1.json"
);

#[derive(Deserialize)]
struct UpdateFixture {
    client_state_hex: String,
    consensus_state_hex: String,
    update_client_message: Msg,
}

#[derive(Deserialize)]
struct Msg {
    client_message_hex: String,
}

#[derive(Deserialize)]
struct MembershipFixture {
    consensus_state_hex: String,
    membership_msg: MembershipMsg,
}

#[derive(Deserialize)]
pub struct MembershipMsg {
    pub path: Vec<String>,
    pub proof: String,
    pub value: String,
}

pub fn params(hex_str: &str) -> Params {
    let cs = RawClientState::decode(hex::decode(hex_str).unwrap().as_slice()).unwrap();
    let tl = cs.trust_level.unwrap();
    Params {
        chain_id: cs.chain_id,
        trust_numerator: tl.numerator,
        trust_denominator: tl.denominator,
        trusting_period_secs: cs.trusting_period.unwrap().seconds as u64,
        unbonding_period_secs: cs.unbonding_period.unwrap().seconds as u64,
        max_clock_drift_secs: cs.max_clock_drift.unwrap().seconds as u64,
    }
}

pub fn cons_state(hex_str: &str) -> ConsensusState {
    let cs = RawConsensusState::decode(hex::decode(hex_str).unwrap().as_slice()).unwrap();
    let ts = cs.timestamp.unwrap();
    ConsensusState {
        timestamp_ns: ts.seconds as u128 * NANOS_PER_SEC + ts.nanos as u128,
        root: cs.root.unwrap().hash.try_into().unwrap(),
        next_validators_hash: cs.next_validators_hash.try_into().unwrap(),
    }
}

pub struct Update {
    pub params: Params,
    pub trusted: ConsensusState,
    pub header: Vec<u8>,
    pub now_ns: u128,
}

pub fn update() -> Update {
    let f: UpdateFixture = serde_json::from_str(UPDATE).unwrap();
    let trusted = cons_state(&f.consensus_state_hex);
    Update {
        params: params(&f.client_state_hex),
        trusted,
        header: hex::decode(f.update_client_message.client_message_hex).unwrap(),
        // One hour after the trusted state, same as the upstream tests.
        now_ns: trusted.timestamp_ns + 3600 * NANOS_PER_SEC,
    }
}

/// Consensus state and message of the membership fixture.
pub fn membership() -> (ConsensusState, MembershipMsg) {
    membership_case(MEMBERSHIP)
}

/// Consensus state and message of the non-membership fixture.
pub fn non_membership() -> (ConsensusState, MembershipMsg) {
    membership_case(NON_MEMBERSHIP)
}

pub fn membership_case(json: &str) -> (ConsensusState, MembershipMsg) {
    let f: MembershipFixture = serde_json::from_str(json).unwrap();
    (cons_state(&f.consensus_state_hex), f.membership_msg)
}

pub fn path(m: &MembershipMsg) -> Vec<Vec<u8>> {
    m.path.iter().map(|s| s.as_bytes().to_vec()).collect()
}
