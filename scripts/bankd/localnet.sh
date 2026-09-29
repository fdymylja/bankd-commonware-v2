#!/usr/bin/env bash
# bankd localnet: N validators as native processes on 127.0.0.1.
#
#   localnet.sh up   [chain_id] [rpc_port] [consensus_port] [validators] [epoch_length]
#   localnet.sh down [chain_id]
#   localnet.sh restart [chain_id] [rpc_port] [consensus_port] [validators]   (keeps data)
#
# Validator i gets http+ws on rpc_port+i and consensus/p2p ports from consensus_port+10*i.
# Data and logs live in $BANKD_LOCALNET_DIR/<chain_id> (default target/bankd-localnet).
#
# IBC contracts are predeployed at genesis (see scripts/bankd/connect.sh to link two chains):
#   IBC_MODE=hub|spoke|none   adapter mode (default hub), none skips the predeploy
#   IBC_RELAYERS=0xA,0xB      granted RELAYER_ROLE on the router
#   IBC_HUB_CLIENTS=bankd-hub spoke only: client ids the adapter trusts as the hub
#   IBC_LEGACY_DENOMS=a,b     hub only: legacy traces treated as native ujuno coming home
#   IBC_SEED_ESCROW=client=wei hub only: escrow seeded in the adapter (and funded with the same wei)
#   GENESIS_ALLOC=file.json   json {"0xaddr": "0xhexWei"} merged into genesis balances (migration)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_DIR="${BANKD_LOCALNET_DIR:-$ROOT/target/bankd-localnet}"
# Ask cargo where binaries go, so a shared target dir (see worktree.sh) works too.
BIN_DIR="$(cargo metadata --format-version 1 --no-deps --manifest-path "$ROOT/Cargo.toml" | jq -r .target_directory)/debug"
TEMPO_BIN="${TEMPO_BIN:-$BIN_DIR/tempo}"
XTASK_BIN="${XTASK_BIN:-$BIN_DIR/tempo-xtask}"
SECRET="tempo-localnet-signing-key-secret"
IBC_MODE="${IBC_MODE:-hub}"

cmd="${1:-}"
CHAIN_ID="${2:-9001}"
RPC_PORT="${3:-8545}"
CONSENSUS_PORT="${4:-9000}"
VALIDATORS="${5:-4}"
EPOCH_LENGTH="${6:-600}"
DIR="$BASE_DIR/$CHAIN_ID"

down() {
  if [[ -d "$DIR" ]]; then
    for pidf in "$DIR"/*/node.pid; do
      [[ -f "$pidf" ]] || continue
      kill "$(cat "$pidf")" 2>/dev/null || true
    done
    sleep 2
    for pidf in "$DIR"/*/node.pid; do
      [[ -f "$pidf" ]] || continue
      kill -9 "$(cat "$pidf")" 2>/dev/null || true
    done
    rm -rf "$DIR"
    echo "chain $CHAIN_ID stopped, $DIR removed"
  else
    echo "chain $CHAIN_ID: nothing to stop"
  fi
}

up() {
  if [[ -d "$DIR" ]]; then
    echo "chain $CHAIN_ID already has state at $DIR, run down first" >&2
    exit 1
  fi
  if [[ ! -x "$TEMPO_BIN" || ! -x "$XTASK_BIN" ]]; then
    echo "building tempo + xtask (debug)"
    (cd "$ROOT" && cargo build --bin tempo --bin tempo-xtask)
  fi

  local peers=()
  for ((i = 0; i < VALIDATORS; i++)); do
    peers+=("127.0.0.1:$((CONSENSUS_PORT + 10 * i))")
  done
  local validators_csv
  validators_csv="$(IFS=,; echo "${peers[*]}")"

  # IBC predeploy flags. The contracts come from forge's out/, so build them if they're missing.
  local ibc=()
  if [[ "$IBC_MODE" != none ]]; then
    if [[ ! -f "$ROOT/contracts/out/ICS20NativeAdapter.sol/ICS20NativeAdapter.json" ]]; then
      echo "building contracts (forge)"
      (cd "$ROOT/contracts" && forge build -q)
    fi
    ibc=(--ibc-predeploy --ibc-mode "$IBC_MODE" --ibc-artifacts "$ROOT/contracts/out")
    [[ -n "${IBC_RELAYERS:-}" ]] && ibc+=(--ibc-relayers "$IBC_RELAYERS")
    [[ -n "${IBC_LEGACY_DENOMS:-}" ]] && ibc+=(--ibc-legacy-denoms "$IBC_LEGACY_DENOMS")
    [[ -n "${IBC_SEED_ESCROW:-}" ]] && ibc+=(--ibc-seed-escrow "$IBC_SEED_ESCROW")
    [[ "$IBC_MODE" == spoke ]] && ibc+=(--ibc-hub-clients "${IBC_HUB_CLIENTS:-bankd-hub}")
  fi

  mkdir -p "$BASE_DIR"
  # Seed ties validator keys to the chain id so reruns are reproducible.
  "$XTASK_BIN" generate-localnet --output "$DIR" --force \
    --chain-id "$CHAIN_ID" --epoch-length "$EPOCH_LENGTH" --accounts 10 \
    --seed "$CHAIN_ID" --validators "$validators_csv" \
    --no-extra-tokens --no-pairwise-liquidity ${ibc[@]+"${ibc[@]}"} >"$DIR.gen.log" 2>&1 \
    || { cat "$DIR.gen.log" >&2; exit 1; }
  mv "$DIR.gen.log" "$DIR/generate.log"
  if [[ -n "${GENESIS_ALLOC:-}" ]]; then
    python3 - "$DIR/genesis.json" "$GENESIS_ALLOC" <<'PY'
import json, sys
gpath, apath = sys.argv[1:3]
g = json.load(open(gpath))
existing = {k.lower() for k in g["alloc"]}
for addr, wei in json.load(open(apath)).items():
    key = "0x" + addr.lower().removeprefix("0x")
    assert key not in existing, f"{addr} already in genesis alloc"
    g["alloc"][key] = {"balance": wei}
json.dump(g, open(gpath, "w"), indent=2)
PY
  fi
  printf '%s\n' "$SECRET" >"$DIR/consensus.secret"

  launch
}

