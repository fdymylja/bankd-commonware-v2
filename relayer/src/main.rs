// SPDX-License-Identifier: MIT OR Apache-2.0
//! bankd <-> bankd IBC v2 relayer.
//!
//! Per direction A -> B:
//! 1. subscribe to SendPacket on A's router
//! 2. take an eth_getProof of the commitment at A's tip, then wait until that block is finalized
//! 3. fetch its certificate + header (consensus_getFinalization), catch B's light client up across
//!    any epoch boundaries, then updateClient on B
//! 4. recvPacket on B
//! 5. WriteAcknowledgement on B goes back to A the same way (ackPacket)
//!
//! Timeouts are not handled yet.
//!
//! Usage:
//!   bankd-relayer                       run, config from env (see `main`)
//!   bankd-relayer lc-init <http_rpc> <epoch_length>
//!                                       print the trusted epoch + group key to deploy a light client with

mod abi;
mod cert;

use std::{sync::Arc, time::Duration};

use alloy::{
    network::EthereumWallet,
    primitives::{Address, B256, Bytes, keccak256},
    providers::{DynProvider, Provider, ProviderBuilder, WsConnect},
    rpc::types::Filter,
    signers::local::PrivateKeySigner,
    sol_types::{SolEvent, SolValue},
};
use eyre::{Context as _, eyre};
use futures::StreamExt as _;
use serde::Deserialize;
use tempo_primitives::TempoHeader;
use tokio::sync::Mutex;

use abi::{
    ClientState, CommonwareLightClient, Height, ICS26Router, MembershipProof, MsgAckPacket,
    MsgRecvPacket, Packet,
};

/// ERC-7201 base slot of IBCStoreUpgradeable (commitments mapping).
const IBCSTORE_SLOT: B256 =
    alloy::primitives::b256!("1260944489272988d9df285149b5aa1b0f48f2136d6f416159f840a3e0747600");
const POLL: Duration = Duration::from_millis(250);

#[derive(Clone)]
struct Chain {
    name: String,
    provider: DynProvider,
    router: Address,
    /// Client on this chain that tracks the other chain.
    client_id: String,
    /// Epoch length of this chain, used when building updates for the other side.
    epoch_length: u64,
    /// One relayer key per chain, so txs from concurrent tasks are serialized to keep nonces sane.
    tx_lock: Arc<Mutex<()>>,
}

/// Subset of tempo's `CertifiedBlock` (crates/node/src/rpc/consensus/types.rs).
#[derive(Debug, Deserialize)]
struct CertifiedBlock {
    certificate: String,
    block: CertifiedBlockInner,
}

#[derive(Debug, Deserialize)]
struct CertifiedBlockInner {
    header: TempoHeader,
}

impl Chain {
    async fn connect(prefix: &str, signer: PrivateKeySigner) -> eyre::Result<Self> {
        let var = |k: &str| {
            std::env::var(format!("{prefix}_{k}")).wrap_err_with(|| format!("{prefix}_{k}"))
        };
        let provider = ProviderBuilder::new()
            .wallet(EthereumWallet::from(signer))
            .connect_ws(WsConnect::new(var("WS")?))
            .await?
            .erased();
        Ok(Self {
            name: var("NAME").unwrap_or_else(|_| prefix.to_string()),
            provider,
            router: var("ROUTER")?.parse()?,
            client_id: var("CLIENT_ID")?,
            epoch_length: var("EPOCH_LENGTH")?.parse()?,
            tx_lock: Arc::default(),
        })
    }

    async fn finalized_height(&self) -> eyre::Result<u64> {
        let b: serde_json::Value = self
            .provider
            .raw_request("eth_getBlockByNumber".into(), ("finalized", false))
            .await?;
        hex_u64(&b["number"])
    }

    async fn wait_finalized(&self, height: u64) -> eyre::Result<()> {
        while self.finalized_height().await? < height {
            tokio::time::sleep(POLL).await;
        }
        Ok(())
    }

    /// Update message proving this chain's finalized block at `height` to a CommonwareLightClient.
    async fn update_msg(&self, height: u64) -> eyre::Result<Bytes> {
        let fin: CertifiedBlock = self
            .provider
            .raw_request(
                "consensus_getFinalization".into(),
                (serde_json::json!({ "height": height }),),
            )
            .await
            .wrap_err_with(|| format!("{}: consensus_getFinalization {height}", self.name))?;
        // Re-encode the header ourselves. build_update checks keccak(rlp) == certified digest.
        let rlp = Bytes::from(alloy_rlp::encode(&fin.block.header));
        Ok(
            cert::build_update(&fin.certificate, rlp, self.epoch_length)?
                .abi_encode()
                .into(),
        )
    }

