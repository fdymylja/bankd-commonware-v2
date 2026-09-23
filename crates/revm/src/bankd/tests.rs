use alloy_primitives::{Address, Bytes, TxKind, U256, address};
use alloy_sol_types::SolCall;
use reth_evm::EvmInternals;
use revm::{
    Context, ExecuteCommitEvm, MainContext,
    context::{ContextTr, TxEnv, result::EVMError},
    database::{CacheDB, EmptyDB},
    state::{AccountInfo, Bytecode},
};
use tempo_contracts::precompiles::{COMPLIANCE_ADDRESS, ICompliance, NATIVE_ADDRESS};
use tempo_precompiles::{
    bankd::{Authority, Compliance},
    storage::{StorageCtx, evm::EvmPrecompileStorageProvider},
};

use crate::{TempoEvm, TempoInvalidTransaction, TempoTxEnv};

type TestEvm = TempoEvm<CacheDB<EmptyDB>, ()>;

const OWNER: Address = address!("0x00000000000000000000000000000000000000a1");
const ALICE: Address = address!("0x00000000000000000000000000000000000000a2");
const FROZEN: Address = address!("0x00000000000000000000000000000000000000a3");
const FORWARDER: Address = address!("0x00000000000000000000000000000000000000c1");
const SUICIDE: Address = address!("0x00000000000000000000000000000000000000c2");
const ONE: u128 = 1_000_000_000_000_000_000;

/// Runtime code: CALL(gas, target, callvalue, 0, 0, 0, 0), revert if it failed.
fn forwarder_code(target: Address) -> Bytecode {
    let mut code = vec![0x60, 0, 0x60, 0, 0x60, 0, 0x60, 0, 0x34, 0x73];
    code.extend_from_slice(target.as_slice());
    code.extend_from_slice(&[
        0x5a, 0xf1, 0x15, 0x60, 0x25, 0x57, 0x00, 0x5b, 0x60, 0, 0x60, 0, 0xfd,
    ]);
    Bytecode::new_raw(code.into())
}

/// Runtime code: SELFDESTRUCT(beneficiary).
fn selfdestruct_code(beneficiary: Address) -> Bytecode {
    let mut code = vec![0x73];
    code.extend_from_slice(beneficiary.as_slice());
    code.push(0xff);
    Bytecode::new_raw(code.into())
}

/// EVM with OWNER as Authority owner and FROZEN frozen, everyone funded with 1 BRL.
fn setup() -> TestEvm {
    let ctx = Context::mainnet()
        .with_db(CacheDB::new(EmptyDB::new()))
        .with_block(Default::default())
        .with_cfg(Default::default())
        .with_tx(Default::default());
    let mut evm = TempoEvm::new(ctx, ());
    evm.ctx.cfg.disable_nonce_check = true;
    for addr in [OWNER, ALICE, FROZEN] {
        evm.ctx.db_mut().insert_account_info(
            addr,
            AccountInfo {
                balance: U256::from(ONE),
                ..Default::default()
            },
        );
    }
    for (addr, code) in [
        (FORWARDER, forwarder_code(FROZEN)),
        (SUICIDE, selfdestruct_code(FROZEN)),
    ] {
        evm.ctx.db_mut().insert_account_info(
            addr,
            AccountInfo {
                balance: U256::from(ONE),
                code_hash: code.hash_slow(),
                code: Some(code),
                ..Default::default()
            },
        );
    }

    {
        let ctx = &mut evm.ctx;
        let internals = EvmInternals::new(&mut ctx.journaled_state, &ctx.block, &ctx.cfg, &ctx.tx);
        let mut storage = EvmPrecompileStorageProvider::new_max_gas(internals, &ctx.cfg);
        StorageCtx::enter(&mut storage, || {
            Authority::new().initialize(OWNER)?;
            Compliance::new().initialize()?;
            Compliance::new().freeze(OWNER, FROZEN)
        })
        .unwrap();
    }
    evm
}

fn tx(caller: Address, to: Address, value: u128, input: Bytes) -> TempoTxEnv {
    TempoTxEnv {
        inner: TxEnv {
            caller,
            kind: TxKind::Call(to),
            value: U256::from(value),
            data: input,
            gas_limit: 1_000_000,
            ..Default::default()
        },
        ..Default::default()
    }
}

fn balance(evm: &mut TestEvm, addr: Address) -> U256 {
    use revm::context::JournalTr;
    evm.ctx
        .journaled_state
        .load_account(addr)
        .unwrap()
        .data
        .info
        .balance
}

fn assert_invalid(evm: &mut TestEvm, tx: TempoTxEnv, expected: TempoInvalidTransaction) {
    match evm.transact_commit(tx) {
        Err(EVMError::Transaction(err)) => assert_eq!(err, expected),
        other => panic!("expected {expected:?}, got {other:?}"),
    }
}

