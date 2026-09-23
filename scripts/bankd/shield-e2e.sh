#!/usr/bin/env bash
# Real ZK-proven shieldd txs end to end over the 0x77 path, on its own 1-validator localnet.
#
#   EVM deposit (SHLD.deposit) -> checkpoint -> proven private transfer alice -> bob (0x77)
#   -> proven withdrawal bob -> fresh EVM address (0x77) -> replay rejected -> node restart.
#
#   shield-e2e.sh [rpc_port] [chain_id] [consensus_port]
#
# Needs target/debug/{tempo,tempo-xtask,bankd-shield-wallet} and Go (the wallet build
# compiles shieldd's gnark prover as a shared library). Tears the localnet down on exit
# unless KEEP=1.
set -euo pipefail

RPC_PORT="${1:-38545}"
CHAIN_ID="${2:-9001}"
CONSENSUS_PORT="${3:-39000}"
RPC="http://127.0.0.1:$RPC_PORT"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WALLET_BIN="${WALLET_BIN:-$ROOT/target/debug/bankd-shield-wallet}"
SHIELD_CHAIN_ID="bankd-$CHAIN_ID"

SHLD="0x0000000000000000000000000000000053484C44"
# anvil account 0, funded at genesis
PK0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ADDR0="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
# fresh EVM address with no history, receives the shielded withdrawal
RECV="0x00000000000000000000000000000000005eC0dE"

DEPOSIT=1000000000000000000  # 1 BRL
SEND=300000000000000000      # 0.3 BRL alice -> bob
WITHDRAW=100000000000000000  # 0.1 BRL bob -> RECV

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }
rpc() {
  curl -s -X POST -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" "$RPC"
}
bal() { cast balance --rpc-url "$RPC" ${2:+--block "$2"} "$1"; }
# slot <n> [block]
slot() { cast storage --rpc-url "$RPC" ${2:+--block "$2"} "$SHLD" "$1"; }
head_num() { cast block-number --rpc-url "$RPC"; }
finalized() { cast block --rpc-url "$RPC" finalized --field number; }
wait_finalized() {
  for _ in $(seq 1 60); do
    (( $(finalized) >= $1 )) && return 0
    sleep 1
  done
  fail "block $1 not finalized"
}
wallet() { "$WALLET_BIN" "$@"; }

# Checkpoint of finalized shieldd state at height >= $1. shieldd commits right after reth
# marks a block finalized, so retry briefly. Checkpoints land in the node's datadir
# (shieldd/checkpoints), localnet down removes them.
checkpoint() {
  local res path height
  for _ in $(seq 1 30); do
    res="$(rpc bankd_shieldCheckpoint '[]')"
    path="$(jq -r '.result.path // empty' <<<"$res")"
    height="$(jq -r '.result.height // 0' <<<"$res")"
    [[ -n "$path" ]] || fail "bankd_shieldCheckpoint: $res"
    (( height >= $1 )) && { echo "$path"; return 0; }
    rm -rf "$path"
    sleep 1
  done
  fail "shieldd never committed height $1"
}
balance_of() { wallet --account "$1" balance --db "$2" | awk '{print $2}'; }

# Sends a raw 0x77 tx, waits for its receipt, prints it.
send_shielded() {
  local res hash receipt
  res="$(rpc eth_sendRawTransaction "[\"$1\"]")"
  hash="$(jq -r '.result // empty' <<<"$res")"
  [[ -n "$hash" ]] || fail "eth_sendRawTransaction: $(jq -c '.error' <<<"$res")"
  for _ in $(seq 1 60); do
    receipt="$(rpc eth_getTransactionReceipt "[\"$hash\"]" | jq -c '.result')"
    [[ "$receipt" != "null" ]] && { echo "$receipt"; return 0; }
    sleep 1
  done
  fail "0x77 tx $hash never included"
}

