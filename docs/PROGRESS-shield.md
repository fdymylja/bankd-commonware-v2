# Shieldd in bankd v2: progress (E4)

shieldd runs inside the node. Every block drives it, its root lands in reth state, it commits to disk only on commonware finality, and EVM accounts can deposit BRL into the shielded pool through the SHLD precompile. 0x77 shielded txs are accepted by the pool, included by the builder and executed through shieldd. What's still missing is a real proven 0x77 tx end to end (see "Real 0x77 tx").

## TL;DR

- shieldd's Rust crates link straight into the tempo workspace. No cgo, no C ABI, no sidecar.
- **Finalize-only commit.** Candidate blocks run in memory; shieldd writes a block only when consensus finalizes it (`forward_finalized` -> `on_finalized`). Competing candidates and children of unfinalized parents both work.
- **One state root.** Every block writes the shieldd root + height into the SHLD precompile's storage (slots 0 and 1).
- **Deposits.** `SHLD.deposit(string recipient)` is payable, escrows `msg.value` at the SHLD address and emits `ShielddDeposit`. The block executor forwards the event to shieldd after the tx commits and refunds it in the same block if shieldd refuses it.
- **0x77.** New envelope variant with no ECDSA signer. The pool checks it with shieldd, it sorts after every EVM tx, and executing it moves withdrawals out of the SHLD escrow.
- Live checks: `shield-smoke.sh`, `smoke.sh` and `bridge-e2e.sh` all pass on localnets (details in "Tests").

## How to run

```bash
git submodule update --init shieldd && git -C shieldd lfs pull
cargo build --bin tempo --bin tempo-xtask

./scripts/bankd/localnet.sh up 9001 8545 9000 1
./scripts/bankd/shield-smoke.sh 8545 9001 9000   # restarts the node midway
./scripts/bankd/localnet.sh down 9001
```

- shieldd state lives in `<datadir>/shieldd` (`state/` RocksDB, `commit-roots.bin`, `outputs/`).
- `BANKD_SHIELD_DISABLE=1` runs a node without it. Don't mix nodes with it on and off on one chain, they'd compute different state roots.
- `localnet.sh restart` is new: it stops the validators and starts them again, keeping the data.

## How it fits together

```text
payload build / newPayload
  TempoBlockExecutor::apply_pre_execution_changes
    parent_root = SHLD.slot0 (parent state) -> session.begin_block(parent_root, number, ts)
  tx 0x77            -> session.deliver_tx(payload) -> payouts out of SHLD escrow / reverted receipt
  tx emits ShielddDeposit (after commit) -> session.deposit(..) -> refund if refused
  finish             -> session.finish() = end_block + seal -> write SHLD slot0 = root, slot1 = height
consensus forward_finalized (after FCU)
  on_finalized(hash, height) -> root = SHLD.slot0 at hash -> ShieldExecutor::finalize(root, height)
```

- **Candidates are keyed by their shieldd root, not the block hash.** The payload builder doesn't know the block hash until after execution, and reth never re-executes its own built blocks. Each block reads its parent's root from the SHLD slot, so the chain of candidates links by root. The finalize hook reads the finalized block's root back from its post-state. Two blocks with identical shieldd inputs on the same parent get the same root and changes, so sharing an entry is safe.
- **Sessions.** One `ShieldExecutor` per node (`crates/node/src/shield.rs`). The builder, the engine and RPC-driven block execution take turns through a session lock held from pre-execution to `finish`. Finalize waits for that lock too.
- **Replay.** Heights at or below the finalized height don't run shieldd. They hand back the outputs recorded at finalize time (`outputs/<height>.json`: deposit accept/refuse, tx outcomes and withdrawals), so reth re-importing a block after a restart gets identical EVM effects and the same stored root.
- **Nested runtimes.** Calls from inside another tokio runtime (the pool validates inside `Handle::block_on`) hop to a scoped thread before `block_on` on shieldd's runtime. Opening and finalizing run in `spawn_blocking`. On drop, shieldd's runtime shuts down in the background.

## 0x77 shielded tx

