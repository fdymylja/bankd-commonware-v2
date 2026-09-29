# TODO: final requirements for the IBC migration run

Goal: full JUNO<>GAIA then CW<>GAIA migration over the same channel, swapping the client. Not ready yet, this is what's left.

## Done

- verifier crate, precompile (gated at T14), `TendermintLightClient.sol` (forge tests only vs a mock precompile)
- relayer cmds `tm-update-msg`, `tm-proof`, `tm-header`. A relayer built header and a non-membership proof from the live gaia both verify offline

## Blockers

- **T14 bankd.** Running stack has no `t14Time`, so the precompile is off. Needs a fresh genesis or `t14Time` set + restart.
- **Scripts.** `juno-migration.sh` and `gaia-bridge.sh` still use SP1 + proof-api for gaia -> bankd. They need to:
  - deploy `TendermintLightClient` with an initial trusted header
  - use `tm-update-msg` / `tm-proof` instead of proof-api
- **Client swap on the same channel.** Not looked at yet. Need to check how the router re-points a client id to a new light client contract, and whether the legacy alias / v1 voucher flow assumes SP1.

## Untested on-chain

- `tm-update-msg` reading the LC's latest height
- membership proofs for real IBC v2 packet commitment keys (only a non-membership proof for `clients/08-wasm-0/clientState` was checked)
- gas on real headers, the constants are guesses
- update across a gaia validator set change (relayer fetches the trusted next validators, never exercised)

## Open decisions

- who writes the script wiring: me in a new script, or the agent that owns the existing ones
- `updateClient` is open to anyone (SP1 had a submitter role), ok?
- membership rejects once the client is past the trusting period (ibc-go style, SP1 doesn't), ok?
- clock drift is a hardcoded 15s

## Later (hardening)

See the TODO section at the bottom of `PLAN-tendermint-precompile.md`.
