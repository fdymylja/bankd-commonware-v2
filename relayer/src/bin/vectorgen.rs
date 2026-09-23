// SPDX-License-Identifier: MIT OR Apache-2.0
//! Generates CommonwareLightClient test vectors with the same types tempo uses on chain.
//!
//! Usage:
//!   vectorgen <state_root hex> <timestamp secs> <epoch_length>
//!     three updates (plain, epoch boundary with key rotation, next epoch)
//!   vectorgen single <state_root hex> <height> <timestamp secs> <epoch_length>
//!     one epoch 0 update at `height`
//! Prints a JSON fixture to stdout. The state root should come from a real chain (anvil) so the
//! storage proofs in the fixture verify against it.

use alloy_primitives::{B256, Bytes, hex};
use commonware_codec::Encode as _;
use commonware_consensus::{
    simplex::{
        scheme::{
            Namespace,
            bls12381_threshold::vrf::{Certificate, Scheme, Signature},
        },
        types::{Finalization, Proposal, Subject},
    },
    types::{Epoch, Round, View},
};
use commonware_cryptography::{
    Signer as _,
    bls12381::{
        dkg::feldman_desmedt as dkg,
        primitives::{
            ops::threshold,
            sharing::{Mode, Sharing},
            variant::MinSig,
        },
    },
    certificate::Subject as _,
    ed25519::{PrivateKey, PublicKey},
    sha256,
};
use commonware_math::algebra::Random as _;
use commonware_parallel::Sequential;
use commonware_utils::{N3f1, TryFromIterator as _, ordered};
use rand::{SeedableRng as _, rngs::StdRng};
use serde_json::{Value, json};
use tempo_dkg_onchain_artifacts::OnchainDkgOutcome;
use tempo_primitives::{Header, TempoConsensusContext, TempoHeader, ed25519::PublicKey as TempoEd};

const NAMESPACE: &[u8] = b"TEMPO";

struct Committee {
    output: dkg::Output<MinSig, PublicKey>,
    shares: Vec<commonware_cryptography::bls12381::primitives::group::Share>,
    players: ordered::Set<PublicKey>,
}

fn committee(rng: &mut StdRng) -> Committee {
    let mut keys: Vec<PrivateKey> = (0..4).map(|_| PrivateKey::random(&mut *rng)).collect();
    keys.sort_by_key(|k| k.public_key());
    let players = ordered::Set::try_from_iter(keys.iter().map(|k| k.public_key())).unwrap();
    let (output, shares) =
        dkg::deal::<MinSig, _, N3f1>(&mut *rng, Mode::NonZeroCounter, players.clone()).unwrap();
    Committee {
        output,
        shares: shares.values().to_vec(),
        players,
    }
}

/// Uncompressed EIP-2537 G2 point, each 48-byte field padded to 64, ordered x.c0 x.c1 y.c0 y.c1.
fn g2_eip2537(compressed: &[u8]) -> Vec<u8> {
    let p = blst::min_pk::Signature::from_bytes(compressed).unwrap();
    let mut raw = p.serialize().to_vec(); // x.c1 x.c0 y.c1 y.c0
    for coord in raw.chunks_mut(96) {
        let (c1, c0) = coord.split_at_mut(48);
        c1.swap_with_slice(c0);
    }
    pad(&raw)
}

/// Uncompressed G1 `x || y`, 48 bytes each, the shape LibBLS12381.verifyMinSig takes.
fn g1_uncompressed(compressed: &[u8]) -> Vec<u8> {
    blst::min_sig::Signature::from_bytes(compressed)
        .unwrap()
        .serialize()
        .to_vec()
}

fn pad(raw: &[u8]) -> Vec<u8> {
    raw.chunks(48)
        .flat_map(|f| [0u8; 16].into_iter().chain(f.iter().copied()))
        .collect()
}

fn sign(
    sharing: &Sharing<MinSig>,
    shares: &[commonware_cryptography::bls12381::primitives::group::Share],
    ns: &[u8],
    msg: &[u8],
) -> <MinSig as commonware_cryptography::bls12381::primitives::variant::Variant>::Signature {
    let partials: Vec<_> = shares
        .iter()
        .take(sharing.required() as usize)
        .map(|s| threshold::sign_message::<MinSig>(s, ns, msg))
        .collect();
    threshold::recover::<MinSig, _>(sharing, &partials, &Sequential).unwrap()
}

struct Update<'a> {
    committee: &'a Committee,
    height: u64,
    epoch: u64,
    view: u64,
    parent_view: u64,
    state_root: B256,
    timestamp: u64,
    extra_data: Bytes,
}

