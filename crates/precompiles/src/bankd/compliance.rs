//! Compliance precompile: protocol-level freeze and sanctions registry, plus seize.
//!
//! Both flags live in one packed slot per account so the txpool and the handler can answer
//! [`is_blocked`] with a single SLOAD.

use super::{Authority, bankd_err, move_native};
use crate::{
    Precompile, charge_input_cost, dispatch,
    error::Result,
    mutate_void,
    storage::{Handler, Mapping},
    view,
};
use alloy::primitives::{Address, U256};
use revm::precompile::PrecompileResult;
use tempo_contracts::precompiles::{BankdError, COMPLIANCE_ADDRESS, ICompliance};
use tempo_precompiles_macros::contract;

/// Status bit: account is frozen.
pub const FROZEN: u8 = 1 << 0;
/// Status bit: account is sanctioned.
pub const SANCTIONED: u8 = 1 << 1;

/// Storage layout:
/// ```solidity
/// contract Compliance {
///     mapping(address => uint8) status;  // slot 0, FROZEN | SANCTIONED bits
/// }
/// ```
#[contract(addr = COMPLIANCE_ADDRESS)]
pub struct Compliance {
    status: Mapping<Address, u8>,
}

/// Returns true when `account` is frozen or sanctioned.
///
/// Must run inside a [`StorageCtx`](crate::storage::StorageCtx), e.g. the handler's
/// `StorageCtx::enter_evm` or the pool's `with_read_only_storage_ctx`.
pub fn is_blocked(account: Address) -> Result<bool> {
    Compliance::new().is_blocked(account)
}

/// Storage slot holding `account`'s status byte, for callers that read raw state
/// (`sload(COMPLIANCE_ADDRESS, slot)`) without entering a storage context.
pub fn status_slot(account: Address) -> U256 {
    Compliance::new().status[account].slot()
}

/// Interprets a raw status slot value read via [`status_slot`].
pub fn is_blocked_value(value: U256) -> bool {
    value & U256::from(FROZEN | SANCTIONED) != U256::ZERO
}

/// Fails with `AccountBlocked` if `account` is frozen or sanctioned.
pub fn ensure_not_blocked(account: Address) -> Result<()> {
    if is_blocked(account)? {
        return Err(bankd_err(BankdError::account_blocked(account)));
    }
    Ok(())
}

impl Compliance {
    /// Marks the precompile account as deployed. No other state to set up.
    pub fn initialize(&mut self) -> Result<()> {
        self.__initialize()
    }

    pub fn is_frozen(&self, account: Address) -> Result<bool> {
        Ok(self.status[account].read()? & FROZEN != 0)
    }

    pub fn is_sanctioned(&self, account: Address) -> Result<bool> {
        Ok(self.status[account].read()? & SANCTIONED != 0)
    }

    pub fn is_blocked(&self, account: Address) -> Result<bool> {
        Ok(self.status[account].read()? & (FROZEN | SANCTIONED) != 0)
    }

    fn set_flag(&mut self, sender: Address, account: Address, flag: u8, on: bool) -> Result<()> {
        Authority::new().require_owner(sender)?;
        if account.is_zero() {
            return Err(bankd_err(BankdError::zero_address()));
        }
        let status = self.status[account].read()?;
        let next = if on { status | flag } else { status & !flag };
        self.status[account].write(next)
    }

    pub fn freeze(&mut self, sender: Address, account: Address) -> Result<()> {
        self.set_flag(sender, account, FROZEN, true)?;
        self.emit_event(ICompliance::ComplianceFreeze {
            caller: sender,
            account,
        })
    }

    pub fn unfreeze(&mut self, sender: Address, account: Address) -> Result<()> {
        self.set_flag(sender, account, FROZEN, false)?;
        self.emit_event(ICompliance::ComplianceUnfreeze {
            caller: sender,
            account,
        })
    }

    pub fn add_sanctioned(&mut self, sender: Address, account: Address) -> Result<()> {
        self.set_flag(sender, account, SANCTIONED, true)?;
        self.emit_event(ICompliance::ComplianceAddSanctioned {
            caller: sender,
            account,
        })
    }

    pub fn remove_sanctioned(&mut self, sender: Address, account: Address) -> Result<()> {
        self.set_flag(sender, account, SANCTIONED, false)?;
        self.emit_event(ICompliance::ComplianceRemoveSanctioned {
            caller: sender,
            account,
        })
    }

    /// Admin moves native BRL out of `from`, skipping the freeze check on `from`. The
    /// destination still has to be clean so seized funds don't land in another blocked account.
    pub fn seize(&mut self, sender: Address, call: ICompliance::seizeCall) -> Result<()> {
        Authority::new().require_owner(sender)?;
        if call.from.is_zero() || call.to.is_zero() {
            return Err(bankd_err(BankdError::zero_address()));
        }
        ensure_not_blocked(call.to)?;
        move_native(call.from, call.to, call.amount)?;
        self.emit_event(ICompliance::ComplianceSeize {
            caller: sender,
            from: call.from,
            to: call.to,
            amount: call.amount,
        })
    }
}

