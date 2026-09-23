// SPDX-License-Identifier: MIT OR Apache-2.0
//! bankd -> Cosmos (gaia) side, against the `cw-commonware` 08-wasm client.
//!
//! Builds unsigned `cosmos.tx.v1beta1.TxBody`s (printed base64) for the caller to sign and
//! broadcast, the same contract as ibc-contracts' proof-api. `scripts/bankd/gaia-bridge.sh`
//! signs them with gaiad.
//!
//!   bankd-relayer gaia-create-client        MsgCreateClient trusting bankd's latest finalized block
//!   bankd-relayer gaia-relay <bankd tx>     MsgUpdateClient(s) + MsgRecvPacket / MsgAcknowledgement
//!                                           for every SendPacket / WriteAcknowledgement in the tx
//!
//! Env: BANKD_RPC (http), BANKD_ROUTER, BANKD_EPOCH_LENGTH, GAIA_SIGNER (relayer's cosmos address),
//! plus WASM_CHECKSUM (hex) for create, GAIA_CLIENT_ID and GAIA_CLIENT_HEIGHT (the client's latest
//! height) for relay.

use alloy::{
    eips::BlockNumberOrTag,
    primitives::{Address, B256, Bytes, keccak256},
    providers::{DynProvider, Provider, ProviderBuilder},
    sol_types::{SolEvent, SolValue},
};
use cw_commonware::{
    membership::account_from_proof,
    types::{ClientState, ConsensusState, EpochKey, Header, MembershipProof},
    verify::dkg_outcome_identity,
};
use eyre::{Context as _, eyre};
use prost::Message;

use crate::{CertifiedBlock, IBCSTORE_SLOT, POLL, abi, commitment_path, hex_u64};

/// Simplex namespace bankd signs with (crates/consensus NAMESPACE).
const NAMESPACE: &[u8] = b"TEMPO";

mod proto {
    //! The handful of ibc-go / cosmos-sdk messages we send, by hand instead of pulling ibc-proto.
    use prost::Message;

    #[derive(Clone, PartialEq, Message)]
    pub struct Any {
        #[prost(string, tag = "1")]
        pub type_url: String,
        #[prost(bytes = "vec", tag = "2")]
        pub value: Vec<u8>,
    }

    impl Any {
        pub fn pack(type_url: &str, m: &impl Message) -> Self {
            Self {
                type_url: type_url.into(),
                value: m.encode_to_vec(),
            }
        }
    }

    #[derive(Clone, Copy, PartialEq, Message)]
    pub struct Height {
        #[prost(uint64, tag = "1")]
        pub revision_number: u64,
        #[prost(uint64, tag = "2")]
        pub revision_height: u64,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct WasmClientState {
        #[prost(bytes = "vec", tag = "1")]
        pub data: Vec<u8>,
        #[prost(bytes = "vec", tag = "2")]
        pub checksum: Vec<u8>,
        #[prost(message, optional, tag = "3")]
        pub latest_height: Option<Height>,
    }

