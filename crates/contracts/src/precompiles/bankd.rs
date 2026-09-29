//! bankd precompile ABIs: Authority, Native, Compliance, BankSend and Shield.
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
/// Shield ("SHLD"): EVM to shielded pool deposits. Its storage also holds the shieldd root.
pub const SHIELD_ADDRESS: Address = address!("0x0000000000000000000000000000000053484C44");
/// TendermintVerifier ("TMVER"): stateless CometBFT light client verification.
pub const TENDERMINT_VERIFIER_ADDRESS: Address =
    address!("0x000000000000000000000000000000544D564552");
/// Cw ("CWASM"): CosmWasm runtime. Contract state lives in this account's storage.
pub const CW_ADDRESS: Address = address!("0x000000000000000000000000000000435741534D");
/// Shieldd denom for native BRL (18 decimals, atto-BRL).
pub const SHIELD_BRL_DENOM: &str = "abrl";

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
        error ZeroDeposit();
        error EmptyRecipient();
        error NotPayable();
        error CwFailed(string reason);
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

crate::sol! {
    /// Deposits native BRL into the shielded pool. The block executor forwards each
    /// `ShielddDeposit` to shieldd after the tx succeeds, and refunds it if shieldd rejects it.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface IShield {
        /// Escrows `msg.value` under this address and mints a shielded note to `recipient`.
        function deposit(string calldata recipient) external payable returns (bool success);
        /// Shieldd app hash and height written by the last block.
        function getLastCommitment() external view returns (bytes32 root, uint64 height);

        event ShielddDeposit(address indexed sender, string recipient, uint256 amount, string denom);

        error ZeroDeposit();
        error EmptyRecipient();
        error NotPayable();
        error AccountBlocked(address account);
    }
}

crate::sol! {
    /// CosmWasm runtime. Contracts are addressed by 20 byte EVM addresses, messages are JSON.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface ICw {
        /// Validates and stores a wasm blob in one tx. Returns its code id. A tx is gas capped,
        /// so big blobs go through `uploadCode` + `finalizeCode` instead.
        function storeCode(bytes calldata wasm) external returns (uint64 codeId);
        /// Appends a chunk to an unfinished upload. `codeId` 0 starts a new one. Only the
        /// uploader can append.
        function uploadCode(uint64 codeId, bytes calldata chunk) external returns (uint64 id);
        /// Validates the uploaded chunks as one wasm blob and makes the code usable.
        function finalizeCode(uint64 codeId) external;
        /// Runs `instantiate` on a new contract. `data` is the response data.
        function instantiate(uint64 codeId, bytes calldata msg) external returns (address contractAddress, bytes memory data);
        /// Runs `execute`. Returns the response data.
        function execute(address contractAddress, bytes calldata msg) external returns (bytes memory data);
        /// Runs `query`. Returns the raw response (JSON).
        function query(address contractAddress, bytes calldata msg) external view returns (bytes memory response);
        function isContract(address account) external view returns (bool);
        function contractInfo(address contractAddress) external view returns (uint64 codeId, address creator);

        event CodeStored(uint64 indexed codeId, address indexed creator, bytes32 codeHash);
        event Instantiated(address indexed contractAddress, uint64 indexed codeId, address indexed creator);
        /// One per wasm event. The response attributes come as the `wasm` event.
        event WasmEvent(address indexed contractAddress, string eventType, string[] keys, string[] values);

        error CwFailed(string reason);
    }
}
