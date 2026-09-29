#!/usr/bin/env bash
# CosmWasm e2e on a running bankd localnet: store, instantiate, execute, query the counter.
#
#   cw-e2e.sh [rpc_port]
set -euo pipefail

RPC="http://127.0.0.1:${1:-8545}"
CW="0x000000000000000000000000000000435741534D"
WASM="$(dirname "$0")/../../cw-contracts/counter/artifacts/cw_counter.wasm"
# anvil account 0
PK0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }
hexs() { printf '%s' "$1" | xxd -p | tr -d '\n' | sed 's/^/0x/'; }
send() { cast send --rpc-url "$RPC" --private-key "$PK0" --json "$CW" "$@"; }
check() { [[ "$(jq -r .status <<<"$1")" == "0x1" ]] || fail "$2: $1"; }
used() { cast to-dec "$(jq -r .gasUsed <<<"$1")"; }

# 1. upload the wasm in chunks (a tx is gas capped), then finalize. eth_call gives the code id.
me="$(cast wallet address "$PK0")"
code_id=0
gas=0
chunk_dir="$(mktemp -d)"
split -b 10000 "$WASM" "$chunk_dir/c"
for f in "$chunk_dir"/c*; do
  chunk="0x$(xxd -p "$f" | tr -d '\n')"
  code_id="$(cast call --rpc-url "$RPC" --from "$me" "$CW" "uploadCode(uint64,bytes)(uint64)" "$code_id" "$chunk")"
  receipt="$(send "uploadCode(uint64,bytes)" "$([[ $gas == 0 ]] && echo 0 || echo "$code_id")" "$chunk")"
  check "$receipt" uploadCode
  gas=$((gas + $(used "$receipt")))
done
rm -rf "$chunk_dir"
receipt="$(send "finalizeCode(uint64)" "$code_id")"
check "$receipt" finalizeCode
ok "code $code_id uploaded ($(wc -c <"$WASM" | tr -d ' ') bytes, upload gas $gas)"

# 2. instantiate with count 5, address is the Instantiated topic
receipt="$(send "instantiate(uint64,bytes)" "$code_id" "$(hexs '{"count":5}')")"
check "$receipt" instantiate
contract="$(cast parse-bytes32-address "$(jq -r '.logs[0].topics[1]' <<<"$receipt")")"
[[ "$(tr A-F a-f <<<"$contract")" == 0xc0dec0de* ]] || fail "contract addr $contract has no vanity prefix"
ok "instantiate: $contract (gas $(used "$receipt"))"

# 3. execute increment, twice
for want in 6 7; do
  receipt="$(send "execute(address,bytes)" "$contract" "$(hexs '{"increment":{}}')")"
  check "$receipt" execute
  ok "execute increment (gas $(used "$receipt"))"
done

# 4. return value of execute, via eth_call, is the count as 8 big endian bytes
ret="$(cast call --rpc-url "$RPC" --from "$(cast wallet address "$PK0")" "$CW" \
  "execute(address,bytes)(bytes)" "$contract" "$(hexs '{"increment":{}}')")"
[[ "$ret" == "0x0000000000000008" ]] || fail "execute return $ret != 0x0000000000000008"
ok "execute return data $ret"

# 5. query
res="$(cast call --rpc-url "$RPC" "$CW" "query(address,bytes)(bytes)" "$contract" "$(hexs '{"get_count":{}}')")"
[[ "$(cast to-utf8 "$res")" == '{"count":"7"}' ]] || fail "query returned $(cast to-utf8 "$res")"
ok "query get_count -> $(cast to-utf8 "$res")"

# 6. registry views
[[ "$(cast call --rpc-url "$RPC" "$CW" "isContract(address)(bool)" "$contract")" == "true" ]] || fail "isContract"
ok "isContract($contract) true"

# 7. a failing contract call reverts and leaves state alone
if send "execute(address,bytes)" "$contract" "$(hexs '{"nope":{}}')" >/dev/null 2>&1; then
  fail "bad execute msg should revert"
fi
res="$(cast call --rpc-url "$RPC" "$CW" "query(address,bytes)(bytes)" "$contract" "$(hexs '{"get_count":{}}')")"
[[ "$(cast to-utf8 "$res")" == '{"count":"7"}' ]] || fail "state changed after failed execute"
ok "bad msg reverts, count still 7"

echo "cw e2e passed"
