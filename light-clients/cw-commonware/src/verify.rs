//! Finalization checks for one bankd header. Mirrors `CommonwareLightClient.updateClient`.

use alloy_primitives::keccak256;
use cosmwasm_std::{Api, HashFunction, BLS12_381_G2_GENERATOR};

use crate::{
    cert::{read_varint, write_varint, Finalization},
    header::TempoHeader,
    Error,
};

pub const G2_COMPRESSED: usize = 96;

/// Hash to curve domain for MinSig (signatures on G1), same as commonware's `LibBLS12381`.
pub const DST_G1: &[u8] = b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_POP_";

/// Client settings a header is checked against.
#[derive(Debug, Clone)]
pub struct Params<'a> {
    /// Simplex namespace, `TEMPO` on bankd.
    pub namespace: &'a [u8],
    /// Blocks per epoch (tempo's FixedEpocher).
    pub epoch_length: u64,
    /// The client's latest height, headers from older epochs are refused.
    pub latest_height: u64,
}

/// A header whose finalization checked out.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedHeader {
    pub height: u64,
    pub timestamp: u64,
    pub state_root: [u8; 32],
    /// Set on boundary blocks: the next epoch and its group key from `extra_data`.
    pub next_key: Option<(u64, [u8; G2_COMPRESSED])>,
}

/// Checks that `cert` finalizes `header_rlp` under the group key of the header's epoch.
///
/// `group_key` looks up a stored key by epoch. It doesn't write anything, storing the
/// consensus state and next key is up to the caller.
pub fn verify_header(
    api: &dyn Api,
    params: &Params<'_>,
    group_key: impl Fn(u64) -> Option<[u8; G2_COMPRESSED]>,
    header_rlp: &[u8],
    cert: &[u8],
) -> Result<VerifiedHeader, Error> {
    let header = TempoHeader::decode(header_rlp)?;
    let fin = Finalization::decode(cert)?;

    if fin.payload != keccak256(header_rlp).0 {
        return Err(Error::PayloadMismatch);
    }
    let epoch = header.number / params.epoch_length;
    if fin.epoch != epoch {
        return Err(Error::EpochMismatch {
            cert: fin.epoch,
            header: epoch,
        });
    }
    // An old committee could still sign for its epoch after it rotated out, so refuse older epochs.
    let latest = params.latest_height / params.epoch_length;
    if epoch < latest {
        return Err(Error::StaleEpoch { epoch, latest });
    }
    if let Some(ctx) = header.context {
        if ctx.epoch != epoch || ctx.view != fin.view || ctx.parent_view != fin.parent {
            return Err(Error::ContextMismatch);
        }
    }

    let key = group_key(epoch).ok_or(Error::UnknownEpoch(epoch))?;
    let msg = finalize_message(params.namespace, &fin);
    let hashed = api
        .bls12_381_hash_to_g1(HashFunction::Sha256, &msg, DST_G1)
        .map_err(|e| Error::Bls(e.to_string()))?;
    // e(sig, g2) == e(H(m), pk)
    let ok = api
        .bls12_381_pairing_equality(&fin.vote_signature, &BLS12_381_G2_GENERATOR, &hashed, &key)
        .map_err(|e| Error::Bls(e.to_string()))?;
    if !ok {
        return Err(Error::InvalidSignature);
    }

    let next_key = if header.number % params.epoch_length == params.epoch_length - 1 {
        let (next_epoch, identity) = dkg_outcome_identity(&header.extra_data)?;
        if next_epoch != epoch + 1 {
            return Err(Error::DkgOutcomeEpochMismatch {
                expected: epoch + 1,
                actual: next_epoch,
            });
        }
        // Decoding in the host checks the point is on the curve and in the subgroup.
        api.bls12_381_aggregate_g2(&identity)
            .map_err(|e| Error::Bls(e.to_string()))?;
        Some((next_epoch, identity))
    } else {
        None
    };

    Ok(VerifiedHeader {
        height: header.number,
        timestamp: header.timestamp,
        state_root: header.state_root,
        next_key,
    })
}

/// The signed bytes: `varint(len(ns)) ns varint(epoch) varint(view) varint(parent) payload`,
/// where `ns` is the namespace with the `_FINALIZE` suffix.
pub fn finalize_message(namespace: &[u8], fin: &Finalization) -> Vec<u8> {
    let mut ns = namespace.to_vec();
    ns.extend_from_slice(b"_FINALIZE");
    let mut out = Vec::with_capacity(ns.len() + 64);
    write_varint(ns.len() as u64, &mut out);
    out.extend_from_slice(&ns);
    write_varint(fin.epoch, &mut out);
    write_varint(fin.view, &mut out);
    write_varint(fin.parent, &mut out);
    out.extend_from_slice(&fin.payload);
    out
}

/// Epoch and compressed group key (network identity) from an `OnchainDkgOutcome`.
/// Same offsets as `TempoHeaderLib.readDkgOutcome`.
pub fn dkg_outcome_identity(data: &[u8]) -> Result<(u64, [u8; G2_COMPRESSED]), Error> {
    let mut off = 0;
    let epoch = read_varint(data, &mut off).ok_or(Error::MalformedDkgOutcome)?;
    off += 32 + 1 + 4;
    let coeffs = read_varint(data, &mut off).ok_or(Error::MalformedDkgOutcome)?;
    let identity = data
        .get(off..off + G2_COMPRESSED)
        .ok_or(Error::MalformedDkgOutcome)?;
    if coeffs == 0 {
        return Err(Error::MalformedDkgOutcome);
    }
    Ok((epoch, identity.try_into().expect("checked length")))
}
