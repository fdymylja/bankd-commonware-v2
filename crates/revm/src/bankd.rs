//! bankd protocol checks: compliance (freeze/sanctions) and value sent to bankd precompiles.
//!
//! Lives in its own module so upstream rebases only touch the call sites.

use alloy_primitives::{Address, Bytes, U256};
use alloy_sol_types::SolInterface;
use revm::{
    context::{JournalTr, Transaction},
    handler::{FrameResult, ItemOrResult},
    interpreter::{
        CallInputs, CallOutcome, CreateInputs, CreateOutcome, FrameInput, Gas, InstructionResult,
        InterpreterResult,
    },
};
use tempo_contracts::precompiles::{
    AUTHORITY_ADDRESS, BANK_SEND_ADDRESS, BankdError, COMPLIANCE_ADDRESS, NATIVE_ADDRESS,
};
use tempo_precompiles::bankd::compliance::{is_blocked_value, status_slot};

use crate::{TempoInvalidTransaction, TempoTxEnv};

/// bankd precompiles can't see `msg.value`, so value sent to them would be stuck there.
pub const BANKD_PRECOMPILES: [Address; 4] = [
    AUTHORITY_ADDRESS,
    NATIVE_ADDRESS,
    COMPLIANCE_ADDRESS,
    BANK_SEND_ADDRESS,
];

/// Reads the Compliance status slot for `account` through the journal, so a freeze earlier
/// in the same block or tx is seen.
pub fn is_blocked<J: JournalTr>(
    journal: &mut J,
    account: Address,
) -> Result<bool, <J::Database as revm::Database>::Error> {
    journal.load_account(COMPLIANCE_ADDRESS)?;
    let value = journal
        .sload(COMPLIANCE_ADDRESS, status_slot(account))?
        .data;
    Ok(is_blocked_value(value))
}

/// `(to, value)` for every call the tx makes, AA batches included.
fn tx_calls(tx: &TempoTxEnv) -> Vec<(Option<Address>, U256)> {
    match tx.tempo_tx_env.as_ref() {
        Some(aa) => aa
            .aa_calls
            .iter()
            .map(|call| (call.to.to().copied(), call.value))
            .collect(),
        None => vec![(tx.kind().to().copied(), tx.value())],
    }
}

/// Stateless check: no call in the tx sends value to a bankd precompile.
pub fn validate_no_value_to_precompiles(tx: &TempoTxEnv) -> Result<(), TempoInvalidTransaction> {
    for (to, value) in tx_calls(tx) {
        if let Some(to) = to
            && !value.is_zero()
            && BANKD_PRECOMPILES.contains(&to)
        {
            return Err(TempoInvalidTransaction::ValueToBankdPrecompile { address: to });
        }
    }
    Ok(())
}

/// Rejects the tx when its sender, fee payer or any call target is frozen or sanctioned.
/// Runs in both the pool and block execution, since a block producer can skip the pool.
pub fn validate_tx_compliance<J: JournalTr>(
    journal: &mut J,
    tx: &TempoTxEnv,
    fee_payer: Address,
) -> Result<Result<(), TempoInvalidTransaction>, <J::Database as revm::Database>::Error> {
    let targets = tx_calls(tx).into_iter().filter_map(|(to, _)| to);
    for address in [tx.caller(), fee_payer].into_iter().chain(targets) {
        if is_blocked(journal, address)? {
            return Ok(Err(TempoInvalidTransaction::AccountBlocked { address }));
        }
    }
    Ok(Ok(()))
}

fn blocked_output(account: Address) -> Bytes {
    BankdError::account_blocked(account).abi_encode().into()
}

fn revert_call(inputs: &CallInputs, output: Bytes) -> FrameResult {
    FrameResult::Call(CallOutcome {
        result: InterpreterResult {
            result: InstructionResult::Revert,
            gas: Gas::new_with_regular_gas_and_reservoir(inputs.gas_limit, inputs.reservoir),
            output,
        },
        memory_offset: inputs.return_memory_offset.clone(),
        was_precompile_called: false,
        precompile_call_logs: Vec::new(),
        charged_new_account_state_gas: inputs.charged_new_account_state_gas,
    })
}

fn revert_create(inputs: &CreateInputs, output: Bytes) -> FrameResult {
    FrameResult::Create(CreateOutcome {
        result: InterpreterResult {
            result: InstructionResult::Revert,
            gas: Gas::new_with_regular_gas_and_reservoir(inputs.gas_limit(), inputs.reservoir()),
            output,
        },
        address: None,
        charged_create_state_gas: inputs.charged_create_state_gas(),
    })
}

/// Frame-level hook: reverts any frame moving native BRL from or to a blocked account, or
/// sending value to a bankd precompile. Catches contracts forwarding BRL internally.
pub fn check_frame<J: JournalTr, F>(
    journal: &mut J,
    input: &FrameInput,
) -> Result<Option<ItemOrResult<F, FrameResult>>, <J::Database as revm::Database>::Error> {
    let result = match input {
        FrameInput::Call(inputs) if inputs.transfers_value() => {
            let (from, to) = (inputs.transfer_from(), inputs.transfer_to());
            if BANKD_PRECOMPILES.contains(&to) {
                Some(revert_call(inputs, Bytes::new()))
            } else if is_blocked(journal, from)? {
                Some(revert_call(inputs, blocked_output(from)))
            } else if is_blocked(journal, to)? {
                Some(revert_call(inputs, blocked_output(to)))
            } else {
                None
            }
        }
        FrameInput::Create(inputs) if !inputs.value().is_zero() => {
            let from = inputs.caller();
            is_blocked(journal, from)?.then(|| revert_create(inputs, blocked_output(from)))
        }
        _ => None,
    };
    Ok(result.map(ItemOrResult::Result))
}

#[cfg(test)]
mod tests;
