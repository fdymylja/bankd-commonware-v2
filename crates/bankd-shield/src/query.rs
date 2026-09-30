//! Bounded browser-wallet queries over one finalized Shieldd snapshot.

use anyhow::{Result, ensure};
use cnidarium::{Snapshot, StateRead as _};
use futures::TryStreamExt as _;
use prost::Message;
use shieldd_sdk_app::app::StateReadExt as _;
use shieldd_sdk_compact_block::component::StateReadExt as _;
use shieldd_sdk_proto::{
    cnidarium::v1 as kv,
    core::{
        app::v1 as app,
        component::{
            compact_block::v1 as cb, compliance::v1 as compliance, sct::v1 as sct,
            shielded_pool::v1 as pool,
        },
    },
};
use shieldd_sdk_sct::component::clock::EpochRead as _;

pub(crate) async fn query(state: Snapshot, method: &str, request: &[u8]) -> Result<Vec<Vec<u8>>> {
    ensure!(
        request.len() <= 1_048_576,
        "Shieldd query request exceeds 1 MiB"
    );
    let responses = match method {
        "AppParameters" => {
            app::AppParametersRequest::decode(request)?;
            vec![
                app::AppParametersResponse {
                    app_parameters: Some(state.get_app_params().await?.into()),
                }
                .encode_to_vec(),
            ]
        }
        "AssetMetadataById" => vec![
            shieldd_sdk_shielded_pool::component::query::asset_metadata_by_id(
                &state,
                pool::AssetMetadataByIdRequest::decode(request)?,
            )
            .await?
            .encode_to_vec(),
        ],
        "ComplianceAssetStatus" => vec![
            shieldd_sdk_compliance::component::query::compliance_asset_status(
                &state,
                compliance::ComplianceAssetStatusRequest::decode(request)?,
            )
            .await?
            .encode_to_vec(),
        ],
        "ComplianceBatchMerkleProofs" => vec![
            shieldd_sdk_compliance::component::query::compliance_batch_merkle_proofs(
                &state,
                compliance::ComplianceBatchMerkleProofsRequest::decode(request)?,
            )
            .await?
            .encode_to_vec(),
        ],
        "ComplianceUserLeaf" => vec![
            shieldd_sdk_compliance::component::query::compliance_user_leaf(
                &state,
                compliance::ComplianceUserLeafRequest::decode(request)?,
            )
            .await?
            .encode_to_vec(),
        ],
        "NullifierWindow" => {
            sct::NullifierWindowRequest::decode(request)?;
            let generation = shieldd_sdk_sct::nullifier_tree::generation_state(&state).await?;
            vec![
                sct::NullifierWindowResponse {
                    window: Some(generation.window().into()),
                }
                .encode_to_vec(),
            ]
        }
        "KeyValue" => {
            let req = kv::KeyValueRequest::decode(request)?;
            ensure!(
                !req.key.is_empty() && req.key.len() <= 4096,
                "invalid Shieldd state key"
            );
            let (value, proof) = if req.proof {
                let (value, proof) = state.get_with_proof(req.key.into_bytes()).await?;
                let proofs = proof
                    .proofs
                    .into_iter()
                    .map(|p| Message::decode(p.encode_to_vec().as_slice()))
                    .collect::<Result<Vec<_>, _>>()?;
                (
                    value,
                    Some(ibc_proto::ibc::core::commitment::v1::MerkleProof { proofs }),
                )
            } else {
                (state.get_raw(&req.key).await?, None)
            };
            vec![
                kv::KeyValueResponse {
                    value: value.map(|value| kv::key_value_response::Value { value }),
                    proof,
                }
                .encode_to_vec(),
            ]
        }
        "CommittedTransaction" => {
            let req = app::CommittedTransactionRequest::decode(request)?;
            let id = req
                .transaction_id
                .try_into()
                .map_err(|_| anyhow::anyhow!("transaction ID must be 32 bytes"))?;
            vec![
                state
                    .committed_transaction(req.block_height, id)
                    .await?
                    .encode_to_vec(),
            ]
        }
        "CompactBlockRange" => {
            let req = cb::CompactBlockRangeRequest::decode(request)?;
            ensure!(!req.keep_alive, "Shieldd query ranges must be bounded");
            let height = state.get_block_height().await?;
            let end = if req.end_height == 0 {
                height
            } else {
                req.end_height.min(height)
            };
            let count = end
                .checked_sub(req.start_height)
                .map_or(0, |n| n.saturating_add(1));
            ensure!(count <= 10_001, "Shieldd query range exceeds 10001 blocks");
            let mut blocks = state.stream_compact_block(req.start_height);
            let mut next = req.start_height;
            let mut responses = Vec::new();
            let mut response_bytes = 0usize;
            while let Some(block) = blocks.try_next().await? {
                if block.height > end {
                    break;
                }
                ensure!(
                    block.height == next,
                    "gap in finalized compact blocks at {next}"
                );
                next += 1;
                let response = cb::CompactBlockRangeResponse {
                    compact_block: Some(block),
                }
                .encode_to_vec();
                response_bytes += response.len();
                ensure!(
                    response_bytes <= 32 * 1_048_576,
                    "Shieldd query response exceeds 32 MiB"
                );
                responses.push(response);
            }
            ensure!(
                responses.len() as u64 == count,
                "missing finalized compact blocks"
            );
            responses
        }
        _ => anyhow::bail!("unsupported Shieldd query method: {method}"),
    };
    ensure!(
        responses.iter().map(Vec::len).sum::<usize>() <= 32 * 1_048_576,
        "Shieldd query response exceeds 32 MiB"
    );
    Ok(responses)
}
