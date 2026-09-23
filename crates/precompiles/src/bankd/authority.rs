//! Authority precompile: the rotatable admin every bankd precompile checks against.
//!
//! Replaces bankd v1's `x/authority`. The owner is written into genesis storage via
//! [`Authority::initialize`] and rotated with a two-step transfer.

use super::bankd_err;
use crate::{
    Precompile, charge_input_cost, dispatch, error::Result, mutate_void, storage::Handler, view,
};
use alloy::primitives::Address;
use revm::precompile::PrecompileResult;
use tempo_contracts::precompiles::{AUTHORITY_ADDRESS, BankdError, IAuthority};
use tempo_precompiles_macros::contract;

/// Storage layout:
/// ```solidity
/// contract Authority {
///     address owner;         // slot 0
///     address pendingOwner;  // slot 1
/// }
/// ```
#[contract(addr = AUTHORITY_ADDRESS)]
pub struct Authority {
    owner: Address,
    pending_owner: Address,
}

impl Authority {
    /// Sets the initial owner. Called once when building genesis.
    pub fn initialize(&mut self, owner: Address) -> Result<()> {
        if owner.is_zero() {
            return Err(bankd_err(BankdError::zero_address()));
        }
        self.__initialize()?;
        self.owner.write(owner)
    }

    /// Returns the current owner. Zero means uninitialized, and then every admin call fails.
    pub fn owner(&self) -> Result<Address> {
        self.owner.read()
    }

    /// Returns the pending owner of an in-flight transfer, or zero.
    pub fn pending_owner(&self) -> Result<Address> {
        self.pending_owner.read()
    }

    /// Fails with `NotOwner` unless `sender` is the current owner.
    pub fn require_owner(&self, sender: Address) -> Result<()> {
        let owner = self.owner()?;
        if owner.is_zero() || owner != sender {
            return Err(bankd_err(BankdError::not_owner()));
        }
        Ok(())
    }

    /// Starts a two-step transfer to `newOwner`. Overwrites any pending transfer.
    pub fn transfer_ownership(
        &mut self,
        sender: Address,
        call: IAuthority::transferOwnershipCall,
    ) -> Result<()> {
        self.require_owner(sender)?;
        if call.newOwner.is_zero() {
            return Err(bankd_err(BankdError::zero_address()));
        }
        self.pending_owner.write(call.newOwner)?;
        self.emit_event(IAuthority::OwnershipTransferStarted {
            owner: sender,
            pendingOwner: call.newOwner,
        })
    }

    /// Finishes a transfer. Only the pending owner can call it.
    pub fn accept_ownership(&mut self, sender: Address) -> Result<()> {
        let pending = self.pending_owner()?;
        if pending.is_zero() || pending != sender {
            return Err(bankd_err(BankdError::not_pending_owner()));
        }
        let previous = self.owner()?;
        self.owner.write(sender)?;
        self.pending_owner.write(Address::ZERO)?;
        self.emit_event(IAuthority::OwnershipTransferred {
            newOwner: sender,
            previousOwner: previous,
        })
    }

    /// Drops a pending transfer. Only the current owner can call it.
    pub fn cancel_transfer_ownership(&mut self, sender: Address) -> Result<()> {
        self.require_owner(sender)?;
        let pending = self.pending_owner()?;
        self.pending_owner.write(Address::ZERO)?;
        self.emit_event(IAuthority::OwnershipTransferCanceled {
            owner: sender,
            pendingOwner: pending,
        })
    }
}

