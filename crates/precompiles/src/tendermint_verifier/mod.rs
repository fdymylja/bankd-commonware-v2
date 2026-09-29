//! Stateless CometBFT light client verifier. Wraps `tempo-tendermint-verifier`.
//!
//! No storage. The Solidity light client keeps state and passes the trusted consensus state in.

pub mod dispatch;

use crate::error::{Result, TempoPrecompileError};
use tempo_contracts::precompiles::{
    ITendermintVerifier::{
        ConsensusState, Height, Params, checkMisbehaviourCall, checkMisbehaviourReturn,
        verifyMembershipCall, verifyUpdateCall, verifyUpdateReturn,
    },
    TENDERMINT_VERIFIER_ADDRESS, TendermintVerifierError,
};
use tempo_precompiles_macros::contract;
use tempo_tendermint_verifier as verifier;

// Gas is charged before any decoding or crypto. Per byte is derived from the worst case of one
// ed25519 verify (up to two per commit signature: trusted set and new set) per ~100 header
// bytes, which is the smallest a commit signature plus its validator entry can be.
// UNSURE: not benchmarked yet, tune once worst-case headers are measured.
const UPDATE_BASE_GAS: u64 = 100_000;
const UPDATE_PER_BYTE_GAS: u64 = 100;
const MEMBERSHIP_BASE_GAS: u64 = 30_000;
const MEMBERSHIP_PER_BYTE_GAS: u64 = 50;

/// Largest accepted protobuf header. A 300 validator header is well under this.
pub(crate) const MAX_HEADER_LEN: usize = 256 * 1024;
/// Largest accepted protobuf MerkleProof.
pub(crate) const MAX_PROOF_LEN: usize = 64 * 1024;
/// Largest accepted membership value.
pub(crate) const MAX_VALUE_LEN: usize = 16 * 1024;
/// Most path segments (ibc uses 2).
pub(crate) const MAX_PATH_SEGMENTS: usize = 8;
/// Longest path segment.
pub(crate) const MAX_PATH_SEGMENT_LEN: usize = 1024;
/// Longest chain id. The ibc-rs limit is 64.
pub(crate) const MAX_CHAIN_ID_LEN: usize = 64;

const NANOS_PER_SEC: u128 = 1_000_000_000;

#[contract(addr = TENDERMINT_VERIFIER_ADDRESS)]
pub struct TendermintVerifier {}

fn invalid_input() -> TempoPrecompileError {
    TendermintVerifierError::invalid_input().into()
}

fn verification_failed() -> TempoPrecompileError {
    TendermintVerifierError::verification_failed().into()
}

fn map_err(e: verifier::Error) -> TempoPrecompileError {
    match e {
        verifier::Error::InvalidParams(_) | verifier::Error::Decode(_) => invalid_input(),
        verifier::Error::Update(_) | verifier::Error::Misbehaviour(_) | verifier::Error::Panic => {
            verification_failed()
        }
    }
}

fn params(p: &Params) -> Result<verifier::Params> {
    if p.chainId.len() > MAX_CHAIN_ID_LEN {
        return Err(invalid_input());
    }
    Ok(verifier::Params {
        chain_id: p.chainId.clone(),
        trust_numerator: p.trustNumerator,
        trust_denominator: p.trustDenominator,
        trusting_period_secs: p.trustingPeriod,
        unbonding_period_secs: p.unbondingPeriod,
        max_clock_drift_secs: p.maxClockDrift,
    })
}

fn cons_state(c: &ConsensusState) -> verifier::ConsensusState {
    verifier::ConsensusState {
        timestamp_ns: c.timestamp,
        root: c.root.0,
        next_validators_hash: c.nextValidatorsHash.0,
    }
}

fn height(h: verifier::Height) -> Height {
    Height {
        revisionNumber: h.revision_number,
        revisionHeight: h.revision_height,
    }
}

fn now_ns(now_seconds: u64) -> u128 {
    u128::from(now_seconds) * NANOS_PER_SEC
}

impl TendermintVerifier {
    pub fn initialize(&mut self) -> Result<()> {
        self.__initialize()
    }

    pub fn verify_update(&mut self, call: verifyUpdateCall) -> Result<verifyUpdateReturn> {
        if call.header.len() > MAX_HEADER_LEN {
            return Err(invalid_input());
        }
        self.storage
            .deduct_gas(UPDATE_BASE_GAS + UPDATE_PER_BYTE_GAS * call.header.len() as u64)?;

        let out = verifier::verify_update(
            &params(&call.params)?,
            &cons_state(&call.trusted),
            &call.header,
            now_ns(call.nowSeconds),
        )
        .map_err(map_err)?;

        Ok(verifyUpdateReturn {
            newConsensusState: ConsensusState {
                timestamp: out.new_consensus_state.timestamp_ns,
                root: out.new_consensus_state.root.into(),
                nextValidatorsHash: out.new_consensus_state.next_validators_hash.into(),
            },
            newHeight: height(out.new_height),
            trustedHeight: height(out.trusted_height),
        })
    }

    pub fn verify_membership(&mut self, call: verifyMembershipCall) -> Result<bool> {
        if call.proof.len() > MAX_PROOF_LEN
            || call.value.len() > MAX_VALUE_LEN
            || call.path.is_empty()
            || call.path.len() > MAX_PATH_SEGMENTS
            || call.path.iter().any(|s| s.len() > MAX_PATH_SEGMENT_LEN)
        {
            return Err(invalid_input());
        }
        self.storage
            .deduct_gas(MEMBERSHIP_BASE_GAS + MEMBERSHIP_PER_BYTE_GAS * call.proof.len() as u64)?;

        verifier::verify_membership(
            call.root.0,
            &call.proof,
            call.path.into_iter().map(|s| s.to_vec()).collect(),
            call.value.to_vec(),
        )
        .map_err(map_err)
    }

    pub fn check_misbehaviour(
        &mut self,
        call: checkMisbehaviourCall,
    ) -> Result<checkMisbehaviourReturn> {
        if call.header1.len() > MAX_HEADER_LEN || call.header2.len() > MAX_HEADER_LEN {
            return Err(invalid_input());
        }
        let bytes = (call.header1.len() + call.header2.len()) as u64;
        self.storage
            .deduct_gas(UPDATE_BASE_GAS * 2 + UPDATE_PER_BYTE_GAS * bytes)?;

        let out = verifier::check_misbehaviour(
            &params(&call.params)?,
            &cons_state(&call.trusted1),
            &cons_state(&call.trusted2),
            &call.header1,
            &call.header2,
            now_ns(call.nowSeconds),
        )
        .map_err(map_err)?;

        Ok(checkMisbehaviourReturn {
            detected: out.detected,
            trustedHeight1: height(out.trusted_height_1),
            trustedHeight2: height(out.trusted_height_2),
        })
    }
}