    /// Same shape for `wasm.v1.ConsensusState` and `wasm.v1.ClientMessage`.
    #[derive(Clone, PartialEq, Message)]
    pub struct WasmData {
        #[prost(bytes = "vec", tag = "1")]
        pub data: Vec<u8>,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct MsgCreateClient {
        #[prost(message, optional, tag = "1")]
        pub client_state: Option<Any>,
        #[prost(message, optional, tag = "2")]
        pub consensus_state: Option<Any>,
        #[prost(string, tag = "3")]
        pub signer: String,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct MsgUpdateClient {
        #[prost(string, tag = "1")]
        pub client_id: String,
        #[prost(message, optional, tag = "2")]
        pub client_message: Option<Any>,
        #[prost(string, tag = "3")]
        pub signer: String,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct Payload {
        #[prost(string, tag = "1")]
        pub source_port: String,
        #[prost(string, tag = "2")]
        pub destination_port: String,
        #[prost(string, tag = "3")]
        pub version: String,
        #[prost(string, tag = "4")]
        pub encoding: String,
        #[prost(bytes = "vec", tag = "5")]
        pub value: Vec<u8>,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct Packet {
        #[prost(uint64, tag = "1")]
        pub sequence: u64,
        #[prost(string, tag = "2")]
        pub source_client: String,
        #[prost(string, tag = "3")]
        pub destination_client: String,
        #[prost(uint64, tag = "4")]
        pub timeout_timestamp: u64,
        #[prost(message, repeated, tag = "5")]
        pub payloads: Vec<Payload>,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct MsgRecvPacket {
        #[prost(message, optional, tag = "1")]
        pub packet: Option<Packet>,
        #[prost(bytes = "vec", tag = "2")]
        pub proof_commitment: Vec<u8>,
        #[prost(message, optional, tag = "3")]
        pub proof_height: Option<Height>,
        #[prost(string, tag = "4")]
        pub signer: String,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct Acknowledgement {
        #[prost(bytes = "vec", repeated, tag = "1")]
        pub app_acknowledgements: Vec<Vec<u8>>,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct MsgAcknowledgement {
        #[prost(message, optional, tag = "1")]
        pub packet: Option<Packet>,
        #[prost(message, optional, tag = "2")]
        pub acknowledgement: Option<Acknowledgement>,
        #[prost(bytes = "vec", tag = "3")]
        pub proof_acked: Vec<u8>,
        #[prost(message, optional, tag = "4")]
        pub proof_height: Option<Height>,
        #[prost(string, tag = "5")]
        pub signer: String,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct TxBody {
        #[prost(message, repeated, tag = "1")]
        pub messages: Vec<Any>,
    }
}

struct Bankd {
    provider: DynProvider,
    router: Address,
    epoch_length: u64,
    signer: String,
}

impl Bankd {
    async fn from_env() -> eyre::Result<Self> {
        let var = |k: &str| std::env::var(k).wrap_err(k.to_string());
        Ok(Self {
            provider: ProviderBuilder::new()
                .connect(&var("BANKD_RPC")?)
                .await?
                .erased(),
            router: var("BANKD_ROUTER")?.parse()?,
            epoch_length: var("BANKD_EPOCH_LENGTH")?.parse()?,
            signer: var("GAIA_SIGNER")?,
        })
    }

    async fn finalization(&self, height: u64) -> eyre::Result<Header> {
        let fin: CertifiedBlock = self
            .provider
            .raw_request(
                "consensus_getFinalization".into(),
                (serde_json::json!({ "height": height }),),
            )
            .await
            .wrap_err_with(|| format!("consensus_getFinalization {height}"))?;
        let rlp = Bytes::from(alloy_rlp::encode(&fin.block.header));
        let certificate = Bytes::from(alloy::primitives::hex::decode(&fin.certificate)?);
        eyre::ensure!(
            keccak256(&rlp).0 == certificate_payload(&certificate)?,
            "header hash != certified digest"
        );
        Ok(Header {
            header_rlp: rlp,
            certificate,
        })
    }

    async fn finalized_height(&self) -> eyre::Result<u64> {
        let b: serde_json::Value = self
            .provider
            .raw_request("eth_getBlockByNumber".into(), ("finalized", false))
            .await?;
        hex_u64(&b["number"])
    }

    /// Compressed group key of `epoch`: genesis extra_data for epoch 0, else the previous epoch's
    /// boundary header. Parsed with the light client's own decoder.
    async fn group_key(&self, epoch: u64) -> eyre::Result<EpochKey> {
        let src = if epoch == 0 {
            0
        } else {
            epoch * self.epoch_length - 1
        };
        let b = self
            .provider
            .get_block_by_number(BlockNumberOrTag::Number(src))
            .await?
            .ok_or_else(|| eyre!("no block {src}"))?;
        let (outcome_epoch, key) = dkg_outcome_identity(&b.header.extra_data)
            .map_err(|e| eyre!("dkg outcome at {src}: {e}"))?;
        eyre::ensure!(
            outcome_epoch == epoch,
            "outcome epoch {outcome_epoch} != {epoch}"
        );
        Ok(EpochKey {
            epoch,
            key: key.into(),
        })
    }

    /// Proofs of `paths` in the router at the tip. reth only serves proofs at the tip by default,
    /// so snapshot first and let the caller wait for finality.
    async fn tip_proofs(&self, paths: &[Vec<u8>]) -> eyre::Result<(u64, Vec<MembershipProof>)> {
        let slots: Vec<B256> = paths
            .iter()
            .map(|p| keccak256((keccak256(p), IBCSTORE_SLOT).abi_encode()))
            .collect();
        loop {
            let tip = self.provider.get_block_number().await?;
            let Ok(p) = self
                .provider
                .get_proof(self.router, slots.clone())
                .number(tip)
                .await
            else {
                // Tip moved between the two calls, try again.
                tokio::time::sleep(POLL).await;
                continue;
            };
            let account = account_from_proof(&p.account_proof)
                .ok_or_else(|| eyre!("account proof has no leaf"))?;
            let proofs = p
                .storage_proof
                .iter()
                .map(|s| {
                    eyre::ensure!(!s.value.is_zero(), "commitment missing at {tip}");
                    Ok(MembershipProof {
                        account: account.clone(),
                        account_proof: p.account_proof.clone(),
                        storage_proof: s.proof.clone(),
                    })
                })
                .collect::<eyre::Result<_>>()?;
            return Ok((tip, proofs));
        }
    }
}

fn certificate_payload(cert: &[u8]) -> eyre::Result<[u8; 32]> {
    cw_commonware::cert::Finalization::decode(cert)
        .map(|f| f.payload)
        .map_err(|e| eyre!("certificate: {e}"))
}

fn height(h: u64) -> Option<proto::Height> {
    Some(proto::Height {
        revision_number: 0,
        revision_height: h,
    })
}

fn print_body(messages: Vec<proto::Any>) {
    use base64::Engine as _;
    let body = proto::TxBody { messages }.encode_to_vec();
    println!("{}", base64::engine::general_purpose::STANDARD.encode(body));
}

pub async fn create_client() -> eyre::Result<()> {
    let bankd = Bankd::from_env().await?;
    let checksum =
        alloy::primitives::hex::decode(std::env::var("WASM_CHECKSUM").wrap_err("WASM_CHECKSUM")?)?;
    let h = bankd.finalized_height().await?;
    let fin = bankd.finalization(h).await?;
    let header =
        cw_commonware::header::TempoHeader::decode(&fin.header_rlp).map_err(|e| eyre!("{e}"))?;
    let cs = ClientState {
        router: bankd.router,
        namespace: NAMESPACE.into(),
        epoch_length: bankd.epoch_length,
        latest_height: h,
        frozen: false,
        keys: vec![bankd.group_key(h / bankd.epoch_length).await?],
    };
    let consensus = ConsensusState {
        timestamp: header.timestamp,
        state_root: header.state_root.into(),
    };
    let msg = proto::MsgCreateClient {
        client_state: Some(proto::Any::pack(
            "/ibc.lightclients.wasm.v1.ClientState",
            &proto::WasmClientState {
                data: serde_json::to_vec(&cs)?,
                checksum,
                latest_height: height(h),
            },
        )),
        consensus_state: Some(proto::Any::pack(
            "/ibc.lightclients.wasm.v1.ConsensusState",
            &proto::WasmData {
                data: serde_json::to_vec(&consensus)?,
            },
        )),
        signer: bankd.signer.clone(),
    };
    eprintln!(
        "gaia-create-client: trusting bankd height {h}, epoch {}",
        h / bankd.epoch_length
    );
    print_body(vec![proto::Any::pack(
        "/ibc.core.client.v1.MsgCreateClient",
        &msg,
    )]);
    Ok(())
}

fn to_proto(p: abi::Packet) -> proto::Packet {
    proto::Packet {
        sequence: p.sequence,
        source_client: p.sourceClient,
        destination_client: p.destClient,
        timeout_timestamp: p.timeoutTimestamp,
        payloads: p
            .payloads
            .into_iter()
            .map(|p| proto::Payload {
                source_port: p.sourcePort,
                destination_port: p.destPort,
                version: p.version,
                encoding: p.encoding,
                value: p.value.to_vec(),
            })
            .collect(),
    }
}

/// A packet event from the bankd tx and what gaia needs for it.
enum Relay {
    Recv(abi::Packet),
    Ack(abi::Packet, Vec<Bytes>),
}

pub async fn relay(tx: &str) -> eyre::Result<()> {
    let bankd = Bankd::from_env().await?;
    let client_id = std::env::var("GAIA_CLIENT_ID").wrap_err("GAIA_CLIENT_ID")?;
    let client_height: u64 = std::env::var("GAIA_CLIENT_HEIGHT")
        .wrap_err("GAIA_CLIENT_HEIGHT")?
        .parse()?;

    let receipt = bankd
        .provider
        .get_transaction_receipt(tx.parse()?)
        .await?
        .ok_or_else(|| eyre!("no receipt for {tx}"))?;
    let mut work = Vec::new();
    for log in receipt
        .inner
        .logs()
        .iter()
        .filter(|l| l.address() == bankd.router)
    {
        match log.topic0() {
            Some(&abi::ICS26Router::SendPacket::SIGNATURE_HASH) => {
                work.push(Relay::Recv(
                    abi::ICS26Router::SendPacket::decode_log_data(log.data())?.packet,
                ));
            }
            Some(&abi::ICS26Router::WriteAcknowledgement::SIGNATURE_HASH) => {
                let ev = abi::ICS26Router::WriteAcknowledgement::decode_log_data(log.data())?;
                work.push(Relay::Ack(ev.packet, ev.acknowledgements));
            }
            _ => {}
        }
    }
    eyre::ensure!(
        !work.is_empty(),
        "no SendPacket or WriteAcknowledgement in {tx}"
    );

    let paths: Vec<Vec<u8>> = work
        .iter()
        .map(|w| match w {
            Relay::Recv(p) => commitment_path(&p.sourceClient, 1, p.sequence),
            Relay::Ack(p, _) => commitment_path(&p.destClient, 3, p.sequence),
        })
        .collect();
    let (proof_height, proofs) = bankd.tip_proofs(&paths).await?;
    while bankd.finalized_height().await? < proof_height {
        tokio::time::sleep(POLL).await;
    }

    // Boundary headers between the client's height and the proof height first, so the client
    // learns each next committee, then the proof height itself.
    let len = bankd.epoch_length;
    let mut heights: Vec<u64> = (client_height / len..proof_height / len)
        .map(|e| (e + 1) * len - 1)
        .collect();
    heights.push(proof_height);
    let mut messages = Vec::new();
    for h in heights.into_iter().filter(|h| *h > client_height) {
        let header = bankd.finalization(h).await?;
        messages.push(proto::Any::pack(
            "/ibc.core.client.v1.MsgUpdateClient",
            &proto::MsgUpdateClient {
                client_id: client_id.clone(),
                client_message: Some(proto::Any::pack(
                    "/ibc.lightclients.wasm.v1.ClientMessage",
                    &proto::WasmData {
                        data: serde_json::to_vec(&header)?,
                    },
                )),
                signer: bankd.signer.clone(),
            },
        ));
        eprintln!("gaia-relay: update {client_id} to bankd height {h}");
    }

    for (w, proof) in work.into_iter().zip(proofs) {
        let proof = serde_json::to_vec(&proof)?;
        match w {
            Relay::Recv(p) => {
                eprintln!(
                    "gaia-relay: recv seq={} proofHeight={proof_height}",
                    p.sequence
                );
                messages.push(proto::Any::pack(
                    "/ibc.core.channel.v2.MsgRecvPacket",
                    &proto::MsgRecvPacket {
                        packet: Some(to_proto(p)),
                        proof_commitment: proof,
                        proof_height: height(proof_height),
                        signer: bankd.signer.clone(),
                    },
                ));
            }
            Relay::Ack(p, acks) => {
                eprintln!(
                    "gaia-relay: ack seq={} proofHeight={proof_height}",
                    p.sequence
                );
                messages.push(proto::Any::pack(
                    "/ibc.core.channel.v2.MsgAcknowledgement",
                    &proto::MsgAcknowledgement {
                        packet: Some(to_proto(p)),
                        acknowledgement: Some(proto::Acknowledgement {
                            app_acknowledgements: acks.into_iter().map(|a| a.to_vec()).collect(),
                        }),
                        proof_acked: proof,
                        proof_height: height(proof_height),
                        signer: bankd.signer.clone(),
                    },
                ));
            }
        }
    }
    print_body(messages);
    Ok(())
}
