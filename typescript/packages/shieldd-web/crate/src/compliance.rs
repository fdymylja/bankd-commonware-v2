#![allow(clippy::mutable_key_type, clippy::map_entry)]
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use decaf377::Fq;
use shieldd_asset::asset;
use shieldd_compliance::{
    AssetPolicy, AssetProofData, BatchComplianceData, ComplianceLeaf, IndexedLeaf, MerklePath,
    MerklePathLayer, UserProofData,
};
use shieldd_keys::Address;
use shieldd_proto::core::component::compliance::v1 as pb;
use shieldd_proto::Message;
use shieldd_tct::StateCommitment;
use std::collections::{BTreeMap, BTreeSet};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::JsFuture;

pub(crate) fn action_witness(
    batch: &BatchComplianceData,
    spends: &[shieldd_shielded_pool::ShieldedInputPlan],
) -> Result<shieldd_shielded_pool::ActionWitness> {
    let spend = spends
        .first()
        .ok_or_else(|| anyhow!("shielded action requires a spend"))?;
    let asset_id = spend.note.asset_id();
    let asset = batch
        .asset_proofs
        .get(&asset_id)
        .ok_or_else(|| anyhow!("missing asset proof"))?;
    Ok(shieldd_shielded_pool::ActionWitness {
        asset: shieldd_shielded_pool::AssetWitness {
            asset_id,
            root: batch.asset_anchor,
            leaf: asset.indexed_leaf.clone(),
            position: asset.position,
            path: asset.auth_path.clone(),
            is_regulated: asset.is_regulated,
        },
        policy: if asset.is_regulated {
            Some(
                batch
                    .asset_policies
                    .get(&asset_id)
                    .cloned()
                    .ok_or_else(|| anyhow!("missing regulated asset policy"))?,
            )
        } else {
            None
        },
        user_root: batch.compliance_anchor,
        sender: user_witness(batch, &spend.note.address(), asset_id)?,
    })
}

pub(crate) fn user_witness(
    batch: &BatchComplianceData,
    address: &Address,
    asset_id: asset::Id,
) -> Result<shieldd_shielded_pool::UserWitness> {
    let user = batch
        .user_proofs
        .get(&(address.clone(), asset_id))
        .ok_or_else(|| anyhow!("missing user witness"))?;
    Ok(shieldd_shielded_pool::UserWitness {
        leaf: user.leaf.clone(),
        position: user.position,
        path: user.auth_path.clone(),
    })
}
pub(crate) async fn fetch_batch_compliance_data(
    grpc_url: &str,
    spend_identities: &[(asset::Id, Address)],
    output_identities: &[(asset::Id, Address)],
) -> Result<Option<(BatchComplianceData, Address, asset::Id)>> {
    if spend_identities.is_empty() && output_identities.is_empty() {
        return Ok(None);
    }

    let sender_address = spend_identities
        .first()
        .map(|(_, address)| address.clone())
        .or_else(|| {
            output_identities
                .first()
                .map(|(_, address)| address.clone())
        })
        .expect("at least one spend or output identity must exist");
    let spend_binding_asset_id = spend_identities
        .first()
        .map(|(asset_id, _)| *asset_id)
        .or_else(|| output_identities.first().map(|(asset_id, _)| *asset_id))
        .expect("at least one spend or output identity must exist");

    let mut queries: BTreeSet<(Address, asset::Id)> = BTreeSet::new();
    for (asset_id, address) in spend_identities {
        queries.insert((address.clone(), *asset_id));
    }
    for (asset_id, address) in output_identities {
        queries.insert((address.clone(), *asset_id));
        queries.insert((sender_address.clone(), spend_binding_asset_id));
    }

    let query_vec = queries.into_iter().collect::<Vec<_>>();
    let batch_response = fetch_batch_response(grpc_url, &query_vec).await?;
    let batch_data = parse_batch_response(grpc_url, query_vec.clone(), batch_response).await?;
    Ok(Some((batch_data, sender_address, spend_binding_asset_id)))
}

