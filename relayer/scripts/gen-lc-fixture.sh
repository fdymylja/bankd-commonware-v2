#!/usr/bin/env bash
# Regenerates contracts/test/fixtures/lc.json: real commonware threshold certs over real TempoHeader
# RLP (vectorgen) whose state_root comes from anvil, plus eth_getProof proofs against that root.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/contracts/test/fixtures/lc.json"
PORT="${PORT:-8599}"
RPC="http://127.0.0.1:$PORT"
EPOCH_LENGTH=10

anvil --port "$PORT" --hardfork prague --silent &
ANVIL=$!
trap 'kill $ANVIL' EXIT
sleep 1

ROUTER=0x00000000000000000000000000000000000ab1c0
IBCSTORE=0x1260944489272988d9df285149b5aa1b0f48f2136d6f416159f840a3e0747600
# ICS24 packet commitment path: clientId || 0x01 || uint64 BE sequence
PATH_HEX="0x$(printf 'client-0' | xxd -p)01$(printf '%016x' 1)"
PATH_HASH=$(cast keccak "$PATH_HEX")
SLOT=$(cast keccak "$(cast abi-encode 'f(bytes32,bytes32)' "$PATH_HASH" "$IBCSTORE")")
VALUE=0x$(printf 'ab%.0s' {1..32})
ABSENT_PATH_HEX="0x$(printf 'client-0' | xxd -p)01$(printf '%016x' 2)"
ABSENT_SLOT=$(cast keccak "$(cast abi-encode 'f(bytes32,bytes32)' "$(cast keccak "$ABSENT_PATH_HEX")" "$IBCSTORE")")

cast rpc --rpc-url "$RPC" anvil_setCode "$ROUTER" 0x00 >/dev/null
cast rpc --rpc-url "$RPC" anvil_setStorageAt "$ROUTER" "$SLOT" "$VALUE" >/dev/null
# A few neighbours so the storage trie has branch nodes.
for i in 1 2 3 4 5; do
  cast rpc --rpc-url "$RPC" anvil_setStorageAt "$ROUTER" "$(cast keccak "0x0$i")" "$(cast keccak "0x1$i")" >/dev/null
done
cast rpc --rpc-url "$RPC" evm_mine >/dev/null

BLOCK=$(cast block latest --rpc-url "$RPC" --json)
STATE_ROOT=$(echo "$BLOCK" | jq -r .stateRoot)
NUMBER=$(cast to-dec "$(echo "$BLOCK" | jq -r .number)")
TS=$(cast to-dec "$(echo "$BLOCK" | jq -r .timestamp)")
PROOF=$(cast proof "$ROUTER" "$SLOT" "$ABSENT_SLOT" --block "$NUMBER" --rpc-url "$RPC")

cd "$HERE/.."
VECTORS=$(cargo +1.97.1 run -q --bin vectorgen -- "$STATE_ROOT" "$TS" "$EPOCH_LENGTH")

mkdir -p "$(dirname "$OUT")"
jq -n --argjson v "$VECTORS" --argjson p "$PROOF" \
  --arg router "$ROUTER" --arg path "$PATH_HEX" --arg absent "$ABSENT_PATH_HEX" --arg value "$VALUE" \
  '$v + { router: $router, commitmentPath: $path, absentPath: $absent, commitment: $value,
          accountProof: $p.accountProof, storageProof: $p.storageProof[0].proof,
          absentStorageProof: $p.storageProof[1].proof }' > "$OUT"
echo "wrote $OUT"
