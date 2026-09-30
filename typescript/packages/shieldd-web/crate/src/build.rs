use crate::error::WasmResult;
use crate::utils;
use crate::view_server::{load_tree, StoredTree};
use anyhow::{anyhow, Context};
use decaf377::Fq;
use rand_core::OsRng;
use serde::Serialize;
use shieldd_keys::{keys::SpendKey, symmetric::PayloadKey, FullViewingKey};
use shieldd_proto::DomainType;
use shieldd_shielded_pool::{
    gnark::{
        decode_shielded_withdrawal_witness, decode_transfer_witness,
        encode_shielded_withdrawal_witness, translate_shielded_withdrawal_proof_result,
        translate_transfer_proof_result,
    },
    ShieldedWithdrawalFamilyId,
};
use shieldd_tct::{self as tct, Proof, StateCommitment};
use shieldd_transaction::{
    plan::{ActionPlan, TransactionPlan},
    Action, AuthorizationData, Transaction, WitnessData,
};
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProofRequest {
    family: &'static str,
    witness: Vec<u8>,
}

/// Authorize transaction using a spend key.
#[wasm_bindgen]
pub fn authorize(spend_key: &[u8], transaction_plan: &[u8]) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let spend_key = SpendKey::decode(spend_key)?;
    let plan = TransactionPlan::decode(transaction_plan)?;
    let auth_data = plan.authorize(OsRng, &spend_key)?;

    Ok(auth_data.encode_to_vec())
}

/// Build witness data from a transaction plan and serialized IndexedDB SCT.
#[wasm_bindgen]
pub fn witness(transaction_plan: &[u8], stored_tree: JsValue) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let plan = TransactionPlan::decode(transaction_plan)?;
    let stored_tree = serde_wasm_bindgen::from_value(stored_tree)?;
    let witness_data = witness_inner(plan, stored_tree)?;

    Ok(witness_data.encode_to_vec())
}

fn witness_inner(plan: TransactionPlan, stored_tree: StoredTree) -> WasmResult<WitnessData> {
    let sct = load_tree(stored_tree);
    let recent_position_floor = plan.recent_position_floor()?;
    if planned_spends(&plan).into_iter().any(|plan| {
        plan.note.amount() != 0u64.into() && u64::from(plan.position) < recent_position_floor
    }) {
        return Err(anyhow!(
            "historical nullifier proofs are required for one or more selected notes"
        )
        .into());
    }

    let mut note_commitments: Vec<StateCommitment> = planned_spends(&plan)
        .into_iter()
        .filter(|plan| plan.note.amount() != 0u64.into())
        .map(|spend| spend.note.commit())
        .collect();

    note_commitments.extend(plan.actions.iter().filter_map(|action| match action {
        ActionPlan::Transfer(plan) => plan.accumulator_prior_commitment(),
        ActionPlan::ShieldedHostWithdrawal(plan) => plan.accumulator_prior_commitment(),
        _ => None,
    }));
    let anchor = sct.root();
    let auth_paths = note_commitments
        .iter()
        .map(|nc| {
            sct.witness(*nc)
                .ok_or_else(|| anyhow!("note commitment is in the SCT"))
        })
        .collect::<Result<Vec<Proof>, anyhow::Error>>()?;
    drop(sct);

    let mut witness_data = WitnessData {
        anchor,
        state_commitment_proofs: auth_paths
            .into_iter()
            .map(|proof| (proof.commitment(), proof))
            .collect(),
        historical_nullifier_proofs: Vec::new(),
    };

    for nc in planned_spends(&plan)
        .into_iter()
        .filter(|plan| plan.note.amount() == 0u64.into())
        .map(|plan| plan.note.commit())
    {
        witness_data.add_proof(nc, Proof::dummy(&mut OsRng, nc));
    }

    Ok(witness_data)
}

/// Builds the witness payload required by the local HTTP prover for the
/// requested action. This is intentionally binary-only across the WASM
/// boundary; ActionPlan JSON is not accepted or produced.
#[wasm_bindgen]
pub fn build_action_proof_request(
    transaction_plan: &[u8],
    action_plan: &[u8],
    full_viewing_key: &[u8],
    witness_data: &[u8],
) -> WasmResult<JsValue> {
    utils::set_panic_hook();
    let transaction_plan = TransactionPlan::decode(transaction_plan)?;
    let witness = WitnessData::decode(witness_data)?;
    let action_plan = ActionPlan::decode(action_plan)?;
    let full_viewing_key = FullViewingKey::decode(full_viewing_key)?;

    let request =
        build_action_proof_request_inner(transaction_plan, action_plan, full_viewing_key, witness)?;
    Ok(serde_wasm_bindgen::to_value(&request)?)
}

