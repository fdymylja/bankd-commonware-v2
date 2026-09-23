//! BankSend precompile: native BRL sends from the caller, including atomic batch payroll.
//!
//! Plain value transfers already cover single sends now that BRL is native. This stays for
//! `batchSend` and for Solidity callers written against bankd v1's address.

use super::{bankd_err, compliance::ensure_not_blocked, move_native};
use crate::{
    Precompile, charge_input_cost, dispatch,
    error::{Result, TempoPrecompileError},
    mutate,
};
use alloy::primitives::{Address, U256};
use revm::precompile::PrecompileResult;
use tempo_contracts::precompiles::{BANK_SEND_ADDRESS, BankdError, IBankSend};
use tempo_precompiles_macros::contract;

#[contract(addr = BANK_SEND_ADDRESS)]
pub struct BankSend {}

impl BankSend {
    /// Marks the precompile account as deployed. Stateless otherwise.
    pub fn initialize(&mut self) -> Result<()> {
        self.__initialize()
    }

    pub fn send(&mut self, sender: Address, call: IBankSend::sendCall) -> Result<bool> {
        self.batch_send(
            sender,
            IBankSend::batchSendCall {
                payments: vec![IBankSend::Payment {
                    recipient: call.recipient,
                    amount: call.amount,
                }],
            },
        )
    }

    /// Validates the whole batch before moving anything, so a bad payment never leaves a
    /// partial payout behind (the EVM frame revert covers it too, this keeps it explicit).
    pub fn batch_send(&mut self, sender: Address, call: IBankSend::batchSendCall) -> Result<bool> {
        ensure_not_blocked(sender)?;

        let mut total = U256::ZERO;
        for p in &call.payments {
            ensure_not_blocked(p.recipient)?;
            total = total
                .checked_add(p.amount)
                .ok_or_else(TempoPrecompileError::under_overflow)?;
        }
        let available = self.storage.balance(sender)?;
        if available < total {
            return Err(bankd_err(BankdError::insufficient_native_balance(
                sender, available, total,
            )));
        }

        for p in call.payments {
            move_native(sender, p.recipient, p.amount)?;
            self.emit_event(IBankSend::BankSend {
                sender,
                recipient: p.recipient,
                amount: p.amount,
            })?;
        }
        Ok(true)
    }
}

