# modules progress (E3)

Branch `reece/v2-modules`. Nothing's committed yet.

## What's there

Four precompiles live in `crates/precompiles/src/bankd/`, and their ABIs are in `crates/contracts/src/precompiles/bankd.rs`. They're all registered in `extend_tempo_precompiles` and active from genesis, with no hardfork gate. They're also listed in `SYSTEM_PRECOMPILES` at `Genesis`.

| precompile | address | file |
|-|-|-|
| Authority | `0x0000000000000000000000000000000041555448` ("AUTH") | `bankd/authority.rs` |
| Native | `0x0000000000000000000000000000004552433230` | `bankd/native.rs` |
| Compliance | `0x000000000000000000000000000000434D504C59` | `bankd/compliance.rs` |
| BankSend | `0x00000000000000000000000042414E4B53454E44` | `bankd/bank_send.rs` |

Genesis: `xtask generate-genesis` now calls `initialize_bankd_modules(validator_admin, native_minters)`. That writes the Authority owner and sets the `0xef` marker code on all four addresses, so Solidity's extcodesize check passes.

### Contract as minter (ICS20 native adapter)

`mint(address,uint256) returns (bool)` and `burn(address,uint256) returns (bool)` keep bankd v1's exact ABI and selectors, so the bridge's `INative.sol` works unchanged. Any address with `isMinter == true` can call both, contracts included (the check is on `msg.sender`, meaning the adapter contract itself, not tx.origin). Delegatecall into the precompile is rejected by tempo's wrapper, so the adapter has to `call` it.

There are two ways to allow the adapter:

- **At genesis:** `tempo-xtask generate-genesis ... --native-minters 0xAdapter[,0xOther]`. Each address gets `setMinter(addr, true)` from the Authority owner (`--validator-admin`, or the first generated account). The adapter's address has to be known up front, so deploy it at a fixed genesis address (or a CREATE2/CreateX address).
- **After genesis:** the Authority owner sends `Native.setMinter(adapter, true)`.

### ABIs

```solidity
interface IAuthority {
    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;   // owner only, starts 2-step
    function acceptOwnership() external;                     // pending owner only
    function cancelTransferOwnership() external;             // owner only
    event OwnershipTransferStarted(address indexed owner, address pendingOwner);
    event OwnershipTransferred(address indexed newOwner, address previousOwner);
    event OwnershipTransferCanceled(address indexed owner, address pendingOwner);
}

interface INative {
    function mint(address to, uint256 value) external returns (bool);   // owner or minter
    function burn(address from, uint256 value) external returns (bool); // owner or minter
    function setMinter(address minter, bool allowed) external;          // owner
    function isMinter(address account) external view returns (bool);
    function registerBank(string calldata bankId, address bridge) external; // owner
    function getBankByBridge(address bridge) external view returns (string memory bankId); // "" if none
    event NativeMint(address indexed caller, address to, uint256 value);
    event NativeBurn(address indexed caller, address from, uint256 value);
    event NativeSetMinter(address indexed caller, address minter, bool allowed);
    event NativeRegisterBank(address indexed caller, string bankId, address bridge);
}

interface ICompliance {
    function freeze(address account) external;            // owner
    function unfreeze(address account) external;          // owner
    function addSanctioned(address account) external;     // owner
    function removeSanctioned(address account) external;  // owner
    function seize(address from, address to, uint256 amount) external; // owner, ignores freeze on `from`
    function isFrozen(address account) external view returns (bool);
    function isSanctioned(address account) external view returns (bool);
    function isBlocked(address account) external view returns (bool); // frozen || sanctioned
    event ComplianceFreeze(address indexed caller, address account);
    event ComplianceUnfreeze(address indexed caller, address account);
    event ComplianceAddSanctioned(address indexed caller, address account);
    event ComplianceRemoveSanctioned(address indexed caller, address account);
    event ComplianceSeize(address indexed caller, address from, address to, uint256 amount);
}

interface IBankSend {
    struct Payment { address recipient; uint256 amount; }
    function send(address recipient, uint256 amount) external returns (bool);
    function batchSend(Payment[] calldata payments) external returns (bool); // all or nothing
    event BankSend(address indexed sender, address recipient, uint256 amount);
}
```

Shared errors (`IBankd`, one `TempoPrecompileError::BankdError` variant): `NotOwner()`, `NotPendingOwner()`, `NotMinter()`, `ZeroAddress()`, `EmptyBankId()`, `BankAlreadyRegistered()`, `BridgeAlreadyRegistered()`, `AccountBlocked(address)`, `InsufficientNativeBalance(address,uint256,uint256)`.

Every event has exactly one indexed input, the caller, same as bankd v1.

## Integration points for core

### Compliance check (txpool + handler)

```rust
// crates/precompiles/src/bankd/compliance.rs
pub fn is_blocked(account: Address) -> tempo_precompiles::Result<bool>;
```

It has to run inside a `StorageCtx`. It's one SLOAD (frozen and sanctioned are bits in one `u8` slot).

