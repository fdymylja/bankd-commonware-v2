# Plan: native Tendermint light client precompile

Goal: let this chain verify Cosmos (CometBFT) chains without ZK proofs and without a third party prover. Today gaia to commonware uses `SP1ICS07Tendermint`, which needs SP1 network proofs. The commonware to gaia direction is already native (`cw-commonware` runs as wasm on gaia). This makes the other direction native too.

Stuff I'm not sure about is marked **UNSURE**. Time estimates are guesses.

## Why bother

- No Succinct, no proving latency (network proofs take minutes), no per-proof cost.
- SP1 exists because checking ed25519 commits in the EVM is too expensive. We own the node, so we can just do it in Rust.
- Same trust model as a normal Cosmos light client, minus the extra zkVM + Groth16 trust assumptions.
- The shield's Groth16 can't be reused. SP1's Groth16 wraps a RISC-V execution and its verifier is tied to that circuit.

## What already exists

`contracts/lib/ibc-contracts/packages/tendermint-light-client/` has plain Rust crates that are exactly what runs inside the SP1 guest:

- `update-client`: `update_client(...)` verifies a header against a trusted consensus state (adjacent/non-adjacent, trust threshold, trusting period) and returns `UpdateClientOutput`.
- `membership`: `membership(...)` checks ICS-23 proofs against an app hash for a set of `KVPair`s (member and non-member).
- `misbehaviour`: checks two conflicting headers.
- `uc-and-membership`: both in one go.

So the precompile is basically "run the guest program natively". These crates are Apache-2.0 and built on `ibc-client-tendermint` and `tendermint-light-client-verifier`. The Solidity side, `SP1ICS07Tendermint.sol`, already shows what state a client needs (client state, consensus state hash per height, frozen flag).

## Design

### Stateless verifier precompile plus a thin Solidity client

I'd keep the precompile pure. It takes bytes in, returns bytes out, no storage. State lives in a Solidity `TendermintLightClient.sol` that implements `ILightClient` (same shape as `SP1ICS07Tendermint`, minus SP1).

Why not a stateful precompile like `Native`:

- Smaller consensus surface. A pure function is easier to reason about, test and fuzz.
- Client state and consensus states stay in normal contract storage, so the router integration is unchanged (`addClient(id, counterparty, lcAddress)`).
- Bugs in the glue can be fixed by deploying a new client contract instead of a hardfork.

Precompile address: ASCII "TMVER" style like the other bankd ones (`0x...544d564552`, exact value to pick with the rest of the bankd addresses).

### Precompile ABI

Sketch, exact structs to settle when we write it:

```solidity
interface ITendermintVerifier {
    /// Verifies `header` (protobuf ibc.lightclients.tendermint.v1.Header) against a trusted
    /// consensus state. Reverts if invalid. `nowSeconds` is the block timestamp, passed in so the
    /// precompile has no clock of its own.
    function verifyUpdate(
        bytes calldata clientState,        // chain id, trust level, trusting period, unbonding period, drift, latest height
        bytes calldata trustedConsState,   // root, timestamp, next validators hash
        bytes calldata header,
        uint64 nowSeconds
    ) external view returns (bytes memory newConsState, uint64 newHeight);

    /// ICS-23 membership / non-membership against a trusted app hash.
    function verifyMembership(
        bytes calldata root,
        bytes calldata proof,              // MerkleProof (protobuf), two specs: iavl then tendermint
        bytes[] calldata path,             // ["ibc", key]
        bytes calldata value               // empty for non-membership
    ) external view returns (bool);

    function checkMisbehaviour(
        bytes calldata clientState,
        bytes calldata trustedConsState1,
        bytes calldata trustedConsState2,
        bytes calldata header1,
        bytes calldata header2,
        uint64 nowSeconds
    ) external view returns (bool);
}
```

The Solidity client then does what `SP1ICS07Tendermint` does with the public values: store the consensus state hash at the new height, handle "same height, same state" as a no-op, freeze on a conflicting one, and check trusting period expiry.

### Gas

The gas has to be metered before we do the work, and it has to be deterministic:

