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
//! On start each direction backfills logs from {A,B}_FROM_BLOCK before subscribing, and packets
//! that were already received or acked are skipped, so a restart picks up where it left off.
//! Errors retry with backoff from the failed event's block instead of stopping the relayer.
//!
//! Timeouts are not handled yet. Timed out packets are skipped.
//!
//! Usage:
//!   bankd-relayer                       run, config from env (see `main`)
//!   bankd-relayer lc-init <http_rpc> <epoch_length>
//!                                       print the trusted epoch + group key to deploy a light client with
//!   bankd-relayer gaia-create-client | gaia-relay <tx>
//!                                       bankd -> Cosmos txs, see gaia.rs
//!   bankd-relayer tm-update-msg [height] | tm-proof <key> [height]
//!                                       gaia -> bankd, see tendermint.rs

mod abi;
mod cert;
mod gaia;
mod tendermint;

use std::{sync::Arc, time::Duration};

use alloy::{
    eips::BlockNumberOrTag,
    network::EthereumWallet,
    primitives::{Address, B256, Bytes, keccak256},
    providers::{DynProvider, Provider, ProviderBuilder, WsConnect},
    rpc::types::{Filter, Log},
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
const BACKOFF_MIN: Duration = Duration::from_secs(1);
const BACKOFF_MAX: Duration = Duration::from_secs(30);
const RECEIPT_TIMEOUT: Duration = Duration::from_secs(60);
/// Block range per eth_getLogs call when backfilling.
const LOG_CHUNK: u64 = 5_000;

#[derive(Clone)]
struct Chain {
    name: String,
    provider: DynProvider,
    router: Address,
    /// Client on this chain that tracks the other chain.
    client_id: String,
    /// Epoch length of this chain, used when building updates for the other side.
    epoch_length: u64,
    /// First block to scan for this chain's events on startup.
    from_block: u64,
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
    async fn connect(prefix: &str) -> eyre::Result<Self> {
        let var = |k: &str| {
            std::env::var(format!("{prefix}_{k}")).wrap_err_with(|| format!("{prefix}_{k}"))
        };
        let signer: PrivateKeySigner = var("KEY")?.parse()?;
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
            from_block: var("FROM_BLOCK").map_or(Ok(0), |v| v.parse())?,
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
            .with_timeout(Some(RECEIPT_TIMEOUT))
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

/// Which events a relay task follows. Packets: SendPacket on src -> recvPacket on dst.
/// Acks: WriteAcknowledgement on dst -> ackPacket on src.
#[derive(Clone, Copy, Debug)]
enum Kind {
    Packets,
    Acks,
}

/// Runs one relay task forever. Errors wait with backoff, then resume from the failed event's block.
async fn relay(kind: Kind, src: Chain, dst: Chain) {
    let watched = match kind {
        Kind::Packets => &src,
        Kind::Acks => &dst,
    };
    let what = format!("{kind:?} {} -> {}", src.name, dst.name);
    let mut from = watched.from_block;
    let mut backoff = BACKOFF_MIN;
    loop {
        let start = from;
        match watch(kind, &src, &dst, &mut from).await {
            Ok(()) => eprintln!("{what}: log stream ended, resubscribing"),
            Err(e) => eprintln!("{what}: {e:#}, retrying from block {from} in {backoff:?}"),
        }
        if from > start {
            backoff = BACKOFF_MIN;
        }
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(BACKOFF_MAX);
    }
}

/// Handles `kind` events from block `from` on: backfill with eth_getLogs, then follow a subscription.
/// `from` only moves past a block once every event in it was handled.
async fn watch(kind: Kind, src: &Chain, dst: &Chain, from: &mut u64) -> eyre::Result<()> {
    let (chain, event) = match kind {
        Kind::Packets => (src, ICS26Router::SendPacket::SIGNATURE_HASH),
        Kind::Acks => (dst, ICS26Router::WriteAcknowledgement::SIGNATURE_HASH),
    };
    let filter = Filter::new().address(chain.router).event_signature(event);
    // Subscribe before backfilling so nothing emitted in between is missed.
    let mut sub = chain.provider.subscribe_logs(&filter).await?.into_stream();
    let tip = chain.provider.get_block_number().await?;

    while *from <= tip {
        let to = (*from + LOG_CHUNK - 1).min(tip);
        let logs = chain
            .provider
            .get_logs(&filter.clone().from_block(*from).to_block(to))
            .await?;
        for log in logs {
            *from = log.block_number.unwrap_or(*from);
            handle(kind, src, dst, &log).await?;
        }
        *from = to + 1;
    }

    while let Some(log) = sub.next().await {
        let n = log
            .block_number
            .ok_or_else(|| eyre!("log without block number"))?;
        if n <= tip {
            continue; // already handled by the backfill
        }
        *from = n;
        handle(kind, src, dst, &log).await?;
    }
    Ok(())
}

async fn handle(kind: Kind, src: &Chain, dst: &Chain, log: &Log) -> eyre::Result<()> {
    match kind {
        Kind::Packets => relay_packet(src, dst, log).await,
        Kind::Acks => relay_ack(src, dst, log).await,
    }
}

/// Whether `chain`'s router has a commitment (packet, receipt or ack) at `path`.
async fn has_commitment(chain: &Chain, path: &[u8]) -> eyre::Result<bool> {
    let c = ICS26Router::new(chain.router, &chain.provider)
        .getCommitment(keccak256(path))
        .call()
        .await?;
    Ok(c != B256::ZERO)
}

/// Relays one SendPacket on `src` to recvPacket on `dst`. Already handled packets are skipped.
async fn relay_packet(src: &Chain, dst: &Chain, log: &Log) -> eyre::Result<()> {
    let packet: Packet = ICS26Router::SendPacket::decode_log_data(log.data())?.packet;
    let seq = packet.sequence;
    let path = commitment_path(&packet.sourceClient, 1, seq);
    // No packet commitment means it was already acked (or timed out).
    if !has_commitment(src, &path).await?
        || has_commitment(dst, &commitment_path(&packet.destClient, 2, seq)).await?
    {
        return Ok(());
    }
    let dst_time = dst
        .provider
        .get_block_by_number(BlockNumberOrTag::Latest)
        .await?
        .ok_or_else(|| eyre!("{}: no latest block", dst.name))?
        .header
        .timestamp;
    if dst_time >= packet.timeoutTimestamp {
        eprintln!(
            "{} -> {}: seq={seq} timed out, skipping",
            src.name, dst.name
        );
        return Ok(());
    }

    let (height, proof) = src.tip_proof(&path).await?;
    src.wait_finalized(height).await?;
    update_client(src, dst, height).await?;

    let msg = MsgRecvPacket {
        packet,
        proofCommitment: proof,
        proofHeight: Height {
            revisionNumber: 0,
            revisionHeight: height,
        },
    };
    let _g = dst.tx_lock.lock().await;
    let r = ICS26Router::new(dst.router, &dst.provider)
        .recvPacket(msg)
        .send()
        .await?
        .with_timeout(Some(RECEIPT_TIMEOUT))
        .get_receipt()
        .await?;
    eyre::ensure!(r.status(), "recvPacket reverted: {:?}", r.transaction_hash);
    eprintln!(
        "{} -> {}: recvPacket seq={seq} proofHeight={height}",
        src.name, dst.name
    );
    Ok(())
}

/// Relays one WriteAcknowledgement on `dst` back to ackPacket on `src`. Already acked packets are skipped.
async fn relay_ack(src: &Chain, dst: &Chain, log: &Log) -> eyre::Result<()> {
    let ev = ICS26Router::WriteAcknowledgement::decode_log_data(log.data())?;
    let seq = ev.packet.sequence;
    if !has_commitment(src, &commitment_path(&ev.packet.sourceClient, 1, seq)).await? {
        return Ok(());
    }
    // Single payload packets only, same as ICS26Router today.
    let ack = ev
        .acknowledgements
        .first()
        .cloned()
        .ok_or_else(|| eyre!("no ack"))?;
    let path = commitment_path(&ev.packet.destClient, 3, seq);
    let (height, proof) = dst.tip_proof(&path).await?;
    dst.wait_finalized(height).await?;
    update_client(dst, src, height).await?;

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
    let r = ICS26Router::new(src.router, &src.provider)
        .ackPacket(msg)
        .send()
        .await?
        .with_timeout(Some(RECEIPT_TIMEOUT))
        .get_receipt()
        .await?;
    eyre::ensure!(r.status(), "ackPacket reverted: {:?}", r.transaction_hash);
    eprintln!(
        "{} -> {}: ackPacket seq={seq} proofHeight={height}",
        dst.name, src.name
    );
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

/// Env, for A and B: {A,B}_KEY (relayer key used on that chain), {A,B}_WS, {A,B}_ROUTER,
/// {A,B}_CLIENT_ID (client on that chain tracking the other one), {A,B}_EPOCH_LENGTH, optional
/// {A,B}_NAME and {A,B}_FROM_BLOCK (where to start scanning that chain's events, default 0).
#[tokio::main]
async fn main() -> eyre::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("lc-init") {
        let rpc = args.get(2).ok_or_else(|| eyre!("rpc url"))?;
        let len = args.get(3).ok_or_else(|| eyre!("epoch length"))?.parse()?;
        return lc_init(rpc, len).await;
    }
    match args.get(1).map(String::as_str) {
        Some("gaia-create-client") => return gaia::create_client().await,
        Some("gaia-relay") => {
            return gaia::relay(args.get(2).ok_or_else(|| eyre!("bankd tx hash"))?).await;
        }
        Some("tm-update-msg") => {
            return tendermint::update_msg(args.get(2).map(|v| v.parse()).transpose()?).await;
        }
        Some("tm-header") => {
            return tendermint::header_json(
                args.get(2)
                    .ok_or_else(|| eyre!("trusted height"))?
                    .parse()?,
                args.get(3).ok_or_else(|| eyre!("target height"))?.parse()?,
            )
            .await;
        }
        Some("tm-proof") => {
            return tendermint::proof(
                args.get(2).ok_or_else(|| eyre!("key hex"))?,
                args.get(3).map(|v| v.parse()).transpose()?,
            )
            .await;
        }
        _ => {}
    }

    let a = Chain::connect("A").await?;
    let b = Chain::connect("B").await?;
    eprintln!("relaying {} <-> {}", a.name, b.name);

    // Both directions, packets and acks. These only return if the process is killed.
    tokio::join!(
        relay(Kind::Packets, a.clone(), b.clone()),
        relay(Kind::Acks, a.clone(), b.clone()),
        relay(Kind::Packets, b.clone(), a.clone()),
        relay(Kind::Acks, b, a),
    );
    Ok(())
}
