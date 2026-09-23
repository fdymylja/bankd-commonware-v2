use thiserror::Error;

/// Errors from decoding and verifying bankd headers.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum Error {
    #[error("malformed header: {0}")]
    MalformedHeader(&'static str),
    #[error("malformed certificate: {0}")]
    MalformedCertificate(&'static str),
    #[error("malformed dkg outcome")]
    MalformedDkgOutcome,
    #[error("certificate payload is not keccak(header)")]
    PayloadMismatch,
    #[error("certificate epoch {cert} != header epoch {header}")]
    EpochMismatch { cert: u64, header: u64 },
    #[error("header consensus context doesn't match the certificate")]
    ContextMismatch,
    #[error("epoch {epoch} is older than the latest epoch {latest}")]
    StaleEpoch { epoch: u64, latest: u64 },
    #[error("no group key for epoch {0}")]
    UnknownEpoch(u64),
    #[error("invalid finalization signature")]
    InvalidSignature,
    #[error("dkg outcome is for epoch {actual}, expected {expected}")]
    DkgOutcomeEpochMismatch { expected: u64, actual: u64 },
    #[error("bls host function: {0}")]
    Bls(String),
    #[error("expected a single element merkle path")]
    InvalidPath,
    #[error("commitment value must be 32 bytes")]
    InvalidValueLength,
    #[error("invalid proof: {0}")]
    InvalidProof(String),
    #[error("client is frozen")]
    Frozen,
    #[error("revision number must be 0")]
    InvalidRevision,
    #[error("client state not found")]
    ClientStateNotFound,
    #[error("no consensus state at height {0}")]
    ConsensusStateNotFound(u64),
    #[error("client state latest height {client} != consensus state height {consensus}")]
    HeightMismatch { client: u64, consensus: u64 },
    #[error("client state has no key for its latest epoch")]
    MissingKey,
    #[error("decode: {0}")]
    Decode(String),
    #[error("{0} is not supported")]
    Unsupported(&'static str),
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Self::Decode(e.to_string())
    }
}

impl From<prost::DecodeError> for Error {
    fn from(e: prost::DecodeError) -> Self {
        Self::Decode(e.to_string())
    }
}