# Prover runtime: the gnark shared libs built by shieldd-sdk-proof-params, found via
# SHIELDD_ARTIFACT_ROOT/lib/gnark.
setup_prover() {
  local lib
  lib="$(ls -t "$ROOT"/target/debug/build/shieldd-sdk-proof-params-*/out/gnark/*/libshieldd_gnark_transfer.* 2>/dev/null | head -1)"
  [[ -n "$lib" ]] || fail "gnark libs missing, run: cargo build -p bankd-shield-wallet"
  export SHIELDD_ARTIFACT_ROOT="$ROOT/target/bankd-shield-prover"
  mkdir -p "$SHIELDD_ARTIFACT_ROOT/lib"
  ln -sfn "$(dirname "$lib")" "$SHIELDD_ARTIFACT_ROOT/lib/gnark"
}

cleanup() {
  [[ "${KEEP:-}" == 1 ]] || "$HERE/localnet.sh" down "$CHAIN_ID" >/dev/null
}

[[ -x "$WALLET_BIN" ]] || fail "missing $WALLET_BIN, run: cargo build -p bankd-shield-wallet"
setup_prover
"$HERE/localnet.sh" up "$CHAIN_ID" "$RPC_PORT" "$CONSENSUS_PORT" 1
trap cleanup EXIT

ALICE="$(wallet --account 0 address)"
BOB="$(wallet --account 1 address)"
[[ "$ALICE" != "$BOB" ]] || fail "alice and bob share an address"

# 1. EVM deposit into alice's shielded address
e0="$(bal "$SHLD")"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json "$SHLD" 'deposit(string)' "$ALICE" --value "$DEPOSIT")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "deposit tx failed: $receipt"
blk="$(cast to-dec "$(jq -r .blockNumber <<<"$receipt")")"
wait_finalized "$blk"
cp1="$(checkpoint "$blk")"
a="$(balance_of 0 "$cp1")"; b="$(balance_of 1 "$cp1")"
[[ "$a" == "$DEPOSIT" && "$b" == 0 ]] || fail "after deposit alice=$a bob=$b"
ok "deposit $DEPOSIT from $ADDR0 in block $blk, wallet sees alice=$a bob=$b"

# 2. proven private transfer alice -> bob
echo "proving transfer (gnark, can take a minute)..."
t0=$SECONDS
raw_transfer="$(wallet --account 0 transfer --db "$cp1" --chain-id "$SHIELD_CHAIN_ID" --to "$BOB" --amount "$SEND")"
[[ "$raw_transfer" == 0x77* ]] || fail "wallet output isn't a 0x77 envelope"
ok "transfer proven in $((SECONDS - t0))s, envelope $(( (${#raw_transfer} - 2) / 2 )) bytes"
escrow0="$(bal "$SHLD")"
receipt="$(send_shielded "$raw_transfer")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "transfer receipt: $receipt"
[[ "$(jq -r .type <<<"$receipt")" == "0x77" ]] || fail "receipt type $(jq -r .type <<<"$receipt")"
tblk="$(cast to-dec "$(jq -r .blockNumber <<<"$receipt")")"
from="$(jq -r .from <<<"$receipt")"
# The pseudo-sender is derived from the tx hash: no key, no nonce, no funds, no link.
[[ "$(tr A-F a-f <<<"$from")" != "$(tr A-F a-f <<<"$ADDR0")" ]] || fail "0x77 tx linked to the depositor"
[[ "$(cast nonce --rpc-url "$RPC" "$from")" == 0 && "$(bal "$from")" == 0 ]] \
  || fail "pseudo-sender $from has state"
[[ "$(jq '.logs | length' <<<"$receipt")" == 0 ]] || fail "0x77 transfer emitted EVM logs"
r_prev="$(slot 0 "$((tblk - 1))")"; r_t="$(slot 0 "$tblk")"
[[ "$r_prev" != "$r_t" ]] || fail "root slot unchanged at block $tblk"
[[ "$(bal "$SHLD")" == "$escrow0" ]] || fail "private transfer moved escrow"
ok "0x77 transfer in block $tblk, from=$from (unlinked), root $r_prev -> $r_t, escrow unchanged"

