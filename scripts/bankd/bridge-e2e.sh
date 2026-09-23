#!/usr/bin/env bash
# Live bridge e2e on two local bankd chains (hub 9001, spoke 9002), 1 validator each.
#
#   bridge-e2e.sh            bring both chains up, deploy, relay, check balances, tear down
#   KEEP=1 bridge-e2e.sh     leave the chains + relayer running at the end (run `down` yourself)
#   EPOCH_LENGTH=30 ...      short epochs, so the light clients rotate keys during the run
#   HUB_PORT/HUB_CONS/SPOKE_PORT/SPOKE_CONS override the default ports
#
# The relayer uses its own key per chain (anvil acct 1 on the hub, acct 2 on the spoke), each
# granted RELAYER_ROLE on that chain's router. It gets restarted mid-run to check it catches up.
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
    A_NAME=hub A_WS="ws://127.0.0.1:$HUB_PORT" A_ROUTER="$HUB_ROUTER" A_CLIENT_ID=client-0 A_EPOCH_LENGTH="$EPOCH_LENGTH" \
    B_NAME=spoke B_WS="ws://127.0.0.1:$SPOKE_PORT" B_ROUTER="$SPOKE_ROUTER" B_CLIENT_ID=client-0 B_EPOCH_LENGTH="$EPOCH_LENGTH" \
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