    /// eth_getProof of a commitment path at the current tip. reth only serves proofs for the tip by
    /// default (eth-proof-window 0), so snapshot now and wait for finality afterwards.
    async fn tip_proof(&self, path: &[u8]) -> eyre::Result<(u64, Bytes)> {
        let slot = keccak256((keccak256(path), IBCSTORE_SLOT).abi_encode());
        loop {
            let tip = self.provider.get_block_number().await?;
            match self
                .provider
                .get_proof(self.router, vec![slot])
                .number(tip)
                .await
            {
                Ok(p) => {
                    let storage = p
                        .storage_proof
                        .first()
                        .ok_or_else(|| eyre!("no storage proof"))?;
                    eyre::ensure!(!storage.value.is_zero(), "commitment missing at {tip}");
                    let proof = MembershipProof {
                        accountProof: p.account_proof,
                        storageProof: storage.proof.clone(),
                    };
                    return Ok((tip, proof.abi_encode().into()));
                }
                // Tip moved between the two calls, try again.
                Err(_) => tokio::time::sleep(POLL).await,
            }
        }
    }
}

/// Brings `dst`'s light client for `src` up to `height`: boundary headers first, then `height`.
async fn update_client(src: &Chain, dst: &Chain, height: u64) -> eyre::Result<()> {
    // Hold the lock for the whole catch-up: two tasks updating the same client could otherwise
    // interleave and submit an older epoch after a newer one (StaleEpoch revert).
    let _g = dst.tx_lock.lock().await;
    let router = ICS26Router::new(dst.router, &dst.provider);
    let lc_addr = router.getClient(dst.client_id.clone()).call().await?;
    let lc = CommonwareLightClient::new(lc_addr, &dst.provider);
    let state = ClientState::abi_decode(&lc.getClientState().call().await?)?;
    let len = state.epochLength;
    let mut heights: Vec<u64> = (state.latestHeight.revisionHeight / len..height / len)
        .map(|e| (e + 1) * len - 1)
        .collect();
    heights.push(height);

    for h in heights {
        if lc.getConsensusState(h).call().await?.stateRoot != B256::ZERO {
            continue;
        }
        let msg = src.update_msg(h).await?;
        let r = router
            .updateClient(dst.client_id.clone(), msg)
            .send()
            .await?
            .get_receipt()
            .await?;
        eyre::ensure!(
            r.status(),
            "updateClient reverted: {:?}",
            r.transaction_hash
        );
        eprintln!("{} <- {}: updateClient height={h}", dst.name, src.name);
    }
    Ok(())
}

fn commitment_path(client: &str, kind: u8, sequence: u64) -> Vec<u8> {
    [client.as_bytes(), &[kind], &sequence.to_be_bytes()].concat()
}

/// Relays SendPacket on `src` to recvPacket on `dst`.
async fn relay_packets(src: Chain, dst: Chain) -> eyre::Result<()> {
    let filter = Filter::new()
        .address(src.router)
        .event_signature(ICS26Router::SendPacket::SIGNATURE_HASH);
    let mut logs = src.provider.subscribe_logs(&filter).await?.into_stream();
    let dst_router = ICS26Router::new(dst.router, &dst.provider);

    while let Some(log) = logs.next().await {
        let packet: Packet = ICS26Router::SendPacket::decode_log_data(log.data())?.packet;
        let seq = packet.sequence;
        let path = commitment_path(&packet.sourceClient, 1, seq);
        let (height, proof) = src.tip_proof(&path).await?;
        src.wait_finalized(height).await?;
        update_client(&src, &dst, height).await?;

        let msg = MsgRecvPacket {
            packet,
            proofCommitment: proof,
            proofHeight: Height {
                revisionNumber: 0,
                revisionHeight: height,
            },
        };
        let _g = dst.tx_lock.lock().await;
        let r = dst_router
            .recvPacket(msg)
            .send()
            .await?
            .get_receipt()
            .await?;
        eyre::ensure!(r.status(), "recvPacket reverted: {:?}", r.transaction_hash);
        eprintln!(
            "{} -> {}: recvPacket seq={seq} proofHeight={height}",
            src.name, dst.name
        );
    }
    Ok(())
}

