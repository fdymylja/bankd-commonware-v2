//! Block executor + shieldd engine wiring, with a mock engine.

use super::*;
use crate::{
    shield::{ShieldEngine, ShieldHandle},
    test_utils::{TestExecutorBuilder, test_chainspec},
};
use alloy_consensus::transaction::Recovered;
use alloy_evm::eth::EthTxResult;
use alloy_primitives::{Log, address};
use reth_revm::{Database as _, State, state::AccountInfo};
use std::sync::{Arc, Mutex};
use tempo_primitives::{TxShielded, shielded_sender};
use tempo_revm::ExecutionContext;

#[derive(Debug, Default)]
struct Calls {
    begins: Vec<(B256, u64)>,
    deposits: Vec<ShieldDepositInput>,
    txs: Vec<Vec<u8>>,
    finished: usize,
}

/// Records calls, accepts deposits unless the recipient is "bad", and pays out 5 wei to
/// `PAYEE` for payload `b"pay"`.
#[derive(Debug, Default, Clone)]
struct MockEngine(Arc<Mutex<Calls>>);

const PAYEE: Address = address!("0x00000000000000000000000000000000000b0b00");
const ROOT: B256 = B256::repeat_byte(0x42);

struct MockSession(Arc<Mutex<Calls>>);

impl ShieldSession for MockSession {
    fn begin_block(&mut self, parent_root: B256, height: u64, _: u64) -> Result<(), String> {
        self.0.lock().unwrap().begins.push((parent_root, height));
        Ok(())
    }
    fn deposit(&mut self, deposit: ShieldDepositInput) -> Result<bool, String> {
        let accepted = deposit.recipient != "bad";
        self.0.lock().unwrap().deposits.push(deposit);
        Ok(accepted)
    }
    fn deliver_tx(&mut self, payload: &[u8]) -> Result<ShieldTxOutcome, String> {
        self.0.lock().unwrap().txs.push(payload.to_vec());
        Ok(if payload == b"pay" {
            ShieldTxOutcome::Accepted {
                payouts: vec![(PAYEE, U256::from(5))],
            }
        } else {
            ShieldTxOutcome::Rejected("bad proof".into())
        })
    }
    fn finish(&mut self) -> Result<B256, String> {
        self.0.lock().unwrap().finished += 1;
        Ok(ROOT)
    }
}

impl ShieldEngine for MockEngine {
    fn session(&self) -> Box<dyn ShieldSession> {
        Box::new(MockSession(self.0.clone()))
    }
    fn finalize(&self, _: B256, _: u64) -> Result<(), String> {
        Ok(())
    }
    fn check_tx(&self, _: &[u8]) -> Result<(), String> {
        Ok(())
    }
}

fn state_with_escrow(escrow: u64, parent_root: B256) -> State<revm::database::EmptyDB> {
    let mut db = State::builder().with_bundle_update().build();
    db.insert_account_with_storage(
        SHIELD_ADDRESS,
        AccountInfo {
            balance: U256::from(escrow),
            ..Default::default()
        },
        [(SHIELD_ROOT_SLOT, U256::from_be_bytes(parent_root.0))]
            .into_iter()
            .collect(),
    );
    db
}

fn shielded(payload: &[u8]) -> TempoTxEnvelope {
    TempoTxEnvelope::Shielded(alloy_consensus::Sealed::new(TxShielded {
        input: Bytes::copy_from_slice(payload),
    }))
}

#[test]
fn every_block_writes_root_and_height() {
    let chainspec = test_chainspec();
    let engine = MockEngine::default();
    let parent = B256::repeat_byte(0x11);
    let mut db = state_with_escrow(0, parent);
    let mut executor = TestExecutorBuilder::default()
        .with_parent_beacon_block_root(B256::ZERO)
        .with_block_number(7)
        .with_shield(Arc::new(engine.clone()) as ShieldHandle)
        .build(&mut db, &chainspec);
    executor.apply_pre_execution_changes().unwrap();
    executor.finish_shield_block().unwrap();

    let calls = engine.0.lock().unwrap();
    assert_eq!(
        calls.begins,
        vec![(parent, 7)],
        "parent root read from the slot"
    );
    assert_eq!(calls.finished, 1);
    drop(calls);
    let db = executor.inner.evm.db_mut();
    assert_eq!(
        db.storage(SHIELD_ADDRESS, SHIELD_ROOT_SLOT).unwrap(),
        U256::from_be_bytes(ROOT.0)
    );
    assert_eq!(
        db.storage(SHIELD_ADDRESS, SHIELD_HEIGHT_SLOT).unwrap(),
        U256::from(7)
    );
}

