#!/usr/bin/env bash
# cw-commonware client on gaia across commonware epoch boundaries (own chain 9201, epoch length 20).
# Needs the gaia localnet from juno-migration.sh (chain localgaia-mig-1, wasm stored) to be running.
# Sends a transfer before the first boundary, after it, and after the second, asserting the voucher balance each time.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export BANKD_CHAIN_ID=9201 EPOCH=20
export BANKD_RPC=http://127.0.0.1:8745 BANKD_EPOCH_LENGTH=$EPOCH
export GAIA_HOME="$ROOT/target/gaiad-localnet/node0" GAIA_CHAIN_ID=localgaia-mig-1 GAIA_RPC=http://127.0.0.1:28000
export RELAYER_BIN="${RELAYER_BIN:-$ROOT/relayer/target/debug/bankd-relayer}"
export GAIA_BRIDGE_WORK="$ROOT/target/gaia-bridge-epoch"
ROUTER=0x4be2f106a550b243B60Fa279228f4e94b1EF8AeC
ADAPTER=0xBA01319fA1739A1D69aBae52B64105C74764CA4c
ADMIN_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
AMOUNT=1000000
BRIDGE="$ROOT/scripts/bankd/gaia-bridge.sh"
NODE=tcp://127.0.0.1:28000

mkdir -p "$GAIA_BRIDGE_WORK"
"$ROOT/scripts/bankd/localnet.sh" up 9201 8745 9200 2 $EPOCH
trap '[[ -n "${KEEP:-}" ]] || "$ROOT/scripts/bankd/localnet.sh" down 9201; rm -rf "$GAIA_BRIDGE_WORK"' EXIT

gaia_client="$("$BRIDGE" gaia-client | jq -r .gaia_client)"
echo "client $gaia_client"

# Return direction uses a mock client, same as juno-migration.sh bridge.
lc="$(cd "$ROOT/contracts/lib/ibc-contracts/ibc-solidity" && forge create --rpc-url $BANKD_RPC --private-key $ADMIN_PK \
  --broadcast --json test/solidity-ibc/mocks/DummyLightClient.sol:DummyLightClient --constructor-args 0 0 false | jq -r .deployedTo)"
cast send --rpc-url $BANKD_RPC --private-key $ADMIN_PK --json $ROUTER "addClient(string,(string,bytes[]),address)" \
  "$GAIA_CHAIN_ID" "($gaia_client,[0x696263,0x])" "$lc" | jq -e '.status == "0x1"' >/dev/null
gaiad --home "$GAIA_HOME" tx ibc client add-counterparty "$gaia_client" "$GAIA_CHAIN_ID" "" --from val --keyring-backend test \
  --chain-id "$GAIA_CHAIN_ID" --node $NODE --gas 500000 --gas-prices 0.1uatom -y -o json | jq -e '.code == 0' >/dev/null
sleep 3
jq -n --arg g "$gaia_client" --arg b "$GAIA_CHAIN_ID" '{gaia_client: $g, bankd_client: $b}' >"$GAIA_BRIDGE_WORK/state.json"

rcv="$(gaiad --home "$GAIA_HOME" keys show val -a --keyring-backend test)"
denom="ibc/$(printf 'transfer/%s/ujuno' "$gaia_client" | shasum -a 256 | cut -d' ' -f1 | tr a-f A-F)"
balance() {
  gaiad --home "$GAIA_HOME" q bank balances "$rcv" --node $NODE -o json | jq -r --arg d "$denom" '[.balances[] | select(.denom==$d) | .amount][0] // "0"'
}
height() { cast block-number --rpc-url $BANKD_RPC; }

# $1 = label, $2 = expected balance
transfer() {
  local tx bal
  tx="$(cast send --rpc-url $BANKD_RPC --private-key $ADMIN_PK --value $((AMOUNT * 1000000000000)) --json $ADAPTER \
    "sendTransfer(string,string,uint64,string)" "$GAIA_CHAIN_ID" "$rcv" $(( $(date +%s) + 3600 )) "" | jq -r .transactionHash)"
  echo "$1: sent at bankd height $(height)"
  sleep 4
  "$BRIDGE" to-gaia "$tx" | tail -1
  bal="$(balance)"
  [[ "$bal" == "$2" ]] || { echo "FAIL $1: expected $2 got $bal" >&2; exit 1; }
  echo "PASS $1: gaia voucher balance $bal (bankd height $(height))"
}

(( $(height) < EPOCH - 4 )) || echo "warn: already near first boundary" >&2
transfer "epoch0" $AMOUNT
until (( $(height) > EPOCH + 2 )); do sleep 1; done
transfer "epoch1 (after 1 boundary)" $((AMOUNT * 2))
until (( $(height) > 2 * EPOCH + 2 )); do sleep 1; done
transfer "epoch2 (after 2 boundaries)" $((AMOUNT * 3))
echo "epoch e2e ok"