async fn fetch_batch_response(
    grpc_url: &str,
    queries: &[(Address, asset::Id)],
) -> Result<pb::ComplianceBatchMerkleProofsResponse> {
    let request = pb::ComplianceBatchMerkleProofsRequest {
        queries: queries
            .iter()
            .map(|(address, asset_id)| pb::ComplianceBatchQuery {
                address: Some(address.clone().into()),
                asset_id: Some((*asset_id).into()),
            })
            .collect(),
    };
    let response = grpc_web_unary(
        grpc_url,
        "/shieldd.core.component.compliance.v1.QueryService/ComplianceBatchMerkleProofs",
        request.encode_to_vec(),
    )
    .await?;
    Ok(pb::ComplianceBatchMerkleProofsResponse::decode(
        response.as_slice(),
    )?)
}

async fn fetch_asset_policy(grpc_url: &str, asset_id: asset::Id) -> Result<Option<AssetPolicy>> {
    let request = pb::ComplianceAssetStatusRequest {
        asset_id: Some(asset_id.into()),
    };
    let response = grpc_web_unary(
        grpc_url,
        "/shieldd.core.component.compliance.v1.QueryService/ComplianceAssetStatus",
        request.encode_to_vec(),
    )
    .await?;
    let status = pb::ComplianceAssetStatusResponse::decode(response.as_slice())?;
    status.asset_policy.map(AssetPolicy::try_from).transpose()
}

async fn parse_batch_response(
    grpc_url: &str,
    queries: Vec<(Address, asset::Id)>,
    response: pb::ComplianceBatchMerkleProofsResponse,
) -> Result<BatchComplianceData> {
    let compliance_anchor =
        parse_state_commitment(&response.compliance_anchor, "compliance_anchor")?;
    let asset_anchor = parse_state_commitment(&response.asset_anchor, "asset_anchor")?;

    if response.results.len() != queries.len() {
        return Err(anyhow!(
            "batch compliance response result count {} does not match query count {}",
            response.results.len(),
            queries.len()
        ));
    }

    let mut asset_proofs = BTreeMap::new();
    let mut asset_policies = BTreeMap::new();
    let mut user_proofs = BTreeMap::new();

    for (result, (address, asset_id)) in response.results.into_iter().zip(queries.into_iter()) {
        let compliance_path = parse_merkle_path(result.compliance_path);
        let asset_path = parse_merkle_path(result.asset_path);

        if !asset_proofs.contains_key(&asset_id) {
            let indexed_leaf = result
                .asset_indexed_leaf
                .ok_or_else(|| anyhow!("asset_indexed_leaf missing for asset {}", asset_id))
                .and_then(IndexedLeaf::try_from)?;
            asset_proofs.insert(
                asset_id,
                AssetProofData {
                    auth_path: asset_path.clone(),
                    position: result.asset_position,
                    indexed_leaf,
                    is_regulated: result.is_regulated,
                },
            );
            if result.is_regulated {
                let policy = fetch_asset_policy(grpc_url, asset_id)
                    .await?
                    .ok_or_else(|| {
                        anyhow!("missing asset policy for regulated asset {}", asset_id)
                    })?;
                asset_policies.insert(asset_id, policy);
            }
        }

        let key = (address.clone(), asset_id);
        if !user_proofs.contains_key(&key) {
            if result.user_registered {
                let leaf = result
                    .compliance_leaf
                    .ok_or_else(|| anyhow!("compliance leaf missing for registered user"))?
                    .try_into()?;
                user_proofs.insert(
                    key,
                    UserProofData {
                        auth_path: compliance_path,
                        position: result.compliance_position,
                        leaf,
                    },
                );
            } else if !result.is_regulated {
                let leaf = ComplianceLeaf::synthetic_unregulated(address, asset_id);
                user_proofs.insert(
                    key,
                    UserProofData {
                        auth_path: MerklePath::default(),
                        position: 0,
                        leaf,
                    },
                );
            } else {
                return Err(anyhow!(
                    "user is not registered in compliance tree for asset {}",
                    asset_id
                ));
            }
        }
    }

    Ok(BatchComplianceData {
        compliance_anchor,
        asset_anchor,
        asset_proofs,
        asset_policies,
        user_proofs,
    })
}

