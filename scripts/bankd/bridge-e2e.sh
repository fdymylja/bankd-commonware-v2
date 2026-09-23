#!/usr/bin/env bash
# Live bridge e2e on two local bankd chains (hub 9001, spoke 9002), 1 validator each.
#
#   bridge-e2e.sh            bring both chains up, connect, relay, check balances, tear down
#   KEEP=1 bridge-e2e.sh     leave the chains + relayer running at the end (run `down` yourself)
#   EPOCH_LENGTH=30 ...      short epochs, so the light clients rotate keys during the run
#   HUB_PORT/HUB_CONS/SPOKE_PORT/SPOKE_CONS override the default ports
#
# Router, AccessManager and adapter are genesis predeploys (localnet.sh IBC_MODE). Only the light
# clients get added after genesis, by connect.sh. The relayer uses its own key per chain (anvil
# acct 1 on the hub, acct 2 on the spoke), granted RELAYER_ROLE at genesis. It gets restarted
# mid-run to check it catches up.
#
# Flow: hub sends 5 BRL -> spoke receiver gets 5 native BRL (minted by the adapter through the
# Native precompile) -> receiver sends 2 BRL back -> hub releases 2 from escrow. Acks are relayed
# both ways. Everything goes through the real CommonwareLightClient on each side.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCALNET="$ROOT/scripts/bankd/localnet.sh"
C="$ROOT/contracts"
WORK="$ROOT/target/bankd-bridge-e2e"
RELAYER_TARGET="$(cargo metadata --format-version 1 --no-deps --manifest-path "$ROOT/relayer/Cargo.toml" | jq -r .target_directory)"
RELAYER_BIN="${RELAYER_BIN:-$RELAYER_TARGET/debug/bankd-relayer}"

HUB_ID=9001 HUB_PORT="${HUB_PORT:-8545}" HUB_CONS="${HUB_CONS:-9000}"
SPOKE_ID=9002 SPOKE_PORT="${SPOKE_PORT:-9545}" SPOKE_CONS="${SPOKE_CONS:-19000}"
EPOCH_LENGTH="${EPOCH_LENGTH:-600}"
HUB="http://127.0.0.1:$HUB_PORT"
SPOKE="http://127.0.0.1:$SPOKE_PORT"

# anvil/hardhat account 0: funded by genesis and the Authority owner on both chains.
PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
HUB_RELAYER_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
SPOKE_RELAYER_PK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
# Fresh accounts with no genesis balance, so balances are exactly what the bridge moved.
# Bob receives on the spoke and sends back from the minted BRL (paying gas with it too).
BOB_PK=0x$(printf 'bankd-bridge-e2e-bob' | shasum -a 256 | cut -c1-64)
BOB=$(cast wallet address "$BOB_PK")
CAROL=0x000000000000000000000000000000000000CA70
DAVE=0x000000000000000000000000000000000000DA7E
NATIVE=0x0000000000000000000000000000004552433230

# Genesis predeploys, same on every chain (xtask/src/bankd_ibc.rs).
ROUTER=0x4be2f106a550b243B60Fa279228f4e94b1EF8AeC
ROUTER_IMPL=0xD8517Af4f4767F16DF0916966B259BE075711A28
AM=0xF0A69d75d5903afF51d51BBf3b0752B6aBfcEC33
ADAPTER=0xBA01319fA1739A1D69aBae52B64105C74764CA4c
# Client on the hub tracking the spoke, and on the spoke tracking the hub (connect.sh defaults).
HUB_CLIENT=spoke-$SPOKE_ID
SPOKE_CLIENT=bankd-hub