create() { # rpc, contract, constructor args...
  local rpc=$1 contract=$2; shift 2
  local args=()
  [[ $# -gt 0 ]] && args=(--constructor-args "$@")
  (cd "$C" && forge create --rpc-url "$rpc" --private-key "$PK" --broadcast --json "$contract" "${args[@]}") \
    | jq -r .deployedTo
}

# Deploys AccessManager + ICS26Router proxy + adapter. Prints "router adapter accessmanager".
deploy_core() { # rpc, mode (0 hub, 1 spoke)
  local rpc=$1 mode=$2 am logic router adapter
  am="$(create "$rpc" lib/openzeppelin-contracts/contracts/access/manager/AccessManager.sol:AccessManager "$ME")"
  logic="$(create "$rpc" lib/ibc-contracts/ibc-solidity/contracts/ICS26Router.sol:ICS26Router)"
  router="$(create "$rpc" lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    "$logic" "$(cast calldata 'initialize(address)' "$am")")"
  adapter="$(create "$rpc" src/ics20/ICS20NativeAdapter.sol:ICS20NativeAdapter "$router" "$mode" "$ME")"
  send "$rpc" "$router" 'addIBCApp(string,address)' transfer "$adapter" >/dev/null
  echo "$router $adapter $am"
}

# Lets `relayer` call recvPacket, timeoutPacket, ackPacket and updateClient (IBCRolesLib.RELAYER_ROLE).
grant_relayer() { # rpc, access manager, router, relayer
  local rpc=$1 am=$2 router=$3 relayer=$4
  send "$rpc" "$am" 'setTargetFunctionRole(address,bytes4[],uint64)' "$router" \
    '[0x5ebd10ca,0xb98c330a,0x1bca011a,0x6fbf8079]' 1 >/dev/null
  send "$rpc" "$am" 'grantRole(uint64,address,uint32)' 1 "$relayer" 0 >/dev/null
  [[ "$(cast balance --rpc-url "$rpc" "$relayer")" != 0 ]] || fail "relayer $relayer has no gas on $rpc"
}

# Deploys a CommonwareLightClient on `rpc` tracking the chain at `other_rpc`, registers it as client-0.
deploy_client() { # rpc, other_rpc, other_router
  local rpc=$1 other=$2 other_router=$3 init lc
  init="$("$RELAYER_BIN" lc-init "$other" "$EPOCH_LENGTH")"
  lc="$(create "$rpc" src/light-client/CommonwareLightClient.sol:CommonwareLightClient \
    "$other_router" 0x54454d504f "$EPOCH_LENGTH" "$(jq -r .epoch <<<"$init")" \
    "$(cast abi-decode 'f()((bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32))' "$(jq -r .key <<<"$init")" | tr -d ' ')")"
  echo "$lc"
}

main() {
  mkdir -p "$WORK"
  : >"$WORK/relayer.log"
  log "building contracts + relayer"
  (cd "$C" && forge build -q)
  (cd "$ROOT/relayer" && cargo +1.97.1 build -q --bin bankd-relayer)

  # Another localnet on these ports would silently answer our RPC calls, so refuse to start.
  for port in $HUB_PORT $HUB_CONS $SPOKE_PORT $SPOKE_CONS; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      fail "port $port is already in use (another localnet running?)"
    fi
  done

  log "chains up (1 validator each, epoch length $EPOCH_LENGTH)"
  "$LOCALNET" up "$HUB_ID" "$HUB_PORT" "$HUB_CONS" 1 "$EPOCH_LENGTH"
  "$LOCALNET" up "$SPOKE_ID" "$SPOKE_PORT" "$SPOKE_CONS" 1 "$EPOCH_LENGTH"

  log "deploying router + adapter"
  read -r HUB_ROUTER HUB_ADAPTER HUB_AM <<<"$(deploy_core "$HUB" 0)"
  read -r SPOKE_ROUTER SPOKE_ADAPTER SPOKE_AM <<<"$(deploy_core "$SPOKE" 1)"
  echo "hub   router=$HUB_ROUTER adapter=$HUB_ADAPTER"
  echo "spoke router=$SPOKE_ROUTER adapter=$SPOKE_ADAPTER"

  log "deploying light clients"
  HUB_LC="$(deploy_client "$HUB" "$SPOKE" "$SPOKE_ROUTER")"
  SPOKE_LC="$(deploy_client "$SPOKE" "$HUB" "$HUB_ROUTER")"
  send "$HUB" "$HUB_ROUTER" 'addClient((string,bytes[]),address)' '("client-0",[0x])' "$HUB_LC" >/dev/null
  send "$SPOKE" "$SPOKE_ROUTER" 'addClient((string,bytes[]),address)' '("client-0",[0x])' "$SPOKE_LC" >/dev/null
  echo "hub lc=$HUB_LC  spoke lc=$SPOKE_LC"

  log "spoke: trust client-0 (the hub) and make the adapter a Native minter"
  send "$SPOKE" "$SPOKE_ADAPTER" 'setTrustedClient(string,bool)' client-0 true >/dev/null
  send "$SPOKE" "$NATIVE" 'setMinter(address,bool)' "$SPOKE_ADAPTER" true >/dev/null
  [[ "$(cast call --rpc-url "$SPOKE" "$NATIVE" 'isMinter(address)(bool)' "$SPOKE_ADAPTER")" == true ]] \
    || fail "adapter is not a minter"

  log "granting RELAYER_ROLE to the relayer key on each chain"
  grant_relayer "$HUB" "$HUB_AM" "$HUB_ROUTER" "$(cast wallet address "$HUB_RELAYER_PK")"
  grant_relayer "$SPOKE" "$SPOKE_AM" "$SPOKE_ROUTER" "$(cast wallet address "$SPOKE_RELAYER_PK")"

  cat >"$WORK/addrs.env" <<EOF
HUB_ROUTER=$HUB_ROUTER
HUB_ADAPTER=$HUB_ADAPTER
HUB_LC=$HUB_LC
SPOKE_ROUTER=$SPOKE_ROUTER
SPOKE_ADAPTER=$SPOKE_ADAPTER
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
  escrow_is() { [[ "$(cast call --rpc-url "$HUB" "$HUB_ADAPTER" 'escrowed(string)(uint256)' client-0 | awk '{print $1}')" == "$1" ]]; }
  no_commitment() { # rpc router path
    [[ "$(cast call --rpc-url "$1" "$2" 'getCommitment(bytes32)(bytes32)' "$(cast keccak "$3")")" == 0x0000000000000000000000000000000000000000000000000000000000000000 ]]
  }
  path() { echo "0x$(printf 'client-0' | xxd -p)01$(printf '%016x' "$1")"; }

  local timeout
  timeout=$(( $(date +%s) + 3600 ))

  log "hub -> spoke: 5 BRL to $BOB"
  send "$HUB" "$HUB_ADAPTER" 'sendTransfer(string,string,uint64,string)' client-0 "$BOB" "$timeout" "" --value 5ether >/dev/null
  escrow_is 5000000000000000000 || fail "hub escrow != 5 BRL"
  wait_for "spoke mint" bal_is "$SPOKE" "$BOB" 5000000000000000000
  log "ok: $BOB has 5 native BRL on the spoke"
  wait_for "ack on hub" no_commitment "$HUB" "$HUB_ROUTER" "$(path 1)"
  log "ok: ack relayed, hub packet commitment cleared"

  log "spoke -> hub: bob sends 2 BRL back to $CAROL"
  r="$(cast send --rpc-url "$SPOKE" --private-key "$BOB_PK" --json "$SPOKE_ADAPTER" \
    'sendTransfer(string,string,uint64,string)' client-0 "$CAROL" "$timeout" "" --value 2ether)"
  [[ "$(jq -r .status <<<"$r")" == 0x1 ]] || fail "spoke send reverted"
  wait_for "hub release" bal_is "$HUB" "$CAROL" 2000000000000000000
  escrow_is 3000000000000000000 || fail "hub escrow != 3 BRL after release"
  log "ok: $CAROL got 2 BRL on the hub, escrow 5 -> 3"
  wait_for "ack on spoke" no_commitment "$SPOKE" "$SPOKE_ROUTER" "$(path 1)"
  log "ok: ack relayed back to the spoke"

  log "restart: stop the relayer, hub sends 1 BRL to $DAVE while it's down, then start it again"
  kill "$RELAYER_PID"; wait "$RELAYER_PID" 2>/dev/null || true
  send "$HUB" "$HUB_ADAPTER" 'sendTransfer(string,string,uint64,string)' client-0 "$DAVE" "$timeout" "" --value 1ether >/dev/null
  start_relayer
  wait_for "spoke mint after restart" bal_is "$SPOKE" "$DAVE" 1000000000000000000
  wait_for "ack on hub after restart" no_commitment "$HUB" "$HUB_ROUTER" "$(path 2)"
  log "ok: relayer caught up on the packet sent while it was down"

  log "relayer log:"
  cat "$WORK/relayer.log"
  log "PASS"
}

main "$@"
