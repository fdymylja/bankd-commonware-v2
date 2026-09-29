# CosmWasm on bankd - plan

Demo goal: run a CosmWasm contract on this chain and get a return value back after compute. Not prod, so no audit or licence work.

## Where we are

There's no wasm runtime anywhere in the workspace. `Cargo.lock` only has `wasmtimer`. So this is greenfield.

- `light-clients/cw-commonware` is a CosmWasm contract (for Gaia to run), not a host. Standalone workspace, cosmwasm-std 2.2.
- `docs/MIGRATION-juno.md:20` says CW addresses are 32 bytes and skipped "until we add cosmwasm". We're keeping 20 byte EVM addrs on chain and padding to 32 inside the CW `Api`.
- IBC is Solidity (predeployed in genesis by `xtask/src/bankd_ibc.rs`). Stays that way.
- `docs/DESIGN.md:24` says add new crates rather than editing tempo files. We follow that.

Line refs below came from an exploration pass, spot check them before relying on them.

## Design

- New crate `crates/bankd-cw` wrapping `cosmwasm-vm` (singlepass).
- Hide it behind a trait like `crates/evm/src/shield.rs` so tempo-evm doesn't pull in wasmer. Real engine gets plugged in from `crates/node`.
- Exposed as a `cw` precompile with `storeCode`, `instantiate`, `execute`, `query`.
  - Register in `crates/precompiles/src/lib.rs:220-275`.
  - Address goes in `crates/contracts/src/precompiles/mod.rs:87-91`.
  - Return value is `Response.data`. Events become EVM logs.
- State lives in a separate RocksDB (same idea as shieldd). Only a root is committed on-chain.

```text
code(code_id -> wasm)
contract(addr -> {code_id, creator})
storage(addr, key -> value)
```

- The `contract` table is the "this addr is a contract" tag. Add `isContract(addr)` and `contractInfo(addr)` views on the precompile.
- Addresses are 20 bytes with a vanity prefix so they stand out in explorers: `0xC0DEC0DE || sha256(code_id || creator || counter)[..16]`.
- Inside the CW `Api` the canonical address is 32 bytes, zero padded (12 zero bytes + the 20 byte addr). `addr_canonicalize` checks the padding and strips it, `addr_humanize` pads it back. Real 32 byte addrs (instantiate2 etc) won't fit, fine for the demo.
- Contract balance is just the EVM balance at the 20 byte addr, so the bank query needs no extra accounting.

## Block lifecycle

Copy the shieldd pattern in `crates/evm/src/block.rs`:

- begin block hook, per-tx overlay, finish block hook.
- Per-tx writes go in an overlay. Success merges into the block overlay, revert drops it.
- At finish block, flush to RocksDB and write the DB root into a slot on the `cw` address (like `ROOT_SLOT` in `crates/bankd-shield/src/system.rs:11-25`). Consensus certifies the header state root, so the CW root is covered.
- Overlay lives on the executor instance so the payload builder can discard a speculative block cleanly.
- DB reads happen at the parent block's version (versioned by height) so reorgs don't desync.

## Gas

- 200k base, plus wasm gas converted with a fixed ratio.
- Cap around 5M per call. Typical contracts land ~200k, heavy ones ~2M.
- Charge through the precompile gas API (`charge_input_cost` in `crates/precompiles/src/lib.rs`).
- Not sure of the exact cosmwasm-vm multiplier (about 140M wasm gas per SDK gas). Verify in the spike.

## Host mapping

- `Api`: 32-byte zero padded canonical addresses (see above), bech32 stays in tooling.
- `Querier`: bank query reads native BRL balance (18 decimals, `docs/DESIGN.md:10-12`). Single denom.
- `Env`: height, time, chain_id from the revm block env. Sender is `tx.from`.
- `Coin` funds map to `msg.value`.

## Steps

1. Spike `cosmwasm-vm` in `crates/bankd-cw`. Confirm it builds on 1.97.1 and check the rocksdb conflict. Load `cw-commonware.wasm`. (1-2 days)
2. RocksDB tables + contract registry. (2 days)
3. Host backend: `Storage`, `Api`, `Querier` over the tx overlay. (3 days)
4. `cw` precompile. (2 days)
5. Gas conversion. (1 day)
6. Block begin/finish hooks + root slot. (2-3 days)
7. E2E test in `crates/e2e` (upload, instantiate, execute, query) + a Justfile target next to `bankd-smoke`. (2 days)

About 2 weeks total.

## Out of scope for v1

- Submessages and reply (needs recursive EVM calls + journal checkpoints, biggest risk).
- IBC entrypoints, sudo, migrate.
- New 0x78 tx type. Precompile is enough. If we want it later, model on shielded (0x77, `crates/primitives/src/transaction/shielded.rs`) and touch `crates/transaction-pool/src/validator.rs`.

## Risks

- **RocksDB `links` conflict** (`Cargo.toml:427-434`). Likely the first blocker. Check in step 1.
- **Inner reverts.** If the precompile succeeds but an outer EVM frame reverts, CW writes persist. Accepted for the demo. Real fix is journaling the writes in EVM storage.
- **Wasmer/singlepass** is heavy and platform sensitive. Check `Cross.toml` and `Dockerfile.reproducible`.
- **Gas ratio** is a guess until benchmarked.

## Build and test

- `rust-toolchain.toml` pins 1.97.1, workspace edition 2024, MSRV 1.95.
- Use the `Justfile` (`bankd-localnet-up`, `bankd-smoke`, `check-abi`) and `scripts/bankd/*.sh`.
- Format with `cargo +nightly fmt`.
