# Admin migration to Commonware

This branch is stacked on [PR #2](https://github.com/mizufinance/bankd-commonware-v2/pull/2),
at `b462bd99f6b5bf0bb9df95135fda247eae980284`, and targets its
`reece/bankd-scaffold` branch. The frontend runs in the same repository as the
node and its pinned Shieldd submodule.

## How to review the diff

The first commit, `837eba92a3caeb2b160f36a047c897cddffc9328`, imports `admin/` and
`packages/shared/` unchanged from
[bankd at 13c42e04](https://github.com/mizufinance/bankd/tree/13c42e048a9bdd8c5b465c48ce8c56fb06e715d6).
The large initial diff is the existing application, generated protobufs, contract
bytecode and vendored development SDKs. Review the migration separately with:

```bash
git diff 837eba92a3caeb2b160f36a047c897cddffc9328..HEAD
```

## Effective changes

| Area | Previous integration | Commonware integration |
| --- | --- | --- |
| Public BRL balances | Cosmos bank REST, 6 decimals | `eth_getBalance`, native `abrl`, 18 decimals |
| Public transfers | Cosmos `MsgSend` through MsgExec | `BankSend.send(address,uint256)` |
| Mint and burn | Cosmos native module messages | Native ERC20 precompile `mint` / `burn` |
| Minter management | Cosmos module parameters | Native `setMinter` / `isMinter` and grant events; Authority owner can mint implicitly |
| Authority | Single-step module authority change | `owner`, `pendingOwner`, transfer/accept/cancel ownership |
| Validators | Cosmos PoA validators and parameters | ValidatorConfigV2 tuples; add with key proof, deactivate by index; separate validator owner |
| Freeze, sanctions, seizure | Authority-wrapped Cosmos messages | Compliance precompile calls and replayed EVM events |
| IBC | Cosmos clients, transaction search and commitments | Router client events/views, native adapter `sendTransfer`, EVM packet events and ICS24 commitment paths |
| Shield deposit | Cosmos deposit message | Payable `Shield.deposit(string)` for native BRL |
| Private wallet reads | Separate gRPC/Comet endpoints | Bounded finalized `bankd_shieldQuery` RPC, bridged to existing gRPC-web protobufs |
| Private send / withdrawal | Cosmos mutation message and Tendermint confirmation | Native `0x77` envelope submitted with `eth_sendRawTransaction`; successful EVM receipt and finalized height |
| Public account history | Shinzo-only transaction index | Optional Shinzo plus bounded finalized EVM block queries |
| Safe funding / deployment | Cosmos funding; assumed CreateCall helper | Native EVM funding, normal EOA deployment receipts; helper code checks for Safe operations |

The forms and signing flow remain the existing admin. Retained protobuf objects
are local form intents translated to EVM calldata, not Cosmos transactions sent
to the chain. Amounts use integer base units throughout. Seizure reason/reference
fields are explicitly local annotations because the base precompile does not
store them. Host withdrawals encode an EVM recipient, since the base cannot credit
the old Cosmos address representation.

## Changes beyond queries and transactions

1. **Read-only node RPC.** PR #2 did not expose the browser wallet's compact
   blocks, anchors, nullifier window or compliance proofs. `bankd_shieldQuery`
   reads one finalized Shieldd snapshot using existing Shieldd query logic.
   Requests, ranges and responses are bounded; it cannot write state or subscribe
   indefinitely. This adds no consensus rules or precompile behavior.
2. **Shieldd-web packaging.** The browser Rust wrapper was imported from
   [shieldd-web b731744f](https://github.com/mizufinance/shieldd-web/tree/b731744fec5012d50746f06337eac03f39722e75),
   linked to this monorepo's `shieldd/` at
   `2349ae0708f9e1ae6290981702056486718dee67`, and rebuilt as WASM. The existing
   JavaScript wrapper distribution is preserved. No cryptographic algorithm or
   Shieldd state transition was modified. Build provenance and WASM checksum are
   shipped in the new SDK tarball.
3. **Local browser prover.** The shieldd-web HTTP wrapper was imported so the
   browser can call the pinned Shieldd Go prover/artifacts for transfers and
   withdrawals. The development script builds both together and binds to loopback.
4. **Form semantics and wallet sync.** Authority acceptance/cancellation and
   validator key proofs require different fields/actions. The private wallet now
   waits for the finalized height observed at the start of an operation, avoiding
   an unreachable moving target on a fast localnet. Committed SCT anchors are
   still checked against the node before broadcast.
5. **Workspace setup.** Root pnpm scripts, lockfile, package links and Next.js
   transpilation let the frontend and browser SDK run from this monorepo.

No Solidity, genesis configuration, consensus logic, embedded Shieldd source or
private proof protocol was changed.

## Base limitations made explicit

- The base has no Cosmos MsgExec, Cosmos multisigs, module token conversion or
  regulated asset registration transactions. Those actions are removed from the
  active forms or rejected before signing. Ordinary EVM ERC20 contracts can still
  be deployed and transferred; only native BRL can be shielded through the base
  precompile.
- Global compliance pause and persisted case reasons are absent from the base.
  Freeze, sanctions and seizure remain available.
- Safe is not predeployed. Attaching an existing Safe works; batching and creation
  require deployed helper contracts and otherwise return a clear error.
- Native total supply cannot be recovered from mint/burn logs without recording
  the genesis baseline. The migration does not display an invented supply.
- IBC send queues depend on the base's deployed clients and running relayer.
  A receipt alone is not an outgoing acknowledgement; tracking uses `AckPacket`
  and distinguishes incoming `WriteAcknowledgement` events.
- Supervisor, Shinzo and disclosure demo services are separate dependencies not
  delivered by PR #2. They are not fabricated from the localnet. Unconfigured
  protected disclosure access fails closed. EVM lending/swap demos retain their
  existing contract deployment paths and require their own deployed contracts.

## Validation

- Admin production build and TypeScript checks for admin/shared.
- 26 migration ABI/query/transport and Safe tests; 2 SDK provenance/key derivation
  checks.
- 11 Rust `bankd-shield` tests, including finalized-only reads, query bounds and
  Merkle proofs; `tempo-node` check and actual localnet binary build.
- Browser SDK native check and WASM build against the pinned Shieldd submodule.
- Real Chromium against a disposable one-validator Commonware chain: authority
  permissions and validator reads, exact 18-decimal public BRL transfer, shield
  deposit and private note decryption, proved/finalized private transfer and
  withdrawal with an exact `0.1 BRL` credit to the EVM recipient.
- Real browser minter grant/revoke, ownership transfer start/cancel, native mint
  and burn of `123` base units (`0.000000000000000123 BRL`), and compliance
  freeze/unfreeze, checked against the node after signing.

IBC client tuple decoding and packet commitment paths are tested with RPC
fixtures. Cross-chain relaying and a deployed Safe have not been exercised in this
one-chain browser run. See [admin setup](../admin/README.md) for reproducible commands.