log() { echo "==> $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

RELAYER_PID=""
cleanup() {
  [[ -n "$RELAYER_PID" ]] && kill "$RELAYER_PID" 2>/dev/null || true
  if [[ "${KEEP:-0}" != 1 ]]; then
    "$LOCALNET" down "$HUB_ID" >/dev/null || true
    "$LOCALNET" down "$SPOKE_ID" >/dev/null || true
  fi
}
trap cleanup EXIT

start_relayer() { # appends to $WORK/relayer.log so restarts keep the history
  log "starting relayer (log $WORK/relayer.log)"
  A_KEY=$HUB_RELAYER_PK B_KEY=$SPOKE_RELAYER_PK \
    A_NAME=hub A_WS="ws://127.0.0.1:$HUB_PORT" A_ROUTER="$ROUTER" A_CLIENT_ID="$HUB_CLIENT" A_EPOCH_LENGTH="$EPOCH_LENGTH" \
    B_NAME=spoke B_WS="ws://127.0.0.1:$SPOKE_PORT" B_ROUTER="$ROUTER" B_CLIENT_ID="$SPOKE_CLIENT" B_EPOCH_LENGTH="$EPOCH_LENGTH" \
    "$RELAYER_BIN" >>"$WORK/relayer.log" 2>&1 &
  RELAYER_PID=$!
  sleep 2
  kill -0 "$RELAYER_PID" 2>/dev/null || { cat "$WORK/relayer.log"; fail "relayer died"; }
}

send() { # rpc, then cast send args
  local rpc=$1; shift
  local r
  r="$(cast send --rpc-url "$rpc" --private-key "$PK" --json "$@")"
  [[ "$(jq -r .status <<<"$r")" == 0x1 ]] || fail "tx reverted: $*"
  echo "$r"
}

# The predeploys must be fully set up in the genesis state itself, not by some later tx.
check_genesis() { # rpc, mode (0 hub, 1 spoke), relayer
  local rpc=$1 mode=$2 relayer=$3
  local c=(--rpc-url "$rpc" --block 0)
  for a in $ROUTER $ROUTER_IMPL $AM $ADAPTER; do
    [[ "$(cast code "${c[@]}" "$a")" != 0x ]] || fail "$rpc: no code at $a in block 0"
  done
  [[ "$(cast call "${c[@]}" "$ADAPTER" 'MODE()(uint8)')" == "$mode" ]] || fail "$rpc: adapter mode != $mode"
  [[ "$(cast call "${c[@]}" "$ADAPTER" 'owner()(address)')" == "$ME" ]] || fail "$rpc: adapter owner != $ME"
  [[ "$(cast call "${c[@]}" "$ROUTER" 'getIBCApp(string)(address)' transfer)" == "$ADAPTER" ]] \
    || fail "$rpc: transfer port not bound to the adapter"
  [[ "$(cast call "${c[@]}" "$ROUTER" 'authority()(address)')" == "$AM" ]] || fail "$rpc: router authority != $AM"
  # Genesis grants roles at timestamp 1 (xtask bankd_ibc.rs) and block 0 has timestamp 0, so ask
  # at block 1. No tx has touched the AccessManager by then, it's still the genesis state.
  local b1=(--rpc-url "$rpc" --block 1)
  [[ "$(cast call "${b1[@]}" "$AM" 'hasRole(uint64,address)(bool,uint32)' 0 "$ME" | head -1)" == true ]] \
    || fail "$rpc: $ME is not AccessManager admin"
  [[ "$(cast call "${b1[@]}" "$AM" 'hasRole(uint64,address)(bool,uint32)' 1 "$relayer" | head -1)" == true ]] \
    || fail "$rpc: $relayer has no RELAYER_ROLE"
  if [[ "$mode" == 1 ]]; then
    [[ "$(cast call "${c[@]}" "$NATIVE" 'isMinter(address)(bool)' "$ADAPTER")" == true ]] \
      || fail "$rpc: adapter is not a Native minter"
    [[ "$(cast call "${c[@]}" "$ADAPTER" 'trustedClients(string)(bool)' "$SPOKE_CLIENT")" == true ]] \
      || fail "$rpc: adapter does not trust $SPOKE_CLIENT"
  fi
}

main() {
  mkdir -p "$WORK"
  : >"$WORK/relayer.log"
  log "building contracts + relayer (genesis reads the predeploy bytecode from contracts/out)"
  (cd "$C" && forge build -q)
  (cd "$ROOT/relayer" && cargo +1.97.1 build -q --bin bankd-relayer)

  # Another localnet on these ports would silently answer our RPC calls, so refuse to start.
  for port in $HUB_PORT $HUB_CONS $SPOKE_PORT $SPOKE_CONS; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      fail "port $port is already in use (another localnet running?)"
    fi
  done

  local hub_relayer spoke_relayer
  hub_relayer="$(cast wallet address "$HUB_RELAYER_PK")"
  spoke_relayer="$(cast wallet address "$SPOKE_RELAYER_PK")"
  log "chains up (1 validator each, epoch length $EPOCH_LENGTH, IBC predeployed at genesis)"
  IBC_MODE=hub IBC_RELAYERS="$hub_relayer" \
    "$LOCALNET" up "$HUB_ID" "$HUB_PORT" "$HUB_CONS" 1 "$EPOCH_LENGTH"
  IBC_MODE=spoke IBC_RELAYERS="$spoke_relayer" IBC_HUB_CLIENTS="$SPOKE_CLIENT" \
    "$LOCALNET" up "$SPOKE_ID" "$SPOKE_PORT" "$SPOKE_CONS" 1 "$EPOCH_LENGTH"

  log "checking the genesis predeploys at block 0"
  check_genesis "$HUB" 0 "$hub_relayer"
  check_genesis "$SPOKE" 1 "$spoke_relayer"
  log "ok: router, access manager and adapter set up in genesis on both chains"

  # The spoke trusts bankd-hub from genesis, so nobody but the admin may register that id first.
  # Bob and the spoke relayer are both non-admins. eth_call is enough, a revert is the check.
  log "checking a non-admin can't take the trusted client id or trust a new one"
  local lc_args=('addClient(string,(string,bytes[]),address)' "$SPOKE_CLIENT" "(\"$HUB_CLIENT\",[0x])" "$CAROL")
  for who in "$BOB" "$spoke_relayer"; do
    if cast call --rpc-url "$SPOKE" --from "$who" "$ROUTER" "${lc_args[@]}" >/dev/null 2>&1; then
      fail "$who could register $SPOKE_CLIENT on the spoke"
    fi
  done
  if cast call --rpc-url "$SPOKE" --from "$BOB" "$ADAPTER" 'setTrustedClient(string,bool)' evil-hub true >/dev/null 2>&1; then
    fail "$BOB could trust a client on the spoke adapter"
  fi
  # Same call as the admin goes through, so the reverts above really are access control.
  cast call --rpc-url "$SPOKE" --from "$ME" "$ROUTER" "${lc_args[@]}" >/dev/null \
    || fail "admin addClient($SPOKE_CLIENT) eth_call reverted"
  log "ok: addClient($SPOKE_CLIENT) and setTrustedClient are admin only"

  log "connecting (light clients, the only post-genesis admin step)"
  EPOCH_LENGTH="$EPOCH_LENGTH" HUB_CLIENT_ID="$HUB_CLIENT" SPOKE_CLIENT_ID="$SPOKE_CLIENT" \
    RELAYER_BIN="$RELAYER_BIN" ADMIN_PK="$PK" "$ROOT/scripts/bankd/connect.sh" "$HUB" "$SPOKE" >/dev/null
  HUB_LC="$(cast call --rpc-url "$HUB" "$ROUTER" 'getClient(string)(address)' "$HUB_CLIENT")"
  SPOKE_LC="$(cast call --rpc-url "$SPOKE" "$ROUTER" 'getClient(string)(address)' "$SPOKE_CLIENT")"
  echo "hub $HUB_CLIENT=$HUB_LC  spoke $SPOKE_CLIENT=$SPOKE_LC"

  cat >"$WORK/addrs.env" <<EOF
ROUTER=$ROUTER
ADAPTER=$ADAPTER
HUB_CLIENT=$HUB_CLIENT
HUB_LC=$HUB_LC
SPOKE_CLIENT=$SPOKE_CLIENT
SPOKE_LC=$SPOKE_LC
EOF

  start_relayer

  wait_for() { # description, command...
    local what=$1; shift
    for _ in $(seq 1 120); do
      if "$@"; then return 0; fi
      kill -0 "$RELAYER_PID" 2>/dev/null || { cat "$WORK/relayer.log"; fail "relayer died waiting for $what"; }
      sleep 1
    done
    cat "$WORK/relayer.log"; fail "timed out waiting for $what"
  }
  bal_is() { [[ "$(cast balance --rpc-url "$1" "$2")" == "$3" ]]; }
  escrow_is() { [[ "$(cast call --rpc-url "$HUB" "$ADAPTER" 'escrowed(string)(uint256)' "$HUB_CLIENT" | awk '{print $1}')" == "$1" ]]; }
  no_commitment() { # rpc path
    [[ "$(cast call --rpc-url "$1" "$ROUTER" 'getCommitment(bytes32)(bytes32)' "$(cast keccak "$2")")" == 0x0000000000000000000000000000000000000000000000000000000000000000 ]]
  }
  path() { echo "0x$(printf '%s' "$1" | xxd -p | tr -d '\n')01$(printf '%016x' "$2")"; } # client, seq

  local timeout
  timeout=$(( $(date +%s) + 3600 ))

  log "hub -> spoke: 5 BRL to $BOB"
  send "$HUB" "$ADAPTER" 'sendTransfer(string,string,uint64,string)' "$HUB_CLIENT" "$BOB" "$timeout" "" --value 5ether >/dev/null
  escrow_is 5000000000000000000 || fail "hub escrow != 5 BRL"
  wait_for "spoke mint" bal_is "$SPOKE" "$BOB" 5000000000000000000
  log "ok: $BOB has 5 native BRL on the spoke"
  wait_for "ack on hub" no_commitment "$HUB" "$(path "$HUB_CLIENT" 1)"
  log "ok: ack relayed, hub packet commitment cleared"

  log "spoke -> hub: bob sends 2 BRL back to $CAROL"
  r="$(cast send --rpc-url "$SPOKE" --private-key "$BOB_PK" --json "$ADAPTER" \
    'sendTransfer(string,string,uint64,string)' "$SPOKE_CLIENT" "$CAROL" "$timeout" "" --value 2ether)"
  [[ "$(jq -r .status <<<"$r")" == 0x1 ]] || fail "spoke send reverted"
  wait_for "hub release" bal_is "$HUB" "$CAROL" 2000000000000000000
  escrow_is 3000000000000000000 || fail "hub escrow != 3 BRL after release"
  log "ok: $CAROL got 2 BRL on the hub, escrow 5 -> 3"
  wait_for "ack on spoke" no_commitment "$SPOKE" "$(path "$SPOKE_CLIENT" 1)"
  log "ok: ack relayed back to the spoke"

  log "restart: stop the relayer, hub sends 1 BRL to $DAVE while it's down, then start it again"
  kill "$RELAYER_PID"; wait "$RELAYER_PID" 2>/dev/null || true
  send "$HUB" "$ADAPTER" 'sendTransfer(string,string,uint64,string)' "$HUB_CLIENT" "$DAVE" "$timeout" "" --value 1ether >/dev/null
  start_relayer
  wait_for "spoke mint after restart" bal_is "$SPOKE" "$DAVE" 1000000000000000000
  wait_for "ack on hub after restart" no_commitment "$HUB" "$(path "$HUB_CLIENT" 2)"
  log "ok: relayer caught up on the packet sent while it was down"

  log "relayer log:"
  cat "$WORK/relayer.log"
  log "PASS"
}

main "$@"
