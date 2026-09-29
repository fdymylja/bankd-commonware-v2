// SPDX-License-Identifier: MIT OR Apache-2.0
//! gaia -> bankd, against `TendermintLightClient` (verified natively by the TendermintVerifier
//! precompile, no proofs from a third party).
//!
//!   bankd-relayer tm-update-msg [target height]   ABI-encoded MsgUpdateClient for
//!                                                 router.updateClient(clientId, msg)
//!   bankd-relayer tm-proof <0x key hex> [height]  prints `<proofHeight> <0x MerkleProof>`
//!
//! Env: GAIA_RPC (CometBFT rpc, http), BANKD_HTTP (bankd rpc, http) and TM_LC (light client address)
//! for tm-update-msg.
//!
//! The trusted height is the light client's latest height. The header at target height is
//! checked against the trusted state, whose next validator set is the validators at trusted+1.

use alloy::{
    primitives::{Address, Bytes},
    providers::ProviderBuilder,
    sol,
    sol_types::SolValue,
};
use eyre::{Context as _, eyre};
use ibc_proto::{
    ibc::{
        core::{client::v1::Height, commitment::v1::MerkleProof},
        lightclients::tendermint::v1::Header,
    },
    ics23::CommitmentProof,
};
use prost::Message;
use serde_json::{Value, json};
use tendermint::{block::signed_header::SignedHeader, validator};

sol! {
    #[sol(rpc)]
    contract TendermintLightClient {
        function clientState() external view returns (
            string chainId, uint8 trustNumerator, uint8 trustDenominator, uint64 revisionNumber,
            uint64 revisionHeight, uint32 trustingPeriod, uint32 unbondingPeriod, bool isFrozen, uint8 zkAlgorithm
        );
    }

    struct MsgUpdateClient { bytes header; uint64 trustedHeight; }
}

struct Rpc {
    url: String,
    http: reqwest::Client,
}

impl Rpc {
    fn from_env() -> eyre::Result<Self> {
        Ok(Self {
            url: std::env::var("GAIA_RPC").wrap_err("GAIA_RPC")?,
            http: reqwest::Client::new(),
        })
    }

    async fn call(&self, method: &str, params: Value) -> eyre::Result<Value> {
        let res: Value = self
            .http
            .post(&self.url)
            .json(&json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}))
            .send()
            .await?
            .json()
            .await?;
        if let Some(e) = res.get("error") {
            return Err(eyre!("{method}: {e}"));
        }
        Ok(res["result"].clone())
    }

    async fn latest_height(&self) -> eyre::Result<u64> {
        let s = self.call("status", json!({})).await?;
        Ok(s["sync_info"]["latest_block_height"]
            .as_str()
            .ok_or_else(|| eyre!("no latest_block_height"))?
            .parse()?)
    }

    async fn signed_header(&self, height: u64) -> eyre::Result<SignedHeader> {
        let r = self
            .call("commit", json!({"height": height.to_string()}))
            .await?;
        serde_json::from_value(r["signed_header"].clone()).wrap_err("decode signed_header")
    }

    /// All validators at `height`, paginated. The rpc caps per_page at 100.
    async fn validators(&self, height: u64) -> eyre::Result<Vec<validator::Info>> {
        let mut out: Vec<validator::Info> = Vec::new();
        for page in 1.. {
            let r = self
                .call(
                    "validators",
                    json!({"height": height.to_string(), "page": page.to_string(), "per_page": "100"}),
                )
                .await?;
            let total: usize = r["total"].as_str().unwrap_or("0").parse()?;
            let got: Vec<validator::Info> =
                serde_json::from_value(r["validators"].clone()).wrap_err("decode validators")?;
            let empty = got.is_empty();
            out.extend(got);
            if out.len() >= total || empty {
                break;
            }
        }
        Ok(out)
    }

    async fn validator_set(
        &self,
        height: u64,
        proposer: Option<tendermint::account::Id>,
    ) -> eyre::Result<tendermint_proto::types::ValidatorSet> {
        let vals = self.validators(height).await?;
        let proposer = proposer.and_then(|id| vals.iter().find(|v| v.address == id).cloned());
        Ok(validator::Set::new(vals, proposer).into())
    }
}

fn revision_number(chain_id: &str) -> u64 {
    // ibc revision: the number after the last dash, 0 if none.
    chain_id
        .rsplit_once('-')
        .and_then(|(_, n)| n.parse().ok())
        .unwrap_or(0)
}