impl Precompile for Compliance {
    fn call(&mut self, calldata: &[u8], msg_sender: Address) -> PrecompileResult {
        if let Some(err) = charge_input_cost(&mut self.storage, calldata) {
            return err;
        }

        dispatch!(calldata, |call| match call {
            ICompliance::IComplianceCalls {
                isFrozen(call) => view(call, |c| self.is_frozen(c.account)),
                isSanctioned(call) => view(call, |c| self.is_sanctioned(c.account)),
                isBlocked(call) => view(call, |c| self.is_blocked(c.account)),
                freeze(call) => mutate_void(call, msg_sender, |s, c| self.freeze(s, c.account)),
                unfreeze(call) => mutate_void(call, msg_sender, |s, c| self.unfreeze(s, c.account)),
                addSanctioned(call) => mutate_void(call, msg_sender, |s, c| self.add_sanctioned(s, c.account)),
                removeSanctioned(call) => mutate_void(call, msg_sender, |s, c| self.remove_sanctioned(s, c.account)),
                seize(call) => mutate_void(call, msg_sender, |s, c| self.seize(s, c)),
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

    fn setup(owner: Address) -> HashMapStorageProvider {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || Authority::new().initialize(owner)).unwrap();
        storage
    }

    #[test]
    fn test_compliance_selector_coverage() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || {
            let mut c = Compliance::new();
            let unsupported = check_selector_coverage(
                &mut c,
                ICompliance::IComplianceCalls::SELECTORS,
                "ICompliance",
                ICompliance::IComplianceCalls::name_by_selector,
            );
            assert_full_coverage([unsupported]);
            Ok(())
        })
    }

    #[test]
    fn test_admin_only() -> eyre::Result<()> {
        let owner = Address::random();
        let (rando, target) = (Address::random(), Address::random());
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || {
            let mut c = Compliance::new();
            let not_owner = bankd_err(BankdError::not_owner());
            assert_eq!(c.freeze(rando, target).unwrap_err(), not_owner);
            assert_eq!(c.unfreeze(rando, target).unwrap_err(), not_owner);
            assert_eq!(c.add_sanctioned(rando, target).unwrap_err(), not_owner);
            assert_eq!(c.remove_sanctioned(rando, target).unwrap_err(), not_owner);
            let seize = ICompliance::seizeCall {
                from: target,
                to: rando,
                amount: U256::ZERO,
            };
            assert_eq!(c.seize(rando, seize).unwrap_err(), not_owner);
            Ok(())
        })
    }

    #[test]
    fn test_freeze_and_sanction_flags() -> eyre::Result<()> {
        let owner = Address::random();
        let a = Address::random();
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || {
            let mut c = Compliance::new();
            assert!(!is_blocked(a)?);

            c.freeze(owner, a)?;
            assert!(c.is_frozen(a)?);
            assert!(!c.is_sanctioned(a)?);
            assert!(is_blocked(a)?);

            c.add_sanctioned(owner, a)?;
            c.unfreeze(owner, a)?;
            // still blocked, sanction is independent of freeze
            assert!(!c.is_frozen(a)?);
            assert!(c.is_sanctioned(a)?);
            assert!(is_blocked(a)?);
            assert_eq!(
                ensure_not_blocked(a).unwrap_err(),
                bankd_err(BankdError::account_blocked(a))
            );

            c.remove_sanctioned(owner, a)?;
            assert!(!is_blocked(a)?);
            ensure_not_blocked(a)?;

            assert_eq!(c.emitted_events().len(), 4);
            Ok(())
        })
    }

    #[test]
    fn test_raw_slot_matches_is_blocked() -> eyre::Result<()> {
        let owner = Address::random();
        let a = Address::random();
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || Compliance::new().freeze(owner, a))?;
        let raw = storage.sload(COMPLIANCE_ADDRESS, status_slot(a))?;
        assert!(is_blocked_value(raw));
        let clean = storage.sload(COMPLIANCE_ADDRESS, status_slot(Address::random()))?;
        assert!(!is_blocked_value(clean));
        Ok(())
    }

    #[test]
    fn test_seize_bypasses_freeze() -> eyre::Result<()> {
        let owner = Address::random();
        let (bad, treasury) = (Address::random(), Address::random());
        let mut storage = setup(owner);
        storage.set_balance(bad, U256::from(1_000))?;
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut c = Compliance::new();
            c.freeze(owner, bad)?;
            c.add_sanctioned(owner, bad)?;

            c.seize(
                owner,
                ICompliance::seizeCall {
                    from: bad,
                    to: treasury,
                    amount: U256::from(600),
                },
            )?;
            assert_eq!(StorageCtx.balance(bad)?, U256::from(400));
            assert_eq!(StorageCtx.balance(treasury)?, U256::from(600));

            // can't take more than is there
            let over = c
                .seize(
                    owner,
                    ICompliance::seizeCall {
                        from: bad,
                        to: treasury,
                        amount: U256::from(401),
                    },
                )
                .unwrap_err();
            assert_eq!(
                over,
                bankd_err(BankdError::insufficient_native_balance(
                    bad,
                    U256::from(400),
                    U256::from(401)
                ))
            );

            // can't seize into a blocked account
            let other = Address::random();
            c.freeze(owner, other)?;
            let blocked = c
                .seize(
                    owner,
                    ICompliance::seizeCall {
                        from: bad,
                        to: other,
                        amount: U256::from(1),
                    },
                )
                .unwrap_err();
            assert_eq!(blocked, bankd_err(BankdError::account_blocked(other)));
            Ok(())
        })
    }
}