fn build_action_proof_request_inner(
    transaction_plan: TransactionPlan,
    action_plan: ActionPlan,
    full_viewing_key: FullViewingKey,
    witness: WitnessData,
) -> WasmResult<ProofRequest> {
    let anchor = witness.anchor;
    let recent_position_floor = transaction_plan.recent_position_floor()?;
    let request = match action_plan {
        ActionPlan::Transfer(plan) => {
            let auth_paths =
                transfer_auth_paths(&plan.spends, plan.accumulator_prior_commitment(), &witness)?;
            ProofRequest {
                family: "transfer",
                witness: plan.transfer_witness_payload(
                    &full_viewing_key,
                    auth_paths,
                    anchor,
                    recent_position_floor,
                )?,
            }
        }
        ActionPlan::ShieldedHostWithdrawal(plan) => {
            let auth_paths =
                transfer_auth_paths(&plan.spends, plan.accumulator_prior_commitment(), &witness)?;
            let (public, private) = plan.shielded_host_withdrawal_public_private(
                &full_viewing_key,
                &auth_paths,
                anchor,
                recent_position_floor,
            )?;
            ProofRequest {
                // Host withdrawals deliberately reuse the canonical shielded
                // withdrawal circuit and prover artifact.
                family: "shielded_withdrawal",
                witness: encode_shielded_withdrawal_witness(&public, &private)?,
            }
        }
        other => {
            return Err(anyhow!(
                "browser proving is not available for action plan variant {}",
                other.variant_index()
            )
            .into())
        }
    };
    Ok(request)
}

/// Builds a binary Action from a binary ActionPlan and a packed gnark proof
/// result returned by the local HTTP prover.
#[wasm_bindgen]
pub fn build_action_with_proof_result(
    transaction_plan: &[u8],
    action_plan: &[u8],
    full_viewing_key: &[u8],
    witness_data: &[u8],
    proof_result: &[u8],
) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();
    let transaction_plan = TransactionPlan::decode(transaction_plan)?;
    let witness = WitnessData::decode(witness_data)?;
    let action_plan = ActionPlan::decode(action_plan)?;
    let full_viewing_key = FullViewingKey::decode(full_viewing_key)?;

    let action = build_action_with_proof_result_inner(
        transaction_plan,
        action_plan,
        full_viewing_key,
        witness,
        proof_result,
    )?;

    Ok(action.encode_to_vec())
}

fn build_action_with_proof_result_inner(
    transaction_plan: TransactionPlan,
    action_plan: ActionPlan,
    full_viewing_key: FullViewingKey,
    witness: WitnessData,
    proof_result: &[u8],
) -> WasmResult<Action> {
    let anchor = witness.anchor;
    let memo_key = memo_key(&transaction_plan);
    let recent_position_floor = transaction_plan.recent_position_floor()?;

    let action = match action_plan {
        ActionPlan::Transfer(plan) => {
            let auth_paths =
                transfer_auth_paths(&plan.spends, plan.accumulator_prior_commitment(), &witness)?;
            let expected_witness = plan.transfer_witness_payload(
                &full_viewing_key,
                auth_paths,
                anchor,
                recent_position_floor,
            )?;
            let expected = Fq::from_le_bytes_mod_order(
                &decode_transfer_witness(&expected_witness)?.claimed_statement_hash,
            );
            let (claimed, proof) = translate_transfer_proof_result(proof_result)?;
            if claimed != expected {
                return Err(anyhow!(
                    "transfer proof result statement hash mismatch: expected {expected}, got {claimed}"
                )
                .into());
            }
            Action::Transfer(plan.build_unauth_transfer_with_proof(
                &full_viewing_key,
                vec![[0u8; 64].into(); plan.spends.len()],
                anchor,
                &memo_key,
                proof,
                recent_position_floor,
            )?)
        }
        ActionPlan::ShieldedHostWithdrawal(plan) => {
            let auth_paths =
                transfer_auth_paths(&plan.spends, plan.accumulator_prior_commitment(), &witness)?;
            let (public, private) = plan.shielded_host_withdrawal_public_private(
                &full_viewing_key,
                &auth_paths,
                anchor,
                recent_position_floor,
            )?;
            let expected_witness = encode_shielded_withdrawal_witness(&public, &private)?;
            let expected = Fq::from_le_bytes_mod_order(
                &decode_shielded_withdrawal_witness(&expected_witness)?.claimed_statement_hash,
            );
            let (claimed, proof) = translate_shielded_withdrawal_proof_result(
                proof_result,
                ShieldedWithdrawalFamilyId::Canonical,
            )?;
            if claimed != expected {
                return Err(anyhow!(
                    "shielded host withdrawal proof result statement hash mismatch: expected {expected}, got {claimed}"
                )
                .into());
            }
            Action::ShieldedHostWithdrawal(plan.build_unauth_shielded_host_withdrawal_with_proof(
                &full_viewing_key,
                vec![[0u8; 64].into(); plan.spends.len()],
                anchor,
                &memo_key,
                proof,
                recent_position_floor,
            )?)
        }
        other => {
            return Err(anyhow!(
                "browser proving is not available for action plan variant {}",
                other.variant_index()
            )
            .into())
        }
    };

    Ok(action)
}