- **Handler** (`validate_env`, frame hook, SELFDESTRUCT beneficiary):
  ```rust
  StorageCtx::enter_evm(&mut ctx.journaled_state, &ctx.block, &ctx.cfg, &ctx.tx, StorageActions::disabled(),
      || tempo_precompiles::bankd::compliance::is_blocked(addr))
  ```
  `enter_evm` uses a max-gas provider, so the read isn't metered against the tx. That's probably what we want for a protocol check, but core should decide.
- **Pool** (`validate_one_with_evm`):
  ```rust
  state.with_read_only_storage_ctx(spec, StorageActions::disabled(),
      || tempo_precompiles::bankd::compliance::is_blocked(addr))
  ```
- **No storage ctx** (raw state reads): `status_slot(addr) -> U256` gives you the slot under `COMPLIANCE_ADDRESS`, and `is_blocked_value(U256) -> bool` interprets it. So it's `is_blocked_value(state.sload(COMPLIANCE_ADDRESS, status_slot(addr))?)`.

Also exported: `ensure_not_blocked(addr) -> Result<()>` (returns `AccountBlocked`), plus the `FROZEN` / `SANCTIONED` bit consts.

### Admin checks elsewhere

`Authority::new().require_owner(sender)?` from inside any tempo precompile. For `ValidatorConfigV2` (DESIGN says it should take its owner from Authority), swap its `require_owner` for this. I haven't done that since it's E1's area.

### Storage provider change

To edit native balances I added `PrecompileStorageProvider::set_balance(addr, U256)`. It has a default impl that returns `Fatal`, so `ReadOnlyStorageProvider` (crates/revm/src/common.rs) and the xtask `DbStorageOverlay` compile unchanged and fail closed. It's implemented for:

- `EvmPrecompileStorageProvider`: `internals.set_balance` (journaled, so a frame revert undoes it). It rejects static context and charges a flat `BANKD_SET_BALANCE_GAS = 5_000` per write.
- `HashMapStorageProvider`: writes `accounts[addr].balance`.

`StorageCtx` got `balance(addr)` (via `with_account_info`, so it pays the warm/cold account load) and `set_balance`.

Edited upstream files (small, for rebases): `storage/{mod,evm,hashmap,thread_local}.rs`, `error.rs` (one variant + match arms + registry), `lib.rs` (mod, imports, 4 lookup arms, 4 `create_precompile`), `contracts/precompiles/mod.rs` (mod + 4 `SYSTEM_PRECOMPILES` rows), `xtask/src/genesis_args.rs` (init fn + call).

## Tests

`cargo test -p tempo-precompiles --features test-utils bankd` runs 23 tests, all passing:

- auth checks: non-owner rejected on every admin call, uninitialized Authority rejects everyone, two-step transfer, cancel, zero-address guards
- Native: mint/burn change balance, burn underflow, mint overflow, minter add/remove (minter can mint and burn), mint to a blocked account rejected, bank registry dupes, dispatch returns ABI `true`
- Compliance: flags are independent, raw slot helper agrees with `is_blocked`, seize bypasses freeze, seize over balance, seize into a blocked account
- BankSend: send, self-send, batch, batch atomicity (over balance, blocked recipient late in the batch, sum overflow all leave balances untouched), sanctioned sender
- selector coverage for all 4
- `storage::evm` tests: `set_balance` is reverted by a journal checkpoint, and rejected in static context

The full `tempo-precompiles` suite passes (1071 + 89).

## Gaps and open calls (please review)

- **Gas for balance writes** is a flat 5k per write, and there's no extra charge for creating a new account (a CALL with value to an empty account costs 25k). It's deterministic, so it's safe for consensus, but the pricing is a guess.
- **Value sent to a precompile**: the `Precompile` trait doesn't expose `msg.value`, so a payable-style call to Native/BankSend with value would leave BRL sitting at the precompile address. Core's handler should probably reject value to these 4 addresses, or I can add it if the input value gets plumbed through.
- **Frame hook doesn't see precompile balance edits.** Native/BankSend/Compliance edit balances directly, so they do their own compliance checks. mint and send check blocked accounts. burn and seize skip the check on the source on purpose (admin actions). seize still refuses a blocked destination.
- **Who can mint**: owner or a `setMinter` address. `registerBank` doesn't grant minting. DESIGN says "admin or a registered bridge". If bridges should mint automatically, that's a one-line change in `require_mint_authority`.
- Dropped from v1 Native: `updateParams`, `mintBridged`/`burnBridged` (requestId idempotency), `setBankBridge`, `setBankPaused`/pause ops, `depositAndForward`/`forward`/`redeemAndBurn` (those were cosmos IBC, and E2's ICS20 adapter replaces them).
- Dropped from v1 Compliance: denom route policies (`setDenomPolicy` etc.), the `reason`/`ref` audit fields, and the audit log. The events are the audit trail for now. DESIGN says to build on `TIP403Registry`, but I didn't, because a flat status map is cheaper for the pool/handler read.
- v1 BankSend took coin strings (`"100ubrl"`). v2 takes `uint256` wei, which is ABI-breaking for the Solidity callers of `send`/`batchSend`, even though the address is the same.
- No hardfork gate. Everything's active from `Genesis`, which is fine on a fresh chain.
- No `tempo-std` Solidity files or `check_abi` entries for these interfaces.
