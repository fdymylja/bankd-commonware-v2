//! Stateless CometBFT light client verification.
//!
//! Thin wrapper over the ibc-contracts `tendermint-light-client-*` crates, the same code the
//! SP1 guest programs run. Pure functions: bytes in, result out. `now` is always an argument.
//! ed25519 goes through `ed25519-consensus` (ZIP-215), which matches CometBFT.

use std::{
    panic::{AssertUnwindSafe, catch_unwind},
    str::FromStr,
};

use ibc_client_tendermint::types::{
    ConsensusState as IbcConsensusState, Header, Misbehaviour, TENDERMINT_CLIENT_TYPE,
    proto::v1::Header as RawHeader,
};
use ibc_core_client_types::Height as IbcHeight;
use ibc_core_commitment_types::{merkle::MerkleProof, proto::v1::MerkleProof as RawMerkleProof};
use ibc_core_host_types::identifiers::ClientId;
use prost::Message;
use tendermint::{Hash, Time, hash::Algorithm};
use tendermint_light_client_membership::{KVPair, membership};
use tendermint_light_client_misbehaviour::{MisbehaviourError, check_for_misbehaviour};
use tendermint_light_client_update_client::{
    ClientState, TrustThreshold, UpdateClientError, update_client,
};

const NANOS_PER_SEC: u128 = 1_000_000_000;

/// Errors from the verifier. Every variant means the input must be rejected.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Client parameters are unusable (bad trust level, periods, chain id).
    #[error("invalid client params: {0}")]
    InvalidParams(&'static str),
    /// Protobuf or field level decoding failed.
    #[error("decode {0}")]
    Decode(&'static str),
    /// Header did not verify against the trusted consensus state.
    #[error("update client: {0}")]
    Update(#[from] UpdateClientError),
    /// Misbehaviour evidence did not verify.
    #[error("misbehaviour: {0}")]
    Misbehaviour(MisbehaviourError),
    /// The wrapped library panicked. Treated as a rejection.
    #[error("verifier panicked")]
    Panic,
}

/// Client parameters the verifier needs, mirrors the tendermint ClientState minus heights.
#[derive(Clone, Debug)]
pub struct Params {
    /// CometBFT chain id, includes the revision suffix.
    pub chain_id: String,
    /// Trust level numerator.
    pub trust_numerator: u64,
    /// Trust level denominator.
    pub trust_denominator: u64,
    /// Trusting period in seconds.
    pub trusting_period_secs: u64,
    /// Unbonding period in seconds.
    pub unbonding_period_secs: u64,
    /// Max clock drift in seconds.
    pub max_clock_drift_secs: u64,
}

/// Consensus state, layout matches `SP1ICS07Tendermint` so hashes are comparable.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ConsensusState {
    /// Unix nanoseconds.
    pub timestamp_ns: u128,
    /// App hash.
    pub root: [u8; 32],
    /// Next validators hash.
    pub next_validators_hash: [u8; 32],
}

/// IBC height.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Height {
    /// Revision number.
    pub revision_number: u64,
    /// Revision height.
    pub revision_height: u64,
}

impl From<IbcHeight> for Height {
    fn from(h: IbcHeight) -> Self {
        Self {
            revision_number: h.revision_number(),
            revision_height: h.revision_height(),
        }
    }
}

/// Result of a verified header.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct UpdateOutput {
    /// Consensus state derived from the header.
    pub new_consensus_state: ConsensusState,
    /// Height of the header.
    pub new_height: Height,
    /// Height of the consensus state the header was verified against.
    pub trusted_height: Height,
}

/// Result of a verified misbehaviour check.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MisbehaviourOutput {
    /// True if the two headers are conflicting.
    pub detected: bool,
    /// Trusted height claimed by header 1.
    pub trusted_height_1: Height,
    /// Trusted height claimed by header 2.
    pub trusted_height_2: Height,
}

/// Verifies `header` (protobuf `ibc.lightclients.tendermint.v1.Header`) against `trusted`.
///
/// The caller must check `trusted` really is the stored state at `trusted_height`.
pub fn verify_update(
    params: &Params,
    trusted: &ConsensusState,
    header: &[u8],
    now_ns: u128,
) -> Result<UpdateOutput, Error> {
    guarded(|| {
        let client_state = client_state(params)?;
        let trusted = to_ibc_consensus_state(trusted)?;
        let header = decode_header(header)?;
        let out = update_client(&client_state, &trusted, header, now_ns)?;
        Ok(UpdateOutput {
            new_consensus_state: from_ibc_consensus_state(&out.new_consensus_state)?,
            new_height: out.latest_height.into(),
            trusted_height: out.trusted_height.into(),
        })
    })
}

