# Shieldd in bankd v2: progress (E4)

Everything lives in `crates/bankd-shield`, plus a few root manifest lines and a small change inside the `shieldd/` submodule (listed below). No tempo source files are touched yet.

## TL;DR

- **Works in-workspace.** shieldd's Rust crates link straight into the tempo workspace. No cgo, no C ABI, no sidecar.
- **Finalize-only commit is in.** Candidate blocks get executed and hashed in memory; shieldd only writes a block to RocksDB once the host finalizes it. Competing candidates at one height and children of unfinalized parents both work.
- The one hard dep conflict was RocksDB. I fixed it by vendoring cnidarium onto rocksdb 0.24.
- Shielded tx fees are still paid in shieldd's base asset (`ushieldd`) at zero gas price, same as v1. They can't be paid in BRL without a shieldd fee change (see "Denom").

## How to run

```bash
git submodule update --init shieldd
git -C shieldd lfs pull
cargo check -p bankd-shield
cargo test -p bankd-shield
cargo deny check licenses
```

The shieldd crates are path deps into the in-repo submodule (`shieldd/crates/...`), so CI just needs the submodule. First cold build is ~8 min (ark + rocksdb).

## What's in the crate

`ShieldExecutor` (`src/executor.rs`) wraps shieldd's `HostExecution` (the same thing the Go cgo handle drives), reworked for a host that executes blocks before they're final:

```text
begin_block(BlockId{hash, parent, height}, time) -> (deposit | deliver_tx)* -> end_block -> seal() -> root
finalize(hash, height)   // writes that block + its unfinalized ancestors, drops dead forks
```

- `seal` returns the shieldd app hash but writes **nothing**. The block's own change set sits in memory, keyed by block hash.
- `begin_block` picks one of three modes:
  - `Live`: new hash. Runs on the finalized state plus the change sets of its unfinalized ancestors (walked via `parent`). Unknown parent is an error.
  - `Cached`: the hash was already sealed (payload build, then `newPayload` on the same block). Nothing runs. Deposits and txs get back the exact outputs recorded on the first run, withdrawals included, and a different input sequence is an error.
  - `Replay`: height is already finalized (restart, reth re-executing). No-op, and `seal` returns the stored root. This is still the v1 crash loop fix.
- `finalize` commits oldest first, checks every disk root equals the staged root (`RootMismatch` = nondeterminism, node must stop), appends to the root log, then prunes every candidate that doesn't build on the new tip. Finalizing a height that's already final is a no-op.
- `check_tx(bytes) -> ShieldFee` validates against the finalized state.
- **Commit root log** (`src/records.rs`): cnidarium forgets old snapshots after a restart, so every finalized `(height, root)` gets appended to a small fsynced file. If we crash between the shieldd commit and the append, `open` backfills it.
- `system.rs`: where the root goes in reth state, and `BRL_DENOM = "abrl"`.

Pending candidates are memory only. After a restart reth re-executes anything unfinalized, so that's fine.

Tests (`cargo test -p bankd-shield`, 6 pass):

- `competing_candidates_only_finalized_persists`: two different blocks at height 1 give different roots, sealing writes nothing, finalizing B persists B and drops A. Then restart: same committed state, and block 2 builds on it.
- `child_of_unfinalized_parent_matches_sequential_commit`: seal p, then its child c before p is final, plus a dead sibling. Finalizing c commits p then c with the staged roots and drops the sibling. A second node that finalizes each block right away gets identical roots.
- `re_executing_a_sealed_block_is_cached`: same hash twice returns the same outputs and root, and a diverging input errors.
- `replay_guard_after_finalize`: restart, then replaying a finalized block is a no-op with the stored root.
- `recovers_record_lost_after_shieldd_commit`: chop the last root log entry, reopen, and it recovers.
- `rejects_unknown_parent_and_bad_tx`.

There's still no real proven shielded tx fixture (needs the gnark prover + keys), so tests use host deposits for real state changes.

## shieldd submodule change

Branch `reece/shield-finalize-commit` off `origin/dev` (`76f370e97a`). No upstream set, never pushed. Everything is in `crates/core/app/src/app/`, about 200 lines, and it only adds API. The existing `commit` path is untouched, so v1 bankd keeps working.

