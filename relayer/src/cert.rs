// SPDX-License-Identifier: MIT OR Apache-2.0
//! Turns tempo's `consensus_getFinalization` output into a CommonwareLightClient update.

use alloy::primitives::{B256, Bytes, FixedBytes, hex, keccak256};
use commonware_codec::{DecodeExt as _, Encode as _, ReadExt as _};
use commonware_consensus::simplex::{scheme::bls12381_threshold::vrf::Scheme, types::Finalization};
use commonware_cryptography::{bls12381::primitives::variant::MinSig, ed25519::PublicKey, sha256};
use eyre::{Context as _, ensure, eyre};
use tempo_dkg_onchain_artifacts::OnchainDkgOutcome;
use tempo_primitives::TempoHeader;

use crate::abi::{G2Point, MsgUpdateClient};

type TempoFinalization = Finalization<Scheme<PublicKey, MinSig>, sha256::Digest>;

/// Builds the update for a finalized block.
///
/// `certificate_hex` is `CertifiedBlock.certificate` from `consensus_getFinalization` and
/// `header_rlp` is the RLP of the TempoHeader it finalizes.
pub fn build_update(
    certificate_hex: &str,
    header_rlp: Bytes,
    epoch_length: u64,
) -> eyre::Result<MsgUpdateClient> {
    let raw = hex::decode(certificate_hex).wrap_err("certificate hex")?;
    let fin =
        TempoFinalization::decode(raw.as_slice()).map_err(|e| eyre!("decode finalization: {e}"))?;

    // The LC recomputes this, but failing here gives a clearer error than a revert.
    let digest = B256::from(fin.proposal.payload.0);
    ensure!(
        keccak256(&header_rlp) == digest,
        "header hash != certified digest"
    );

    let sig = fin
        .certificate
        .get()
        .ok_or_else(|| eyre!("bad certificate signature"))?;
    let signature = g1_uncompressed(&sig.vote_signature.encode())?;

    let header: TempoHeader = alloy_rlp::Decodable::decode(&mut header_rlp.as_ref())
        .map_err(|e| eyre!("decode header: {e}"))?;
    let height = header.inner.number;

    // Boundary blocks carry the next epoch's key, which the LC checks against extra_data.
    let next_group_key = if height % epoch_length == epoch_length - 1 {
        group_key(&header.inner.extra_data)?.1
    } else {
        G2Point::default()
    };

    Ok(MsgUpdateClient {
        headerRlp: header_rlp,
        viewNumber: fin.proposal.round.view().get(),
        parentView: fin.proposal.parent.get(),
        signature: signature.into(),
        nextGroupKey: next_group_key,
    })
}

/// Epoch and group key from an `OnchainDkgOutcome` (genesis or boundary header extra_data).
pub fn group_key(extra_data: &[u8]) -> eyre::Result<(u64, G2Point)> {
    let outcome = OnchainDkgOutcome::read(&mut &extra_data[..])
        .map_err(|e| eyre!("decode dkg outcome: {e}"))?;
    Ok((
        outcome.epoch,
        g2_point(&outcome.network_identity().encode())?,
    ))
}

/// Compressed G1 (48 bytes) to uncompressed `x || y` (96 bytes), what LibBLS12381 takes.
pub fn g1_uncompressed(compressed: &[u8]) -> eyre::Result<Vec<u8>> {
    let p = blst::min_sig::Signature::from_bytes(compressed).map_err(|e| eyre!("g1: {e:?}"))?;
    Ok(p.serialize().to_vec())
}

/// Compressed G2 (96 bytes) to the EIP-2537 layout the LC stores.
pub fn g2_point(compressed: &[u8]) -> eyre::Result<G2Point> {
    let p = blst::min_pk::Signature::from_bytes(compressed).map_err(|e| eyre!("g2: {e:?}"))?;
    // blst orders Fp2 as c1, c0. Split each 48-byte field into a 16-byte hi and 32-byte lo word.
    let raw = p.serialize();
    let field = |i: usize| -> (FixedBytes<32>, FixedBytes<32>) {
        let f = &raw[i * 48..(i + 1) * 48];
        let mut hi = [0u8; 32];
        hi[16..].copy_from_slice(&f[..16]);
        (hi.into(), FixedBytes::from_slice(&f[16..]))
    };
    let (x_c1, x_c0, y_c1, y_c0) = (field(0), field(1), field(2), field(3));
    Ok(G2Point {
        xC0Hi: x_c0.0,
        xC0Lo: x_c0.1,
        xC1Hi: x_c1.0,
        xC1Lo: x_c1.1,
        yC0Hi: y_c0.0,
        yC0Lo: y_c0.1,
        yC1Hi: y_c1.0,
        yC1Lo: y_c1.1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::sol_types::SolValue as _;

    fn fixture() -> serde_json::Value {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../contracts/test/fixtures/lc.json"
        );
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
    }

    fn bytes(v: &serde_json::Value) -> Bytes {
        v.as_str().unwrap().parse().unwrap()
    }

    /// The raw tempo certificate bytes turn into exactly what the forge tests submit.
    #[test]
    fn build_update_matches_fixture() {
        let f = fixture();
        let epoch_length = f["epochLength"].as_u64().unwrap();
        for (i, u) in f["updates"].as_array().unwrap().iter().enumerate() {
            let cert = u["tempoCertificate"].as_str().unwrap();
            let m = build_update(cert, bytes(&u["headerRlp"]), epoch_length).unwrap();
            assert_eq!(m.signature, bytes(&u["voteSignature"]), "update {i}");
            assert_eq!(m.viewNumber, u["view"].as_u64().unwrap());
            assert_eq!(m.parentView, u["parentView"].as_u64().unwrap());
            if i == 1 {
                // Boundary: next key comes out of extra_data.
                assert_eq!(
                    Bytes::from(m.nextGroupKey.abi_encode()),
                    bytes(&f["epoch1Key"])
                );
            }
        }
    }

    #[test]
    fn g2_point_matches_fixture() {
        let f = fixture();
        let k = g2_point(&bytes(&f["epoch0KeyCompressed"])).unwrap();
        assert_eq!(Bytes::from(k.abi_encode()), bytes(&f["epoch0Key"]));
    }
}
