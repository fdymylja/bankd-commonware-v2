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
```

Pins: ibc-contracts `0759094e`, commonware monorepo `66c914bb` (sol/ files copied as is, MIT OR Apache-2.0, license files next to them). solc 0.8.28, evm `prague`, via-ir.

## Live milestone (two local bankd chains)

`scripts/bankd/bridge-e2e.sh` does the whole thing and passes:

1. brings up hub 9001 (rpc 8545) and spoke 9002 (rpc 9545), 1 validator each. 1-validator DKG and finalization work fine
2. deploys AccessManager + ICS26Router proxy + ICS20NativeAdapter on both (hub mode / spoke mode) with `forge create` + `cast`
3. `bankd-relayer lc-init` reads each chain's current group key (genesis `extraData` for epoch 0, else the last boundary header) and a CommonwareLightClient for the other chain gets deployed and registered as `client-0` on each side
4. spoke: `setTrustedClient(client-0)` and `Native.setMinter(adapter, true)` from the Authority owner (anvil acct 0)
5. starts the relayer, hub sends 5 BRL to a fresh key -> it gets 5 native BRL on the spoke -> ack clears the hub commitment -> that key sends 2 BRL back (paying gas from the minted BRL) -> hub releases 2 to the receiver, escrow 5 -> 3 -> ack relayed back to the spoke
6. tears both chains down (always, via trap; `KEEP=1` keeps them)

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
- **Native precompile:** E3's precompile matches the ABI, and minting works live once the owner calls `setMinter(adapter, true)`. Genesis predeploy of the adapter + `--native-minters` isn't done yet.

## Gaps

- Relayer: no timeouts (timed out packets are just skipped), no batching. Restart recovery rescans logs from `{A,B}_FROM_BLOCK` (default 0) every start, so no saved cursor yet. It relies on `consensus_getFinalization` still having old boundary heights when catching up. That worked here, but pruning limits are untested.
- No trusting period. A retired committee can't sign for newer epochs, but its key stays valid for its own epoch while that's still the latest.
- `misbehaviour()` isn't implemented. Conflicting headers only freeze the client if both get submitted via `updateClient`.
- Proofs aren't cached per tx (Besu does this with transient storage), so batching many packets repeats the account proof.
- Adapter: no spoke to spoke routing through the hub, no compliance route policy checks, no `evm_exec` callback yet. If a hub refund goes to a contract that rejects BRL, the ack/timeout reverts and gets stuck.
- ICS26Router `recvPacket`/`ackPacket` are AccessManager `restricted`. Deploy with public relaying or give the relayer `RELAYER_ROLE`, and point the AccessManager admin at Authority.
- Genesis deployment of the router + LC + adapter isn't written yet. The e2e deploys after genesis with account 0 as AccessManager admin (so it can relay) and as adapter owner.