impl Precompile for BankSend {
    fn call(&mut self, calldata: &[u8], msg_sender: Address) -> PrecompileResult {
        if let Some(err) = charge_input_cost(&mut self.storage, calldata) {
            return err;
        }

        dispatch!(calldata, |call| match call {
            IBankSend::IBankSendCalls {
                send(call) => mutate(call, msg_sender, |s, c| self.send(s, c)),
                batchSend(call) => mutate(call, msg_sender, |s, c| self.batch_send(s, c)),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        bankd::{Authority, Compliance},
        storage::{PrecompileStorageProvider, StorageCtx, hashmap::HashMapStorageProvider},
        test_util::{assert_full_coverage, check_selector_coverage},
    };

    fn pay(recipient: Address, amount: u64) -> IBankSend::Payment {
        IBankSend::Payment {
            recipient,
            amount: U256::from(amount),
        }
    }

    #[test]
    fn test_bank_send_selector_coverage() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || {
            let mut b = BankSend::new();
            let unsupported = check_selector_coverage(
                &mut b,
                IBankSend::IBankSendCalls::SELECTORS,
                "IBankSend",
                IBankSend::IBankSendCalls::name_by_selector,
            );
            assert_full_coverage([unsupported]);
            Ok(())
        })
    }

    #[test]
    fn test_send() -> eyre::Result<()> {
        let (alice, bob) = (Address::random(), Address::random());
        let mut storage = HashMapStorageProvider::new(1);
        storage.set_balance(alice, U256::from(100))?;
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut b = BankSend::new();
            assert!(b.send(
                alice,
                IBankSend::sendCall {
                    recipient: bob,
                    amount: U256::from(40)
                }
            )?);
            assert_eq!(StorageCtx.balance(alice)?, U256::from(60));
            assert_eq!(StorageCtx.balance(bob)?, U256::from(40));

            // self-send is a no-op on balance
            b.send(
                alice,
                IBankSend::sendCall {
                    recipient: alice,
                    amount: U256::from(60),
                },
            )?;
            assert_eq!(StorageCtx.balance(alice)?, U256::from(60));
            assert_eq!(b.emitted_events().len(), 2);
            Ok(())
        })
    }

    #[test]
    fn test_batch_send_moves_all() -> eyre::Result<()> {
        let alice = Address::random();
        let (b1, b2) = (Address::random(), Address::random());
        let mut storage = HashMapStorageProvider::new(1);
        storage.set_balance(alice, U256::from(100))?;
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut b = BankSend::new();
            b.batch_send(
                alice,
                IBankSend::batchSendCall {
                    payments: vec![pay(b1, 30), pay(b2, 50), pay(b1, 20)],
                },
            )?;
            assert_eq!(StorageCtx.balance(alice)?, U256::ZERO);
            assert_eq!(StorageCtx.balance(b1)?, U256::from(50));
            assert_eq!(StorageCtx.balance(b2)?, U256::from(50));
            Ok(())
        })
    }

    #[test]
    fn test_batch_send_is_atomic() -> eyre::Result<()> {
        let owner = Address::random();
        let alice = Address::random();
        let (b1, b2) = (Address::random(), Address::random());
        let mut storage = HashMapStorageProvider::new(1);
        storage.set_balance(alice, U256::from(100))?;
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            Authority::new().initialize(owner)?;
            let mut b = BankSend::new();

            // total over balance: nothing moves even though the first payment alone fits
            let res = b.batch_send(
                alice,
                IBankSend::batchSendCall {
                    payments: vec![pay(b1, 60), pay(b2, 41)],
                },
            );
            assert_eq!(
                res.unwrap_err(),
                bankd_err(BankdError::insufficient_native_balance(
                    alice,
                    U256::from(100),
                    U256::from(101)
                ))
            );

            // a blocked recipient late in the batch: nothing moves
            Compliance::new().freeze(owner, b2)?;
            let res = b.batch_send(
                alice,
                IBankSend::batchSendCall {
                    payments: vec![pay(b1, 10), pay(b2, 10)],
                },
            );
            assert_eq!(res.unwrap_err(), bankd_err(BankdError::account_blocked(b2)));

            // amounts that overflow when summed
            let res = b.batch_send(
                alice,
                IBankSend::batchSendCall {
                    payments: vec![
                        IBankSend::Payment {
                            recipient: b1,
                            amount: U256::MAX,
                        },
                        pay(b1, 1),
                    ],
                },
            );
            assert_eq!(res.unwrap_err(), TempoPrecompileError::under_overflow());

            assert_eq!(StorageCtx.balance(alice)?, U256::from(100));
            assert_eq!(StorageCtx.balance(b1)?, U256::ZERO);
            assert_eq!(StorageCtx.balance(b2)?, U256::ZERO);
            assert!(b.emitted_events().is_empty());
            Ok(())
        })
    }

    #[test]
    fn test_frozen_sender_cannot_send() -> eyre::Result<()> {
        let owner = Address::random();
        let (alice, bob) = (Address::random(), Address::random());
        let mut storage = HashMapStorageProvider::new(1);
        storage.set_balance(alice, U256::from(100))?;
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            Authority::new().initialize(owner)?;
            Compliance::new().add_sanctioned(owner, alice)?;
            let res = BankSend::new().send(
                alice,
                IBankSend::sendCall {
                    recipient: bob,
                    amount: U256::from(1),
                },
            );
            assert_eq!(
                res.unwrap_err(),
                bankd_err(BankdError::account_blocked(alice))
            );
            assert_eq!(StorageCtx.balance(alice)?, U256::from(100));
            Ok(())
        })
    }
}