wait_finalized "$tblk"
cp2="$(checkpoint "$tblk")"
a="$(balance_of 0 "$cp2")"; b="$(balance_of 1 "$cp2")"
[[ "$a" == "$((DEPOSIT - SEND))" && "$b" == "$SEND" ]] || fail "after transfer alice=$a bob=$b"
ok "wallet sees alice=$a bob=$b"

# 3. the same proven tx again: nullifier already spent, the pool refuses it
res="$(rpc eth_sendRawTransaction "[\"$raw_transfer\"]")"
[[ "$(jq -r '.error // empty' <<<"$res")" != "" ]] || fail "replayed 0x77 accepted: $res"
ok "replay rejected: $(jq -r .error.message <<<"$res" | cut -c1-100)"

# 4. proven withdrawal bob -> fresh EVM address
echo "proving withdrawal..."
t0=$SECONDS
raw_withdraw="$(wallet --account 1 withdraw --db "$cp2" --chain-id "$SHIELD_CHAIN_ID" --to "$RECV" --amount "$WITHDRAW")"
ok "withdrawal proven in $((SECONDS - t0))s"
[[ "$(bal "$RECV")" == 0 ]] || fail "$RECV not fresh"
escrow0="$(bal "$SHLD")"
receipt="$(send_shielded "$raw_withdraw")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "withdraw receipt: $receipt"
wblk="$(cast to-dec "$(jq -r .blockNumber <<<"$receipt")")"
[[ "$(bal "$RECV" "$wblk")" == "$WITHDRAW" ]] || fail "recipient got $(bal "$RECV" "$wblk")"
[[ "$(bc <<<"$escrow0 - $(bal "$SHLD" "$wblk")")" == "$WITHDRAW" ]] || fail "escrow didn't pay out"
ok "0x77 withdrawal in block $wblk paid $WITHDRAW to $RECV out of SHLD escrow"

wait_finalized "$wblk"
cp3="$(checkpoint "$wblk")"
a="$(balance_of 0 "$cp3")"; b="$(balance_of 1 "$cp3")"
[[ "$a" == "$((DEPOSIT - SEND))" && "$b" == "$((SEND - WITHDRAW))" ]] || fail "after withdraw alice=$a bob=$b"
ok "wallet sees alice=$a bob=$b"

# 5. restart: finalized shieldd roots, balances and payouts survive
fin="$(finalized)"
root_fin="$(slot 0 "$fin")"
escrow="$(bal "$SHLD")"
"$HERE/localnet.sh" restart "$CHAIN_ID" "$RPC_PORT" "$CONSENSUS_PORT" 1
got=""
for _ in $(seq 1 60); do
  got="$(slot 0 "$fin" 2>/dev/null || true)"
  [[ -n "$got" ]] && break
  sleep 1
done
[[ "$got" == "$root_fin" ]] || fail "root at block $fin changed across restart: $root_fin -> $got"
[[ "$(slot 0 "$tblk")" == "$r_t" ]] || fail "transfer block root changed across restart"
wait_finalized "$((fin + 2))"
cp4="$(checkpoint "$((fin + 2))")"
a="$(balance_of 0 "$cp4")"; b="$(balance_of 1 "$cp4")"
[[ "$a" == "$((DEPOSIT - SEND))" && "$b" == "$((SEND - WITHDRAW))" ]] || fail "after restart alice=$a bob=$b"
[[ "$(bal "$RECV")" == "$WITHDRAW" && "$(bal "$SHLD")" == "$escrow" ]] || fail "EVM balances moved across restart"
ok "restart: root at block $fin unchanged, alice=$a bob=$b, escrow $escrow, recipient $WITHDRAW"

echo "shield e2e passed"