#[test]
fn shielded_tx_pays_out_of_escrow_or_reverts() {
    let chainspec = test_chainspec();
    let engine = MockEngine::default();
    let mut db = state_with_escrow(100, B256::ZERO);
    let mut executor = TestExecutorBuilder::default()
        .with_parent_beacon_block_root(B256::ZERO)
        .with_shield(Arc::new(engine.clone()) as ShieldHandle)
        .build(&mut db, &chainspec);
    executor.apply_pre_execution_changes().unwrap();

    let pay = shielded(b"pay");
    let sender = shielded_sender(*pay.tx_hash());
    let out = executor
        .execute_transaction_without_commit(Recovered::new_unchecked(&pay, sender))
        .unwrap();
    assert!(out.result().result.is_success());
    executor.commit_transaction(out);

    let bad = shielded(b"nope");
    let sender = shielded_sender(*bad.tx_hash());
    let out = executor
        .execute_transaction_without_commit(Recovered::new_unchecked(&bad, sender))
        .unwrap();
    assert!(!out.result().result.is_success());
    executor.commit_transaction(out);

    let receipts = executor.receipts();
    assert!(receipts[0].success && !receipts[1].success);
    assert_eq!(receipts[1].cumulative_gas_used, 2 * SHIELDED_TX_GAS);
    let db = executor.inner.evm.db_mut();
    assert_eq!(db.basic(PAYEE).unwrap().unwrap().balance, U256::from(5));
    assert_eq!(
        db.basic(SHIELD_ADDRESS).unwrap().unwrap().balance,
        U256::from(95)
    );
}

fn deposit_log(sender: Address, recipient: &str, amount: u64) -> Log {
    Log::new_unchecked(
        SHIELD_ADDRESS,
        vec![IShield::ShielddDeposit::SIGNATURE_HASH, sender.into_word()],
        IShield::ShielddDeposit {
            sender,
            recipient: recipient.into(),
            amount: U256::from(amount),
            denom: "abrl".into(),
        }
        .encode_data()
        .into(),
    )
}

#[test]
fn deposits_are_forwarded_and_refused_ones_refunded() {
    let chainspec = test_chainspec();
    let engine = MockEngine::default();
    let mut db = state_with_escrow(30, B256::ZERO);
    let mut executor = TestExecutorBuilder::default()
        .with_parent_beacon_block_root(B256::ZERO)
        .with_shield(Arc::new(engine.clone()) as ShieldHandle)
        .build(&mut db, &chainspec);
    executor.apply_pre_execution_changes().unwrap();

    let depositor = Address::repeat_byte(0xd0);
    let tx = shielded(b"x");
    let output = TempoTxResult {
        execution_context: ExecutionContext::Transaction {
            tx_hash: B256::ZERO,
        },
        inner: EthTxResult {
            result: ResultAndState {
                result: ExecutionResult::Success {
                    reason: SuccessReason::Return,
                    gas: ResultGas::default().with_total_gas_spent(21000),
                    logs: vec![
                        deposit_log(depositor, "shieldd1ok", 10),
                        deposit_log(depositor, "bad", 20),
                    ],
                    output: Output::Call(Bytes::new()),
                },
                state: Default::default(),
            },
            blob_gas_used: 0,
            tx_type: tx.tx_type(),
        },
        next_section: BlockSection::NonShared,
        is_payment: false,
        block_gas_used: 21000,
        validator_fee: U256::ZERO,
        tx_hash: B256::repeat_byte(0xaa),
    };
    executor.commit_transaction(output);

    let calls = engine.0.lock().unwrap();
    assert_eq!(calls.deposits.len(), 2);
    assert_eq!(calls.deposits[1].msg_index, 1);
    assert_eq!(calls.deposits[0].tx_hash, B256::repeat_byte(0xaa));
    drop(calls);
    let db = executor.inner.evm.db_mut();
    assert_eq!(
        db.basic(depositor).unwrap().unwrap().balance,
        U256::from(20)
    );
    assert_eq!(
        db.basic(SHIELD_ADDRESS).unwrap().unwrap().balance,
        U256::from(10)
    );
}

#[test]
fn shielded_tx_without_engine_is_invalid() {
    let chainspec = test_chainspec();
    let mut db = State::builder().with_bundle_update().build();
    let mut executor = TestExecutorBuilder::default()
        .with_parent_beacon_block_root(B256::ZERO)
        .build(&mut db, &chainspec);
    executor.apply_pre_execution_changes().unwrap();
    let tx = shielded(b"pay");
    let sender = shielded_sender(*tx.tx_hash());
    assert!(
        executor
            .execute_transaction_without_commit(Recovered::new_unchecked(&tx, sender))
            .is_err()
    );
}
