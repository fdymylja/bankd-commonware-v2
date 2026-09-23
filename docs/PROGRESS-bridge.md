# Bridge progress (E2)

Status of the IBC v2 bridge work from the "Bridge (IBC v2 in Solidity)" section of `DESIGN.md`.

## What's here

```text
contracts/
  src/light-client/CommonwareLightClient.sol   ILightClient for a tempo chain
  src/light-client/TempoHeaderLib.sol          RLP TempoHeader + OnchainDkgOutcome parsing
  src/light-client/G2Lib.sol                   G2 compress + on-curve check (for key rotation)
  src/ics20/ICS20NativeAdapter.sol             hub/spoke native BRL ICS20 app
  src/ics20/INative.sol                        Native precompile ABI (0x...4552433230)
  script/HubSend.s.sol                         deploys a hub on anvil and sends 5 BRL (fixture gen)
  test/                                        forge tests + fixtures
  vendor/commonware/                           commonware sol/ verifier, vendored (see below)
  lib/                                         submodules: ibc-contracts, OZ 5.6.1, OZ-upgradeable 5.6.1, permit2, forge-std
relayer/
  src/main.rs                                  relayer loop + `lc-init` (runs live, see below)
  src/cert.rs                                  tempo finalization -> MsgUpdateClient
  src/bin/vectorgen.rs                         test vector generator using tempo's own types
  scripts/gen-lc-fixture.sh                    regenerates contracts/test/fixtures/lc.json
  scripts/gen-e2e-fixture.sh                   regenerates contracts/test/fixtures/e2e.json
scripts/bankd/bridge-e2e.sh                    live two-chain e2e (hub + spoke localnets, relayer)
scripts/bankd/connect.sh                       post-genesis: add the light clients on both chains
xtask/src/bankd_ibc.rs                         genesis predeploy of router + AccessManager + adapter
```

Pins: ibc-contracts `0759094e`, commonware monorepo `66c914bb` (sol/ files copied as is, MIT OR Apache-2.0, license files next to them). solc 0.8.28, evm `prague`, via-ir.

## Live milestone (two local bankd chains)

`scripts/bankd/bridge-e2e.sh` does the whole thing and passes:

1. brings up hub 9001 (rpc 8545) and spoke 9002 (rpc 9545), 1 validator each. 1-validator DKG and finalization work fine. Router, AccessManager and adapter are already in genesis (see "Genesis predeploys" below), and the script checks that at block 0
2. `scripts/bankd/connect.sh` adds the light clients: `bankd-relayer lc-init` reads each chain's current group key (genesis `extraData` for epoch 0, else the last boundary header), then a CommonwareLightClient for the other chain gets deployed and registered as `spoke-9002` on the hub and `bankd-hub` on the spoke
3. starts the relayer, hub sends 5 BRL to a fresh key -> it gets 5 native BRL on the spoke -> ack clears the hub commitment -> that key sends 2 BRL back (paying gas from the minted BRL) -> hub releases 2 to the receiver, escrow 5 -> 3 -> ack relayed back to the spoke
4. tears both chains down (always, via trap; `KEEP=1` keeps them)

```bash
cargo build --bin tempo --bin tempo-xtask
./scripts/bankd/bridge-e2e.sh                      # epoch length 600, stays in epoch 0
EPOCH_LENGTH=30 ./scripts/bankd/bridge-e2e.sh      # rotates keys mid-run, both directions
HUB_PORT=28545 HUB_CONS=29000 SPOKE_PORT=29545 SPOKE_CONS=39000 ./scripts/bankd/bridge-e2e.sh  # if 8545 etc are taken
```

With `EPOCH_LENGTH=30` the relayer submits boundary headers (heights 29, 59) before the target header, and the light clients rotate to the new DKG output from `extra_data`. So live epoch rotation works on real tempo headers and real certificates. The script refuses to start if the ports are in use, because another localnet on 8545 would otherwise silently answer.

