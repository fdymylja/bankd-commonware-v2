//! Shield precompile (SHLD): EVM to shielded pool deposits.
//!
//! `deposit` is payable. The EVM already moved `msg.value` into this address before the
//! precompile runs, so it only validates and emits `ShielddDeposit`. The block executor turns
//! that log into a shieldd deposit after the tx commits, because shieldd can't roll back when
//! an EVM frame reverts, while logs revert for free.

use super::{bankd_err, compliance::ensure_not_blocked};
use crate::{
    Precompile, charge_input_cost, dispatch, error::Result, mutate, storage::Handler, view,
};
use alloy::primitives::{Address, B256, U256};
use revm::precompile::PrecompileResult;
use tempo_contracts::precompiles::{BankdError, IShield, SHIELD_ADDRESS, SHIELD_BRL_DENOM};
use tempo_precompiles_macros::contract;

/// Storage layout, the block executor writes both slots at the end of every block:
/// ```solidity
/// contract Shield {
///     bytes32 root;   // slot 0, shieldd app hash
///     uint64 height;  // slot 1, shieldd height of `root`
/// }
/// ```
#[contract(addr = SHIELD_ADDRESS)]
pub struct Shield {
    root: B256,
    height: u64,
}

impl Shield {
    /// Marks the precompile account as deployed.
    pub fn initialize(&mut self) -> Result<()> {
        self.__initialize()
    }

    /// Validates a deposit whose `value` already sits in this account and emits the event.
    pub fn deposit(
        &mut self,
        sender: Address,
        value: U256,
        call: IShield::depositCall,
    ) -> Result<bool> {
        if value.is_zero() {
            return Err(bankd_err(BankdError::zero_deposit()));
        }
        if call.recipient.is_empty() {
            return Err(bankd_err(BankdError::empty_recipient()));
        }
        // The frame hook already reverts value moves from blocked accounts, this keeps the
        // rule explicit if that hook ever changes.
        ensure_not_blocked(sender)?;
        self.emit_event(IShield::ShielddDeposit {
            sender,
            recipient: call.recipient,
            amount: value,
            denom: SHIELD_BRL_DENOM.to_owned(),
        })?;
        Ok(true)
    }

    /// Shieldd root and height committed by the last block.
    pub fn last_commitment(&self) -> Result<IShield::getLastCommitmentReturn> {
        Ok(IShield::getLastCommitmentReturn {
            root: self.root.read()?,
            height: self.height.read()?,
        })
    }

    /// Binds the call value, which the generic [`Precompile`] trait doesn't carry.
    pub fn with_value(self, value: U256) -> ShieldCall {
        ShieldCall {
            shield: self,
            value,
        }
    }
}

/// [`Shield`] plus the call's `msg.value`.
pub struct ShieldCall {
    shield: Shield,
    value: U256,
}

impl Precompile for ShieldCall {
    fn call(&mut self, calldata: &[u8], msg_sender: Address) -> PrecompileResult {
        if let Some(err) = charge_input_cost(&mut self.shield.storage, calldata) {
            return err;
        }
        let value = self.value;
        let shield = &mut self.shield;
        dispatch!(calldata, |call| match call {
            IShield::IShieldCalls {
                deposit(call) => mutate(call, msg_sender, |s, c| shield.deposit(s, value, c)),
                getLastCommitment(call) => {
                    // Value on a non-payable method would be stuck here, revert it back.
                    if !value.is_zero() {
                        view(call, |_| Err(bankd_err(BankdError::not_payable())))
                    } else {
                        view(call, |_| shield.last_commitment())
                    }
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        storage::{PrecompileStorageProvider, StorageCtx, hashmap::HashMapStorageProvider},
        test_util::{assert_full_coverage, check_selector_coverage},
    };
    use alloy::sol_types::SolEvent;
    use tempo_contracts::precompiles::COMPLIANCE_ADDRESS;

    fn setup_storage() -> (HashMapStorageProvider, Address) {
        (HashMapStorageProvider::new(1), Address::random())
    }

    #[test]
    fn test_shield_selector_coverage() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || {
            let mut s = Shield::new().with_value(U256::ZERO);
            let unsupported = check_selector_coverage(
                &mut s,
                IShield::IShieldCalls::SELECTORS,
                "IShield",
                IShield::IShieldCalls::name_by_selector,
            );
            assert_full_coverage([unsupported]);
            Ok(())
        })
    }

    fn recipient() -> IShield::depositCall {
        IShield::depositCall {
            recipient: "shieldd1recipient".to_owned(),
        }
    }

    #[test]
    fn deposit_emits_event() -> eyre::Result<()> {
        let (mut storage, sender) = setup_storage();
        StorageCtx::enter(&mut storage, || {
            let mut shield = Shield::new();
            shield.initialize()?;
            assert!(shield.deposit(sender, U256::from(7), recipient())?);
            Ok::<_, eyre::Report>(())
        })?;
        let log = storage
            .get_events(SHIELD_ADDRESS)
            .last()
            .expect("event emitted");
        let ev = IShield::ShielddDeposit::decode_log_data(log)?;
        assert_eq!(ev.sender, sender);
        assert_eq!(ev.amount, U256::from(7));
        assert_eq!(ev.denom, SHIELD_BRL_DENOM);
        assert_eq!(ev.recipient, "shieldd1recipient");
        Ok(())
    }

    #[test]
    fn deposit_rejects_zero_empty_and_blocked() -> eyre::Result<()> {
        let (mut storage, sender) = setup_storage();
        // Freeze the sender by writing its Compliance status bit directly.
        storage.sstore(
            COMPLIANCE_ADDRESS,
            crate::bankd::compliance::status_slot(sender),
            U256::from(crate::bankd::compliance::FROZEN),
        )?;
        StorageCtx::enter(&mut storage, || {
            let mut shield = Shield::new();
            let zero = shield.deposit(Address::repeat_byte(1), U256::ZERO, recipient());
            assert_eq!(zero.unwrap_err(), bankd_err(BankdError::zero_deposit()));
            let empty = shield.deposit(
                Address::repeat_byte(1),
                U256::from(1),
                IShield::depositCall {
                    recipient: String::new(),
                },
            );
            assert_eq!(empty.unwrap_err(), bankd_err(BankdError::empty_recipient()));
            let blocked = shield.deposit(sender, U256::from(1), recipient());
            assert_eq!(
                blocked.unwrap_err(),
                bankd_err(BankdError::account_blocked(sender))
            );
            Ok::<_, eyre::Report>(())
        })
    }

    #[test]
    fn last_commitment_reads_slots() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        storage.sstore(SHIELD_ADDRESS, U256::ZERO, U256::from(0xabcd))?;
        storage.sstore(SHIELD_ADDRESS, U256::from(1), U256::from(42))?;
        StorageCtx::enter(&mut storage, || {
            let c = Shield::new().last_commitment()?;
            assert_eq!(c.root, B256::from(U256::from(0xabcd)));
            assert_eq!(c.height, 42);
            Ok::<_, eyre::Report>(())
        })
    }
}
