#!/usr/bin/env bash
# Regenerates contracts/test/fixtures/e2e.json: a hub deployed on anvil sends 5 BRL, then we take
# the real packet commitment proof (eth_getProof) and a commonware cert over a TempoHeader holding
# that block's state root. E2ETest replays it into a spoke with CommonwareLightClient.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/contracts/test/fixtures/e2e.json"
HUB_OUT="$ROOT/contracts/test/fixtures/.hub.json"
PORT="${PORT:-8598}"
RPC="http://127.0.0.1:$PORT"
EPOCH_LENGTH=21600
RECEIVER=0x000000000000000000000000000000000000b0b0
# anvil account 0
PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

anvil --port "$PORT" --hardfork prague --silent &
ANVIL=$!
trap 'kill $ANVIL; rm -f "$HUB_OUT"' EXIT
sleep 1

cd "$ROOT/contracts"
PRIVATE_KEY=$PK RECEIVER=$RECEIVER OUT="$HUB_OUT" forge script script/HubSend.s.sol --rpc-url "$RPC" --broadcast --slow -q >/dev/null

ROUTER=$(jq -r .router "$HUB_OUT")
SLOT=$(jq -r .slot "$HUB_OUT")
BLOCK=$(cast block latest --rpc-url "$RPC" --json)
STATE_ROOT=$(echo "$BLOCK" | jq -r .stateRoot)
NUMBER=$(cast to-dec "$(echo "$BLOCK" | jq -r .number)")
TS=$(cast to-dec "$(echo "$BLOCK" | jq -r .timestamp)")
PROOF=$(cast proof "$ROUTER" "$SLOT" --block "$NUMBER" --rpc-url "$RPC")
[ "$(echo "$PROOF" | jq -r '.storageProof[0].value')" != "0x0" ] || { echo "commitment not in state"; exit 1; }

cd "$HERE/.."
VECTORS=$(cargo +1.97.1 run -q --bin vectorgen -- single "$STATE_ROOT" "$NUMBER" "$TS" "$EPOCH_LENGTH")

jq -n --argjson v "$VECTORS" --argjson p "$PROOF" --slurpfile hub "$HUB_OUT" --arg receiver "$RECEIVER" \
  '$v + $hub[0] + { receiver: $receiver, accountProof: $p.accountProof, storageProof: $p.storageProof[0].proof }' > "$OUT"
echo "wrote $OUT"