/// Relays WriteAcknowledgement on `dst` back to ackPacket on `src`.
async fn relay_acks(src: Chain, dst: Chain) -> eyre::Result<()> {
    let filter = Filter::new()
        .address(dst.router)
        .event_signature(ICS26Router::WriteAcknowledgement::SIGNATURE_HASH);
    let mut logs = dst.provider.subscribe_logs(&filter).await?.into_stream();
    let src_router = ICS26Router::new(src.router, &src.provider);

    while let Some(log) = logs.next().await {
        let ev = ICS26Router::WriteAcknowledgement::decode_log_data(log.data())?;
        // Single payload packets only, same as ICS26Router today.
        let ack = ev
            .acknowledgements
            .first()
            .cloned()
            .ok_or_else(|| eyre!("no ack"))?;
        let seq = ev.packet.sequence;
        let path = commitment_path(&ev.packet.destClient, 3, seq);
        let (height, proof) = dst.tip_proof(&path).await?;
        dst.wait_finalized(height).await?;
        update_client(&dst, &src, height).await?;

        let msg = MsgAckPacket {
            packet: ev.packet,
            acknowledgement: ack,
            proofAcked: proof,
            proofHeight: Height {
                revisionNumber: 0,
                revisionHeight: height,
            },
        };
        let _g = src.tx_lock.lock().await;
        let r = src_router
            .ackPacket(msg)
            .send()
            .await?
            .get_receipt()
            .await?;
        eyre::ensure!(r.status(), "ackPacket reverted: {:?}", r.transaction_hash);
        eprintln!(
            "{} -> {}: ackPacket seq={seq} proofHeight={height}",
            dst.name, src.name
        );
    }
    Ok(())
}

fn hex_u64(v: &serde_json::Value) -> eyre::Result<u64> {
    let s = v
        .as_str()
        .ok_or_else(|| eyre!("expected hex quantity, got {v}"))?;
    Ok(u64::from_str_radix(s.trim_start_matches("0x"), 16)?)
}

/// Trusted epoch and group key for a new light client tracking the chain at `rpc`.
/// Epoch 0's key is in genesis extra_data, later ones in the previous epoch's boundary header.
async fn lc_init(rpc: &str, epoch_length: u64) -> eyre::Result<()> {
    let p = ProviderBuilder::new().connect(rpc).await?;
    let fin: serde_json::Value = p
        .raw_request("eth_getBlockByNumber".into(), ("finalized", false))
        .await?;
    let epoch = hex_u64(&fin["number"])? / epoch_length;
    let src = if epoch == 0 {
        0
    } else {
        epoch * epoch_length - 1
    };
    let b: serde_json::Value = p
        .raw_request("eth_getBlockByNumber".into(), (format!("{src:#x}"), false))
        .await?;
    let extra: Bytes = serde_json::from_value(b["extraData"].clone())?;
    let (outcome_epoch, key) = cert::group_key(&extra)?;
    eyre::ensure!(
        outcome_epoch == epoch,
        "outcome epoch {outcome_epoch} != {epoch}"
    );
    println!(
        "{}",
        serde_json::json!({ "epoch": epoch, "key": Bytes::from(key.abi_encode()) })
    );
    Ok(())
}

/// Env: RELAYER_KEY, and for A and B: {A,B}_WS, {A,B}_ROUTER, {A,B}_CLIENT_ID (client on that chain
/// tracking the other one), {A,B}_EPOCH_LENGTH, optional {A,B}_NAME.
#[tokio::main]
async fn main() -> eyre::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("lc-init") {
        let rpc = args.get(2).ok_or_else(|| eyre!("rpc url"))?;
        let len = args.get(3).ok_or_else(|| eyre!("epoch length"))?.parse()?;
        return lc_init(rpc, len).await;
    }

    let signer: PrivateKeySigner = std::env::var("RELAYER_KEY")
        .wrap_err("RELAYER_KEY")?
        .parse()?;
    let a = Chain::connect("A", signer.clone()).await?;
    let b = Chain::connect("B", signer).await?;
    eprintln!("relaying {} <-> {}", a.name, b.name);

    // Both directions, packets and acks. Any task error stops the relayer (fail fast for now).
    tokio::try_join!(
        relay_packets(a.clone(), b.clone()),
        relay_acks(a.clone(), b.clone()),
        relay_packets(b.clone(), a.clone()),
        relay_acks(b, a),
    )?;
    Ok(())
}