- `crates/primitives/src/transaction/shielded.rs`: `TxShielded { input }`, encoded as `0x77 || rlp([input])`. The hash is keccak of that, and `shielded_sender(hash)` gives a unique pseudo-sender per tx (nonce 0), so reth's pool needs no sub-pool.
- There's no signature and no nonce. Gas is fixed at `SHIELDED_TX_GAS = 250_000` against the block limit. It has priority fee 0 and effective price 0, so it sorts after every EVM tx and can't starve them. `max_fee_per_gas` reports a huge cap so reth doesn't park it below the base fee, and RPC shows that number.
- Pool: `TempoTransactionValidator::with_shielded_checker` routes 0x77 to `ShieldExecutor::check_tx` against finalized state. That skips nonce/balance/fee/compliance checks. Without a checker it's `TxTypeNotSupported`.
- Execution never touches the EVM. Accepted: transfer withdrawals of `abrl` to a `0x` recipient become balance moves out of the SHLD escrow. Rejected: a reverted receipt with shieldd's log as output. Prewarm's action replay is bypassed for 0x77.
- RPC: `eth_sendRawTransaction` accepts it (custom tx type registered). `from` shows the pseudo-sender.

## SHLD precompile

`0x0000000000000000000000000000000053484C44`, ABI `IShield` in `crates/contracts/src/precompiles/bankd.rs`:

- `deposit(string recipient) payable returns (bool)`: rejects zero value, an empty recipient or a blocked sender (the frame hook also reverts value from frozen accounts). It emits `ShielddDeposit(address indexed sender, string recipient, uint256 amount, string denom="abrl")`. The value was already moved into the SHLD balance by the EVM call itself, and the precompile reads `msg.value` through `Shield::with_value`.
- `getLastCommitment() view returns (bytes32 root, uint64 height)`: value on this call reverts with `NotPayable`.
- SHLD isn't in core's `BANKD_PRECOMPILES` no-value list, so value to it is allowed. Genesis gives it the `0xef` marker, and the executor adds the marker too if it's missing (otherwise EIP-161 would wipe the empty account together with the slots).

## Tests

- `cargo test -p bankd-shield`: 8 pass (competing candidates, child of an unfinalized parent vs sequential commits, re-execution gives the same root, replay returns recorded outputs, refused deposit, root log recovery, nested tokio runtime, unknown parent / bad tx).
- `cargo test -p tempo-evm --lib shield`: 4 pass, using a mock engine (root/height slots written every block with the parent root read from state, 0x77 payout / revert, deposits forwarded and refused ones refunded, 0x77 with no engine is invalid).
- `cargo test -p tempo-precompiles --features test-utils bankd`: bankd + 4 new Shield tests (selector coverage, event, zero/empty/blocked rejects, `getLastCommitment` reads the slots).
- 0x77 type: `tempo-primitives` roundtrip/hash/sender/Compact tests, and the pool shielded checker test (accepted / rejected / no checker).
- Live, 1-validator localnet, `scripts/bankd/shield-smoke.sh`: the root slot changes every block and the height slot equals the block number, `getLastCommitment` agrees, a deposit escrows 1 BRL, a refused deposit is refunded, a frozen sender can't deposit, and after a node restart the finalized block's root is unchanged, blocks continue, the height slot is fresh and the escrow is intact.
- Regression: `scripts/bankd/smoke.sh` all checks pass, `scripts/bankd/bridge-e2e.sh` PASS.
- Pre-existing failure, not from this work: `tempo-evm` `evm::tests::test_tip20_full_evm_storage_actions` (TIP-20 fee test, "lack of funds" since native BRL gas).

## Real 0x77 tx

Not done. Here's exactly what's missing:

1. The spend builder, `shieldd/crates/bin/bankd-e2e-spend-builder`, hardcodes the `ubrl` denom (main.rs 354, 417). It needs a denom arg (`abrl`), which is a shieldd change.
2. Building it with `bundled-proving-keys` means a standalone shieldd workspace build (its own 1.89 toolchain) plus the gnark Go prover runtime. The proving keys are there (`tools/gnark/artifacts`, 961M), but that's a second full build and disk was at 21G free.
3. It reads a shieldd RocksDB to find the test wallet's note. That means copying `<datadir>/shieldd/state` out of a stopped node (RocksDB is locked while it runs), after a deposit to `shieldd1u29dhz...` (test wallet 0) has finalized.
4. Then wrap the output: `cast publish 0x77$(cast to-rlp '["0x<tx bytes>"]' | cut -c3-)`.

