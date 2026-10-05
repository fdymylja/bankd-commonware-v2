# Bank'd Commonware mobile wallet

The Expo wallet and its bundled Shieldd WebView engine live in `typescript/mobile`.
It reuses the admin PR's Commonware browser SDK and the node's native BRL asset
(`abrl`, 18 decimals). See [the migration breakdown](../../docs/MOBILE-MIGRATION.md)
for the effective changes and the capabilities inherited from the base.

## Local chain and prover

From the repository root:

```bash
git submodule update --init --recursive shieldd
pnpm --dir typescript install --frozen-lockfile
BANKD_RPC_CORS=http://localhost,http://localhost:8081,http://127.0.0.1:8081 \
  IBC_MODE=none scripts/bankd/localnet.sh up 9001 8545 9000 1
```

In a second terminal:

```bash
scripts/bankd/prover.sh --warm transfer
```

The standard development seed is funded by this localnet:
`test test test test test test test test test test test junk`.
Use it only with a disposable development chain.

## Start the wallet

```bash
pnpm --dir typescript mobile:web
# Or Metro with the existing Expo development client:
pnpm --dir typescript mobile:dev
```

Both commands build the single-file Shieldd HTML before starting Expo. The
native WebView and browser iframe execute the same WASM, planner, sync and proof
code. No SDK rebuild, AMM demo server, Cosmos REST server or proving-key copy is
required. The browser preview uses port 8081; include its exact origin in
`BANKD_RPC_CORS`. On an existing localnet, use `localnet.sh restart` with that
setting to enable the configured origins without discarding its data.

Import a wallet, then use the public BRL card to shield/withdraw. Transfers has
public and private sends, plus public and fresh private receive addresses. The
public form currently lists native BRL; the executor also supports ordinary
ERC20 calls for attached EVM applications.

## Device endpoints

Settings → Network applies and saves the Commonware RPC and Shieldd prover URLs.
Changing either restarts the private engine and clears query caches. Saved URLs
have priority over build-time defaults. The chain is fixed to 9001; private
initialization checks the actual RPC chain ID before scanning.

Defaults are `http://127.0.0.1:8545` and `http://127.0.0.1:8090`. Set these before
starting/exporting Expo to use different defaults:

```bash
EXPO_PUBLIC_EVM_RPC=http://127.0.0.1:8545 \
EXPO_PUBLIC_PENUMBRA_PROVER_URL=http://127.0.0.1:8090 \
  pnpm --dir typescript mobile:dev
```

For the Android emulator use `10.0.2.2` in both URLs; the iOS simulator can use
`127.0.0.1`. A physical device needs a reachable host/LAN address. The development
node and prover default to loopback; `BANKD_RPC_ADDR` and `BANKD_PROVER_ADDR` can
bind them to the development host's LAN address. Native WebViews use the origin
`http://localhost`, which belongs in the RPC CORS list. The prover accepts private
witnesses, so use it on a trusted development network.

Local HTTP is opt-in for native builds:

```bash
EXPO_PUBLIC_ALLOW_HTTP=1 pnpm --dir typescript/mobile ios
EXPO_PUBLIC_ALLOW_HTTP=1 pnpm --dir typescript/mobile android
```

That setting configures iOS WebView/local-network access and Android cleartext
access at native build time. Rebuild the development client after changing it.
Leave it unset for HTTPS endpoints. Native runs require Xcode/iOS or Android SDK
setup respectively; Metro/Hermes exports do not need a simulator.

## Verify

```bash
pnpm --dir typescript mobile:typecheck
pnpm --dir typescript mobile:test
pnpm --dir typescript/mobile export:web
pnpm --dir typescript/mobile export:native
pnpm --dir typescript/mobile test:e2e
```

The end-to-end check serves the web export and submits real transactions through
its mobile interface and bundled engine. It requires the disposable node,
funded seed, CORS origins above and prover. It checks an 18-decimal deposit,
a private send decrypted by a second wallet, exact EVM withdrawal credit, public
send and key removal when locking. Chromium uses the system Chrome channel;
set `CHROMIUM_PATH` to use another installed Chromium executable. Reports and
screenshots are under the ignored `test-results/` directory.

Native exports produce separate iOS/Android Hermes bundles in `dist-native/`,
including the offline HTML/WASM asset. The exported browser is a development
preview; native encrypted storage remains the existing Expo SecureStore flow.