#[test]
fn frozen_sender_rejected() {
    let mut evm = setup();
    assert_invalid(
        &mut evm,
        tx(FROZEN, ALICE, 1, Bytes::new()),
        TempoInvalidTransaction::AccountBlocked { address: FROZEN },
    );
}

#[test]
fn transfer_to_frozen_rejected() {
    let mut evm = setup();
    assert_invalid(
        &mut evm,
        tx(ALICE, FROZEN, 1, Bytes::new()),
        TempoInvalidTransaction::AccountBlocked { address: FROZEN },
    );
}

#[test]
fn contract_forwarding_to_frozen_reverts() {
    let mut evm = setup();
    let result = evm
        .transact_commit(tx(ALICE, FORWARDER, 5, Bytes::new()))
        .unwrap();
    assert!(
        !result.is_success(),
        "forward to frozen should revert: {result:?}"
    );
    assert_eq!(balance(&mut evm, FROZEN), U256::from(ONE));
}

#[test]
fn contract_forwarding_to_clean_account_works() {
    let mut evm = setup();
    evm.ctx.db_mut().insert_account_info(FORWARDER, {
        let code = forwarder_code(OWNER);
        AccountInfo {
            code_hash: code.hash_slow(),
            code: Some(code),
            ..Default::default()
        }
    });
    let result = evm
        .transact_commit(tx(ALICE, FORWARDER, 5, Bytes::new()))
        .unwrap();
    assert!(result.is_success(), "{result:?}");
    assert_eq!(balance(&mut evm, OWNER), U256::from(ONE + 5));
}

#[test]
fn selfdestruct_to_frozen_reverts() {
    let mut evm = setup();
    let result = evm
        .transact_commit(tx(ALICE, SUICIDE, 0, Bytes::new()))
        .unwrap();
    assert!(
        !result.is_success(),
        "selfdestruct to frozen should revert: {result:?}"
    );
    assert_eq!(balance(&mut evm, FROZEN), U256::from(ONE));
    assert_eq!(balance(&mut evm, SUICIDE), U256::from(ONE));
}

#[test]
fn value_to_bankd_precompile_rejected() {
    let mut evm = setup();
    assert_invalid(
        &mut evm,
        tx(ALICE, NATIVE_ADDRESS, 1, Bytes::new()),
        TempoInvalidTransaction::ValueToBankdPrecompile {
            address: NATIVE_ADDRESS,
        },
    );
}

#[test]
fn internal_value_to_bankd_precompile_reverts() {
    let mut evm = setup();
    let code = forwarder_code(COMPLIANCE_ADDRESS);
    evm.ctx.db_mut().insert_account_info(
        FORWARDER,
        AccountInfo {
            code_hash: code.hash_slow(),
            code: Some(code),
            ..Default::default()
        },
    );
    let result = evm
        .transact_commit(tx(ALICE, FORWARDER, 5, Bytes::new()))
        .unwrap();
    assert!(!result.is_success(), "{result:?}");
    assert_eq!(balance(&mut evm, COMPLIANCE_ADDRESS), U256::ZERO);
}

#[test]
fn seize_moves_frozen_funds_and_unfreeze_restores() {
    let mut evm = setup();
    let seize = ICompliance::seizeCall {
        from: FROZEN,
        to: OWNER,
        amount: U256::from(ONE / 2),
    }
    .abi_encode();
    let result = evm
        .transact_commit(tx(OWNER, COMPLIANCE_ADDRESS, 0, seize.into()))
        .unwrap();
    assert!(result.is_success(), "seize failed: {result:?}");
    assert_eq!(balance(&mut evm, FROZEN), U256::from(ONE / 2));

    let unfreeze = ICompliance::unfreezeCall { account: FROZEN }.abi_encode();
    let result = evm
        .transact_commit(tx(OWNER, COMPLIANCE_ADDRESS, 0, unfreeze.into()))
        .unwrap();
    assert!(result.is_success(), "unfreeze failed: {result:?}");

    let result = evm
        .transact_commit(tx(FROZEN, ALICE, 1, Bytes::new()))
        .unwrap();
    assert!(result.is_success(), "transfer after unfreeze: {result:?}");
}

#[test]
fn selfdestruct_to_clean_account_works() {
    let mut evm = setup();
    let code = selfdestruct_code(OWNER);
    evm.ctx.db_mut().insert_account_info(
        SUICIDE,
        AccountInfo {
            balance: U256::from(ONE),
            code_hash: code.hash_slow(),
            code: Some(code),
            ..Default::default()
        },
    );
    let result = evm
        .transact_commit(tx(ALICE, SUICIDE, 0, Bytes::new()))
        .unwrap();
    assert!(result.is_success(), "{result:?}");
    assert_eq!(balance(&mut evm, OWNER), U256::from(2 * ONE));
}
