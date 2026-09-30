//! Sealed audit envelopes; plaintext openings never leave WASM.
use crate::error::WasmResult;
use anyhow::{ensure, Result};
use shieldd_proto::DomainType;
use shieldd_transaction::{Transaction, TransactionPlan};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn prepare_orbis_packages(
    plan: &[u8],
    transaction: &[u8],
    delivery: &str,
) -> WasmResult<String> {
    let result = (|| -> Result<String> {
        ensure!(
            plan.len() <= shieldd_disclosure::MAX_WITNESS_BYTES,
            "plan exceeds size limit"
        );
        ensure!(
            transaction.len() <= shieldd_proto::core::app::v1::MAX_TRANSACTION_BYTES,
            "transaction exceeds size limit"
        );
        ensure!(
            delivery.len() <= 4096,
            "delivery configuration exceeds size limit"
        );
        let plan = TransactionPlan::decode(plan)?;
        let transaction = Transaction::decode_canonical(transaction)?;
        let delivery = serde_json::from_str(delivery)?;
        Ok(serde_json::to_string(
            &shieldd_disclosure::orbis::prepare_packages(&plan, &transaction, &delivery)?,
        )?)
    })();
    Ok(result?)
}