async fn grpc_web_unary(grpc_url: &str, path: &str, request_bytes: Vec<u8>) -> Result<Vec<u8>> {
    let mut frame = Vec::with_capacity(5 + request_bytes.len());
    frame.push(0);
    let len = request_bytes.len() as u32;
    frame.extend_from_slice(&len.to_be_bytes());
    frame.extend_from_slice(&request_bytes);
    let body = BASE64_STANDARD.encode(frame);

    let headers = web_sys::Headers::new().map_err(js_error)?;
    headers
        .set("Content-Type", "application/grpc-web-text")
        .map_err(js_error)?;
    headers
        .set("Accept", "application/grpc-web-text")
        .map_err(js_error)?;

    let init = web_sys::RequestInit::new();
    init.set_method("POST");
    init.set_mode(web_sys::RequestMode::Cors);
    init.set_headers(&headers);
    init.set_body(&JsValue::from_str(&body));

    let window = web_sys::window().ok_or_else(|| anyhow!("window is unavailable"))?;
    let url = format!("{}{}", grpc_url.trim_end_matches('/'), path);
    let response_value = JsFuture::from(window.fetch_with_str_and_init(&url, &init))
        .await
        .map_err(js_error)?;
    let response: web_sys::Response = response_value
        .dyn_into()
        .map_err(|_| anyhow!("fetch did not return a Response"))?;
    if !response.ok() {
        let status = response.status();
        let text = response_text(response).await.unwrap_or_default();
        return Err(anyhow!(
            "compliance query failed with HTTP {}: {}",
            status,
            text
        ));
    }

    let text = response_text(response).await?;
    decode_grpc_web_text(&text)
}

async fn response_text(response: web_sys::Response) -> Result<String> {
    let text_value = JsFuture::from(response.text().map_err(js_error)?)
        .await
        .map_err(js_error)?;
    text_value
        .as_string()
        .ok_or_else(|| anyhow!("response text is not a string"))
}

fn decode_grpc_web_text(text: &str) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    for chunk in split_base64_frames(text.trim()) {
        if chunk.is_empty() {
            continue;
        }
        bytes.extend(BASE64_STANDARD.decode(chunk.as_bytes())?);
    }

    let mut offset = 0usize;
    while offset + 5 <= bytes.len() {
        let flags = bytes[offset];
        let len = u32::from_be_bytes([
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
            bytes[offset + 4],
        ]) as usize;
        offset += 5;
        if offset + len > bytes.len() {
            return Err(anyhow!("malformed grpc-web frame"));
        }
        let message = bytes[offset..offset + len].to_vec();
        if flags & 0x80 == 0 {
            return Ok(message);
        }
        offset += len;
    }

    Err(anyhow!("grpc-web response did not contain a message frame"))
}

fn split_base64_frames(text: &str) -> Vec<&str> {
    let bytes = text.as_bytes();
    let mut chunks = Vec::new();
    let mut start = 0usize;
    let mut i = 0usize;
    while i + 1 < bytes.len() {
        if bytes[i] == b'=' && bytes[i + 1].is_ascii_alphanumeric() {
            chunks.push(&text[start..=i]);
            start = i + 1;
        }
        i += 1;
    }
    chunks.push(&text[start..]);
    chunks
}

fn parse_state_commitment(bytes: &[u8], field: &str) -> Result<StateCommitment> {
    if bytes.len() != 32 {
        return Err(anyhow!("{} must be 32 bytes, got {}", field, bytes.len()));
    }
    let mut bytes_array = [0u8; 32];
    bytes_array.copy_from_slice(bytes);
    Ok(StateCommitment(
        Fq::from_bytes_checked(&bytes_array)
            .map_err(|e| anyhow!("invalid {} field element: {}", field, e))?,
    ))
}

fn parse_merkle_path(path: Option<pb::MerklePath>) -> MerklePath {
    match path {
        Some(path) => MerklePath {
            layers: path
                .layers
                .into_iter()
                .map(|layer| MerklePathLayer {
                    siblings: layer.siblings,
                })
                .collect(),
        },
        None => MerklePath { layers: vec![] },
    }
}

fn js_error(value: JsValue) -> anyhow::Error {
    if let Some(s) = value.as_string() {
        anyhow!(s)
    } else {
        anyhow!("JavaScript error: {:?}", value)
    }
}