- `staged.rs` (new): `BlockChanges`, one block's verifiable + nonverifiable writes (ephemeral objects and events dropped, same as a normal commit). It has `merge`, `without(base)` (a block's own delta) and `apply_to(state)`. It only uses stock cnidarium 0.83 API, so shieldd still builds standalone.
- `lifecycle.rs`: `App::take_block_changes`, the same pre-commit work as `App::commit` (nullifier block check, flush deferred tx index), but it flattens and hands the changes back instead of writing them.
- `mod.rs`: `App::new_on_pending(snapshot, &BlockChanges)`, an app on top of unfinalized ancestor changes. It sets `snapshot_version = u64::MAX` so a stateless-cache "historical validation" stamp from the committed snapshot can never skip checks against state that also has pending ancestors in it (for example, a nullifier spent in the parent).
- `host.rs`: `HostExecution::begin_block_on_pending(block, ancestors)`, `stage() -> HostStagedBlock { root_hash, changes }` (root via cnidarium `prepare_commit`, the batch is dropped unwritten), and `commit_staged(&changes)`.

Why the staged root equals the committed root: JMT roots only depend on content. Staging a child computes one version of (ancestors + child) over the committed snapshot. Finalizing writes the ancestors and then the child one version each, and ends at the same content. The test above checks exactly that against a node that commits every block right away.

## Denom for native BRL

It's **`abrl`** (atto-BRL, 18 decimals, matches native wei amounts 1:1).

- Nothing in shieldd hardcodes `wei` or `abrl`. `abrl` doesn't match any registry regex, so `parse_denom` treats it as a plain base denom, and the first deposit registers it (same as `ubrl` in v1).
- The only hardcoded BRL denom in shieldd is `ubrl`, in `crates/bin/bankd-e2e-spend-builder` and `crates/disclosure/tests/claims.rs`. Those are v1 6-decimal fixtures. They'd need updating for v2 no matter what we pick (`wei` breaks them the same way). The disclosure test builds its own notes, so it isn't affected at runtime.
- The `ShielddDeposit` event carries the denom as a plain string. The v1 Shinzo collection (`infra/supervisor-reporting/shinzo-collections.yaml`) just stores it and doesn't match on it.
- **Can't do** "pay shielded fees in abrl": shieldd's fee component only accepts `BASE_ASSET_ID` (`ushieldd`). See `fee_pay.rs` ("only base-asset fees are supported") and `FeeParameters::validate_base_asset_only`. v1 runs with `fixed_gas_prices: {}`, meaning zero fees in `ushieldd`, and v2 inherits that. So `check_tx`'s `ShieldFee.asset_id` is `ushieldd`. Genesis pre-registration of `abrl` isn't needed for deposits. BRL fees would need a shieldd fee component change, which is a separate decision.

## Dependency conflicts

| crate | shieldd | tempo | what happened |
|-|-|-|-|
| rocksdb / librocksdb-sys | 0.21 / 0.11 (via cnidarium 0.83) | 0.24 / 0.17 (reth-provider default) | **Hard conflict.** librocksdb-sys has `links = "rocksdb"`, so only one version can exist. Vendored cnidarium 0.83.0 to `crates/bankd-shield/vendor/cnidarium` with rocksdb bumped to 0.24, `[patch.crates-io]` at root. It compiled with zero source changes. |
| decaf377, decaf377-rdsa, poseidon377 (+ permutation, parameters) | mizufinance git forks via shieldd's `[patch]` | not used | `[patch]` only applies from the root workspace, so I mirrored it in tempo's root `Cargo.toml`. Has to be `branch = "main"`, not `rev`, or the git deps that point at the same branch don't unify (two `decaf377` crates, type errors). Lock pinned to shieldd's exact commits with `cargo update --precise` (decaf377 `738110e`, rdsa `504c043`, poseidon `72e3d94`). |
| prost / tonic | 0.13 / 0.12 | 0.14 / 0.14 | coexist, different semver majors |
| ark-* | 0.5 | 0.3, 0.4, 0.5, 0.6 | coexist |
| rand / rand_core / getrandom | 0.8 / 0.6 / 0.2 | also has these | already in tempo's lock |
| tokio | 1.52 | 1.52 | same |
| tendermint | 0.40 | none | new, only for `Time` + events |
| tikv-jemallocator | the `shieldd` bin crate sets `#[global_allocator]` | tempo bin does too | avoided: we depend on `shieldd-sdk-app` directly, not the `shieldd` cgo crate, so no second allocator |