fn update(rng: &mut StdRng, u: Update<'_>) -> Value {
    let header = TempoHeader {
        general_gas_limit: 30_000_000,
        shared_gas_limit: 3_000_000,
        timestamp_millis_part: 250,
        inner: Header {
            number: u.height,
            timestamp: u.timestamp,
            state_root: u.state_root,
            gas_limit: 500_000_000,
            base_fee_per_gas: Some(10_000_000_000),
            extra_data: u.extra_data,
            parent_hash: B256::repeat_byte(0x11),
            ..Default::default()
        },
        consensus_context: Some(TempoConsensusContext {
            epoch: u.epoch,
            view: u.view,
            parent_view: u.parent_view,
            proposer: TempoEd::try_from(B256::from(<[u8; 32]>::from(
                &PrivateKey::from_seed(7).public_key(),
            )))
            .unwrap(),
        }),
    };
    let rlp = alloy_rlp::encode(&header);
    let hash = alloy_primitives::keccak256(&rlp);
    assert_eq!(hash, alloy_consensus::Sealable::hash_slow(&header));

    let proposal = Proposal::new(
        Round::new(Epoch::new(u.epoch), View::new(u.view)),
        View::new(u.parent_view),
        sha256::Digest(hash.0),
    );
    let ns = Namespace::new(NAMESPACE);
    let subject = Subject::Finalize {
        proposal: &proposal,
    };
    let sharing = u.committee.output.public();
    let vote = sign(
        sharing,
        &u.committee.shares,
        subject.namespace(&ns),
        &subject.message(),
    );
    let seed = sign(
        sharing,
        &u.committee.shares,
        &ns.seed,
        &proposal.round.encode(),
    );
    let signed_message = subject.message();
    let finalization = Finalization::<Scheme<PublicKey, MinSig>, sha256::Digest> {
        proposal: proposal.clone(),
        certificate: Certificate::from(Signature {
            vote_signature: vote,
            seed_signature: seed,
        }),
    };
    // Same check tempo's FinalizationVerifier runs, so the fixture is a cert tempo would accept.
    let verifier = Scheme::<PublicKey, MinSig>::certificate_verifier(NAMESPACE, *sharing.public());
    assert!(finalization.verify(rng, &verifier, &Sequential));

    json!({
        "height": u.height,
        "epoch": u.epoch,
        "view": u.view,
        "parentView": u.parent_view,
        "headerRlp": hex::encode_prefixed(&rlp),
        "headerHash": hash.to_string(),
        "stateRoot": u.state_root.to_string(),
        "timestamp": u.timestamp,
        "signedMessage": hex::encode_prefixed(&signed_message),
        "voteSignature": hex::encode_prefixed(g1_uncompressed(&vote.encode())),
        "tempoCertificate": hex::encode_prefixed(finalization.encode()),
    })
}

fn main() -> eyre::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("single") {
        return single(&args[2..]);
    }
    let state_root: B256 = args
        .get(1)
        .ok_or_else(|| eyre::eyre!("state root"))?
        .parse()?;
    let timestamp: u64 = args
        .get(2)
        .ok_or_else(|| eyre::eyre!("timestamp"))?
        .parse()?;
    let epoch_length: u64 = args
        .get(3)
        .ok_or_else(|| eyre::eyre!("epoch length"))?
        .parse()?;

    let mut rng = StdRng::seed_from_u64(42);
    let c0 = committee(&mut rng);
    let c1 = committee(&mut rng);

    // The boundary (last block of epoch 0) carries the outcome that installs epoch 1's key.
    let outcome = OnchainDkgOutcome {
        epoch: 1,
        output: c1.output.clone(),
        next_players: c1.players.clone(),
        is_next_full_dkg: false,
    };
    let outcome_bytes = outcome.encode();
    let id0 = c0.output.public().public().encode();
    let id1 = c1.output.public().public().encode();

    let boundary = epoch_length - 1;
    let updates = vec![
        update(
            &mut rng,
            Update {
                committee: &c0,
                height: 3,
                epoch: 0,
                view: 4,
                parent_view: 3,
                state_root,
                timestamp,
                extra_data: Bytes::new(),
            },
        ),
        update(
            &mut rng,
            Update {
                committee: &c0,
                height: boundary,
                epoch: 0,
                view: boundary + 1,
                parent_view: boundary,
                state_root,
                timestamp: timestamp + 1,
                extra_data: Bytes::from(outcome_bytes.to_vec()),
            },
        ),
        update(
            &mut rng,
            Update {
                committee: &c1,
                height: epoch_length + 2,
                epoch: 1,
                view: 3,
                parent_view: 2,
                state_root,
                timestamp: timestamp + 2,
                extra_data: Bytes::new(),
            },
        ),
    ];

    let out = json!({
        "namespace": hex::encode_prefixed(NAMESPACE),
        "epochLength": epoch_length,
        "epoch0KeyCompressed": hex::encode_prefixed(&id0),
        "epoch0Key": hex::encode_prefixed(g2_eip2537(&id0)),
        "epoch1KeyCompressed": hex::encode_prefixed(&id1),
        "epoch1Key": hex::encode_prefixed(g2_eip2537(&id1)),
        "dkgOutcome": hex::encode_prefixed(&outcome_bytes),
        "updates": updates,
    });
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}

fn single(args: &[String]) -> eyre::Result<()> {
    let state_root: B256 = args
        .first()
        .ok_or_else(|| eyre::eyre!("state root"))?
        .parse()?;
    let height: u64 = args.get(1).ok_or_else(|| eyre::eyre!("height"))?.parse()?;
    let timestamp: u64 = args
        .get(2)
        .ok_or_else(|| eyre::eyre!("timestamp"))?
        .parse()?;
    let epoch_length: u64 = args
        .get(3)
        .ok_or_else(|| eyre::eyre!("epoch length"))?
        .parse()?;
    eyre::ensure!(height < epoch_length, "single mode only signs epoch 0");

    let mut rng = StdRng::seed_from_u64(42);
    let c0 = committee(&mut rng);
    let id0 = c0.output.public().public().encode();
    let u = update(
        &mut rng,
        Update {
            committee: &c0,
            height,
            epoch: 0,
            view: height + 1,
            parent_view: height,
            state_root,
            timestamp,
            extra_data: Bytes::new(),
        },
    );
    let out = json!({
        "namespace": hex::encode_prefixed(NAMESPACE),
        "epochLength": epoch_length,
        "epoch0Key": hex::encode_prefixed(g2_eip2537(&id0)),
        "update": u,
    });
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}