- `verifyUpdate`: base + per signature verified. The header carries the commit for up to N validators (Cosmos Hub is around 180). Charge per commit signature that we would check, plus per byte of header. Benchmark ed25519 verify in the node and set the constant with headroom. Cap header size and validator count (**UNSURE** on sane caps, cosmoshub is ~180 vals, some chains 300+).
- `verifyMembership`: base + per proof byte + per op in the proof chain.
- Reject early on oversize input, before decoding.

### Determinism

This is the part that can break consensus, so it gets the most care:

- No wall clock. `now` is an argument, from the block timestamp.
- ed25519 verification semantics have to match what CometBFT accepts. CometBFT uses ZIP-215 style verification, `tendermint-rs` with the `rust-crypto` feature may differ on edge cases. **UNSURE**, needs checking, and if it's off we pick strict-and-conservative (reject more), which is safe for a light client but might reject valid headers in weird cases.
- No floats, no HashMap iteration order leaking into output, no threads, same result on all platforms/arches (we ship to mac and linux at least).
- Panics must not kill the node. Wrap in `catch_unwind` or make sure the crates can't panic on adversarial input, and return an error.
- Memory: decoding untrusted protobuf. Set hard length limits first.

### Hardfork gating

Add it behind a new fork in `crates/hardfork` like the other precompile additions, so existing chains don't change. For a fresh localnet it's on from genesis.

## Dependencies risk

`ibc-client-tendermint` and `tendermint*` pull a big tree (prost, ed25519, sha2, ics23, `ibc-proto`). Risks:

- Version conflicts with the alloy/reth/commonware tree, especially ed25519 and `sha2`.
- MSRV, we are on Rust 1.95 so probably fine.
- Compile time.

Fallback if it's ugly: put the precompile logic in a separate crate `crates/tendermint-verifier` with its own deps and a small API, so conflicts stay contained, and vendor just the two functions we need instead of the whole `ibc-client-tendermint`.

## Steps

1. **Spike (0.5 to 1 day).** New crate `crates/tendermint-verifier`. Pull in the update-client and membership crates, get `update_client` and `membership` compiling in our workspace, run them on the fixtures in `packages/tendermint-light-client/fixtures/` (happy path update, membership, non-membership). Answer the dependency and ed25519 questions here. Stop and re-plan if the dependency tree fights us.
2. **Precompile (1 day).** Wire into `crates/precompiles` (same pattern as `signature_verifier` and the bankd ones), ABI decoding, gas charging, errors, input limits. Unit tests with the fixtures plus bad input (wrong chain id, expired, too few signatures, tampered app hash, oversize).
3. **Solidity client (1 day).** `contracts/src/light-client/TendermintLightClient.sol`, modelled on `SP1ICS07Tendermint`: `updateClient`, `verifyMembership`, `verifyNonMembership`, `misbehaviour`, `getClientState`, frozen flag, trusting period. Foundry tests calling a mock precompile first, then a real one on the localnet.
4. **Relayer (0.5 to 1 day).** `bankd-relayer` needs to build the header + proof bytes from a gaia node (`/commit`, `/validators`, ABCI query with proof) instead of asking proof-api. A lot of this exists in `proof-api` (`cosmos_to_eth` module) and can be borrowed.
5. **E2E (0.5 day).** Swap the mock light client in `juno-migration.sh bridge` for the real one. Send gaia to commonware for real, including the old v1 voucher for the legacy alias test. Also update across a gaia validator set change (2 validators, change power) and check it verifies.
6. **Hardening (1 to 2 days).** Fuzz the protobuf decoding and the precompile input. Differential test the precompile output against the SP1 guest program output on the same inputs. Benchmark worst-case headers and tune gas. Review by someone who didn't write it, since it's consensus critical.

Rough total: 4 to 6 days for something I'd trust on a testnet, more for mainnet review.

## Not in scope

- IBC classic (v1) connection/channel handshakes. Still v2 only.
- Verifying chains other than CometBFT. The same shape (pure verifier precompile + thin client) would work for others.
- Removing SP1 entirely. It stays as an option for chains that can't run our node.

## Open questions

- Header/validator caps? Cosmos Hub ~180 vals, do we need to support bigger?
- Fork name and activation for localnet vs real networks?
- Do we want misbehaviour in v1 of this, or add later?
- Vendor the two functions or depend on the ibc-contracts crates directly? (License is fine, Apache-2.0.)
- Who reviews the precompile before mainnet?