# Starts every validator in $DIR and waits for finality. Shared by up and restart.
launch() {
  local peers=()
  for ((i = 0; i < VALIDATORS; i++)); do
    peers+=("127.0.0.1:$((CONSENSUS_PORT + 10 * i))")
  done

  local trusted=()
  for addr in "${peers[@]}"; do
    local port="${addr##*:}"
    trusted+=("enode://$(cat "$DIR/$addr/enode.identity")@127.0.0.1:$((port + 1))")
  done
  local trusted_csv
  trusted_csv="$(IFS=,; echo "${trusted[*]}")"

  for ((i = 0; i < VALIDATORS; i++)); do
    local addr="${peers[$i]}"
    local port="${addr##*:}"
    local node_dir="$DIR/$addr"
    local rpc=$((RPC_PORT + i))
    "$TEMPO_BIN" node \
      --chain "$DIR/genesis.json" \
      --datadir "$node_dir" \
      --http --http.addr 127.0.0.1 --http.port "$rpc" --http.api all \
      --ws --ws.addr 127.0.0.1 --ws.port "$rpc" --ws.api all \
      --ipcdisable \
      --consensus.signing-key "$node_dir/signing.key" \
      --consensus.secret "$DIR/consensus.secret" \
      --consensus.signing-share "$node_dir/signing.share" \
      --consensus.listen-address "$addr" \
      --consensus.metrics-address "127.0.0.1:$((port + 2))" \
      --consensus.use-local-defaults \
      --consensus.bypass-ip-check \
      --trusted-peers "$trusted_csv" \
      --port "$((port + 1))" \
      --discovery.port "$((port + 1))" \
      --discovery.v5.port "$((port + 4))" \
      --p2p-secret-key "$node_dir/enode.key" \
      --authrpc.port "$((port + 3))" \
      --log.file.directory "$node_dir/logs" --color never \
      >>"$node_dir/node.log" 2>&1 &
    echo $! >"$node_dir/node.pid"
    echo "validator $i: rpc http/ws 127.0.0.1:$rpc  log $node_dir/node.log"
  done

  echo "waiting for chain $CHAIN_ID to finalize blocks..."
  for _ in $(seq 1 90); do
    local head
    head="$(curl -s -X POST -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_getBlockByNumber","params":["finalized",false]}' \
      "http://127.0.0.1:$RPC_PORT" 2>/dev/null | sed -n 's/.*"number":"\(0x[0-9a-f]*\)".*/\1/p' || true)"
    if [[ -n "$head" && "$head" != "0x0" ]]; then
      echo "chain $CHAIN_ID up, finalized block $((head))"
      return 0
    fi
    sleep 2
  done
  echo "chain $CHAIN_ID did not finalize a block in time, check logs in $DIR" >&2
  exit 1
}

# Stops the validators but keeps their data, then starts them again.
restart() {
  [[ -d "$DIR" ]] || { echo "chain $CHAIN_ID has no state at $DIR" >&2; exit 1; }
  for pidf in "$DIR"/*/node.pid; do
    [[ -f "$pidf" ]] || continue
    kill "$(cat "$pidf")" 2>/dev/null || true
  done
  for pidf in "$DIR"/*/node.pid; do
    [[ -f "$pidf" ]] || continue
    for _ in $(seq 1 30); do
      kill -0 "$(cat "$pidf")" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$(cat "$pidf")" 2>/dev/null || true
  done
  echo "chain $CHAIN_ID stopped, restarting"
  launch
}

case "$cmd" in
  up) up ;;
  down) down ;;
  restart) restart ;;
  *) echo "usage: $0 up|down|restart [chain_id] [rpc_port] [consensus_port] [validators] [epoch_length]" >&2; exit 2 ;;
esac
