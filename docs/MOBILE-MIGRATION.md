# Mobile wallet migration on the admin PR

This change stacks on
[admin PR #8](https://github.com/mizufinance/bankd-commonware-v2/pull/8).
Its base is the admin head `0d2a0913365bd8ad16e0ef15e28ce4ad97fa3f47`.
That branch lives in `fdymylja/bankd-commonware-v2`, so the mobile draft targets
`codex/admin-commonware-migration` there. The upstream repository does not contain
that branch and the available account has read-only access to upstream.

All mobile TypeScript/JavaScript, Expo configuration, tests and the WebView build
are under `typescript/mobile/`. It is part of the existing pnpm workspace with
`admin/`, `packages/shared/` and `packages/shieldd-web/`.

## Review the port separately from the import

The first commit, `7c896caf3af75937fcb7ed516cd86ac41a2b3c68`, imports the tracked `mobile/` directory unchanged
from [bankd at 13c42e04](https://github.com/mizufinance/bankd/tree/13c42e048a9bdd8c5b465c48ce8c56fb06e715d6)
into `typescript/mobile/`. Its large diff is existing application code/assets
and the previous embedded SDK archive. Review the actual migration with:

```bash
git diff 7c896ca..HEAD
```

## Effective query and transaction changes

| Area | Original wallet | Commonware wallet |
| --- | --- | --- |
| Public balance | Cosmos bank query options | Reuses the admin's `eth_getBalance` implementation; native `abrl`, 18 decimals |
| Wallet network | Saved RPC fields did not affect requests | One live RPC setting for shared queries, viem signing and the Shieldd engine; prover is independently configurable |
| Public send | `MsgSend` through MsgExec | `BankSend.send` with integer amount; ERC20 executor calls use ordinary `transfer` |
| Shield | Signed Cosmos deposit and optional module ERC20 conversion | Payable `Shield.deposit(shielddAddress)` with native BRL value |
| Private wallet reads | gRPC-web query rewriting and Comet RPC | SDK gRPC-web adapter calls finalized `bankd_shieldQuery`; range batches are capped at 256 heights |
| Height and timestamps | Comet `/status` and `/block` | Finalized EVM block queries and block timestamps |
| Private send / withdrawal | Cosmos TxRaw wrapper and Tendermint broadcast | Native `0x77` RLP envelope through `eth_sendRawTransaction`; successful receipt, finalized height and wallet scan |
| Withdrawal recipient | Cosmos `wallet1…` representation | 20-byte EVM `0x…` recipient for host payout |
| Proof preflight | Local SCT without committed-root check | Node anchor lookup before proving; query failure or uncommitted root blocks submission |
| IBC send helper | Cosmos transfer/convert messages and nanosecond timeout | Native adapter `sendTransfer` with router client ID, BRL value and seconds timeout |
| Contract calls / deployment | MsgExec response decoding and Cosmos lookup mixed with viem | Direct viem calls/deployment, EVM receipts and finality; existing progress callbacks retained |

The proof protocol, note format, key derivation and native wallet signing/storage
are reused. The Commonware SDK archive is the exact one shipped by the admin
PR; no second WASM build or cryptographic implementation was introduced.

## Necessary changes beyond queries and transactions

- **Packaging:** link the mobile app and its HTML build into the pnpm workspace;
  remove the old SDK archive and duplicate SDK dependency. The bridge is one
  offline HTML asset used by native WebViews and the portable browser preview.
- **Remove demo coupling:** the source re-exported its web bridge and swap screen
  from `amm_demo` and fetched gold/demo prices for balances. The bridge is now
  self-contained. The wallet's earlier EVM AtomicSwap screen is restored from
  bankd `a0a69371`; AMM deployment/pricing services are not imported. BRL totals
  use native BRL and do not invent gold or foreign-currency valuations.
- **Reachable wallet flows:** the source exposed shield/withdraw hooks but depended
  on token-demo creation to deposit. The balance card exposes those existing
  actions, the send form supports native public BRL as well as private tokens,
  and receive displays both EVM and fresh private addresses.
- **Amount/address fixes:** validate `shieldd1` bech32m checksums and 48-byte payloads,
  keep 18-decimal integer precision, reject excessive input precision, and fix
  “Use max” to use display units rather than raw base units.
- **Sync and cache lifecycle:** scan toward a captured finalized target, report
  that target in sync status, serialize private mutations, and wait for the
  confirmed transaction's height before another spend. IndexedDB caches are
  scoped to wallet, chain, endpoint and genesis; activity history is scoped to
  wallet/endpoint. Reloading or locking rejects pending requests and destroys
  in-memory spend keys. The source's development auto-unlock with a hardcoded
  password is removed.
- **Development connectivity:** optional RPC bind/CORS settings in `localnet.sh`
  support WebView/Expo origins and physical-device endpoints. Native HTTP access
  is opt-in through `EXPO_PUBLIC_ALLOW_HTTP`; defaults do not change node binding.

No Rust, Solidity, genesis, consensus, embedded Shieldd source or admin UI was
changed. The shared package gains a configurable RPC transport for the mobile
settings; the admin keeps its existing default transport.

## Inherited limitations

Only native BRL can be shielded/withdrawn on this base. Regulated GOLD/other asset
registration, Cosmos MsgExec, module token conversion and the external AMM demo
are unavailable. The unsupported deploy/register/auto-shield token action is
removed before it can spend gas and then fail.

Private swap and lending were already disabled in the imported source and remain
so. EVM application screens still require compatible deployed contracts and
supported public assets. The public send picker lists native BRL; ordinary ERC20
calldata remains supported by the executor, without fabricating a token registry.
IBC requires real deployed clients and a relayer; the helper's receipt means
submitted, not acknowledged. Cross-chain settlement is outside this one-chain
validation.

## Validation

- Fresh frozen-lockfile pnpm install; mobile and bridge TypeScript checks; 21 ABI/precision/address/query/receipt tests.
- Web static export and separate iOS/Android Metro + Hermes bytecode exports,
  including the single-file WASM asset.
- Native configuration introspection verifies the opt-in Android cleartext and
  iOS WebView/local-network settings.
- Shared/admin TypeScript checks, admin production build, 14 Commonware tests,
  12 Safe tests and 2 pinned SDK provenance/export checks after workspace changes.
- Real Chromium at a 390 × 844 mobile viewport against a disposable Commonware
  node and the pinned Go prover: import, `1.000000000000000123 BRL` deposit and
  note decryption, `0.200000000000000001 BRL` private send decrypted by a second
  wallet, `0.100000000000000123 BRL` withdrawal credited exactly to the EVM
  recipient, and `0.123456789123456789 BRL` public send.
- Live RPC setting validation/change, private-engine restart and balance recovery,
  plus lock removing the engine and unlock restoring the persisted wallet.

No iOS/Android simulator or physical device is attached to this environment; native
installation, biometric unlock and camera scanning have not been exercised.
See [mobile setup](../typescript/mobile/README.md) for reproducible commands.
