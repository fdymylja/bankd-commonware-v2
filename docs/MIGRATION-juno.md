# Juno to Juno-on-commonware migration

Plan only for now. The e2e (2 juno vals + 2 commonware vals) comes first, the real Osmosis handover later. Stuff I'm not sure about is marked **UNSURE**.

## What we're moving

- Old: Juno (cosmos-sdk, CometBFT, ibc-go, IBC v1 channels, e.g. Juno<>Osmosis `transfer` channel).
- New: this chain. Commonware consensus, EVM state, IBC v2 in Solidity, 08-wasm client (`cw-commonware`) on the cosmos side.
- Keep: account addresses (same 20 bytes, `juno1...` is just bech32 of them) and balances.
- New: validator consensus keys and the validator set. Validators get fresh commonware keys.

## Accounts

Nothing to map. Old account `juno1x...` is `ripemd160(sha256(pubkey))`. On the new chain the same key signs with the `CosmosSecp256k1` AA signature (`0x05`) and the sender is those same 20 bytes. So a genesis balance for `0xABC...` is the balance of `junoABC...`.

Things that don't carry cleanly:

- Module accounts (bonded pool, distribution, etc). Skip, they don't exist here.
- CosmWasm contract addresses are 32 bytes. Skipped until we add cosmwasm to the network.
- Multisig / non-secp256k1 accounts. Skipped, list them in the export report.
- Vesting accounts. Flatten to liquid balance for the demo, real plan needs a decision.

## Balances (genesis export)

1. Halt old chain at height H (gov software upgrade, so it stops cleanly).
2. `junod export --height H`, then a small tool reads `bank` balances plus staked amounts (delegations converted to liquid, unbonding included) and writes an `alloc` list.
3. Feed the list into the new chain's genesis generation (`xtask generate-genesis`). Native gas token stays as it is in the chain spec, juno's `ujuno` needs to be decided (native asset vs ICS20-style token).
4. Sanity check: sum of alloc equals total supply at H minus skipped accounts. The tool prints both.

For the e2e we do a much smaller version: a handful of funded accounts, export, check the same balances on the new chain by `juno1...` address.

## Validators

- Each old operator generates a new commonware key set (`tempo`/DKG tooling, unchanged).
- They register on the new chain with a tx signed by their *old operator account key* (`CosmosSecp256k1`). The `juno1...` operator address is the continuity proof, so no one has to trust a spreadsheet.
- Set is permissioned (ValidatorConfig precompile), staking/delegation isn't carried over.

## IBC: v1 to v2

The important part. Juno<>Osmosis is a v1 channel: connection + channel bound to a specific 07-tendermint client on each side. Our chain can't speak v1 handshakes (contracts are v2 only), so the old channel itself can't move. What moves is the *client identity and the tokens*.

### The path we want

1. **Pre-halt:** Juno needs ibc-go v10 (v2 support) and 08-wasm. The local `junod` v30.0.0 already has ibc-go v10.6.0, so the v2 part is covered. Still need to confirm 08-wasm is compiled in, if not that's a gov software upgrade.
2. **Drain (best effort):** users bring their IBC assets home over the old channel before H. Osmosis-held `ujuno` unwinds back to native, so the final snapshot has it as plain balances.
3. **Halt and export** as above, launch new chain.
4. **On Osmosis (gov):** the old Juno 07-tendermint client is now expired/stale. Either:
   - **A. recover it. Tested, doesn't work.** On gaiad (ibc-go v10.7.0) `MsgRecoverClient` with an expired `07-tendermint` subject and an Active `08-wasm` substitute passes gov but fails on execution: `PANICKED: cannot convert *types.ClientState into *tendermint.ClientState`. Recover dispatches on the subject's client type, so a native tendermint client can only be recovered with another tendermint client. (Gov catches the panic, the chain is fine.) Only works if the counterparty's Juno client was already an 08-wasm client, then `ibc-wasm migrate-contract` could swap the contract instead.
   - **B. new client, new path.** Create a fresh `cw-commonware` client on Osmosis, register the v2 counterparty pair (Osmosis client id <-> our router client id). Old channel stays dead.