No existing package in tempo's `Cargo.lock` changed version. 82 new packages were added.

Note: the forked cnidarium with the shared RocksDB block cache (`SHIELDD_ROCKSDB_BLOCK_CACHE_MB`) isn't on shieldd `dev` either. It pulls stock cnidarium 0.83 from crates.io. Our vendored copy is the right place to port that fix when we find it.

## Licenses

`cargo deny check licenses` passes. New crates are MIT and/or Apache-2.0 except:

- `ark-dh-commitments`, `ark-inner-products`, `ark-ip-proofs`: vendored inside shieldd's proof-aggregation, parent dir has LICENSE-MIT + LICENSE-APACHE but the manifests don't say so. Added `[[licenses.clarify]]` entries in `deny.toml`.
- `constant_time_eq 0.1.5`, `secp256k1 0.27`, `secp256k1-sys 0.8`: CC0-1.0 (permissive, already allowed).
- `curve25519-dalek-ng`, `subtle-ng`: BSD-3-Clause (permissive, already allowed).
- `imbl 7` (MPL-2.0, weak copyleft) is used by shieldd but tempo already depends on it and has an exception for it.

No GPL/AGPL/LGPL anywhere.

## Manifest lines I had to touch outside the crate

- root `Cargo.toml`: `crates/bankd-shield` in `members`, the vendored cnidarium and `shieldd` in `exclude`, and the `[patch.crates-io]` block at the bottom
- `.gitmodules` + the `shieldd` gitlink (staged, not committed)
- `deny.toml`: three `[[licenses.clarify]]` entries
- `Cargo.lock`

## Hooks needed from core

These are the exact spots. Nothing is wired yet on purpose, since most of them are in files other people are editing.

### (a) tx type 0x77