impl Precompile for Authority {
    fn call(&mut self, calldata: &[u8], msg_sender: Address) -> PrecompileResult {
        if let Some(err) = charge_input_cost(&mut self.storage, calldata) {
            return err;
        }

        dispatch!(calldata, |call| match call {
            IAuthority::IAuthorityCalls {
                owner(call) => view(call, |_| self.owner()),
                pendingOwner(call) => view(call, |_| self.pending_owner()),
                transferOwnership(call) => mutate_void(call, msg_sender, |s, c| self.transfer_ownership(s, c)),
                acceptOwnership(call) => mutate_void(call, msg_sender, |s, _| self.accept_ownership(s)),
                cancelTransferOwnership(call) => mutate_void(call, msg_sender, |s, _| self.cancel_transfer_ownership(s)),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        error::TempoPrecompileError,
        storage::{StorageCtx, hashmap::HashMapStorageProvider},
        test_util::{assert_full_coverage, check_selector_coverage},
    };

    fn not_owner() -> TempoPrecompileError {
        bankd_err(BankdError::not_owner())
    }

    #[test]
    fn test_authority_selector_coverage() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || {
            let mut auth = Authority::new();
            let unsupported = check_selector_coverage(
                &mut auth,
                IAuthority::IAuthorityCalls::SELECTORS,
                "IAuthority",
                IAuthority::IAuthorityCalls::name_by_selector,
            );
            assert_full_coverage([unsupported]);
            Ok(())
        })
    }

    #[test]
    fn test_initialize_rejects_zero_owner() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || {
            let err = Authority::new().initialize(Address::ZERO).unwrap_err();
            assert_eq!(err, bankd_err(BankdError::zero_address()));
            Ok(())
        })
    }

    #[test]
    fn test_uninitialized_rejects_everyone() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || {
            let auth = Authority::new();
            assert_eq!(auth.require_owner(Address::ZERO).unwrap_err(), not_owner());
            assert_eq!(
                auth.require_owner(Address::random()).unwrap_err(),
                not_owner()
            );
            Ok(())
        })
    }

    #[test]
    fn test_two_step_transfer() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        let (owner, next, rando) = (Address::random(), Address::random(), Address::random());
        StorageCtx::enter(&mut storage, || {
            let mut auth = Authority::new();
            auth.initialize(owner)?;
            assert_eq!(auth.owner()?, owner);

            // only the owner can start a transfer
            let call = IAuthority::transferOwnershipCall { newOwner: next };
            assert_eq!(
                auth.transfer_ownership(rando, call.clone()).unwrap_err(),
                not_owner()
            );
            auth.transfer_ownership(owner, call)?;
            assert_eq!(auth.pending_owner()?, next);
            // owner doesn't change until accepted
            assert_eq!(auth.owner()?, owner);

            // only the pending owner can accept
            assert_eq!(
                auth.accept_ownership(rando).unwrap_err(),
                bankd_err(BankdError::not_pending_owner())
            );
            auth.accept_ownership(next)?;
            assert_eq!(auth.owner()?, next);
            assert_eq!(auth.pending_owner()?, Address::ZERO);

            // old owner lost its powers
            assert_eq!(auth.require_owner(owner).unwrap_err(), not_owner());
            auth.require_owner(next)?;

            auth.assert_emitted_events(vec![
                IAuthority::IAuthorityEvents::OwnershipTransferStarted(
                    IAuthority::OwnershipTransferStarted {
                        owner,
                        pendingOwner: next,
                    },
                ),
                IAuthority::IAuthorityEvents::OwnershipTransferred(
                    IAuthority::OwnershipTransferred {
                        newOwner: next,
                        previousOwner: owner,
                    },
                ),
            ]);
            Ok(())
        })
    }

    #[test]
    fn test_cancel_transfer() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        let (owner, next) = (Address::random(), Address::random());
        StorageCtx::enter(&mut storage, || {
            let mut auth = Authority::new();
            auth.initialize(owner)?;
            auth.transfer_ownership(owner, IAuthority::transferOwnershipCall { newOwner: next })?;

            assert_eq!(
                auth.cancel_transfer_ownership(next).unwrap_err(),
                not_owner()
            );
            auth.cancel_transfer_ownership(owner)?;
            assert_eq!(auth.pending_owner()?, Address::ZERO);

            // a canceled transfer can't be accepted
            assert_eq!(
                auth.accept_ownership(next).unwrap_err(),
                bankd_err(BankdError::not_pending_owner())
            );
            assert_eq!(auth.owner()?, owner);
            Ok(())
        })
    }

    #[test]
    fn test_transfer_to_zero_rejected() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        let owner = Address::random();
        StorageCtx::enter(&mut storage, || {
            let mut auth = Authority::new();
            auth.initialize(owner)?;
            let err = auth
                .transfer_ownership(
                    owner,
                    IAuthority::transferOwnershipCall {
                        newOwner: Address::ZERO,
                    },
                )
                .unwrap_err();
            assert_eq!(err, bankd_err(BankdError::zero_address()));
            Ok(())
        })
    }
}