5. **Denoms:** ICS20 v2 denom path uses client ids, not `channel-N`, so anything still on Osmosis as `ibc/H(transfer/channel-N/ujuno)` isn't fungible with `transfer/<new client>/ujuno`. Fix options:
   - Osmosis-side gov migration of the old denom (they've done token migrations before, **UNSURE** on mechanism).
   - Only support the drain path and leave stragglers to a one-time claim.
6. **Escrow on our side:** the juno-side escrow for the old channel gets reproduced in genesis inside the ICS20 native adapter so supply invariants hold (escrow == vouchers elsewhere).

B plus drain is the plan since A is out for native tendermint clients.

### Why not IBC channel upgrades

Channel upgradability (ICS-04 upgrade handshake) can change a v1 channel's version, ordering and connection hops. It's the closest thing to "move the channel", but the upgrade handshake needs a v1 channel end on the counterparty (`ChanUpgradeTry/Ack/Confirm`) over a v1 connection. Our chain only has v2 in Solidity, so there's nobody to answer. Not tried in the e2e, and I'm not sure how much of it survives in ibc-go v10 (the `gaiad` CLI only exposes it through relayers, no gov or tx command).

### Token continuity without moving the channel: legacy alias

The old vouchers on the counterparty can still come home over v2, we just need the new chain to recognize them:

1. Counterparty sends `ibc/H(transfer/channel-N/ujuno)` over the new v2 client. The v2 denom on our side becomes `transfer/<our client>/transfer/channel-N/ujuno`.
2. In genesis, the ICS20 adapter is seeded with escrow equal to what the old chain had outstanding on channel-N, plus an allow-listed alias: that exact trace is treated as native `ujuno` returning home, so it's released from escrow.
3. Supply invariant: native `ujuno` in circulation plus escrow equals old supply at H.

That needs a change in `ICS20NativeAdapter.sol` (alias list, set at genesis or by admin) and it's the piece that makes migration seamless for holders on the counterparty. Not built yet. It goes in the e2e as step 6b: send the step-2 voucher from gaia over the new v2 client and check native `ujuno` shows up at the `juno1...` address.

### "Upgrade client via gov"

Two different things, don't mix them up:

- `MsgIBCSoftwareUpgrade` / `MsgUpgradeClient` on the *counterparty* is for a chain that keeps its consensus type and just changes chain-id/params. Not us, we change the consensus engine, so a 07-tendermint client can never verify the new chain.
- `MsgRecoverClient` is the gov tool for the "client is dead, swap in a live one" case. That's the relevant one (option A).

## Light clients in the e2e

- Juno side verifying us: `cw-commonware` stored via gov as an 08-wasm checksum (already done for gaia, `gaia-localnet.sh`).
- Us verifying Juno: tendermint client in Solidity. ibc-contracts ships `SP1ICS07Tendermint` which needs an SP1 network key (already the case for the gaia flow, see `gaia-bridge.sh`). **UNSURE** if we want that for CI or a mock verifier for the fast path.
- With 2 vals on each side the point is to check header updates across a validator set change: a real 2-of-2 (or 2/3 threshold) commit on Juno, and a commonware BLS cert from 2 validators with an epoch rollover.

## E2E plan

gaiad stands in for Osmosis. It already has 08-wasm (ibc-go 08-wasm v10.5.0), Juno doesn't need it. New `scripts/bankd/juno-migration.sh` drives these, each step re-runnable:

1. `juno-localnet.sh up`: 2 validators, native `junod` processes. Done, funded accounts are `abandon...about` index 0 and 1.
2. `gaia-localnet.sh up`, then hermes opens a plain IBC v1 transfer channel Juno<>gaia and we send `ujuno` over it, so gaia holds `ibc/...` vouchers and Juno escrows.
3. Halt Juno at H (gov software upgrade), export balances, build the new chain's genesis from them.
4. `bankd-localnet-up` with 2 validators. Check `eth_getBalance` of the `0x` form of each funded `juno1...` matches the export.
5. `MsgRecoverClient` on gaia was tried and fails (see option A above). So: create a fresh `cw-commonware` client on gaia and register the v2 counterparty pair (option B).
6. One ICS20 v2 transfer each way, acks back. Old `ibc/...` vouchers on gaia stay on the dead v1 channel, the drain step is what covers them.
7. Force a commonware epoch change and relay another packet to prove client updates still verify.

Stage status: `v1-up`, `halt` and `launch` work (balances verified on both commonware validators). Recover tested and ruled out. Left: cw client on gaia, v2 transfers, legacy alias. Native BRL is the JUNO token here, 18 decimals, and the adapter maps 1 ujuno to 1e12 wei.

## Open questions

- `ujuno` on the new chain: native gas token or ICS20-style token?
- Staked and unbonding balances: flatten to liquid, or drop?
- Vesting accounts: flatten?
- Recover (A) vs new client (B) for Osmosis?
- SP1 proofs in CI or mock verifier for the tendermint side?
- Any accounts that aren't secp256k1 we care about (multisigs, ICAs)?