/// Deprecated browser entrypoint retained as a hard error so stale consumers do
/// not silently fall back to host-only proof generation.
#[wasm_bindgen]
pub fn build_action(
    _transaction_plan: &[u8],
    _action_plan: &[u8],
    _full_viewing_key: &[u8],
    _witness_data: &[u8],
) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();
    Err(anyhow!(
        "build_action is no longer supported in WASM; use build_action_proof_request and build_action_with_proof_result"
    )
    .into())
}

/// Deprecated browser entrypoint retained as a hard error so stale consumers do
/// not use host-only transaction proving in WASM.
#[wasm_bindgen]
pub fn build_serial(
    _full_viewing_key: &[u8],
    _transaction_plan: &[u8],
    _witness_data: &[u8],
    _auth_data: &[u8],
) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();
    Err(anyhow!(
        "build_serial is no longer supported in WASM; build actions with the local prover and call build_parallel"
    )
    .into())
}

/// Build a transaction from binary Actions, a binary TransactionPlan, binary
/// WitnessData, and binary AuthorizationData. No Action or ActionPlan JSON is
/// accepted at this boundary.
#[wasm_bindgen]
pub fn build_parallel(
    actions: JsValue,
    transaction_plan: &[u8],
    witness_data: &[u8],
    auth_data: &[u8],
) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let plan = TransactionPlan::decode(transaction_plan)?;
    let witness = WitnessData::decode(witness_data)?;
    let auth = AuthorizationData::decode(auth_data)?;
    let actions: Vec<Vec<u8>> = serde_wasm_bindgen::from_value(actions)?;
    let actions = actions
        .into_iter()
        .map(|bytes| Action::decode(bytes.as_slice()).map_err(Into::into))
        .collect::<WasmResult<Vec<_>>>()?;

    let tx = build_parallel_inner(actions, plan, witness, auth)?;

    Ok(tx.encode_to_vec())
}

pub fn build_parallel_inner(
    actions: Vec<Action>,
    plan: TransactionPlan,
    witness: WitnessData,
    auth: AuthorizationData,
) -> WasmResult<Transaction> {
    let transaction = plan
        .clone()
        .build_unauth_with_actions(actions, None, &witness)?;
    let tx = plan.apply_auth_data(&auth, transaction)?;

    Ok(tx)
}

fn memo_key(transaction_plan: &TransactionPlan) -> PayloadKey {
    transaction_plan
        .memo
        .as_ref()
        .map(|memo_plan| memo_plan.key)
        .unwrap_or([0u8; 32].into())
}

fn transfer_auth_paths(
    spends: &[shieldd_shielded_pool::ShieldedInputPlan],
    accumulator: Option<StateCommitment>,
    witness: &WitnessData,
) -> WasmResult<Vec<tct::Proof>> {
    spends
        .iter()
        .map(|spend| spend.note.commit())
        .chain(accumulator)
        .map(|note_commitment| {
            witness
                .state_commitment_proofs
                .get(&note_commitment)
                .cloned()
                .context(format!("could not get proof for {note_commitment:?}"))
                .map_err(Into::into)
        })
        .collect()
}

fn planned_spends(plan: &TransactionPlan) -> Vec<&shieldd_shielded_pool::ShieldedInputPlan> {
    let mut spends = Vec::new();
    for action in &plan.actions {
        match action {
            ActionPlan::Transfer(plan) => spends.extend(plan.spends.iter()),
            ActionPlan::NoteReshape(plan) => spends.extend(plan.spends.iter()),
            ActionPlan::ShieldedHostWithdrawal(plan) => spends.extend(plan.spends.iter()),
            _ => {}
        }
    }
    if let Some(fee_funding) = &plan.fee_funding {
        spends.extend(fee_funding.transfer.spends.iter());
    }
    spends
}

#[wasm_bindgen(getter_with_clone)]
pub struct TxpAndTxvBytes {
    pub txp: Vec<u8>,
    pub txv: Vec<u8>,
}

#[wasm_bindgen]
pub async fn transaction_perspective_and_view(
    _full_viewing_key: &[u8],
    _tx: &[u8],
    _idb_constants: JsValue,
) -> WasmResult<TxpAndTxvBytes> {
    Err(
        anyhow!("transaction_perspective_and_view is not available in the bankD demo wasm build")
            .into(),
    )
}

