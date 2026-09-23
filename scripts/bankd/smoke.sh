#!/usr/bin/env bash
# Smoke test a running bankd localnet: native BRL gas, value transfers, contracts, ws.
#
#   smoke.sh [rpc_port] [chain_id]
set -euo pipefail

RPC_PORT="${1:-8545}"
CHAIN_ID="${2:-9001}"
RPC="http://127.0.0.1:$RPC_PORT"
WS="ws://127.0.0.1:$RPC_PORT"
FEE_ESCROW="0x0000000000000000000000000000000000FEE000"

# anvil/hardhat "test test ... junk" accounts 0 and 1
PK0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ADDR0="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
ADDR1="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
PK2="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
ADDR2="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
COMPLIANCE="0x000000000000000000000000000000434D504C59"
NATIVE="0x0000000000000000000000000000004552433230"

# Counter { uint256 public number; function increment() external payable }
COUNTER_BYTECODE="0x6080604052348015600e575f5ffd5b5060c580601a5f395ff3fe6080604052600436106025575f3560e01c80638381f58a146029578063d09de08a14604d575b5f5ffd5b3480156033575f5ffd5b50603b5f5481565b60405190815260200160405180910390f35b60536055565b005b60015f5f82825460649190606b565b9091555050565b80820180821115608957634e487b7160e01b5f52601160045260245ffd5b9291505056fea26469706673582212200076500192150fa03a24a39a69d431311d3d9de474b69a2adeb2bfd098e5d54564736f6c634300081c0033"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }
bal() { cast balance --rpc-url "$RPC" "$1"; }

# 1. chain id
got="$(cast chain-id --rpc-url "$RPC")"
[[ "$got" == "$CHAIN_ID" ]] || fail "chain id $got != $CHAIN_ID"
ok "chain id $got"

# 2. native BRL transfer with value, gas paid in BRL, fee to escrow
value=1000000000000000000 # 1 BRL
s0="$(bal "$ADDR0")"; r0="$(bal "$ADDR1")"; e0="$(bal "$FEE_ESCROW")"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json "$ADDR1" --value "$value")"
status="$(jq -r .status <<<"$receipt")"
[[ "$status" == "0x1" ]] || fail "transfer status $status"
used="$(cast to-dec "$(jq -r .gasUsed <<<"$receipt")")"
price="$(cast to-dec "$(jq -r .effectiveGasPrice <<<"$receipt")")"
blk="$(jq -r .blockNumber <<<"$receipt")"
fee="$(bc <<<"$used * $price")"
s1="$(cast balance --rpc-url "$RPC" --block "$blk" "$ADDR0")"
r1="$(cast balance --rpc-url "$RPC" --block "$blk" "$ADDR1")"
e1="$(cast balance --rpc-url "$RPC" --block "$blk" "$FEE_ESCROW")"
[[ "$(bc <<<"$r1 - $r0")" == "$value" ]] || fail "receiver delta $(bc <<<"$r1 - $r0") != $value"
[[ "$(bc <<<"$s0 - $s1")" == "$(bc <<<"$value + $fee")" ]] \
  || fail "sender delta $(bc <<<"$s0 - $s1") != value+fee $(bc <<<"$value + $fee")"
# Escrow can also collect fees from other txs in the same block, so only require >= fee.
[[ "$(bc <<<"$e1 - $e0 >= $fee")" == "1" ]] || fail "escrow delta $(bc <<<"$e1 - $e0") < fee $fee"
ok "value transfer: sender -$value -$fee (gas $used @ $price), receiver +$value, escrow +$(bc <<<"$e1 - $e0")"

# 3. legacy tx with value
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json --legacy "$ADDR1" --value 1)"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "legacy value tx failed"
ok "legacy tx with value"

# 4. deploy + call a contract (with value)
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json --create "$COUNTER_BYTECODE")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "deploy failed"
counter="$(jq -r .contractAddress <<<"$receipt")"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json --value 5 "$counter" "increment()")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "increment failed"
n="$(cast call --rpc-url "$RPC" "$counter" "number()(uint256)")"
[[ "$n" == "1" ]] || fail "counter number $n != 1"
[[ "$(bal "$counter")" == "5" ]] || fail "counter balance $(bal "$counter") != 5"
ok "contract $counter deployed, increment() -> $n, holds 5 wei"