/// Checks two headers for misbehaviour. `Ok` with `detected == false` means both headers are
/// valid but not conflicting. Invalid evidence is an `Err`.
pub fn check_misbehaviour(
    params: &Params,
    trusted_1: &ConsensusState,
    trusted_2: &ConsensusState,
    header_1: &[u8],
    header_2: &[u8],
    now_ns: u128,
) -> Result<MisbehaviourOutput, Error> {
    guarded(|| {
        let client_state = client_state(params)?;
        let cs1 = to_ibc_consensus_state(trusted_1)?;
        let cs2 = to_ibc_consensus_state(trusted_2)?;
        let client_id =
            ClientId::new(TENDERMINT_CLIENT_TYPE, 0).map_err(|_| Error::Decode("client id"))?;
        let evidence = Misbehaviour::new(
            client_id,
            decode_header(header_1)?,
            decode_header(header_2)?,
        );
        match check_for_misbehaviour(&client_state, &evidence, cs1, cs2, now_ns) {
            Ok(out) => Ok(MisbehaviourOutput {
                detected: true,
                trusted_height_1: out.trusted_height_1.into(),
                trusted_height_2: out.trusted_height_2.into(),
            }),
            Err(MisbehaviourError::MisbehaviourNotDetected) => Ok(MisbehaviourOutput {
                detected: false,
                trusted_height_1: evidence.header1().trusted_height.into(),
                trusted_height_2: evidence.header2().trusted_height.into(),
            }),
            Err(e) => Err(Error::Misbehaviour(e)),
        }
    })
}

/// Verifies an ICS-23 proof (protobuf `MerkleProof`) against `root`. Empty `value` means
/// non-membership. Returns `Ok(false)` when the proof is well formed but does not verify.
pub fn verify_membership(
    root: [u8; 32],
    proof: &[u8],
    path: Vec<Vec<u8>>,
    value: Vec<u8>,
) -> Result<bool, Error> {
    guarded(|| {
        let raw = RawMerkleProof::decode(proof).map_err(|_| Error::Decode("merkle proof"))?;
        let proof = MerkleProof::try_from(raw).map_err(|_| Error::Decode("merkle proof"))?;
        Ok(membership(root, std::iter::once((KVPair::new(path, value), proof))).is_ok())
    })
}

// Panics must never escape into the node. Also a safety net, not the main defence: inputs are
// validated before reaching the library.
fn guarded<T>(f: impl FnOnce() -> Result<T, Error>) -> Result<T, Error> {
    catch_unwind(AssertUnwindSafe(f)).unwrap_or(Err(Error::Panic))
}

fn client_state(p: &Params) -> Result<ClientState, Error> {
    // The library `expect`s on this, and a tiny numerator would let anyone pass.
    let (n, d) = (p.trust_numerator, p.trust_denominator);
    if d == 0 || n > d || n.checked_mul(3).is_none_or(|n3| n3 < d) {
        return Err(Error::InvalidParams("trust level must be in [1/3, 1]"));
    }
    if p.trusting_period_secs == 0 || p.trusting_period_secs >= p.unbonding_period_secs {
        return Err(Error::InvalidParams(
            "trusting period must be in (0, unbonding)",
        ));
    }
    // Rejects an empty or malformed chain id before the library sees it.
    ibc_core_host_types::identifiers::ChainId::from_str(&p.chain_id)
        .map_err(|_| Error::InvalidParams("chain id"))?;
    Ok(ClientState {
        chain_id: p.chain_id.clone(),
        trust_level: TrustThreshold::new(n, d),
        trusting_period_seconds: p.trusting_period_secs,
        unbonding_period_seconds: p.unbonding_period_secs,
        max_clock_drift_seconds: p.max_clock_drift_secs,
        is_frozen: false,
        // Unused by verify_header. Latest height comes from the trusted state lookup.
        latest_height: IbcHeight::min(0),
    })
}

fn decode_header(bytes: &[u8]) -> Result<Header, Error> {
    let raw = RawHeader::decode(bytes).map_err(|_| Error::Decode("header"))?;
    Header::try_from(raw).map_err(|_| Error::Decode("header"))
}

fn to_ibc_consensus_state(cs: &ConsensusState) -> Result<IbcConsensusState, Error> {
    let secs = i64::try_from(cs.timestamp_ns / NANOS_PER_SEC)
        .map_err(|_| Error::Decode("consensus state timestamp"))?;
    let nanos = (cs.timestamp_ns % NANOS_PER_SEC) as u32;
    let time = Time::from_unix_timestamp(secs, nanos)
        .map_err(|_| Error::Decode("consensus state timestamp"))?;
    let nvh = Hash::from_bytes(Algorithm::Sha256, &cs.next_validators_hash)
        .map_err(|_| Error::Decode("next validators hash"))?;
    Ok(IbcConsensusState::new(cs.root.to_vec().into(), time, nvh))
}

fn from_ibc_consensus_state(cs: &IbcConsensusState) -> Result<ConsensusState, Error> {
    let ts = u128::try_from(cs.timestamp.unix_timestamp_nanos())
        .map_err(|_| Error::Decode("header time before epoch"))?;
    let root =
        <[u8; 32]>::try_from(cs.root.as_bytes()).map_err(|_| Error::Decode("app hash length"))?;
    let next_validators_hash = <[u8; 32]>::try_from(cs.next_validators_hash.as_bytes())
        .map_err(|_| Error::Decode("next validators hash length"))?;
    Ok(ConsensusState {
        timestamp_ns: ts,
        root,
        next_validators_hash,
    })
}

#[cfg(any(test, feature = "test-utils"))]
pub mod fixtures;
#[cfg(test)]
mod tests;
