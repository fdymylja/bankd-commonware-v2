#!/usr/bin/env bash
# Local 2-validator cosmos chain (native processes) for the migration e2e. Works for junod and gaiad.
#
#   cosmos-localnet.sh up       init, start both validators
#   cosmos-localnet.sh down
#
# env: BIN (junod), CHAIN_ID (localjuno-1), DENOM (ujuno), BASE_PORT (27000), WORK (target/<BIN>-localnet).
# Node N uses BASE_PORT+N*100 for rpc, +1 p2p, +2 grpc, +3 api, +4 pprof. Node data and logs
# live in $WORK/node{0,1}. Every node's key is named "val".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN="${BIN:-junod}"
WORK="${WORK:-$ROOT/target/$BIN-localnet}"
CHAIN_ID="${CHAIN_ID:-localjuno-1}"
BASE="${BASE_PORT:-27000}"
DENOM="${DENOM:-ujuno}"
NODES=2
# Funded test accounts (abandon x11 + about, index 0 and 1). Never use on a real network.
MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

home() { echo "$WORK/node$1"; }
port() { echo $((BASE + $1 * 100 + $2)); }   # node, offset
j() { local n="$1"; shift; "$BIN" --home "$(home "$n")" "$@"; }
rpc() { echo "tcp://127.0.0.1:$(port "$1" 0)"; }

down() {
  for n in $(seq 0 $((NODES - 1))); do
    [[ -f "$(home "$n")/node.pid" ]] && kill "$(cat "$(home "$n")/node.pid")" 2>/dev/null || true
  done
  sleep 1
  rm -rf "$WORK"
  echo "$BIN chain stopped, $WORK removed"
}

up() {
  [[ -d "$WORK" ]] && { echo "$WORK exists, run down first" >&2; exit 1; }
  command -v "$BIN" >/dev/null || { echo "$BIN not found" >&2; exit 1; }
  lsof -iTCP:"$(port 0 0)" -sTCP:LISTEN >/dev/null 2>&1 && { echo "port $(port 0 0) in use" >&2; exit 1; }

  for n in $(seq 0 $((NODES - 1))); do
    j "$n" init "val$n" --chain-id "$CHAIN_ID" --default-denom "$DENOM" >/dev/null 2>&1
    j "$n" keys add val --keyring-backend test >/dev/null 2>&1
  done

  # Genesis lives on node0. Every validator account and the two funded test accounts get balances.
  local g0
  g0="$(home 0)/config/genesis.json"
  for n in $(seq 0 $((NODES - 1))); do
    j 0 genesis add-genesis-account "$(j "$n" keys show val -a --keyring-backend test)" "100000000000000$DENOM"
  done
  for i in 0 1; do
    echo "$MNEMONIC" | j 0 keys add "user$i" --recover --index "$i" --keyring-backend test >/dev/null 2>&1
    j 0 genesis add-genesis-account "$(j 0 keys show "user$i" -a --keyring-backend test)" "1000000000000$DENOM"
  done

  # Same genesis to every node, then each one signs a gentx with its own key.
  mkdir -p "$(home 0)/config/gentx"
  for n in $(seq 1 $((NODES - 1))); do
    cp "$g0" "$(home "$n")/config/genesis.json"
  done
  for n in $(seq 0 $((NODES - 1))); do
    j "$n" genesis gentx val "1000000000$DENOM" --chain-id "$CHAIN_ID" --keyring-backend test \
      --output-document "$(home 0)/config/gentx/gentx-$n.json" >/dev/null 2>&1
  done
  j 0 genesis collect-gentxs >/dev/null 2>&1

  # Fast gov for the software upgrade in the e2e.
  jq --arg d "$DENOM" '
    .app_state.gov.params.voting_period = "10s"
    | .app_state.gov.params.expedited_voting_period = "5s"
    | .app_state.gov.params.max_deposit_period = "10s"
    | .app_state.gov.params.min_deposit = [{"denom": $d, "amount": "1"}]
    | .app_state.gov.params.expedited_min_deposit = [{"denom": $d, "amount": "2"}]
  ' "$g0" >"$g0.tmp" && mv "$g0.tmp" "$g0"
  # Feemarket would need real gas prices in every tx. Turn it off when the chain has it.
  jq --arg d "$DENOM" 'if .app_state.feemarket then
      .app_state.feemarket.params.fee_denom = $d
      | .app_state.feemarket.params.enabled = false
      | .app_state.feemarket.params.min_base_gas_price = "0.001"
      | .app_state.feemarket.params.max_block_utilization = "200000000"
    else . end' "$g0" >"$g0.tmp" && mv "$g0.tmp" "$g0"
  for n in $(seq 1 $((NODES - 1))); do
    cp "$g0" "$(home "$n")/config/genesis.json"
  done

  local peers=""
  for n in $(seq 0 $((NODES - 1))); do
    peers+="$(j "$n" comet show-node-id)@127.0.0.1:$(port "$n" 1),"
  done
  peers="${peers%,}"

  for n in $(seq 0 $((NODES - 1))); do
    local cfg app
    cfg="$(home "$n")/config/config.toml"
    app="$(home "$n")/config/app.toml"
    sed -i '' -e 's|^timeout_commit = .*|timeout_commit = "1s"|' \
      -e 's|^allow_duplicate_ip = .*|allow_duplicate_ip = true|' \
      -e 's|^addr_book_strict = .*|addr_book_strict = false|' \
      -e "s|^persistent_peers = .*|persistent_peers = \"$peers\"|" "$cfg"
    sed -i '' -e "s|^minimum-gas-prices = .*|minimum-gas-prices = \"0.0025$DENOM\"|" "$app"
    nohup "$BIN" --home "$(home "$n")" start \
      --rpc.laddr "tcp://127.0.0.1:$(port "$n" 0)" \
      --p2p.laddr "tcp://127.0.0.1:$(port "$n" 1)" \
      --grpc.address "127.0.0.1:$(port "$n" 2)" \
      --api.enable --api.address "tcp://127.0.0.1:$(port "$n" 3)" \
      --rpc.pprof_laddr "127.0.0.1:$(port "$n" 4)" \
      >"$(home "$n")/node.log" 2>&1 &
    echo $! >"$(home "$n")/node.pid"
  done

  echo "waiting for $BIN blocks"
  local h=0
  for _ in $(seq 1 60); do
    h="$(curl -s "http://127.0.0.1:$(port 0 0)/status" | jq -r '.result.sync_info.latest_block_height // 0' 2>/dev/null || echo 0)"
    [[ "$h" -ge 3 ]] && break
    sleep 1
  done
  [[ "$h" -ge 3 ]] || { echo "$BIN didn't produce blocks, see $(home 0)/node.log" >&2; exit 1; }
  local vals
  vals="$(j 0 q comet-validator-set --node "$(rpc 0)" -o json | jq '.validators | length')"
  [[ "$vals" == "$NODES" ]] || { echo "expected $NODES validators, got $vals" >&2; exit 1; }
  echo "$BIN $CHAIN_ID up with $vals validators: rpc $(rpc 0), $(rpc 1)"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  *) echo "usage: $0 up|down" >&2; exit 1 ;;
esac
