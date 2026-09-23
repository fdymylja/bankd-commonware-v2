//! bankd precompile ABIs: Authority, Native, Compliance and BankSend.
//!
//! Addresses match bankd v1 (ASCII tag hex-encoded into the address) so Solidity callers and
//! frontends keep their constants. Authority is new in v2.

use alloy_primitives::{Address, address};

pub use IBankd::IBankdErrors as BankdError;

/// Authority ("AUTH"): rotatable admin every bankd precompile checks against.
pub const AUTHORITY_ADDRESS: Address = address!("0x0000000000000000000000000000000041555448");
/// Native ("ERC20"): native BRL mint/burn + bank registry.
pub const NATIVE_ADDRESS: Address = address!("0x0000000000000000000000000000004552433230");
/// Compliance ("CMPLY"): freeze/sanctions registry + seize.
pub const COMPLIANCE_ADDRESS: Address = address!("0x000000000000000000000000000000434D504C59");
/// BankSend ("BANKSEND"): native BRL send and atomic batch payroll.
pub const BANK_SEND_ADDRESS: Address = address!("0x00000000000000000000000042414E4B53454E44");

crate::sol! {
    /// Errors shared by every bankd precompile. Each interface below re-declares the ones it can
    /// return so its ABI is self-contained; the selectors are identical.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface IBankd {
        error NotOwner();
        error NotPendingOwner();
        error NotMinter();
        error ZeroAddress();
        error EmptyBankId();
        error BankAlreadyRegistered();
        error BridgeAlreadyRegistered();
        error AccountBlocked(address account);
        error InsufficientNativeBalance(address account, uint256 available, uint256 required);
    }
}

crate::sol! {
    /// Rotatable admin authority with two-step ownership transfer.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface IAuthority {
        function owner() external view returns (address);
        function pendingOwner() external view returns (address);

        /// Starts a transfer. `newOwner` must call `acceptOwnership` to finish it.
        function transferOwnership(address newOwner) external;
        function acceptOwnership() external;
        function cancelTransferOwnership() external;

        event OwnershipTransferStarted(address indexed owner, address pendingOwner);
        event OwnershipTransferred(address indexed newOwner, address previousOwner);
        event OwnershipTransferCanceled(address indexed owner, address pendingOwner);

        error NotOwner();
        error NotPendingOwner();
        error ZeroAddress();
    }
}

crate::sol! {
    /// Native BRL mint/burn and the hub-spoke bank registry.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface INative {
        function mint(address to, uint256 value) external returns (bool success);
        function burn(address from, uint256 value) external returns (bool success);

        function setMinter(address minter, bool allowed) external;
        function isMinter(address account) external view returns (bool);

        function registerBank(string calldata bankId, address bridge) external;
        function getBankByBridge(address bridge) external view returns (string memory bankId);

        event NativeMint(address indexed caller, address to, uint256 value);
        event NativeBurn(address indexed caller, address from, uint256 value);
        event NativeSetMinter(address indexed caller, address minter, bool allowed);
        event NativeRegisterBank(address indexed caller, string bankId, address bridge);

        error NotOwner();
        error NotMinter();
        error ZeroAddress();
        error EmptyBankId();
        error BankAlreadyRegistered();
        error BridgeAlreadyRegistered();
        error AccountBlocked(address account);
        error InsufficientNativeBalance(address account, uint256 available, uint256 required);
    }
}

crate::sol! {
    /// Protocol-level freeze and sanctions registry.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface ICompliance {
        function freeze(address account) external;
        function unfreeze(address account) external;
        function addSanctioned(address account) external;
        function removeSanctioned(address account) external;

        /// Moves native BRL out of `from` even when it's frozen or sanctioned.
        function seize(address from, address to, uint256 amount) external;

        function isFrozen(address account) external view returns (bool);
        function isSanctioned(address account) external view returns (bool);
        /// True when the account is frozen or sanctioned.
        function isBlocked(address account) external view returns (bool);

        event ComplianceFreeze(address indexed caller, address account);
        event ComplianceUnfreeze(address indexed caller, address account);
        event ComplianceAddSanctioned(address indexed caller, address account);
        event ComplianceRemoveSanctioned(address indexed caller, address account);
        event ComplianceSeize(address indexed caller, address from, address to, uint256 amount);

        error NotOwner();
        error ZeroAddress();
        error AccountBlocked(address account);
        error InsufficientNativeBalance(address account, uint256 available, uint256 required);
    }
}

crate::sol! {
    /// Native BRL sends from the caller, including atomic batch payroll.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface IBankSend {
        struct Payment {
            address recipient;
            uint256 amount;
        }

        function send(address recipient, uint256 amount) external returns (bool success);
        /// All or nothing: any failing payment reverts the whole batch.
        function batchSend(Payment[] calldata payments) external returns (bool success);

        event BankSend(address indexed sender, address recipient, uint256 amount);

        error AccountBlocked(address account);
        error InsufficientNativeBalance(address account, uint256 available, uint256 required);
    }
}
