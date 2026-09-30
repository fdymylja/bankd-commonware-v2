# Admin Panel UI

## Run UI

```bash
pnpm install && pnpm dev

pnpm install && pnpm build && pnpm start
```

## Run Backend

```bash
just local-image
CLEAN=true just compose-up
```

## Regulated assets and disclosures

The registration page accepts complete authority-issued registration JSON.
Asset policy includes four independently provisioned encryption key families
(amount, sender address, receiver address and ownership checking) and an epoch.
User registrations retain ordinary capability/nullifier authorization. New
protected-key provisioning requires upstream work; development keys are synthetic.

Audit review uses the local `disclosure-audit` client and direct Defra operations.
The audit page shows instructions. See [the prototype guide](../infra/disclosure-audit/README.md)
and [capability register](../infra/disclosure-audit/GAPS.md). The fixture is for
trusted local testers only, with NAC disabled; connected clients can administer
the database. Live PET collection and protected delivery are unavailable.

### Browser/mobile SDK

The bundled development SDK supports PET-ready transactions. See the
[SDK verification guide](../tests/e2e/SDK.md) for package provenance, reset
instructions and real browser/WebView transaction checks.

### SCT diagnostics

If the native wallet reports "provided anchor is not a valid SCT root" (or the sync self-heal keeps firing), two Node harnesses in `scripts/` run the real `@mizufinance/wasm` ViewServer outside the browser and compare local SCT roots against the chain's canonical anchors:

- `pnpm sct:roundtrip [--max=H]` - scans compact blocks from the node, replicates the app's incremental persist/reload pipeline, and checks that the live root, reloaded root, and chain anchor all agree. Pinpoints whether a divergence is in scanning, persistence, or reload.
- `pnpm sct:snapshot-check [--max=H]` - byte-compares the snapshot chunks the dev server serves against the chain's compact blocks (duplicates, gaps, mismatches), then scans the snapshot-sourced blocks and checks the resulting root against the chain anchor. This caught the chunk-boundary duplication bug.

Both are read-only and safe against a live stack. Useful after any `@mizufinance/wasm` version bump or Shieldd chain upgrade.

## Accounts

- acc0 & acc1 from the sh-testnet file script in metamask
  - Add Wallet & import account with private key `bankd keys unsafe-export-eth-key acc0` / acc1

- acc0 in PRAX (the Shieldd wallet extension)
  - point the wallet network at bankd's own gRPC, `http://localhost:11317`, chain id
    `9001`. Shieldd is embedded, so there is no separate node on `:8080`. Same values
    as `admin/.env.development`.

### Contract inventory authorization

The admin contract inventory is mine-only and binds the trusted supervisor subject to an EVM wallet. In production, set `SUPERVISOR_TRUST_PROXY_AUTH=true`; the authenticating proxy must strip inbound `x-supervisor-subject` and `x-supervisor-wallet` headers and inject verified values. Local use is denied by default and requires `CONTRACTS_DEV_AUTH=true`, `CONTRACTS_DEV_SUBJECT`, and `CONTRACTS_DEV_WALLET`. Development identity is server-only and request headers cannot override it.

`SHINZO_GRAPHQL_URLS` is an ordered, server-controlled registry matching `supervisor-indexer-policy.json` indexer order. Production endpoints must use HTTPS. Inventory agreement accepts a BlockSignature identity only when it matches the identity statically bound to that authenticated endpoint; an endpoint cannot claim another registered signer. The returned `complete` flag is historical only when indexing starts at height 0; `indexedRangeComplete` describes completeness within the reported indexed range.
