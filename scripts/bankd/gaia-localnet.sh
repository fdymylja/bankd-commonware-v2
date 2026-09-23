#!/usr/bin/env bash
# Local 1-validator gaia for IBC v2 against bankd.
#
#   gaia-localnet.sh up      starts gaiad and stores the 08-wasm light client via gov
#   gaia-localnet.sh down
#
# env: GAIA_CHAIN_ID (localgaia-1), GAIA_RPC_PORT (26657), GAIA_GRPC_PORT (9090),
#      GAIA_API_PORT (1317), GAIA_P2P_PORT (26656), WASM_CLIENT (defaults to ibc-contracts' dummy client)
# Data and logs live in target/gaia-localnet.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOME_DIR="${GAIA_HOME:-$ROOT/target/gaia-localnet}"
CHAIN_ID="${GAIA_CHAIN_ID:-localgaia-1}"
RPC_PORT="${GAIA_RPC_PORT:-26657}"
GRPC_PORT="${GAIA_GRPC_PORT:-9090}"
API_PORT="${GAIA_API_PORT:-1317}"
P2P_PORT="${GAIA_P2P_PORT:-26656}"
WASM_CLIENT="${WASM_CLIENT:-$ROOT/contracts/lib/ibc-contracts/e2e/interchaintestv8/wasm/cw_dummy_light_client.wasm.gz}"
DENOM=uatom
# Well known test mnemonic, so the relayer key is stable across restarts. Never use on a real network.
MNEMONIC="${GAIA_MNEMONIC:-abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art}"

g() { gaiad --home "$HOME_DIR" "$@"; }
tx() { g tx "$@" --from val --keyring-backend test --chain-id "$CHAIN_ID" --node "tcp://127.0.0.1:$RPC_PORT" \
  --gas auto --gas-adjustment 2 --gas-prices "0.1$DENOM" -y -o json; }

# Takes the broadcast json, fails on a CheckTx error, then waits for the tx to land.
wait_tx() {
  local code hash
  code="$(jq -r .code <<<"$1")"
  [[ "$code" == 0 ]] || { echo "broadcast failed: $(jq -r .raw_log <<<"$1")" >&2; exit 1; }
  hash="$(jq -r .txhash <<<"$1")"
  for _ in $(seq 1 30); do
    if out="$(g q tx "$hash" --node "tcp://127.0.0.1:$RPC_PORT" -o json 2>/dev/null)"; then
      local code
      code="$(jq -r .code <<<"$out")"
      [[ "$code" == 0 ]] || { echo "tx $hash failed: $(jq -r .raw_log <<<"$out")" >&2; exit 1; }
      return
    fi
    sleep 1
  done
  echo "tx $hash not found" >&2
  exit 1
}

down() {
  if [[ -f "$HOME_DIR/node.pid" ]]; then
    kill "$(cat "$HOME_DIR/node.pid")" 2>/dev/null || true
    sleep 1
  fi
  rm -rf "$HOME_DIR"
  echo "gaia stopped, $HOME_DIR removed"
}

