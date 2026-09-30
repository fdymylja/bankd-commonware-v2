# Bankd Commonware admin

The admin and shared frontend packages live in this monorepo and use the node's
EVM RPC and embedded Shieldd. See [the migration breakdown](../docs/ADMIN-MIGRATION.md)
for supported operations, SDK provenance and differences from the Cosmos admin.

## Run locally

Initialize submodules and install dependencies from the repository root:

```bash
git submodule update --init --recursive
pnpm install --frozen-lockfile
```

Start a disposable chain using the repository's Rust toolchain. `IBC_MODE=none`
is sufficient for public/private BRL, administration and ordinary EVM use:

```bash
IBC_MODE=none scripts/bankd/localnet.sh up 9001 8545 9000 1
```

In a second terminal, start the browser prover. This builds the Go daemon and
HTTP bridge against the same Shieldd artifacts used by the node:

```bash
scripts/bankd/prover.sh --warm transfer
```

In a third terminal, start the frontend:

```bash
BANKD_RPC_URL=http://127.0.0.1:8545 pnpm admin:dev
```

Open http://localhost:34562. The generated localnet funds the standard development
wallet `test test test test test test test test test test test junk`; import it
through the native wallet dialog. This public seed is only for disposable localnets.

`BANKD_RPC_URL` is a server setting. The browser uses the same-origin `/api/rpc`
gateway and `/api/shieldd` query bridge, so changing the node port does not require
rebuilding the browser. Private proofs use `http://127.0.0.1:8090/prove`; set
`NEXT_PUBLIC_PENUMBRA_PROVER_URL` before building to use another local prover.
The prover binds to loopback by default and accepts private witnesses; run it
only in a trusted development environment.

To exercise IBC, start the base PR's hub/spoke localnet and relayer instead of
`IBC_MODE=none`. The Network page discovers the actual deployed router clients;
it does not create clients or run a relayer.

## Build and verify

```bash
pnpm admin:build
pnpm shared:typecheck
pnpm admin:test
pnpm --filter bankd-admin test:safe
pnpm --filter bankd-admin test:sdk-commonware
pnpm --filter bankd-admin exec tsc --noEmit
BANKD_RPC_URL=http://127.0.0.1:8545 pnpm --filter bankd-admin e2e:commonware
```

The browser check submits real transactions against a disposable localnet and
requires the admin and prover running. Set `E2E_PRIVATE=0` to skip private proofs
and `E2E_ADMIN=0` to skip the administration transactions. Logs/screenshots go to
`/tmp/bankd-admin-browser` by default.

## Browser SDK

The committed Commonware SDK tarball is sufficient to run the frontend. Rebuild
only after changing the pinned Shieldd SDK or browser Rust wrapper:

```bash
rustup target add wasm32-unknown-unknown
# Install wasm-pack separately if it is not already available.
pnpm --filter @bankd/shieldd-web sdk:build
pnpm install --force --no-frozen-lockfile
pnpm --filter bankd-admin test:sdk-commonware
```

The crate links directly to `shieldd/` in this repository. Its independent Cargo
lock and the tarball's `build-provenance.json` record the build inputs. Development
proof keys require the development WASM profile used here.

## Optional services

The base PR does not include the old Cosmos disclosure grants, supervisor metrics
backend or Shinzo indexers. Set `BANKD_DISCLOSURE_URL` only when a compatible
disclosure service exists; unconfigured protected access is denied. Contract
inventory and private indexed history require authenticated Shinzo services.
Public account history has a bounded finalized EVM RPC fallback.

Existing deployed Safe accounts can be attached by address. Safe batches and
contract creation also require the corresponding MultiSend/CreateCall helpers
deployed on the target chain; the localnet does not preinstall them.