Until then the 0x77 path is covered by unit tests with a mock engine, plus shieldd rejecting junk bytes in pool and execution.

## shieldd submodule change

Branch `reece/shield-finalize-commit` off `origin/dev` (`76f370e97a`), now mizufinance/shieldd PR #156. The superproject gitlink is staged at `2349ae0708`. Everything is in `crates/core/app/src/app/`, about 200 lines, and it only adds API. The existing `commit` path is untouched, so v1 bankd keeps working.

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
- **Can't do** "pay shielded fees in abrl": shieldd's fee component only accepts `BASE_ASSET_ID` (`ushieldd`). See `fee_pay.rs` ("only base-asset fees are supported") and `FeeParameters::validate_base_asset_only`. v1 runs with `fixed_gas_prices: {}`, meaning zero fees in `ushieldd`, and v2 inherits that. So `check_tx`'s `ShieldFee.asset_id` is `ushieldd`, and I didn't pre-register `abrl` at genesis because deposits don't need it. BRL fees would need a shieldd fee component change, which is a separate decision.

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

## Where the code lives (for per-feature commits)

- **Finalize-only shieldd executor:** `crates/bankd-shield/**`, `shieldd` gitlink.
- **0x77 tx type:** `crates/primitives/src/transaction/{shielded,envelope,mod}.rs`, `crates/primitives/src/{lib.rs,reth_compat/transaction/envelope.rs}`, `crates/alloy/src/{network.rs,rpc/request.rs,rpc/reth_compat.rs}`, `crates/revm/src/tx.rs`, `crates/transaction-pool/src/{validator,transaction}.rs`.
- **Block execution + root slots:** `crates/evm/src/{shield.rs,block.rs,block/shield_tests.rs,lib.rs,test_utils.rs,action_replay.rs,engine.rs}`.
- **Node wiring + finalize hook:** `crates/node/src/{shield.rs,node.rs,lib.rs}`, `crates/node/Cargo.toml`, `crates/consensus/src/executor/{mod.rs,actor.rs}`, root `Cargo.toml` (`bankd-shield` workspace dep), `Cargo.lock`.
- **SHLD precompile:** already committed by the user in `0f75fc1746`, plus a one-line unused-import fix in `crates/precompiles/src/bankd/shield.rs`.
- **Scripts/docs:** `scripts/bankd/shield-smoke.sh` (new), `scripts/bankd/localnet.sh` (`restart`, logs append), this file.

## Gaps / flagged

1. RPC-driven block execution (pending block, `eth_simulateV1`, tracing) goes through the same executor, so it runs shieldd too. Historical heights replay cheaply. Tip+1 simulations stage throwaway candidates, which get pruned at the next finalize, and hold the session lock while they run. A config switch that keeps shieldd off in RPC paths would be cleaner.
2. The BAL parallel executors (feature `bal`, off by default) would each open a session. Not supported.
3. Withdrawals: only `Transfer` to a `0x` address in `abrl` is paid out. `Execution` withdrawals and non-EVM recipients stay in escrow (deterministic, logged). Not handled yet.
4. The pool checks 0x77 against finalized state only, so a spend of a note created in a notarized but unfinalized block waits for finality. The same tx included twice by a malicious proposer just gets rejected by shieldd (nullifier), since the pseudo-sender nonce isn't bumped.
5. The refund of a refused deposit happens after the receipt, which still shows the `ShielddDeposit` log. Indexers should treat `ShielddDeposit` as a request, not a confirmed deposit.
6. `outputs/<height>.json` and `commit-roots.bin` grow forever. No pruning yet.
7. Mixing nodes with `BANKD_SHIELD_DISABLE` on and off forks the chain (the slot writes differ). It's a dev-only switch.
8. Shielded fees stay in `ushieldd` at zero price (see "Denom").
9. `forward_finalized` fails if shieldd's finalize fails (e.g. `RootMismatch`), which stalls finalization forwarding on purpose instead of diverging.
10. The shared RocksDB block cache fix still isn't in `vendor/cnidarium`.
11. Disk: the main `target/` is ~85G. I ran `cargo clean` on my old worktree (14.5G). The sibling worktrees' targets are untouched.
