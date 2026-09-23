# bankd v2 design

bankd v2 is bankd (the Cosmos SDK chain) rebuilt on tempo, which is reth + commonware 2026.9. Each bank runs its own chain. Chains only talk to other bankd chains, over IBC v2 written in Solidity.

This repo is a fork of [tempoxyz/tempo](https://github.com/tempoxyz/tempo) (MIT OR Apache-2.0). The `upstream` remote points at it.

## Goals

- Native gas coin is BRL, and it's native ether (18 decimals).
- The central bank issues BRL. Bridged BRL unwraps to native BRL on every chain, so there are no vouchers and no wrapped tokens.
- Full EVM + Solidity with persistent state, plus full eth JSON-RPC including ws subscriptions. The Shinzo/DefraDB indexers only use JSON-RPC, so they keep working.
- Sanctions and freeze are enforced at the protocol level, in the txpool and during execution.
- Admin only. No governance.
- Fresh genesis. Nothing gets migrated from the old chain.

Non-goals: talking to non-bankd Cosmos chains, and Eureka's hosted relayer or other closed tooling.

## Layout

```text
upstream tempo crates      keep, patch as little as we can
crates/bankd-*             our stuff lives here (new crates, keeps upstream rebases cheap)
contracts/                 IBC v2 contracts, light client, ICS20 native adapter
relayer/                   bankd <-> bankd relayer
docs/                      this file + ADRs
```

Rule of thumb: when we can add something in a new crate, do that rather than edit a tempo file. Upstream moves fast (500+ commonware commits since May), so we'll rebase often.

## What we change in tempo

### 1. Native BRL as gas

Tempo turns native ETH off completely and pays fees in TIP-20 stablecoins via `TipFeeManager` and a fee AMM. We flip that back:

- Delete the `ValueTransferNotAllowed` checks in `crates/revm/src/handler.rs` (~1780 and ~2315 on the AA path) and in `crates/transaction-pool/src/validator.rs`.
- Put back revm's default deduct/reimburse/reward logic for native balance. Today that's `validate_against_state_and_deduct_caller` (~981), `reimburse_caller` (~1679), and `reward_beneficiary`, which is currently a no-op (~1749).
- Remove the fee-token resolution (`crates/revm/src/fee_manager.rs`) and the AMM liquidity check in the pool (`crates/transaction-pool/src/amm.rs`).
- Genesis alloc gives BRL to the admin and the validators.

Fees (base fee + tip) go to a fixed fee escrow account, not the block beneficiary. What happens to them after that is an admin decision for later.

### 2. Precompiles

Tempo already has a nice precompile framework (`#[contract(addr = ..)]` in `crates/precompiles-macros`, and dispatch helpers in `crates/precompiles/src/dispatch.rs`). New ones register in `extend_tempo_precompiles` (`crates/precompiles/src/lib.rs` ~217).

We keep the same addresses bankd uses today, so the Solidity side and the frontends don't have to change their constants.

| precompile | address | notes |
|-|-|-|
| Native (mint/burn + bank registry) | `0x...4552433230` | mints native BRL by editing journal balances. Only the admin or a registered bridge can call it |
| BankSend | `0x...42414E4B53454E44` | mostly obsolete now that BRL is native, but kept for batch payroll |
| Compliance | `0x...434D504C59` | sanctions/freeze registry plus route policies. Built on top of tempo's `TIP403Registry` |
| AvP | `0x...415650` | port from `x/avp` |
| Shieldd | `0x...53484C44` | links the shieldd Rust crates directly, no cgo |
| Authority | new | owner plus two-step ownership transfer. Every admin-gated precompile checks against it |

What happens to tempo's own precompiles:

- Keep: `ValidatorConfigV2` (it's already owner gated, so we point it at Authority), `CurrentCommittee`, `Nonce`, `AccountKeychain`, `SignatureVerifier`, `TIP403Registry`.
- Strip: `TipFeeManager`, `StablecoinDEX`, `TIP20ChannelReserve`, `ReceivePolicyGuard`, `StorageCredits`, `AddressRegistry`, `ZoneFactory`, `ZoneVerifier`, `ValidatorConfig` v1, `TIP20`, `TIP20Factory`. Also drop the `nitro-attestation` crate, which pulls in minicbor (BlueOak license).
- Other tokens are plain Solidity ERC20s (OpenZeppelin, MIT). TIP20 is tempo's precompile version of ERC20. It exists mostly to support paying fees in stablecoins, and we're removing that.

What drops out entirely: `msgexec` (nothing to execute, there are no Cosmos msgs anymore), bech32, and the cosmos staking/distribution/slashing precompiles. The multisig half of `x/safe` goes too, and a plain Safe covers it.

### 3. Sanctions and freeze

These are enforced in two places, and both read the same Compliance precompile storage:

- **txpool:** `crates/transaction-pool/src/address_filter.rs` already rejects senders and targets on a static list (hooked in at `validator.rs:458`). We swap the static list for a state read in `validate_one_with_evm`.
- **execution:** check sender and `to` in `validate_env` (`handler.rs` ~1765). The pool check alone isn't enough, since a block producer can skip the pool.

- **internal value transfers:** we block these too. A frame-level hook in the handler reverts any call frame that moves BRL from or to a frozen account, which catches a contract forwarding BRL to a frozen address. `SELFDESTRUCT` beneficiaries get the same check.

Seize is an admin call on Compliance that moves the balance, and it's allowed to bypass the freeze check.

ERC20 balances aren't native. So a frozen account's ERC20 holdings are only protected when the token calls into Compliance in its transfer hook. Our bank ERC20 template does that.

### 4. Validators and admin

`ValidatorConfigV2` holds the validator set and gets its owner from Authority. DKG resharing runs every epoch (`crates/consensus/src/dkg`), so adding or removing a validator is just an admin tx followed by waiting for the next epoch.

Epoch length is 21600 blocks, the same as tempo's mainnet (presto). Validator changes take effect at the next boundary, and the light client only has to process one boundary header per epoch.

## Bridge (IBC v2 in Solidity)

We use [cosmos/ibc-contracts](https://github.com/cosmos/ibc-contracts) (Apache-2.0, formerly solidity-ibc-eureka). There's no IBC precompile, it's all regular contracts deployed at genesis.

```text
bank A chain                                    bank B chain
ICS20 native adapter -> ICS26Router  --relayer-->  ICS26Router -> ICS20 native adapter
                        CommonwareLightClient(B)   CommonwareLightClient(A)
```

### Light client

Tempo finalizations are BLS threshold (MinSig) certificates over the block hash. The block hash is computed over `TempoHeader`, and that contains `state_root` (`crates/primitives/src/header.rs`). So proving that a packet commitment exists takes three steps:

1. Verify the simplex certificate with commonware's `sol/` verifier (~130k gas, needs the EIP-2537 BLS precompiles, which reth has).
2. Hash the header, check it matches the certified digest, then read `state_root` from it.
3. Verify an MPT storage proof (from `eth_getProof`) for the ICS26Router commitment slot against `state_root`. `packages/ethereum` in ibc-contracts already does MPT proofs, so we reuse that.

Epochs: the new group key sits in the epoch-boundary header's `extra_data` (`OnchainDkgOutcome`). The client verifies the boundary block under the old key and then switches to the new one. `crates/consensus/src/finalization_verifier/mod.rs` does exactly this in Rust, so it's the reference we port.

### Native BRL over ICS20

Stock ICS20 escrows ERC20s and mints voucher tokens. We wrap it with a native adapter:

- **Hub (central bank) sending out:** escrow native BRL (`msg.value`).
- **Spoke receiving:** call the Native precompile to mint native BRL to the receiver. There's no voucher, and this is how "unwraps to native BRL" works.
- **Spoke sending back:** burn the native BRL. The hub then releases it from escrow.
- **Trust:** a spoke only mints for packets that come from an allow-listed client id, meaning the hub. This is the SPOKE registry from today's `x/unwrap`, and it closes the counterfeit-mint hole we hit before.
- **Invariant:** a spoke's native supply equals the hub's escrow for that client.

Spoke to spoke transfers route through the hub, which escrows on one side and releases on the other. v2 dropped PFM-style forwarding, so the adapter handles this itself.

`evm_exec` memo execution (today's `x/eem`) goes into the adapter as a callback after the mint. Compliance route policies (allowed clients per currency) get checked in the adapter on both send and receive.

### Relayer

bankd <-> bankd only, and the same code runs in both directions:

1. Subscribe to `SendPacket` events on chain A.
2. Wait until A finalizes the block (so there's a cert).
3. Fetch the cert, header and `eth_getProof` for the commitment slot.
4. On B, call `updateClient` and then `recvPacket`.
5. Relay the ack back the same way. Handle timeouts too.

It's written in Rust and lives in this repo, reusing tempo's alloy types. No Hermes.

## Shieldd

Recommendation: **a dedicated shielded tx type** rather than calls through the precompile.

- **Why:** a precompile call is a normal EVM tx, so it has a `from` address that pays gas. That links an EOA to every shielded action, which defeats the point. With its own tx type, fees get paid inside the shielded tx (the way shieldd already works on bankd today) and the tx needs no ECDSA signer.
- **Pool validation:** calls into the shieldd crate to check the proof and the fee.
- **Execution:** a system call into the shieldd state machine. State commits into the reth state root, so there's still one app hash.
- **Precompile:** still needed for deposits (EVM to shielded pool), since those come from a normal account anyway.

Tempo already added one custom tx type (0x76), so all the plumbing for adding another one exists. I'm not 100% sure about the cost of running shieldd's state commit inside reth's execution. That needs a spike.

## Work split (3 engineers, ~3.5 to 4.5 months to a testnet)

| who | stream | first milestone |
|-|-|-|
| E1 | base chain: native BRL gas, strip tempo fees/DEX/zones, Authority, validator admin, chainspec + 2-chain devnet | two local chains producing blocks, native BRL transfers work, RPC + ws working |
| E2 | bridge: light client contract, native ICS20 adapter, relayer, hub routing, evm_exec callback | one BRL packet hub -> spoke, minted as native on the spoke |
| E3 | modules: Native, Compliance (pool + execution), BankSend, AvP, disclosure, then shieldd | freeze blocks a transfer in both the pool and a block |

Clients (admin UI, mobile, packages/shared) swap cosmjs/bech32 for viem once E1's devnet is up. Everyone pitches in there near the end.

## Upstream tracking

```bash
git fetch upstream
git rebase upstream/main   # expect conflicts in handler.rs + pool validator, that's where we patch tempo
```

## Licenses

Our code is MIT OR Apache-2.0, and we don't allow copyleft anywhere in the build. Here's what the build graph pulls in today:

- `imbl` (MPL-2.0+) comes from `reth-transaction-pool`. That's the only copyleft crate that actually gets built. Removing it means patching reth's pool and carrying that patch.
- `minicbor` (BlueOak) goes away when we strip `nitro-attestation`.
- `colored` and `fastrlp` (MPL-2.0) show up in Cargo.lock but aren't built for the node.
- Permissive but not MIT/Apache: BSD (dalek ed25519, used by consensus), CC0 (secp256k1), ISC (ring/rustls), Zlib, Unicode-3.0. Every Rust Ethereum client depends on these, so they can't realistically be avoided.

`deny.toml` needs MPL-2.0 and BlueOak removed from `allow`, so CI enforces this.

## Open questions

- Remove `imbl` from reth's txpool (a small patch we carry), or push the change upstream to reth?
- Is permissive non-MIT/Apache (BSD, ISC, CC0, Zlib) ok?
