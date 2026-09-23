//! Native precompile: mints and burns native BRL (the gas coin) and keeps the bank registry.
//!
//! Balances are edited directly in the EVM journal, so a revert anywhere up the call stack
//! rolls the mint/burn back with it.

use super::{Authority, bankd_err, compliance::ensure_not_blocked};
use crate::{
    Precompile, charge_input_cost, dispatch,
    error::{Result, TempoPrecompileError},
    mutate, mutate_void,
    storage::{Handler, Mapping},
    view,
};
use alloy::primitives::{Address, B256, keccak256};
use revm::precompile::PrecompileResult;
pub use tempo_contracts::precompiles::INative;
use tempo_contracts::precompiles::{BankdError, NATIVE_ADDRESS};
use tempo_precompiles_macros::contract;

/// Storage layout:
/// ```solidity
/// contract Native {
///     mapping(address => bool) minters;          // slot 0
///     mapping(address => string) bankByBridge;   // slot 1
///     mapping(bytes32 => address) bridgeByBank;  // slot 2, keccak256(bankId) => bridge
/// }
/// ```
#[contract(addr = NATIVE_ADDRESS)]
pub struct Native {
    minters: Mapping<Address, bool>,
    bank_by_bridge: Mapping<Address, String>,
    bridge_by_bank: Mapping<B256, Address>,
}

impl Native {
    /// Marks the precompile account as deployed. Minters are added later by the owner.
    pub fn initialize(&mut self) -> Result<()> {
        self.__initialize()
    }

    pub fn is_minter(&self, account: Address) -> Result<bool> {
        self.minters[account].read()
    }

    /// Owner or a whitelisted minter.
    fn require_mint_authority(&self, sender: Address) -> Result<()> {
        if self.is_minter(sender)? {
            return Ok(());
        }
        Authority::new()
            .require_owner(sender)
            .map_err(|_| bankd_err(BankdError::not_minter()))
    }

    /// Mints native BRL to `to`. Blocked accounts can't receive new money.
    pub fn mint(&mut self, sender: Address, call: INative::mintCall) -> Result<bool> {
        self.require_mint_authority(sender)?;
        if call.to.is_zero() {
            return Err(bankd_err(BankdError::zero_address()));
        }
        ensure_not_blocked(call.to)?;

        let balance = self.storage.balance(call.to)?;
        let next = balance
            .checked_add(call.value)
            .ok_or_else(TempoPrecompileError::under_overflow)?;
        self.storage.set_balance(call.to, next)?;

        self.emit_event(INative::NativeMint {
            caller: sender,
            to: call.to,
            value: call.value,
        })?;
        Ok(true)
    }

    /// Burns native BRL from `from`. No compliance check, burning a blocked account's funds is
    /// an admin action like seize.
    pub fn burn(&mut self, sender: Address, call: INative::burnCall) -> Result<bool> {
        self.require_mint_authority(sender)?;

        let available = self.storage.balance(call.from)?;
        let Some(next) = available.checked_sub(call.value) else {
            return Err(bankd_err(BankdError::insufficient_native_balance(
                call.from, available, call.value,
            )));
        };
        self.storage.set_balance(call.from, next)?;

        self.emit_event(INative::NativeBurn {
            caller: sender,
            from: call.from,
            value: call.value,
        })?;
        Ok(true)
    }

    pub fn set_minter(&mut self, sender: Address, call: INative::setMinterCall) -> Result<()> {
        Authority::new().require_owner(sender)?;
        if call.minter.is_zero() {
            return Err(bankd_err(BankdError::zero_address()));
        }
        self.minters[call.minter].write(call.allowed)?;
        self.emit_event(INative::NativeSetMinter {
            caller: sender,
            minter: call.minter,
            allowed: call.allowed,
        })
    }

    /// Registers a commercial bank and its bridge. Both sides must be unused.
    pub fn register_bank(
        &mut self,
        sender: Address,
        call: INative::registerBankCall,
    ) -> Result<()> {
        Authority::new().require_owner(sender)?;
        if call.bankId.is_empty() {
            return Err(bankd_err(BankdError::empty_bank_id()));
        }
        if call.bridge.is_zero() {
            return Err(bankd_err(BankdError::zero_address()));
        }
        let bank_key = keccak256(call.bankId.as_bytes());
        if !self.bridge_by_bank[bank_key].read()?.is_zero() {
            return Err(bankd_err(BankdError::bank_already_registered()));
        }
        if !self.bank_by_bridge[call.bridge].read()?.is_empty() {
            return Err(bankd_err(BankdError::bridge_already_registered()));
        }

        self.bridge_by_bank[bank_key].write(call.bridge)?;
        self.bank_by_bridge[call.bridge].write(call.bankId.clone())?;
        self.emit_event(INative::NativeRegisterBank {
            caller: sender,
            bankId: call.bankId,
            bridge: call.bridge,
        })
    }