Relayer RPC facts, checked against the live node:

- `consensus_getFinalization` takes `{"height": N}` (or `"latest"`) and returns `{epoch, view, digest, certificate, block: {header, body}}`. The header is TempoHeader serde JSON, so the relayer deserializes it with `tempo-primitives` (serde feature) and RLP-encodes it itself. keccak matches the certified digest. `debug_getRawHeader` also returns the same RLP, but it isn't needed.
- `certificate` is hex of `Finalization` (proposal + vote sig + seed sig, 131 bytes). Decoded with commonware 2026.9.0 in `cert.rs`.
- reth serves `eth_getProof` only at the tip (`eth-proof-window` defaults to 0). So the relayer snapshots the proof at the tip first, waits for that block to be finalized, and then updates the client at exactly that height. No node flag needed.
- `eth_getBlockByNumber("finalized")` works for the finality wait.

## Running it

```bash
git submodule update --init contracts/lib/ibc-contracts contracts/lib/openzeppelin-contracts \
  contracts/lib/openzeppelin-contracts-upgradeable contracts/lib/permit2 contracts/lib/forge-std

cd contracts && forge test          # 29 tests
cd relayer && cargo +1.97.1 test    # 2 tests, checks cert conversion against the same fixture

# regenerate fixtures (needs anvil, jq, cargo 1.97.1)
relayer/scripts/gen-lc-fixture.sh
relayer/scripts/gen-e2e-fixture.sh
```

Don't init the nested submodules inside permit2 / OZ-upgradeable, they aren't needed (remappings point at our own copies).

## How the light client works

