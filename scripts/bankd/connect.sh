#!/usr/bin/env bash
# Connects a hub and a spoke bankd chain over IBC. Run once, after both chains are up.
#
#   connect.sh <hub_rpc> <spoke_rpc>
#
# Both chains need the genesis IBC predeploys (tempo-xtask ... --ibc-predeploy). Light clients
# can't be in genesis because a chain's group key only exists once its DKG has run, so this is
# the one post-genesis admin step: per side, read the other chain's current group key
# (bankd-relayer lc-init), deploy a CommonwareLightClient for it and register it on the router.
#
# Client ids are custom ones. Only the AccessManager admin can add those, while generated ids
# (client-N) are permissionless, so a pre-trusted client-N could be squatted by anyone.
#
# env:
#   ADMIN_PK          Authority owner key (AccessManager admin on both chains). Default anvil acct 0.
#   EPOCH_LENGTH      epoch length of both chains (default 600), or HUB_/SPOKE_EPOCH_LENGTH
#   HUB_CLIENT_ID     client on the hub tracking the spoke (default spoke-<spoke chain id>)
#   SPOKE_CLIENT_ID   client on the spoke tracking the hub (default bankd-hub, what localnet trusts)
#   RELAYER_BIN       bankd-relayer binary (built if missing)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
C="$ROOT/contracts"
RELAYER_BIN="${RELAYER_BIN:-$ROOT/relayer/target/debug/bankd-relayer}"

HUB="${1:?usage: connect.sh <hub_rpc> <spoke_rpc>}"
SPOKE="${2:?usage: connect.sh <hub_rpc> <spoke_rpc>}"
ADMIN_PK="${ADMIN_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
HUB_EPOCH_LENGTH="${HUB_EPOCH_LENGTH:-${EPOCH_LENGTH:-600}}"
SPOKE_EPOCH_LENGTH="${SPOKE_EPOCH_LENGTH:-${EPOCH_LENGTH:-600}}"
SPOKE_CLIENT_ID="${SPOKE_CLIENT_ID:-bankd-hub}"

# Genesis predeploys, same on every chain (xtask/src/bankd_ibc.rs).
ROUTER=0x4be2f106a550b243B60Fa279228f4e94b1EF8AeC
ADAPTER=0xBA01319fA1739A1D69aBae52B64105C74764CA4c

log() { echo "==> $*" >&2; }
fail() { echo "FAIL: $*" >&2; exit 1; }

send() { # rpc, then cast send args
  local rpc=$1; shift
  local r
  r="$(cast send --rpc-url "$rpc" --private-key "$ADMIN_PK" --json "$@")"
  [[ "$(jq -r .status <<<"$r")" == 0x1 ]] || fail "tx reverted: $*"
}

has_client() { # rpc, client id
  cast call --rpc-url "$1" "$ROUTER" 'getClient(string)(address)' "$2" >/dev/null 2>&1
}

# Registers a CommonwareLightClient on `rpc` for the chain at `other`, unless `id` exists already.
connect_side() { # rpc, other_rpc, other_epoch_length, client id, counterparty client id
  local rpc=$1 other=$2 len=$3 id=$4 cp_id=$5 init key lc
  if has_client "$rpc" "$id"; then
    log "$rpc: $id already registered, skipping"
    return
  fi
  init="$("$RELAYER_BIN" lc-init "$other" "$len")"
  key="$(cast abi-decode 'f()((bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32))' \
    "$(jq -r .key <<<"$init")" | tr -d ' ')"
  # "TEMPO" is the consensus namespace (crates/consensus config NAMESPACE).
  lc="$(cd "$C" && forge create --rpc-url "$rpc" --private-key "$ADMIN_PK" --broadcast --json \
    src/light-client/CommonwareLightClient.sol:CommonwareLightClient \
    --constructor-args "$ROUTER" 0x54454d504f "$len" "$(jq -r .epoch <<<"$init")" "$key" | jq -r .deployedTo)"
  send "$rpc" "$ROUTER" 'addClient(string,(string,bytes[]),address)' "$id" "(\"$cp_id\",[0x])" "$lc"
  log "$rpc: $id -> light client $lc (counterparty $cp_id)"
}

main() {
  for rpc in "$HUB" "$SPOKE"; do
    [[ "$(cast code --rpc-url "$rpc" "$ROUTER")" != 0x ]] || fail "$rpc has no router predeploy"
  done
  local spoke_chain
  spoke_chain="$(cast chain-id --rpc-url "$SPOKE")"
  HUB_CLIENT_ID="${HUB_CLIENT_ID:-spoke-$spoke_chain}"

  [[ -x "$RELAYER_BIN" ]] || (cd "$ROOT/relayer" && cargo +1.97.1 build -q --bin bankd-relayer)
  (cd "$C" && forge build -q)

  connect_side "$HUB" "$SPOKE" "$SPOKE_EPOCH_LENGTH" "$HUB_CLIENT_ID" "$SPOKE_CLIENT_ID"
  connect_side "$SPOKE" "$HUB" "$HUB_EPOCH_LENGTH" "$SPOKE_CLIENT_ID" "$HUB_CLIENT_ID"

  # Genesis normally trusts the hub client already (--ibc-hub-clients), this covers chains that don't.
  if [[ "$(cast call --rpc-url "$SPOKE" "$ADAPTER" 'trustedClients(string)(bool)' "$SPOKE_CLIENT_ID")" != true ]]; then
    log "spoke: trusting $SPOKE_CLIENT_ID"
    send "$SPOKE" "$ADAPTER" 'setTrustedClient(string,bool)' "$SPOKE_CLIENT_ID" true
  fi
  echo "HUB_CLIENT_ID=$HUB_CLIENT_ID"
  echo "SPOKE_CLIENT_ID=$SPOKE_CLIENT_ID"
}

main "$@"