/// Builds the protobuf `ibc.lightclients.tendermint.v1.Header` for `target`, trusting `trusted`.
async fn build_header(rpc: &Rpc, trusted: u64, target: u64) -> eyre::Result<Vec<u8>> {
    eyre::ensure!(
        target > trusted,
        "target {target} must be above trusted {trusted}"
    );
    let sh = rpc.signed_header(target).await?;
    let revision = revision_number(sh.header.chain_id.as_str());
    let proposer = sh.header.proposer_address;
    let header = Header {
        signed_header: Some(sh.into()),
        validator_set: Some(rpc.validator_set(target, Some(proposer)).await?),
        trusted_height: Some(Height {
            revision_number: revision,
            revision_height: trusted,
        }),
        trusted_validators: Some(rpc.validator_set(trusted + 1, None).await?),
    };
    Ok(header.encode_to_vec())
}

/// `tm-update-msg`: prints the ABI-encoded MsgUpdateClient hex.
pub async fn update_msg(target: Option<u64>) -> eyre::Result<()> {
    let rpc = Rpc::from_env()?;
    let lc: Address = std::env::var("TM_LC").wrap_err("TM_LC")?.parse()?;
    let provider = ProviderBuilder::new().connect_http(
        std::env::var("BANKD_HTTP")
            .wrap_err("BANKD_HTTP")?
            .parse()?,
    );
    let cs = TendermintLightClient::new(lc, provider)
        .clientState()
        .call()
        .await?;
    eyre::ensure!(!cs.isFrozen, "light client is frozen");

    let trusted = cs.revisionHeight;
    // The header at H is only verifiable once H+1 exists for proofs, but for updates H is enough.
    let target = match target {
        Some(t) => t,
        None => rpc.latest_height().await?,
    };
    let header = build_header(&rpc, trusted, target).await?;
    eprintln!(
        "tm-update-msg: trusted={trusted} target={target} header={} bytes",
        header.len()
    );
    let msg = MsgUpdateClient {
        header: Bytes::from(header),
        trustedHeight: trusted,
    };
    println!("0x{}", alloy::hex::encode(msg.abi_encode()));
    Ok(())
}

/// `tm-proof`: ABCI query with proof for a key in the `ibc` store. The proof at query height
/// H verifies against header H+1's app hash, so the client must be updated to H+1.
pub async fn proof(key_hex: &str, height: Option<u64>) -> eyre::Result<()> {
    let rpc = Rpc::from_env()?;
    // Height H needs H+1 to exist, so default to one below the tip.
    let h = match height {
        Some(h) => h,
        None => rpc.latest_height().await?.saturating_sub(1),
    };
    let key = key_hex.trim_start_matches("0x");
    let r = rpc
        .call(
            "abci_query",
            json!({"path": "/store/ibc/key", "data": key, "height": h.to_string(), "prove": true}),
        )
        .await?;
    // CometBFT versions differ on the field name.
    let resp = &r["response"];
    let ops = resp["proofOps"]["ops"]
        .as_array()
        .or_else(|| resp["proof_ops"]["ops"].as_array())
        .ok_or_else(|| eyre!("no proof_ops, key missing or node prunes proofs: {r}"))?;
    use base64::Engine as _;
    let proofs = ops
        .iter()
        .map(|op| {
            let data = base64::engine::general_purpose::STANDARD.decode(
                op["data"]
                    .as_str()
                    .ok_or_else(|| eyre!("op without data"))?,
            )?;
            Ok(CommitmentProof::decode(data.as_slice())?)
        })
        .collect::<eyre::Result<Vec<_>>>()?;
    let proof = MerkleProof { proofs };
    println!("{} 0x{}", h + 1, alloy::hex::encode(proof.encode_to_vec()));
    Ok(())
}

/// `tm-header`: prints the header hex plus the trusted consensus state as json, for checking a
/// header offline against the verifier crate.
pub async fn header_json(trusted: u64, target: u64) -> eyre::Result<()> {
    let rpc = Rpc::from_env()?;
    let header = build_header(&rpc, trusted, target).await?;
    let t = rpc.signed_header(trusted).await?.header;
    println!(
        "{}",
        json!({
            "chain_id": t.chain_id.as_str(),
            "header": format!("0x{}", alloy::hex::encode(header)),
            "trusted_timestamp_ns": t.time.unix_timestamp_nanos().to_string(),
            "trusted_root": format!("0x{}", alloy::hex::encode(t.app_hash.as_bytes())),
            "trusted_next_validators_hash": format!("0x{}", alloy::hex::encode(t.next_validators_hash.as_bytes())),
        })
    );
    Ok(())
}
