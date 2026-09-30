//! Local selective disclosure; callers own custody, storage and committed-node queries.
use anyhow::{ensure, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use shieldd_disclosure as sdk;
use shieldd_keys::FullViewingKey;
use shieldd_proto::{core::app::v1::MAX_TRANSACTION_BYTES, DomainType};
use shieldd_transaction::Transaction;
use wasm_bindgen::prelude::*;

use crate::error::WasmResult;

fn bounded_json<T: serde::de::DeserializeOwned>(input: &str, limit: usize) -> Result<T> {
    ensure!(input.len() <= limit, "disclosure input exceeds size limit");
    Ok(serde_json::from_str(input)?)
}

fn transactions(input: &str) -> Result<Vec<Transaction>> {
    let encoded: Vec<String> = bounded_json(
        input,
        sdk::MAX_OUTPUTS * (MAX_TRANSACTION_BYTES * 4 / 3 + 8),
    )?;
    ensure!(
        encoded.len() <= sdk::MAX_OUTPUTS,
        "too many selected transactions"
    );
    encoded
        .into_iter()
        .map(|value| {
            let bytes = STANDARD.decode(value)?;
            ensure!(
                bytes.len() <= MAX_TRANSACTION_BYTES,
                "transaction exceeds size limit"
            );
            Transaction::decode_canonical(&bytes)
        })
        .collect()
}

/// Returns private witness JSON. Keep it local; it is not a shareable disclosure.
#[wasm_bindgen]
pub fn disclosure_prepare(
    request: &str,
    committed_transactions: &str,
    full_viewing_key: &[u8],
) -> WasmResult<String> {
    let result = (|| -> Result<String> {
        let request: sdk::DisclosureRequest = bounded_json(request, sdk::MAX_DOCUMENT_BYTES)?;
        sdk::validate_request(&request)?;
        ensure!(
            request.outputs.iter().all(|claim| !claim.spending_control),
            "spending-control disclosure requires custody signatures"
        );
        let transactions = transactions(committed_transactions)?;
        let fvk = FullViewingKey::decode(full_viewing_key)?;
        Ok(serde_json::to_string(&sdk::prepare(
            request,
            &transactions,
            &fvk,
        )?)?)
    })();
    Ok(result?)
}

#[wasm_bindgen]
pub fn disclosure_export(witness: &str, method: &str) -> WasmResult<String> {
    let result = (|| -> Result<String> {
        let witness = sdk::decode_witness(witness.as_bytes())?;
        let package = match method {
            "openings" => sdk::export_openings(&witness)?,
            "payload-keys" => sdk::export_payload_keys(&witness)?,
            _ => anyhow::bail!("browser disclosure supports openings or payload-keys"),
        };
        Ok(serde_json::to_string(&package)?)
    })();
    Ok(result?)
}

#[wasm_bindgen]
pub fn disclosure_inspect(package: &str) -> WasmResult<String> {
    let result = (|| -> Result<String> {
        Ok(serde_json::to_string(&sdk::inspect(
            &sdk::decode_package(package.as_bytes())?,
        )?)?)
    })();
    Ok(result?)
}

/// Cryptographic validity only. Acceptance remains NotChecked until independently confirmed.
#[wasm_bindgen]
pub fn disclosure_verify(package: &str) -> WasmResult<String> {
    let result = (|| -> Result<String> {
        Ok(serde_json::to_string(&sdk::verify(&sdk::decode_package(
            package.as_bytes(),
        )?)?)?)
    })();
    Ok(result?)
}

/// Heights and transaction bytes must come from the verifier's chosen node, independently of the package.
#[wasm_bindgen]
pub fn disclosure_confirm_acceptance(
    package: &str,
    chain_id: &str,
    committed_blocks: &str,
) -> WasmResult<String> {
    #[derive(serde::Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Block {
        height: u64,
        transactions: Vec<String>,
    }
    let result = (|| -> Result<String> {
        let package = sdk::decode_package(package.as_bytes())?;
        let encoded: Vec<Block> = bounded_json(
            committed_blocks,
            sdk::MAX_OUTPUTS * (MAX_TRANSACTION_BYTES * 4 / 3 + 128),
        )?;
        ensure!(
            encoded.len() <= sdk::MAX_OUTPUTS,
            "too many accepted blocks"
        );
        ensure!(
            encoded.iter().map(|b| b.transactions.len()).sum::<usize>() <= sdk::MAX_OUTPUTS,
            "too many accepted transactions"
        );
        let blocks = encoded
            .into_iter()
            .map(|block| {
                Ok(sdk::AcceptedBlock {
                    height: block.height,
                    transactions: transactions(&serde_json::to_string(&block.transactions)?)?,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        let mut result = sdk::verify(&package)?;
        result.acceptance = sdk::confirm_acceptance(&package.statement, chain_id, &blocks)?;
        Ok(serde_json::to_string(&result)?)
    })();
    Ok(result?)
}
