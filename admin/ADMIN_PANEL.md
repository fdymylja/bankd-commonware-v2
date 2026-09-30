# Admin Panel

Browser console for operating the bankd chain. Next.js app in this `admin/`
directory (`bankd-admin` in `package.json`). See [README.md](./README.md) to run it.

It talks to a running chain over RPC and drives the custom modules
(`x/native`, `x/poa`, and friends) through wallet-signed transactions instead of
raw CLI.

## Wallets

- **EVM** (MetaMask via wagmi) for the mint/burn, transfer, and demo flows
- **PRAX** for shielded balances and private transfers (Shieldd is embedded in bankd,
  so this talks to the bankd node, not a separate chain)
- **Native wallet** (in-app, see [docs/native-wallet.md](./docs/native-wallet.md))

Permissions come from on-chain params (`usePermissions`): whether the connected
address is the `x/native` admin / a whitelisted minter, or the `x/poa`
authority. The UI gates actions on those roles.

## Pages

| Page | Route | What it does |
|-|-|-|
| Home | `/` | Landing + network status |
| Assets | `/assets` | Issue, manage, and monitor tokens (mint/burn, shield into the pool) |
| Security | `/security` | Add/remove operators in the Whitelisted Operator Set |
| Transfers | `/transfers` | Send assets between institutions (IBC) |
| Network | `/network` | Hub-and-spoke view of bank regions, IBC channels, shielded-pool state |
| Configuration | `/configuration` | View and update module params |

Demo flows live under `/demo`: Audit, Lending, and PvP Swap.

## Notes

Wallets and permissions resolve live from chain state, so what an operator can
do depends on the connected account's roles, not the UI. No built-in multisig
aggregation yet; privileged ops still route through the chain's `x/authority`
owner.
