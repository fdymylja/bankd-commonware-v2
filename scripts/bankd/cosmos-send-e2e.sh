#!/usr/bin/env bash
# A migrated juno account (cosmos secp256k1 sender) transacts on its own 2-val chain 9101.
# Own chain only, never touches 9001. Needs cast, jq, python3.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LN="$ROOT/scripts/bankd/localnet.sh"
BIN_DIR="$(cargo metadata --format-version 1 --no-deps --manifest-path "$ROOT/Cargo.toml" | jq -r .target_directory)/debug"
XTASK="${XTASK_BIN:-$BIN_DIR/tempo-xtask}"
CHAIN=9101
RPC=http://127.0.0.1:8645
MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
SENDER=0x28ff5c6d57d8cfd492b6fb42614536ed648e01fd
RECIPIENT=0x00000000000000000000000000000000000c0511
ADAPTER=0xBA01319fA1739A1D69aBae52B64105C74764CA4c
AMOUNT_UJUNO=12345
AMOUNT_WEI=$((AMOUNT_UJUNO * 1000000000000))
WORK="$ROOT/target/cosmos-send-e2e"

fail() { echo "FAIL: $*" >&2; exit 1; }
cleanup() { "$LN" down "$CHAIN" || true; }
trap cleanup EXIT

mkdir -p "$WORK"
# 1000000 ujuno * 1e12 wei
python3 -c 'import json;print(json.dumps({"'$SENDER'":hex(1000000*10**12)}))' >"$WORK/alloc.json"

"$LN" down "$CHAIN" >/dev/null 2>&1 || true
GENESIS_ALLOC="$WORK/alloc.json" "$LN" up "$CHAIN" 8645 9100 2
(cd "$ROOT" && cargo build --bin tempo-xtask >/dev/null)

bal() { cast balance "$1" --rpc-url "$RPC"; }
nonce() { cast nonce "$1" --rpc-url "$RPC"; }

send() { "$XTASK" cosmos-send --mnemonic "$MNEMONIC" --index 0 --rpc-url "$RPC" "$@"; }

s0=$(bal $SENDER); r0=$(bal $RECIPIENT); n0=$(nonce $SENDER)
echo "before: sender=$s0 recipient=$r0 nonce=$n0"
[[ "$s0" == "1000000000000000000" ]] || fail "sender not funded, got $s0"

echo "== plain transfer of $AMOUNT_UJUNO ujuno"
send --to $RECIPIENT --value-ujuno $AMOUNT_UJUNO

s1=$(bal $SENDER); r1=$(bal $RECIPIENT); n1=$(nonce $SENDER)
echo "after transfer: sender=$s1 recipient=$r1 nonce=$n1"
[[ $(python3 -c "print($r1-$r0)") == "$AMOUNT_WEI" ]] || fail "recipient delta != amount"
fee=$(python3 -c "print($s0-$s1-$AMOUNT_WEI)")
[[ "$fee" -gt 0 ]] || fail "fee not charged, fee=$fee"
[[ "$n1" -eq $((n0 + 1)) ]] || fail "nonce did not advance"
echo "OK transfer: recipient +$AMOUNT_WEI wei, fee $fee wei, nonce $n0 -> $n1"

echo "== ICS20 adapter sendTransfer (no client registered)"
DATA=$(cast calldata "sendTransfer(string,string,uint64,string)" "no-such-client" "cosmos1receiver" 4102444800 "")
out=$(cast call "$ADAPTER" "$DATA" --from $SENDER --value "$AMOUNT_WEI" --rpc-url "$RPC" 2>&1 || true)
echo "eth_call: $out"
SEL=$(cast sig "IBCCounterpartyClientNotFound(string)")
echo "$out" | grep -qiE "IBCCounterpartyClientNotFound|$SEL" || fail "expected client not found revert"
send --to $ADAPTER --data "$DATA" --value-wei $AMOUNT_WEI --gas-limit 500000 --allow-revert | tee "$WORK/adapter.out"
grep -q "status: false" "$WORK/adapter.out" || fail "adapter tx should revert"
n2=$(nonce $SENDER)
[[ "$n2" -eq $((n1 + 1)) ]] || fail "nonce did not advance after contract call"
echo "OK adapter: reverted with IBCCounterpartyClientNotFound ($SEL), nonce $n1 -> $n2"

echo "ALL OK"
