#!/usr/bin/env bash
# Shieldd smoke test on a running 1-validator localnet (localnet.sh up 9001 8545 9000 1).
# EVM deposit into the shielded pool, root slot moving every block, refused deposit
# refund, frozen sender, then a node restart with the shieldd root surviving.
#
#   shield-smoke.sh [rpc_port] [chain_id] [consensus_port]
set -euo pipefail

RPC_PORT="${1:-8545}"
CHAIN_ID="${2:-9001}"
CONSENSUS_PORT="${3:-9000}"
RPC="http://127.0.0.1:$RPC_PORT"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SHLD="0x0000000000000000000000000000000053484C44"
COMPLIANCE="0x000000000000000000000000000000434D504C59"
# anvil accounts 0 (Authority owner at genesis) and 2
PK0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ADDR0="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
PK2="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
ADDR2="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
# shieldd test wallet address 0 (shieldd/crates/core/keys/src/test_keys.rs)
SHIELD_RECIPIENT="shieldd1u29dhz4vxgnek6a3vzxlejg0l83wegpu7hgs3yphdvljcnnnh89dvs6lc9hxxw94w464t7lh5x36cxnxyx0"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }
bal() { cast balance --rpc-url "$RPC" ${2:+--block "$2"} "$1"; }
slot() { cast storage --rpc-url "$RPC" ${3:+--block "$3"} "$SHLD" "$1"; }
head_num() { cast block-number --rpc-url "$RPC"; }
wait_blocks() {
  local target=$(( $(head_num) + $1 ))
  for _ in $(seq 1 60); do
    (( $(head_num) >= target )) && return 0
    sleep 1
  done
  fail "chain stalled below block $target"
}
finalized() {
  cast block --rpc-url "$RPC" finalized --field number
}

# 1. root + height slots move every block
b1="$(head_num)"
r1="$(slot 0 "$b1")"; h1="$(cast to-dec "$(slot 1 "$b1")")"
wait_blocks 1
b2="$(head_num)"
r2="$(slot 0 "$b2")"; h2="$(cast to-dec "$(slot 1 "$b2")")"
[[ "$h1" == "$b1" && "$h2" == "$b2" ]] || fail "height slot $h1/$h2 != blocks $b1/$b2"
[[ "$r1" != "$r2" && "$r1" != "0x0000000000000000000000000000000000000000000000000000000000000000" ]] \
  || fail "root slot didn't change: $r1 -> $r2"
view="$(cast call --rpc-url "$RPC" --block "$b2" "$SHLD" 'getLastCommitment()(bytes32,uint64)')"
[[ "$view" == *"${r2#0x}"* ]] || fail "getLastCommitment $view doesn't show root $r2"
ok "shieldd root slot moves per block ($b1: $r1, $b2: $r2), getLastCommitment agrees"

# 2. EVM deposit escrows msg.value in SHLD and emits ShielddDeposit
value=1000000000000000000
e0="$(bal "$SHLD")"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json "$SHLD" 'deposit(string)' "$SHIELD_RECIPIENT" --value "$value")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "deposit tx failed: $receipt"
blk="$(jq -r .blockNumber <<<"$receipt")"
topic="$(cast keccak 'ShielddDeposit(address,string,uint256,string)')"
logs="$(jq -r --arg t "$topic" '[.logs[] | select(.topics[0] == $t)] | length' <<<"$receipt")"
[[ "$logs" == "1" ]] || fail "expected 1 ShielddDeposit log, got $logs"
e1="$(bal "$SHLD" "$blk")"
[[ "$(bc <<<"$e1 - $e0")" == "$value" ]] || fail "escrow delta $(bc <<<"$e1 - $e0") != $value"
ok "deposit escrowed $value wei in SHLD (block $blk)"

# 3. deposit shieldd refuses (bad recipient) is refunded in the same block
e0="$(bal "$SHLD")"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json "$SHLD" 'deposit(string)' "not-a-shieldd-address" --value "$value")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "bad-recipient deposit tx failed"
blk="$(jq -r .blockNumber <<<"$receipt")"
e1="$(bal "$SHLD" "$blk")"
[[ "$e1" == "$e0" ]] || fail "refused deposit not refunded, escrow $e0 -> $e1"
ok "refused deposit refunded"

# 4. frozen sender can't deposit
cast send --rpc-url "$RPC" --private-key "$PK0" "$COMPLIANCE" 'freeze(address)' "$ADDR2" >/dev/null
if cast send --rpc-url "$RPC" --private-key "$PK2" "$SHLD" 'deposit(string)' "$SHIELD_RECIPIENT" --value 1 >/dev/null 2>&1; then
  fail "frozen account deposited"
fi
cast send --rpc-url "$RPC" --private-key "$PK0" "$COMPLIANCE" 'unfreeze(address)' "$ADDR2" >/dev/null
ok "frozen sender can't deposit"

# 5. restart: finalized shieldd root survives and the chain keeps going
wait_blocks 2
fin="$(finalized)"
root_fin="$(slot 0 "$fin")"
"$HERE/localnet.sh" restart "$CHAIN_ID" "$RPC_PORT" "$CONSENSUS_PORT" 1
# reth only persists some blocks to disk, the rest get re-imported (and shieldd replays
# them) once consensus catches up, so poll until block $fin is served again.
got=""
for _ in $(seq 1 60); do
  got="$(slot 0 "$fin" 2>/dev/null || true)"
  [[ -n "$got" ]] && break
  sleep 1
done
[[ "$got" == "$root_fin" ]] || fail "root at finalized block $fin changed across restart: $root_fin -> $got"
wait_blocks 3
b="$(head_num)"
(( b > fin )) || fail "no new blocks after restart"
h=""
for _ in $(seq 1 20); do
  b="$(head_num)"
  h="$(cast to-dec "$(slot 1 "$b" 2>/dev/null || echo 0x0)")"
  [[ "$h" == "$b" ]] && break
  sleep 1
done
[[ "$h" == "$b" ]] || fail "height slot $h stale at head $b after restart"
e="$(bal "$SHLD")"
(( $(bc <<<"$e >= $value") )) || fail "escrow lost across restart: $e"
ok "restart: root at block $fin unchanged, head $b, escrow $e"

echo "shield smoke passed"