#[wasm_bindgen]
pub async fn transaction_summary(_txv: &[u8]) -> WasmResult<Vec<u8>> {
    Err(anyhow!("transaction_summary is not available in the bankD demo wasm build").into())
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use rand_core::OsRng;
    use shieldd_asset::{Value, BASE_ASSET_ID};
    use shieldd_keys::keys::{AddressIndex, SpendKey, SpendKeyBytes};
    use shieldd_sct::nullifier_generation::{
        empty_history_head, NullifierWindow, PROTOCOL_VERSION,
    };
    use shieldd_shielded_pool::{
        HostTransfer, HostWithdrawal, HostWithdrawalDestination, Note, Rseed,
        ShieldedHostWithdrawalPlan, ShieldedInputPlan, ShieldedOutputPlan,
    };
    use shieldd_tct::{Tree, Witness};
    use shieldd_transaction::{ActionPlan, TransactionParameters, TransactionPlan, WitnessData};

    use super::build_action_proof_request_inner;

    #[test]
    fn host_withdrawal_reuses_shielded_withdrawal_prover_family() {
        let spend_key = SpendKey::try_from(SpendKeyBytes::from([7u8; 32])).unwrap();
        let fvk = spend_key.full_viewing_key().clone();
        let address = fvk.payment_address(AddressIndex::new(0));
        let asset_id = *BASE_ASSET_ID;
        let note = Note::from_parts(
            address.clone(),
            Value {
                amount: 10u64.into(),
                asset_id,
            },
            Rseed::generate(&mut OsRng),
            shieldd_shielded_pool::RecoveryCommitment::unavailable(),
        )
        .unwrap();

        let mut tree = Tree::new();
        let position = tree.insert(Witness::Keep, note.commit()).unwrap();
        let proof = tree.witness(note.commit()).unwrap();
        let anchor = tree.root();

        let spend = ShieldedInputPlan::new(&mut OsRng, note, position);
        let change = ShieldedOutputPlan::new(
            &mut OsRng,
            Value {
                amount: 5u64.into(),
                asset_id,
            },
            address.clone(),
        );
        let host_plan = ShieldedHostWithdrawalPlan::new(
            vec![spend],
            Some(change),
            HostWithdrawal {
                value: Value {
                    amount: 5u64.into(),
                    asset_id,
                },
                destination: HostWithdrawalDestination::Transfer(HostTransfer {
                    recipient: "bankd1recipient".to_owned(),
                }),
            },
            decaf377::Fr::from(9u64),
            {
                let assets = shieldd_compliance::IndexedMerkleTree::new();
                let (position, leaf, path) = assets.non_membership_proof(asset_id.0).unwrap();
                shieldd_shielded_pool::WithdrawalContext {
                    witness: shieldd_shielded_pool::ActionWitness {
                        asset: shieldd_shielded_pool::AssetWitness {
                            asset_id,
                            root: assets.root(),
                            leaf,
                            position,
                            path: path.into(),
                            is_regulated: false,
                        },
                        user_root: shieldd_tct::StateCommitment(decaf377::Fq::from(0u64)),
                        sender: shieldd_shielded_pool::UserWitness {
                            leaf: shieldd_compliance::ComplianceLeaf::synthetic_unregulated(
                                address, asset_id,
                            ),
                            position: 0,
                            path: Default::default(),
                        },
                        policy: None,
                    },
                    timestamp: 86_400,
                    nonce: decaf377::Fr::from(7u64),
                }
            },
            shieldd_shielded_pool::VolumeAccumulatorPlan::padding(86_400),
            Default::default(),
        )
        .unwrap();
        let action_plan = ActionPlan::ShieldedHostWithdrawal(host_plan);
        let transaction_plan = TransactionPlan {
            actions: vec![action_plan.clone()],
            transaction_parameters: TransactionParameters::default(),
            fee_funding: None,
            memo: None,
            nullifier_window: Some(NullifierWindow {
                protocol_version: PROTOCOL_VERSION,
                current_generation: 1,
                recent_position_floor: 0,
                archived_generation_count: 0,
                archived_history_head: empty_history_head(),
            }),
        };
        let witness = WitnessData {
            anchor,
            state_commitment_proofs: BTreeMap::from([(proof.commitment(), proof)]),
            historical_nullifier_proofs: Vec::new(),
        };

        let request =
            build_action_proof_request_inner(transaction_plan, action_plan, fvk, witness).unwrap();

        assert_eq!(request.family, "shielded_withdrawal");
        assert!(!request.witness.is_empty());
    }
}