- `updateClient(abi.encode(MsgUpdateClient))`: decode the TempoHeader RLP, take `epoch = height / epochLength`, look up that epoch's group key, rebuild the simplex Finalize subject `(epoch, view, parent, keccak(headerRlp))` and verify the MinSig vote signature with commonware's `LibSimplexBLS12381Threshold`. Then store `height -> (stateRoot, timestamp)`.
- If the header has `consensus_context`, its epoch/view/parent_view must match too.
- Epoch rotation: when `height % epochLength == epochLength - 1` (tempo's boundary block), we read `OnchainDkgOutcome` from `extra_data`, check `outcome.epoch == epoch + 1`, and check the relayer supplied uncompressed key compresses to the identity bytes in there (and is on curve). Then store it for `epoch + 1`. This isn't stubbed, it parses the real encoding.
- `verifyMembership` / `verifyNonMembership`: MPT account proof for the counterparty router against the stored state root, then storage proof for `keccak(abi.encode(keccak(path), IBCStore slot))`. Same slot math and `TrieProof` as ibc-contracts' Besu client.
- Same height, different header = freeze (returns `Misbehaviour`). Older epochs than the latest one are refused.

Gas (forge, prague): updateClient ~265k, boundary update with rotation ~475k, verifyMembership ~75k.

## Test vectors

They're real, not hand-made:

- `vectorgen` builds a `TempoHeader` with tempo's own `tempo-primitives` type, signs a `Finalization` with commonware 2026.9.0 (same crate version tempo uses) using `bls12381_threshold::vrf::Scheme` and namespace `TEMPO`, and then runs the exact `finalization.verify` that tempo's `FinalizationVerifier` runs. The boundary header's `extra_data` is a real `OnchainDkgOutcome` from `tempo-dkg-onchain-artifacts`.
- State roots and proofs come from anvil (`eth_getProof`).
- `E2ETest` is the milestone: a hub deployed on anvil sends 5 BRL, the spoke gets a certified header over that anvil block's state root, `recvPacket` verifies the real commitment proof, and the receiver gets 5 BRL minted (Native precompile mocked with `vm.etch`).
- The committee is a local 3-of-4 DKG deal, not a real running network. And the header isn't one a tempo node produced, just one built with the same type.

## Uncertain / mismatches (please read)

- **Signature encoding.** Tempo certs carry compressed G1 (48 bytes) and a vote + seed signature pair. The sol verifier wants uncompressed G1 (96 bytes). So the relayer decompresses the vote signature (`relayer/src/cert.rs`) and drops the seed sig (it's only for the VRF, finality doesn't need it). The contract never sees tempo's raw cert bytes. If we want the contract to take the raw cert, we'd need G1 decompression in Solidity (modexp sqrt), doable but not done.
- **Group keys** are compressed G2 in `OnchainDkgOutcome`. Decompressing G2 on chain needs an Fp2 sqrt, so instead the relayer passes the uncompressed key and the contract compresses it and compares. Checked against blst output in `test_CompressMatchesBlst`.
- **Vendored sol/ vs crates.io 2026.9.0.** sol/ is from monorepo HEAD, which is newer than the 2026.9.0 crates tempo uses. The fixtures prove they agree today (varint round, `_FINALIZE` suffix, framed namespace). Re-run the fixture scripts after any commonware bump.
- **Epoch math** assumes tempo's `FixedEpocher` (`epoch = height / epochLength`, boundary = last block of the epoch). If bankd changes the epoch strategy, the client breaks.
- **Namespace** is a constructor arg. Tempo uses `TEMPO`. If E1 changes `crates/consensus/src/config.rs` NAMESPACE, deploy with the new one.
- **Native precompile:** E3's precompile matches the ABI. The spoke adapter is a minter from genesis (see below).

## Gaps

- Relayer: no timeouts (timed out packets are just skipped), no batching. Restart recovery rescans logs from `{A,B}_FROM_BLOCK` (default 0) every start, so no saved cursor yet. It relies on `consensus_getFinalization` still having old boundary heights when catching up. That worked here, but pruning limits are untested.
- No trusting period. A retired committee can't sign for newer epochs, but its key stays valid for its own epoch while that's still the latest.
- `misbehaviour()` isn't implemented. Conflicting headers only freeze the client if both get submitted via `updateClient`.
- Proofs aren't cached per tx (Besu does this with transient storage), so batching many packets repeats the account proof.
- Adapter: no spoke to spoke routing through the hub, no compliance route policy checks, no `evm_exec` callback yet. If a hub refund goes to a contract that rejects BRL, the ack/timeout reverts and gets stuck.
- AccessManager admin and adapter owner are the Authority owner *at genesis*. Rotating Authority ownership later doesn't move them, that's a separate `grantRole`/`transferOwnership` today.

## Genesis predeploys

A fresh chain is bridge-ready from genesis. `tempo-xtask generate-genesis` / `generate-localnet` take:

```bash
--ibc-predeploy                    # put the IBC contracts in the alloc
--ibc-mode hub|spoke               # adapter mode (default hub). spoke also adds the adapter to --native-minters
--ibc-artifacts contracts/out      # forge build output the bytecode comes from
--ibc-relayers 0xA,0xB             # granted RELAYER_ROLE on the router
--ibc-hub-clients bankd-hub        # spoke only, client ids the adapter trusts as the hub
```

`localnet.sh` passes these from env: `IBC_MODE=hub|spoke|none` (default hub), `IBC_RELAYERS`, `IBC_HUB_CLIENTS` (spoke default `bankd-hub`). It runs `forge build` if `contracts/out` is missing.

Same addresses on every chain:

| contract | address |
|-|-|
| AccessManager (admin = Authority owner) | `0xF0A69d75d5903afF51d51BBf3b0752B6aBfcEC33` |
| ICS26Router implementation | `0xD8517Af4f4767F16DF0916966B259BE075711A28` |
| ICS26Router (ERC1967Proxy, use this one) | `0x4be2f106a550b243B60Fa279228f4e94b1EF8AeC` |
| ICS20NativeAdapter (owner = Authority owner) | `0xBA01319fA1739A1D69aBae52B64105C74764CA4c` |

How it works (`xtask/src/bankd_ibc.rs`): a throwaway genesis EVM gets a tiny keyless deployer at `0x...49424344` ("IBCD") that CREATEs whatever calldata it's sent. The four contracts are deployed through it with their real constructors, then `addIBCApp("transfer", adapter)`, the RELAYER_ROLE function mapping, relayer grants and the spoke's `setTrustedClient` run as system calls from the owner. The resulting code + storage is copied into the alloc and the deployer is dropped.

Why this over hand-written storage or relocating code:

- Constructors and initializers really run, so immutables (`ROUTER`, `MODE`, UUPS `__self`), the ERC-1967 implementation slot and the Initializable state are exactly what a normal deploy produces. Relocating code to vanity addresses would break UUPS `__self`.
- Addresses only depend on the deployer's nonce, not on the owner, mode or bytecode, so they're the same on hub and spoke and across contract changes. CREATE2 through a factory would move them whenever the owner or the bytecode changes.
- It's a separate EVM because revm's system calls finalize the journal, which would drop the precompile state the main genesis EVM keeps there.

Two gotchas:

- AccessManager treats `since == 0` as "no role", so grants made at timestamp 0 never count. The throwaway EVM runs at timestamp 1. That means `hasRole` answers false at block 0 itself (timestamp 0) and true from block 1 on.
- The bytecode is read from `contracts/out` at genesis time, so `forge build` first. The foundry config (solc 0.8.28, `bytecode_hash = "none"`) keeps it reproducible.

### Light clients: post-genesis, one command

Clients can't be in genesis. A chain's group key only exists once its DKG has run, and in production the two chains are never generated together. So linking two chains is the one admin step after genesis:

```bash
scripts/bankd/connect.sh http://127.0.0.1:8545 http://127.0.0.1:9545   # hub rpc, spoke rpc
# env: ADMIN_PK (Authority owner, default anvil acct 0), EPOCH_LENGTH (or HUB_/SPOKE_EPOCH_LENGTH),
#      HUB_CLIENT_ID (default spoke-<spoke chain id>), SPOKE_CLIENT_ID (default bankd-hub)
```

It deploys a CommonwareLightClient on each side (from `lc-init`) and registers it under a custom client id, then makes sure the spoke adapter trusts its hub client. It's idempotent, an existing client id is skipped.

For localnet we could compute both group keys from the seeds up front and bake the clients into genesis, but that only works for epoch 0 of two chains generated together, and it'd be a second code path that production never uses. Not worth it.

**Custom client ids matter.** `ICS26Router.addClient(counterparty, client)` (the generated `client-N` one) isn't access controlled, anyone can call it. So pre-trusting `client-0` at genesis would let anyone register their own light client as `client-0` first and mint BRL on the spoke. Custom ids go through the `restricted` overload (AccessManager admin only), and xtask refuses `--ibc-hub-clients` the router would reject as custom ids (`client-`/`channel-` prefix, length outside 4-128, odd chars). `bridge-e2e.sh` checks live that Bob and the relayer can't `addClient("bankd-hub", ...)` or `setTrustedClient` on the spoke, while the admin can. Note the old post-genesis flow had the same race between `addClient` and `setTrustedClient(client-0)`.

Checked (2026-09-23, on top of main `c881bcbee5`):

- `cargo test -p tempo-xtask bankd_ibc`: 5 tests. The two that need `contracts/out` load the alloc into a fresh EVM and check owner, mode, trusted clients, port binding, AccessManager roles + relayer selector mapping, the ERC-1967 slot, that proxy and implementation can't be re-initialized, and that only the admin can add the trusted client id. They skip (with a message) when `forge build` hasn't run
- `bridge-e2e.sh` passes with the predeploys, default epochs and `EPOCH_LENGTH=30` (boundary updates at 29/31), including the relayer restart and the block 0 / non-admin checks
- `smoke.sh` passes on a 1-validator localnet with the hub predeploy, and `shield-e2e.sh` still passes (localnet now predeploys by default)
