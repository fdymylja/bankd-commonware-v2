# Safe multisig (EVM) in the admin panel

This chain isn't on Safe's hosted app (app.safe.global), so we host the Safe flow
ourselves against the chain's own EVM RPC. It's a stripped-down port of what
app.safe.global does: propose a tx, collect owner signatures, execute. No dApp
browser, no token lists, no Safe transaction service - just the core signing
lifecycle plus the cosmos-specific bits (msgexec, authority).

The whole thing lives in `src/lib/safe/` and the Safe surface on the
`/multisig` page. It sits next to the cosmos-multisig flow and doesn't touch it.

## The big idea

A Safe deployed at a cosmos multisig's own address is both a Gnosis Safe (EVM)
and a cosmos account. Because `msgexec.execute` runs with
`contract.Caller() == Safe address == cosmos multisig address`, a Safe can drive
cosmos-side messages too - the signer checks pass. So one Safe gives you:

- native EVM sends
- any cosmos SDK msg (via the msgexec precompile)
- x/authority exec (via `authority.MsgExec` wrapped in msgexec)
- its own owner / threshold management

## Lifecycle

Same shape as the cosmos multisig paste-blob flow, just for Safe
`execTransaction` instead of a cosmos tx.

1. **Propose.** Pick a variant, fill the form, hit "Propose + sign". We read the
   Safe's live `nonce()`, build the `SafeTx`, and ask the Safe contract to
   compute its own EIP-712 digest via `getTransactionHash(...)` (we don't
   rebuild the domain by hand - the contract is the source of truth). The
   initiator auto-signs.
2. **Collect signatures.** Copy the unsigned blob, send it to the other owners.
   Each owner imports it, signs, and sends back a signature blob. Paste each one
   into the pending card. It's the same offline co-signing UX as the cosmos side.
3. **Execute.** Once you've hit threshold, "Execute" concatenates the sigs (in
   ascending owner-address order, which `checkSignatures` requires) and submits
   `execTransaction` from your personal account. You pay gas; min-gas-price is 0
   on the testnet.

### Signing detail

Owners sign the **raw** `safeTxHash` - no EIP-191 prefix - and we **keep** the
recovery byte `v` (in {27, 28}). That's the direct-ecrecover case Safe's
`checkSignatures` verifies. Note this differs from the cosmos multisig path,
which drops `v`. This mirrors `scripts/safe-exec.sh`, the authoritative
reference.

## Variants

- **Native send** - plain value transfer out of the Safe. Amount is in display
  units (BRL); we scale to 18-decimal wei.
- **Cosmos send** - a `bank.MsgSend` from the Safe's cosmos address, wrapped in
  `msgexec.execute`. Amount is in base units (ubrl).
- **Authority exec** - runs an inner SDK msg as the x/authority module account.
  The demo does a `MsgSend` out of the authority module account. See the
  prerequisite below.
- **Add owner** / **Change threshold** - owner management, as self-calls on the
  Safe (`addOwnerWithThreshold`, `changeThreshold`). `removeOwner` is deferred
  for now (it needs the prev-owner linked-list pointer).

## Prerequisite for authority exec

Authority exec only works once x/authority's **owner** is the Safe. Ownership
rotation is two-step (propose then accept), and it's a one-time setup you do
outside this surface (CLI or the cosmos multisig msg flow):

1. The current owner runs `MsgTransferOwnership{ sender: <current owner>,
   new_owner: <Safe address> }`.
2. The Safe accepts with `MsgAcceptOwnership{ sender: <Safe address> }`. You can
   send this as a "Cosmos send"-style msgexec call from the Safe itself
   (typeUrl `/mizufinance.authority.v1.MsgAcceptOwnership`).

After that, the Safe is the owner and "Authority exec" proposals go through.

Under the hood, authority exec builds:

```text
msgexec.execute(
  "/mizufinance.authority.v1.MsgExec",
  MsgExec{
    sender: <Safe bech32>,        // msgexec checks caller == sender
    msg:    Any{ inner SDK msg },  // inner signer = authority module address
  }
)
```

The outer `MsgExec.sender` is the Safe (that's what msgexec validates against the
caller). The inner msg's signer is the **authority module address**
(`wallet13am065qmk680w86wya4u9refhnssqwcvd98446`), because x/authority executes
the inner msg as itself.

## Gotchas

- **Stale nonce.** Two proposals built at the same nonce can't both execute - the
  first to land bumps the nonce and the other's hash no longer matches. The
  pending card shows a stale warning and blocks execute when the chain nonce has
  moved past the tx's nonce. Delete and recreate the stale one.
- **Signature order.** Sigs must be concatenated in ascending owner-address
  order or `checkSignatures` reverts. We sort by the recovered signer address, so
  paste order doesn't matter.
- **Pending storage.** Pending Safe txs live in the shared `multisig-wallets`
  IndexedDB (bumped to v2, `pendingSafeTxs` store). Deleting the Safe wallet
  clears them.

## What's out of scope

Ported the key features, left the rest of app.safe.global alone: no dApp/
WalletConnect browser, no Safe transaction service API, no token/NFT lists, no
arbitrary-call builder. Add those later if the demo needs them.
