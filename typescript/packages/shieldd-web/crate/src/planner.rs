use anyhow::{anyhow, Context};
use decaf377::Fr;
use rand_core::OsRng;
use shieldd_asset::Value;
use shieldd_keys::keys::AddressIndex;
use shieldd_keys::{Address, FullViewingKey};
use shieldd_num::Amount;
use shieldd_proto::view::v1::TransactionPlannerRequest;
use shieldd_proto::{DomainType, Message};
use shieldd_shielded_pool::{
    HostWithdrawal, ShieldedHostWithdrawalPlan, ShieldedInputPlan, ShieldedOutputPlan,
    TransferPlan, PADDED_TRANSFER_INPUTS,
};
use shieldd_transaction::memo::MemoPlaintext;
use shieldd_transaction::{plan::MemoPlan, ActionPlan, TransactionParameters, TransactionPlan};
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

use crate::database::interface::Database;
use crate::error::WasmResult;
use crate::note_record::SpendableNoteRecord;
use crate::storage::{init_idb_storage, DbConstants, Storage};
use crate::utils;

const MAX_WITHDRAWAL_INPUTS: usize = 2;
struct PlanningContext<'a> {
    grpc_url: &'a str,
    routing: shieldd_shielded_pool::discovery::Parameters,
    timestamp: u64,
    fvk: &'a FullViewingKey,
}
async fn compliance_batch(
    context: &PlanningContext<'_>,
    spends: &[ShieldedInputPlan],
    outputs: &[ShieldedOutputPlan],
) -> anyhow::Result<shieldd_compliance::BatchComplianceData> {
    crate::compliance::fetch_batch_compliance_data(
        context.grpc_url,
        &spends
            .iter()
            .map(|s| (s.note.asset_id(), s.note.address()))
            .collect::<Vec<_>>(),
        &outputs
            .iter()
            .map(|o| (o.value.asset_id, o.dest_address.clone()))
            .collect::<Vec<_>>(),
    )
    .await?
    .map(|(batch, _, _)| batch)
    .ok_or_else(|| anyhow!("shielded action requires compliance witnesses"))
}

#[wasm_bindgen]
pub async fn plan_transaction(
    idb_constants: JsValue,
    request: &[u8],
    full_viewing_key: &[u8],
    _gas_fee_token: &[u8],
    grpc_url: String,
) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let tx_planner_req = TransactionPlannerRequest::decode(request)
        .context("transaction planner request is malformed")?;
    let full_viewing_key = FullViewingKey::decode(full_viewing_key)?;
    let constants: DbConstants = serde_wasm_bindgen::from_value(idb_constants)?;
    let storage = init_idb_storage(constants).await?;
    let nullifier_window = storage
        .get_nullifier_window()
        .await?
        .context("nullifier window is not synced")?;
    let recent_position_floor = nullifier_window.recent_position_floor;

    let plan = plan_transaction_inner(
        storage,
        tx_planner_req,
        full_viewing_key,
        grpc_url,
        nullifier_window,
        recent_position_floor,
    )
    .await?;
    Ok(plan.encode_to_vec())
}