# 5. eth_subscribe newHeads over ws
node -e '
const ws = new WebSocket(process.argv[1]);
const t = setTimeout(() => { console.error("no newHeads within 20s"); process.exit(1); }, 20000);
ws.onopen = () => ws.send(JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_subscribe",params:["newHeads"]}));
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.method === "eth_subscription") {
    console.log("ok: ws newHeads block " + parseInt(d.params.result.number, 16));
    clearTimeout(t); ws.close(); process.exit(0);
  }
};
ws.onerror = (e) => { console.error("ws error", e.message); process.exit(1); };
' "$WS" || fail "ws newHeads"

# 6. compliance: freeze acct2 (Authority owner is acct0)
cast send --rpc-url "$RPC" --private-key "$PK0" "$COMPLIANCE" "freeze(address)" "$ADDR2" >/dev/null
[[ "$(cast call --rpc-url "$RPC" "$COMPLIANCE" "isFrozen(address)(bool)" "$ADDR2")" == "true" ]] \
  || fail "acct2 not frozen"
ok "acct2 frozen"

if out="$(cast send --rpc-url "$RPC" --private-key "$PK2" "$ADDR1" --value 1 --gas-limit 300000 2>&1)"; then
  fail "frozen sender tx accepted: $out"
fi
grep -qi "blocked\|frozen" <<<"$out" || fail "frozen sender rejected for the wrong reason: $out"
ok "frozen acct2 can't send"

if out="$(cast send --rpc-url "$RPC" --private-key "$PK0" "$ADDR2" --value 1 --gas-limit 300000 2>&1)"; then
  fail "transfer to frozen accepted: $out"
fi
grep -qi "blocked\|frozen" <<<"$out" || fail "transfer to frozen rejected for the wrong reason: $out"
ok "transfer to frozen acct2 rejected"

# forwarder: CALL(gas, acct2, callvalue, 0, 0, 0, 0), revert on failure
runtime="600060006000600034 73${ADDR2#0x} 5af1156025570 05b60006000fd"
runtime="${runtime// /}"
initcode="0x602b80600b6000396000f3${runtime}"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json --create "$initcode")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "forwarder deploy failed"
fwd="$(jq -r .contractAddress <<<"$receipt")"
b2="$(bal "$ADDR2")"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json --gas-limit 300000 --value 7 "$fwd" 2>/dev/null || true)"
[[ "$(jq -r .status <<<"$receipt" 2>/dev/null)" != "0x1" ]] || fail "forward to frozen succeeded"
[[ "$(bal "$ADDR2")" == "$b2" ]] || fail "frozen acct2 balance changed via contract"
ok "contract forwarding BRL to frozen acct2 reverts"

if cast send --rpc-url "$RPC" --private-key "$PK0" --gas-limit 300000 "$NATIVE" --value 1 >/dev/null 2>&1; then
  fail "value to Native precompile accepted"
fi
ok "value to bankd precompile rejected"

seized=1000000000000000000
b0="$(bal "$ADDR0")"; b2="$(bal "$ADDR2")"
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK0" --json "$COMPLIANCE" "seize(address,address,uint256)" "$ADDR2" "$ADDR0" "$seized")"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "seize failed"
[[ "$(bc <<<"$b2 - $(bal "$ADDR2")")" == "$seized" ]] || fail "seize didn't debit acct2"
ok "seize moved 1 BRL out of frozen acct2"

cast send --rpc-url "$RPC" --private-key "$PK0" "$COMPLIANCE" "unfreeze(address)" "$ADDR2" >/dev/null
receipt="$(cast send --rpc-url "$RPC" --private-key "$PK2" --json "$ADDR1" --value 1)"
[[ "$(jq -r .status <<<"$receipt")" == "0x1" ]] || fail "acct2 transfer after unfreeze failed"
ok "unfreeze restores acct2 transfers"

# 7. finality
fin="$(cast block --rpc-url "$RPC" finalized --field number)"
[[ "$fin" -gt 0 ]] || fail "no finalized block"
ok "finalized block $fin"

echo "all smoke checks passed"