- `crates/primitives/src/transaction/envelope.rs`: add `#[envelope(ty = 0x77, typed = ShieldedTransaction)] Shielded(ShieldedTx)` to `TempoTxEnvelope`. The payload is just the raw shieldd tx bytes. It has no ECDSA signer, but the envelope derive wants `SignerRecoverable`, so `recover_signer` returns the fixed `bankd_shield::system::SHIELD_ADDRESS`. Also the `TempoTxType` <-> `TxType` conversions (~68 to 95) and the reth compat envelope (`reth_compat/transaction/envelope.rs` ~143 to 160).
- Hash = keccak of the typed encoding like every other type (shieldd's own tx id is separate, it goes in the receipt logs).
- **Pool** (`crates/transaction-pool/src/validator.rs`, `validate_one_with_evm` ~395): route 0x77 to `ShieldExecutor::check_tx` and skip the whole nonce/balance/fee path. Every shielded tx "comes from" `SHIELD_ADDRESS`, so they can't go in reth's per-sender nonce queues. I'd give them their own small sub-pool keyed by shieldd tx id with a nullifier conflict set (like `tt_2d_pool.rs` sits next to the main pool), and have the payload builder (`crates/payload/builder/src/lib.rs` ~245) pull from it. Revalidate on every new head since nullifiers get spent.
- **RPC** (`crates/alloy/src/rpc/`, `reth_compat.rs`): `eth_sendRawTransaction` works once the envelope decodes it. `eth_getTransaction*` / receipts need the new variant mapped. `from` shows `SHIELD_ADDRESS`.
- `crates/revm/src/tx.rs` (`FromRecoveredTx<TempoTxEnvelope>` ~392): shielded txs never reach the EVM (see b), but the match needs an arm. Map to a zero gas system style env.

### (b) execution

- Put `Arc<Mutex<ShieldExecutor>>` in `TempoEvmConfig` (`crates/evm/src/lib.rs` ~63), opened by the node at `<datadir>/shieldd`, and run `init_genesis` from the chainspec.
- `TempoBlockExecutor::apply_pre_execution_changes` (`crates/evm/src/block.rs` ~485): `begin_block(BlockId { hash, parent, height }, timestamp)`. **Needs the block hash inside the executor.** The executor context has the parent hash, but not the hash of the block being built (the payload builder only knows it after sealing). Options: key candidates by `(parent_hash, tx list hash)` instead, or re-key after assembly. Not settled yet, see gaps.
- `execute_transaction_without_commit` (~541): for 0x77, don't call the inner EVM. Call `deliver_tx`, build a receipt (status = accepted), and turn `TxOutcome::Accepted { withdrawals }` into BRL balance moves from `SHIELD_ADDRESS` to each recipient. Charge a fixed gas amount against the block limit so blocks can't be stuffed.
- Deposits: the SHLD precompile does **not** call shieldd itself, because shieldd can't roll back when the EVM frame reverts. It escrows BRL into `SHIELD_ADDRESS` and emits `ShielddDeposit`. In `commit_transaction` (~583), for each `ShielddDeposit` log from `SHIELD_ADDRESS` in a successful receipt, call `ShieldExecutor::deposit`. Logs are reverted with the frame, so this is revert safe for free.
- `finish` (~622, next to `apply_current_committee_system_call`): `end_block()` then `seal()`, then (c).
- **Finalization hook:** call `finalize(hash, height)` when commonware finalizes a block. The natural spot is wherever the consensus executor forwards finalized blocks to the engine as forkchoice (`crates/consensus/src/executor/`), or a reth `CanonStateNotification` listener if that's only fired for finalized blocks. Blocks must be finalized in order. `finalize` walks ancestors, so skipping heights is fine.
- Invariant worth asserting in tests: `balance(SHIELD_ADDRESS)` == shielded BRL supply.

### (c) app hash in reth state

`bankd_shield::system`: `SHIELD_ADDRESS` = SHLD precompile `0x...53484C44`, slot 0 = shieldd root, slot 1 = shieldd height. `root_slot_writes(height, root)` returns the pairs. Write them in `finish` the same way `deploy_precompile_at_boundary` (`block.rs` ~207) writes storage: build an `Account` with changed `EvmStorageSlot`s and `db.commit`. Then the one reth state root covers shieldd, and the light client can prove a shieldd root with a normal `eth_getProof` on slot 0.

### (d) SHLD deposit precompile

Owned by modules (`crates/precompiles/src/bankd/`, registered in `extend_tempo_precompiles`, `crates/precompiles/src/lib.rs` ~217). What I need from it:

- `deposit(string recipient) payable`: move `msg.value` into the `SHIELD_ADDRESS` balance, emit `ShielddDeposit(address indexed sender, string recipient, uint256 amount, string denom)` (same event as v1's `IShieldd.sol`, v1 took a coin string, v2 is just native BRL so `msg.value`).
- `getLastCommitment()` view: read slot 0.
- Compliance: check the sender isn't frozen before escrowing.

## Remaining 0x77 wiring (core)

In order:

1. Envelope variant + `SignerRecoverable` sentinel + tx env arm (a).
2. Shielded sub-pool + `check_tx` in the validator, and the payload builder pulling from it (a).
3. `ShieldExecutor` in `TempoEvmConfig`, then begin/deliver/end/seal in the block executor (b).
4. Root + height slot writes in `finish` (c).
5. Finalization hook into `finalize` (b).
6. SHLD precompile escrow + `ShielddDeposit` log, forwarded by the executor (d).
7. RPC mapping for 0x77 txs and receipts (a).

## Blockers / gaps (flagging these, not sure about all of them)

1. **Block hash at execution time.** `ShieldExecutor` keys candidates by block hash, but the block executor may not know its own hash before assembly (see (b)). That needs a decision from core.
2. Pool `check_tx` validates against finalized state only. A tx that spends a note created in a notarized but unfinalized block gets rejected until that block finalizes. That's safe but a bit laggy.
3. `ShieldExecutor` calls `block_on` on its own runtime, so it panics on a tokio worker. Block execution is on plain threads, but pool validation is async, so wrap it in `spawn_blocking`.
4. BRL fees in the shielded pool need a shieldd fee component change (see "Denom").
5. After a restart the finalized tip hash is unknown, so the first candidate after restart is only checked by height, not by parent hash. It could be recorded in the root log if we want that check.
6. Toolchain: shieldd pins 1.89, we build it on 1.97.1. It compiles, but no real proof has been verified on this toolchain yet (no fixture). Building shieldd standalone with 1.97.1 fails on `metrics 0.24.1`. Its own 1.89 pin is fine, and inside our workspace it's fine.
7. The shared RocksDB block cache fix isn't on shieldd `dev`, so it still needs porting into `vendor/cnidarium`.
8. I didn't run shieldd's own test suite on the submodule change (CPU budget, and it needs a separate 1.89 build). The bankd-shield tests cover the new API end to end.