pub async fn plan_transaction_inner<Db: Database>(
    storage: Storage<Db>,
    request: TransactionPlannerRequest,
    full_viewing_key: FullViewingKey,
    grpc_url: String,
    nullifier_window: shieldd_sct::nullifier_generation::NullifierWindow,
    recent_position_floor: u64,
) -> WasmResult<TransactionPlan> {
    if !request.host_withdrawals.is_empty() {
        if !request.outputs.is_empty() {
            return Err(anyhow!(
                "host withdrawals cannot be mixed with other transaction planner actions"
            )
            .into());
        }
        if request.host_withdrawals.len() != 1 {
            return Err(anyhow!(
                "browser planning supports exactly one host withdrawal per transaction"
            )
            .into());
        }
    }

    let source: AddressIndex = request
        .source
        .clone()
        .map(TryInto::try_into)
        .transpose()?
        .unwrap_or_default();

    let context = PlanningContext {
        grpc_url: &grpc_url,
        routing: storage
            .get_discovery_parameters()
            .await?
            .context("discovery parameters are not synced")?,
        timestamp: current_unix_timestamp(),
        fvk: &full_viewing_key,
    };
    let mut actions = Vec::new();

    if !request.outputs.is_empty() {
        let outputs = request
            .outputs
            .iter()
            .map(|output| {
                let value: Value = output
                    .value
                    .clone()
                    .ok_or_else(|| anyhow!("transfer output missing value"))?
                    .try_into()?;
                let address: Address = output
                    .address
                    .clone()
                    .ok_or_else(|| anyhow!("transfer output missing address"))?
                    .try_into()?;
                Ok((value, address))
            })
            .collect::<Result<Vec<_>, anyhow::Error>>()?;

        let action =
            plan_transfer(&storage, source, outputs, recent_position_floor, &context).await?;
        actions.push(ActionPlan::Transfer(action));
    }

    for withdrawal in request.host_withdrawals {
        let withdrawal: HostWithdrawal = withdrawal.try_into()?;
        let action = plan_host_withdrawal(
            &storage,
            source,
            withdrawal,
            recent_position_floor,
            &context,
        )
        .await?;
        actions.push(ActionPlan::ShieldedHostWithdrawal(action));
    }

    if actions.is_empty() {
        return Err(anyhow!("transaction planner request contains no supported actions").into());
    }

    let memo = request
        .memo
        .map(|memo| -> Result<MemoPlan, anyhow::Error> {
            let plaintext: MemoPlaintext = memo.try_into()?;
            Ok(MemoPlan::new(&mut OsRng, plaintext))
        })
        .transpose()?;

    let app_params = storage
        .get_app_params()
        .await?
        .context("app parameters are not synced")?;

    let mut plan = TransactionPlan {
        actions,
        transaction_parameters: TransactionParameters {
            expiry_height: request.expiry_height,
            chain_id: app_params.chain_id,
            ..Default::default()
        },
        fee_funding: None,
        memo,
        nullifier_window: Some(nullifier_window),
    };

    if plan.num_outputs() > 0 && plan.memo.is_none() {
        let return_address = full_viewing_key.payment_address(source);
        plan.memo = Some(MemoPlan::new(
            &mut OsRng,
            MemoPlaintext::new(return_address, String::new())
                .context("could not create empty memo plaintext")?,
        ));
    }

    plan.sort_actions();

    Ok(plan)
}

async fn plan_transfer<Db: Database>(
    storage: &Storage<Db>,
    source: AddressIndex,
    outputs: Vec<(Value, Address)>,
    recent_position_floor: u64,
    context: &PlanningContext<'_>,
) -> WasmResult<TransferPlan> {
    let first_value = outputs
        .first()
        .map(|(value, _)| *value)
        .ok_or_else(|| anyhow!("transfer requires at least one output"))?;
    let asset_id = first_value.asset_id;
    let required = outputs.iter().try_fold(Amount::zero(), |acc, (value, _)| {
        if value.asset_id != asset_id {
            anyhow::bail!("all transfer outputs must use the same asset")
        }
        acc.checked_add(&value.amount)
            .ok_or_else(|| anyhow!("transfer amount overflow"))
    })?;

    let selected = select_notes(storage, source, asset_id, required, recent_position_floor).await?;
    if selected.len() > PADDED_TRANSFER_INPUTS {
        return Err(anyhow!(
            "transfer requires note maintenance before browser planning: selected {} notes, maximum is {}",
            selected.len(),
            PADDED_TRANSFER_INPUTS
        )
        .into());
    }
    let total = selected
        .iter()
        .map(|record| record.note.amount())
        .sum::<Amount>();
    let change = total - required;
    let sender = selected
        .first()
        .map(|record| record.note.address())
        .ok_or_else(|| anyhow!("transfer requires at least one spend"))?;

    let spends = selected
        .iter()
        .map(|record| ShieldedInputPlan::new(&mut OsRng, record.note.clone(), record.position))
        .collect::<Vec<_>>();
    let mut shielded_outputs = outputs
        .into_iter()
        .map(|(value, address)| ShieldedOutputPlan::new(&mut OsRng, value, address))
        .collect::<Vec<_>>();
    if change > Amount::zero() {
        let change_output = ShieldedOutputPlan::new(
            &mut OsRng,
            Value {
                amount: change,
                asset_id,
            },
            sender,
        );
        shielded_outputs.push(change_output);
    }

    let batch = compliance_batch(context, &spends, &shielded_outputs).await?;
    let witness = crate::compliance::action_witness(&batch, &spends)?;
    let recipient =
        crate::compliance::user_witness(&batch, &shielded_outputs[0].dest_address, asset_id)?;
    let volume = storage
        .volume_plan(
            &witness,
            context.fvk,
            context.timestamp,
            shielded_outputs[0].value.amount.value(),
            recipient.leaf.address != witness.sender.leaf.address,
        )
        .await?;
    Ok(TransferPlan::new(
        spends,
        shielded_outputs,
        Fr::rand(&mut OsRng),
        shieldd_shielded_pool::TransferContext {
            witness,
            recipient,
            timestamp: context.timestamp,
            nonce: Fr::rand(&mut OsRng),
        },
        volume,
        shieldd_shielded_pool::TransferProofContext::Ordinary,
        context.routing.clone(),
    )?)
}