    /// Returns the bank id for `bridge`, or an empty string if it isn't registered.
    pub fn get_bank_by_bridge(&self, bridge: Address) -> Result<String> {
        self.bank_by_bridge[bridge].read()
    }
}

impl Precompile for Native {
    fn call(&mut self, calldata: &[u8], msg_sender: Address) -> PrecompileResult {
        if let Some(err) = charge_input_cost(&mut self.storage, calldata) {
            return err;
        }

        dispatch!(calldata, |call| match call {
            INative::INativeCalls {
                isMinter(call) => view(call, |c| self.is_minter(c.account)),
                getBankByBridge(call) => view(call, |c| self.get_bank_by_bridge(c.bridge)),
                mint(call) => mutate(call, msg_sender, |s, c| self.mint(s, c)),
                burn(call) => mutate(call, msg_sender, |s, c| self.burn(s, c)),
                setMinter(call) => mutate_void(call, msg_sender, |s, c| self.set_minter(s, c)),
                registerBank(call) => mutate_void(call, msg_sender, |s, c| self.register_bank(s, c)),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        bankd::Compliance,
        storage::{StorageCtx, hashmap::HashMapStorageProvider},
        test_util::{assert_full_coverage, check_selector_coverage},
    };
    use alloy::primitives::U256;
    use alloy::sol_types::SolCall;

    fn setup(owner: Address) -> HashMapStorageProvider {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || Authority::new().initialize(owner)).unwrap();
        storage
    }

    #[test]
    fn test_native_selector_coverage() -> eyre::Result<()> {
        let mut storage = HashMapStorageProvider::new(1);
        StorageCtx::enter(&mut storage, || {
            let mut n = Native::new();
            let unsupported = check_selector_coverage(
                &mut n,
                INative::INativeCalls::SELECTORS,
                "INative",
                INative::INativeCalls::name_by_selector,
            );
            assert_full_coverage([unsupported]);
            Ok(())
        })
    }

    #[test]
    fn test_mint_and_burn_change_balance() -> eyre::Result<()> {
        let owner = Address::random();
        let user = Address::random();
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut n = Native::new();
            assert!(n.mint(
                owner,
                INative::mintCall {
                    to: user,
                    value: U256::from(500)
                }
            )?);
            assert_eq!(StorageCtx.balance(user)?, U256::from(500));

            assert!(n.burn(
                owner,
                INative::burnCall {
                    from: user,
                    value: U256::from(200)
                }
            )?);
            assert_eq!(StorageCtx.balance(user)?, U256::from(300));

            let over = n
                .burn(
                    owner,
                    INative::burnCall {
                        from: user,
                        value: U256::from(301),
                    },
                )
                .unwrap_err();
            assert_eq!(
                over,
                bankd_err(BankdError::insufficient_native_balance(
                    user,
                    U256::from(300),
                    U256::from(301)
                ))
            );

            n.assert_emitted_events(vec![
                INative::INativeEvents::NativeMint(INative::NativeMint {
                    caller: owner,
                    to: user,
                    value: U256::from(500),
                }),
                INative::INativeEvents::NativeBurn(INative::NativeBurn {
                    caller: owner,
                    from: user,
                    value: U256::from(200),
                }),
            ]);
            Ok(())
        })
    }

