# core (E1) progress

Base chain status. Native BRL gas works, and a 4 validator localnet finalizes blocks with eth JSON-RPC + ws.

## What works

- Native BRL (native ether, 18 decimals) is the gas coin. Legacy, EIP-1559 and 0x76 txs pay gas from the fee payer's native balance.
- Value transfers work (tx value and AA call value).
- Fees (base fee + tip, `gasUsed * effectiveGasPrice`) go to `FEE_ESCROW_ADDRESS` = `0x0000000000000000000000000000000000FEE000`, not the block beneficiary.
- `eth_getBalance` returns real balances now (upstream returned a `4242...` placeholder).
- Genesis: `cargo x generate-localnet ... --native-balance <wei>` funds every generated mnemonic account with native BRL (default 1M BRL). The default mnemonic is the anvil/hardhat one, so `0xf39F...2266` (pk `0xac09...ff80`) is funded.
- 4 validators as native processes, finalizing blocks, http+ws on the same port per node.
- Two chains side by side (9001 and 9002) work.
- Freeze/sanctions (E3's Compliance precompile) are enforced by the protocol:
  - tx validation (pool + block execution, same handler path): sender, fee payer and every call target (tx `to`, each 0x76 call) must not be blocked -> `AccountBlocked { address }`.
  - frame hook (`TempoEvm::frame_init`, covers the inspector path too): any CALL moving nonzero BRL from/to a blocked account reverts with `AccountBlocked(address)`, and CREATE with value from a blocked account reverts. That catches contracts forwarding BRL.
  - SELFDESTRUCT with a nonzero balance reverts when the contract or the beneficiary is blocked.
  - Seize still works, since it's a zero-value call to Compliance that edits balances directly.
- Nonzero value to Authority/Native/Compliance/BankSend is rejected: tx level -> `ValueToBankdPrecompile`, internal CALL -> revert.

## How to run

`just` on this machine (1.38) can't parse the upstream Justfile (`scripts::` module deps need a newer just), so either upgrade just or call the scripts directly:

```bash
cargo build --bin tempo --bin tempo-xtask

# chain 9001: rpc http/ws 8545..8548, consensus ports 9000,9010,9020,9030
./scripts/bankd/localnet.sh up                    # or `up 9001 8545 9000 1` for a single validator (lighter on CPU)
./scripts/bankd/smoke.sh            # chain id, transfer + fee escrow, legacy value tx, contract, ws newHeads, freeze/seize/unfreeze
./scripts/bankd/localnet.sh down

# second chain: 9002 on rpc 9545.., consensus 19000..
./scripts/bankd/localnet.sh up 9002 9545 19000
./scripts/bankd/smoke.sh 9545 9002
./scripts/bankd/localnet.sh down 9002
```

With a newer just it's `just bankd-localnet-up`, `just bankd-smoke`, `just bankd-localnet-down` (same params).

Args for `up`: `chain_id rpc_port consensus_port validators epoch_length`. Localnet uses epoch length 600, pass 21600 for real nets. Data + logs are in `target/bankd-localnet/<chain_id>/<ip:port>/node.log`. `down` deletes the data.

## Where the patch lives

- `crates/revm/src/bankd.rs` (new): compliance + precompile-value checks, frame hook. Called from `handler.rs` (`validate_env`, `validate_against_state_and_deduct_caller`), `evm.rs` (`frame_init`) and `instructions.rs` (SELFDESTRUCT wrapper). Error variants `AccountBlocked`, `ValueToBankdPrecompile` in `error.rs`.
- `crates/revm/src/handler.rs`: `FEE_ESCROW_ADDRESS`, `NATIVE_FEE_TOKEN` (Address::ZERO placeholder), native deduct in `validate_against_state_and_deduct_caller`, refund in `reimburse_caller`, escrow credit in `reward_beneficiary`, value checks removed in `validate_env` and `calculate_aa_batch_intrinsic_gas`.
- `crates/revm/src/tx.rs`: dropped the TIP-20 scaled `max/effective_balance_spending` overrides (revm defaults = wei).
- `crates/node/src/rpc/mod.rs`: `caller_gas_allowance` uses native balance, `balance` override removed.
- `crates/node/src/node.rs`, `crates/transaction-pool/src/validator.rs`: FeeAMM pool check off by default.
- `crates/transaction-pool/src/transaction.rs`: `fee_balance_slot` doesn't panic on the native placeholder token.
- `xtask/src/genesis_args.rs`: `--native-balance`.
- `scripts/bankd/{localnet,smoke}.sh`, Justfile recipes.

Fee manager / DEX / TIP-20 precompiles are still deployed and callable, just not on the gas path.

## Tests

- `cargo test -p tempo-revm`: pass (incl. 9 `bankd::tests`: frozen sender/recipient, forwarder revert + clean forward, selfdestruct both ways, precompile value tx + internal, seize/unfreeze), 9 ignored with `bankd:` reasons (they assert TIP-20 fee payment).
- `cargo test -p tempo-transaction-pool --lib`: pass, 1 ignored (fee token validation). Includes frozen sender and frozen 0x76 call target rejection.
- `cargo test -p tempo-node --lib`, `cargo test -p tempo-xtask`: pass.
- Not run: `crates/node/tests/it` e2e suite. A lot of it funds accounts with pathUSD and expects TIP-20 fees, expect failures there.
- clippy isn't installed for the pinned toolchain, so not run.

## Known gaps

- Keychain access keys (0x76) with spending limits: fee-limit checks still key on the fee token. With native gas the same-tx auth+use path with limits can fail with `SpendingLimitExceeded`. Plain 0x76 txs are fine.
- A 0x76 `fee_token` field is silently ignored.
- Sponsored txs (fee payer != sender) with value: the balance check runs against the fee payer for gas+value, the value itself still comes from the sender at call time.
- Pool doesn't do balance-based eviction for native balances (inner validator balance check stays disabled, EVM validation catches insufficient funds at admission).
- Freezing doesn't evict pending pool txs. They fail validation at block building and get dropped there.
- Compliance reads go through the journal (so a freeze earlier in the same block/tx counts). They warm the Compliance slot and aren't charged to the tx.
- A blocked account can still sign EIP-7702 authorizations, and can be the target of a zero-value call from a contract. Value can't move, but code in a blocked contract can still run.
- CREATE's new address isn't checked (it can't be frozen before it exists).
- TIP-1000 gas: a plain transfer to a new account costs ~271k gas (250k new-account cost). Fine for now, but tools that hardcode 21000 gas will fail on fresh recipients.
- Upstream `scripts/consensus/*` (Docker) and `tempo.nu` flows aren't updated for native gas.
- Chain id 9001 is "evmos" in reth's named chain list, so log dirs are named `evmos`. Cosmetic.