async fn plan_host_withdrawal<Db: Database>(
    storage: &Storage<Db>,
    source: AddressIndex,
    withdrawal: HostWithdrawal,
    recent_position_floor: u64,
    context: &PlanningContext<'_>,
) -> WasmResult<ShieldedHostWithdrawalPlan> {
    let asset_id = withdrawal.value.asset_id;
    let selected = select_notes(
        storage,
        source,
        asset_id,
        withdrawal.value.amount,
        recent_position_floor,
    )
    .await?;
    ensure_withdrawal_input_limit(selected.len())?;

    let total = selected
        .iter()
        .map(|record| record.note.amount())
        .sum::<Amount>();
    let change = total - withdrawal.value.amount;
    let sender = selected
        .first()
        .map(|record| record.note.address())
        .ok_or_else(|| anyhow!("host withdrawal requires at least one spend"))?;

    let spends = selected
        .iter()
        .map(|record| ShieldedInputPlan::new(&mut OsRng, record.note.clone(), record.position))
        .collect::<Vec<_>>();
    let change_output = (change > Amount::zero()).then(|| {
        ShieldedOutputPlan::new(
            &mut OsRng,
            Value {
                amount: change,
                asset_id,
            },
            sender,
        )
    });

    let batch = compliance_batch(context, &spends, change_output.as_slice()).await?;
    let witness = crate::compliance::action_witness(&batch, &spends)?;
    let volume = storage
        .volume_plan(
            &witness,
            context.fvk,
            context.timestamp,
            withdrawal.value.amount.value(),
            true,
        )
        .await?;
    Ok(ShieldedHostWithdrawalPlan::new(
        spends,
        change_output,
        withdrawal,
        Fr::rand(&mut OsRng),
        shieldd_shielded_pool::WithdrawalContext {
            witness,
            timestamp: context.timestamp,
            nonce: Fr::rand(&mut OsRng),
        },
        volume,
        context.routing.clone(),
    )?)
}

async fn select_notes<Db: Database>(
    storage: &Storage<Db>,
    source: AddressIndex,
    asset_id: shieldd_asset::asset::Id,
    required: Amount,
    recent_position_floor: u64,
) -> WasmResult<Vec<SpendableNoteRecord>> {
    let mut notes = storage
        .get_notes(shieldd_proto::view::v1::NotesRequest {
            include_spent: false,
            asset_id: Some(asset_id.into()),
            address_index: Some(source.into()),
            amount_to_spend: None,
        })
        .await?;
    let total_available = notes
        .iter()
        .map(|record| record.note.amount())
        .sum::<Amount>();
    notes.retain(|record| u64::from(record.position) >= recent_position_floor);
    notes.sort_by(|a, b| b.note.amount().cmp(&a.note.amount()));

    let mut total = Amount::zero();
    let mut selected = Vec::new();
    for note in notes {
        total += note.note.amount();
        selected.push(note);
        if total >= required {
            break;
        }
    }

    if total < required {
        if total_available >= required {
            return Err(anyhow!(
                "spending these funds requires historical nullifier proofs, which browser planning does not yet support"
            )
            .into());
        }
        return Err(anyhow!("insufficient balance for requested transaction").into());
    }
    Ok(selected)
}

fn ensure_withdrawal_input_limit(selected: usize) -> WasmResult<()> {
    if selected > MAX_WITHDRAWAL_INPUTS {
        return Err(anyhow!(
            "withdrawal requires note maintenance before browser planning: selected {} notes, maximum is {}",
            selected,
            MAX_WITHDRAWAL_INPUTS
        )
        .into());
    }
    Ok(())
}

fn current_unix_timestamp() -> u64 {
    (js_sys::Date::now() / 1000.0) as u64
}