    #[test]
    fn test_mint_overflow_reverts() -> eyre::Result<()> {
        let owner = Address::random();
        let user = Address::random();
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut n = Native::new();
            n.mint(
                owner,
                INative::mintCall {
                    to: user,
                    value: U256::MAX,
                },
            )?;
            let res = n.mint(
                owner,
                INative::mintCall {
                    to: user,
                    value: U256::from(1),
                },
            );
            assert_eq!(res.unwrap_err(), TempoPrecompileError::under_overflow());
            Ok(())
        })
    }

    #[test]
    fn test_mint_auth() -> eyre::Result<()> {
        let owner = Address::random();
        let (minter, rando, user) = (Address::random(), Address::random(), Address::random());
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut n = Native::new();
            let mint = INative::mintCall {
                to: user,
                value: U256::from(1),
            };

            assert_eq!(
                n.mint(rando, mint.clone()).unwrap_err(),
                bankd_err(BankdError::not_minter())
            );
            assert_eq!(
                n.burn(
                    rando,
                    INative::burnCall {
                        from: user,
                        value: U256::ZERO
                    }
                )
                .unwrap_err(),
                bankd_err(BankdError::not_minter())
            );

            // only the owner manages minters
            let set = INative::setMinterCall {
                minter,
                allowed: true,
            };
            assert_eq!(
                n.set_minter(rando, set.clone()).unwrap_err(),
                bankd_err(BankdError::not_owner())
            );
            n.set_minter(owner, set)?;
            assert!(n.is_minter(minter)?);
            n.mint(minter, mint.clone())?;
            // the minter (e.g. the ICS20 adapter) can burn too
            n.mint(minter, mint.clone())?;
            assert!(n.burn(
                minter,
                INative::burnCall {
                    from: user,
                    value: U256::from(1),
                },
            )?);

            n.set_minter(
                owner,
                INative::setMinterCall {
                    minter,
                    allowed: false,
                },
            )?;
            assert_eq!(
                n.mint(minter, mint).unwrap_err(),
                bankd_err(BankdError::not_minter())
            );
            assert_eq!(StorageCtx.balance(user)?, U256::from(1));
            Ok(())
        })
    }

    #[test]
    fn test_mint_to_blocked_rejected() -> eyre::Result<()> {
        let owner = Address::random();
        let user = Address::random();
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            Compliance::new().freeze(owner, user)?;
            let res = Native::new().mint(
                owner,
                INative::mintCall {
                    to: user,
                    value: U256::from(1),
                },
            );
            assert_eq!(
                res.unwrap_err(),
                bankd_err(BankdError::account_blocked(user))
            );
            assert_eq!(StorageCtx.balance(user)?, U256::ZERO);
            Ok(())
        })
    }

    #[test]
    fn test_bank_registry() -> eyre::Result<()> {
        let owner = Address::random();
        let (bridge, bridge2) = (Address::random(), Address::random());
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut n = Native::new();
            let reg = |id: &str, bridge| INative::registerBankCall {
                bankId: id.to_string(),
                bridge,
            };

            assert_eq!(
                n.register_bank(Address::random(), reg("itau", bridge))
                    .unwrap_err(),
                bankd_err(BankdError::not_owner())
            );
            assert_eq!(
                n.register_bank(owner, reg("", bridge)).unwrap_err(),
                bankd_err(BankdError::empty_bank_id())
            );
            assert_eq!(
                n.register_bank(owner, reg("itau", Address::ZERO))
                    .unwrap_err(),
                bankd_err(BankdError::zero_address())
            );

            assert_eq!(n.get_bank_by_bridge(bridge)?, "");
            n.register_bank(owner, reg("itau", bridge))?;
            assert_eq!(n.get_bank_by_bridge(bridge)?, "itau");

            assert_eq!(
                n.register_bank(owner, reg("itau", bridge2)).unwrap_err(),
                bankd_err(BankdError::bank_already_registered())
            );
            assert_eq!(
                n.register_bank(owner, reg("bradesco", bridge)).unwrap_err(),
                bankd_err(BankdError::bridge_already_registered())
            );
            Ok(())
        })
    }

    #[test]
    fn test_dispatch_mint_returns_true() -> eyre::Result<()> {
        let owner = Address::random();
        let user = Address::random();
        let mut storage = setup(owner);
        StorageCtx::enter(&mut storage, || -> eyre::Result<()> {
            let mut n = Native::new();
            let calldata = INative::mintCall {
                to: user,
                value: U256::from(7),
            }
            .abi_encode();
            let out = n.call(&calldata, owner)?;
            assert!(out.status.is_success());
            assert!(INative::mintCall::abi_decode_returns(&out.bytes)?);
            assert_eq!(StorageCtx.balance(user)?, U256::from(7));

            let denied = n.call(&calldata, Address::random())?;
            assert!(denied.status.is_revert());
            Ok(())
        })
    }
}