up() {
  [[ -d "$HOME_DIR" ]] && { echo "$HOME_DIR exists, run down first" >&2; exit 1; }
  command -v gaiad >/dev/null || { echo "gaiad not found" >&2; exit 1; }
  if lsof -iTCP:"$RPC_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $RPC_PORT in use" >&2
    exit 1
  fi

  g init local --chain-id "$CHAIN_ID" --default-denom "$DENOM" >/dev/null 2>&1
  echo "$MNEMONIC" | g keys add val --recover --keyring-backend test >/dev/null 2>&1
  local addr
  addr="$(g keys show val -a --keyring-backend test)"
  g genesis add-genesis-account "$addr" "100000000000000$DENOM"
  g genesis gentx val "1000000000$DENOM" --chain-id "$CHAIN_ID" --keyring-backend test >/dev/null 2>&1
  g genesis collect-gentxs >/dev/null 2>&1

  # Fast gov so the wasm store-code proposal passes in seconds. Expedited must stay below voting.
  local gen="$HOME_DIR/config/genesis.json"
  jq --arg d "$DENOM" '
    .app_state.gov.params.voting_period = "10s"
    | .app_state.gov.params.expedited_voting_period = "5s"
    | .app_state.gov.params.max_deposit_period = "10s"
    | .app_state.gov.params.min_deposit = [{"denom": $d, "amount": "1"}]
    | .app_state.gov.params.expedited_min_deposit = [{"denom": $d, "amount": "2"}]
    | .app_state.feemarket.params.fee_denom = $d
    | .app_state.feemarket.params.min_base_gas_price = "0.001"
    | .app_state.feemarket.params.max_block_utilization = "200000000"
    | .app_state.feemarket.params.enabled = false
  ' "$gen" >"$gen.tmp" && mv "$gen.tmp" "$gen"

  local cfg="$HOME_DIR/config/config.toml" app="$HOME_DIR/config/app.toml"
  sed -i '' -e "s|^laddr = \"tcp://127.0.0.1:26657\"|laddr = \"tcp://127.0.0.1:$RPC_PORT\"|" \
    -e "s|^laddr = \"tcp://0.0.0.0:26656\"|laddr = \"tcp://127.0.0.1:$P2P_PORT\"|" \
    -e 's|^timeout_commit = .*|timeout_commit = "1s"|' "$cfg"
  sed -i '' -e "s|^minimum-gas-prices = .*|minimum-gas-prices = \"0.001$DENOM\"|" \
    -e "s|localhost:9090|127.0.0.1:$GRPC_PORT|; s|0.0.0.0:9090|127.0.0.1:$GRPC_PORT|" \
    -e "s|tcp://localhost:1317|tcp://127.0.0.1:$API_PORT|; s|tcp://0.0.0.0:1317|tcp://127.0.0.1:$API_PORT|" "$app"
  # Enable the REST api, it's the first "enable = false" in the [api] section.
  sed -i '' -e '/^\[api\]/,/^\[/ s|^enable = false|enable = true|' "$app"

  nohup gaiad start --home "$HOME_DIR" >"$HOME_DIR/node.log" 2>&1 &
  echo $! >"$HOME_DIR/node.pid"

  echo "waiting for gaia blocks"
  for _ in $(seq 1 60); do
    h="$(curl -s "http://127.0.0.1:$RPC_PORT/status" | jq -r '.result.sync_info.latest_block_height // 0' 2>/dev/null || echo 0)"
    [[ "$h" -ge 2 ]] && break
    sleep 1
  done
  [[ "${h:-0}" -ge 2 ]] || { echo "gaia didn't produce blocks, see $HOME_DIR/node.log" >&2; exit 1; }

  echo "storing wasm light client via gov ($(basename "$WASM_CLIENT"))"
  local res
  res="$(tx ibc-wasm store-code "$WASM_CLIENT" --title "wasm client" --summary "bankd client" --deposit "1$DENOM")"
  wait_tx "$res"
  local pid
  pid="$(g q gov proposals --node "tcp://127.0.0.1:$RPC_PORT" -o json | jq -r '.proposals[-1].id')"
  res="$(tx gov vote "$pid" yes)"
  wait_tx "$res"

  for _ in $(seq 1 30); do
    status="$(g q gov proposal "$pid" --node "tcp://127.0.0.1:$RPC_PORT" -o json | jq -r '.proposal.status // .status')"
    [[ "$status" == PROPOSAL_STATUS_PASSED ]] && break
    [[ "$status" == PROPOSAL_STATUS_REJECTED || "$status" == PROPOSAL_STATUS_FAILED ]] && { echo "proposal $pid $status" >&2; exit 1; }
    sleep 1
  done
  [[ "$status" == PROPOSAL_STATUS_PASSED ]] || { echo "proposal $pid still $status" >&2; exit 1; }

  local checksum
  checksum="$(g q ibc-wasm checksums --node "tcp://127.0.0.1:$RPC_PORT" -o json | jq -r '.checksums[-1]')"
  echo "$checksum" >"$HOME_DIR/wasm-checksum"
  echo "gaia $CHAIN_ID up: rpc 127.0.0.1:$RPC_PORT grpc 127.0.0.1:$GRPC_PORT, relayer key $addr"
  echo "wasm client checksum $checksum"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  *) echo "usage: $0 up|down" >&2; exit 1 ;;
esac
