#!/usr/bin/env bash
# Juno (IBC v1) to Juno-on-commonware migration e2e, see docs/MIGRATION-juno.md.
#
#   juno-migration.sh v1-up     2-val juno + 2-val gaia, wasm client stored on gaia, v1 transfer channel via
#                               hermes, one ujuno transfer to gaia
#   juno-migration.sh halt      gov software upgrade halts juno, exports balances, writes genesis-alloc.json
#   juno-migration.sh launch    2-validator commonware chain (9001, rpc 8545) with the exported balances in genesis
#   juno-migration.sh bridge    cw-commonware client on gaia (verifies the commonware validators), mock client on
#                               commonware for gaia, then one ujuno transfer commonware to gaia over IBC v2
#   juno-migration.sh down
#
# genesis-alloc.json lands in target/junod-localnet, it is what localnet.sh takes as GENESIS_ALLOC.
# Needs junod, gaiad, hermes, jq. Later stages (gaia to commonware with a real client, legacy alias, send from a migrated account) are still TODO.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LN="$ROOT/scripts/bankd/cosmos-localnet.sh"
WORK="$ROOT/target/hermes-mig"
JUNO_ID=localjuno-1
GAIA_ID=localgaia-mig-1
GAIA_HOME="$ROOT/target/gaiad-localnet/node0"
# abandon x11 + about. Index 0 is funded on juno, and used as the relayer on both chains.
MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
WASM="${WASM_CLIENT:-$ROOT/contracts/lib/ibc-contracts/e2e/interchaintestv8/wasm/cw_dummy_light_client.wasm.gz}"

hermes_cfg() {
  mkdir -p "$WORK"
  cat >"$WORK/config.toml" <<TOML
[global]
log_level = 'info'
[mode.clients]
enabled = true
refresh = true
misbehaviour = false
[mode.connections]
enabled = true
[mode.channels]
enabled = true
[mode.packets]
enabled = true

[[chains]]
id = '$JUNO_ID'
type = 'CosmosSdk'
rpc_addr = 'http://127.0.0.1:27000'
grpc_addr = 'http://127.0.0.1:27002'
event_source = { mode = 'pull', interval = '1s' }
account_prefix = 'juno'
key_name = 'relayer'
store_prefix = 'ibc'
gas_price = { price = 0.0025, denom = 'ujuno' }
max_gas = 3000000
gas_multiplier = 1.5
clock_drift = '5s'
trusting_period = '10minutes'

[[chains]]
id = '$GAIA_ID'
type = 'CosmosSdk'
rpc_addr = 'http://127.0.0.1:28000'
grpc_addr = 'http://127.0.0.1:28002'
event_source = { mode = 'pull', interval = '1s' }
account_prefix = 'cosmos'
key_name = 'relayer'
store_prefix = 'ibc'
gas_price = { price = 0.005, denom = 'uatom' }
max_gas = 3000000
gas_multiplier = 1.5
clock_drift = '5s'
trusting_period = '10minutes'
TOML
  echo "$MNEMONIC" >"$WORK/mnemonic"
}

v1_up() {
  "$LN" up
  BIN=gaiad CHAIN_ID=$GAIA_ID DENOM=uatom BASE_PORT=28000 "$LN" up
  GAIA_HOME="$GAIA_HOME" GAIA_CHAIN_ID=$GAIA_ID GAIA_RPC_PORT=28000 "$ROOT/scripts/bankd/gaia-localnet.sh" store "$WASM"

  hermes_cfg
  local h="hermes --config $WORK/config.toml"
  for c in $JUNO_ID $GAIA_ID; do
    $h keys add --chain "$c" --mnemonic-file "$WORK/mnemonic" --key-name relayer --overwrite >/dev/null
  done
  # The relayer key is the funded juno account already, gaia needs a top up.
  local relayer_gaia
  relayer_gaia="$($h keys list --chain $GAIA_ID 2>&1 | grep -o 'cosmos1[a-z0-9]*' | head -1)"
  gaiad --home "$GAIA_HOME" tx bank send val "$relayer_gaia" 1000000000uatom --keyring-backend test \
    --chain-id $GAIA_ID --node tcp://127.0.0.1:28000 --gas-prices 0.1uatom --gas auto --gas-adjustment 2 -y -o json >/dev/null
  sleep 3

  $h create channel --a-chain $JUNO_ID --b-chain $GAIA_ID --a-port transfer --b-port transfer --new-client-connection --yes >/dev/null
  local receiver
  receiver="$(gaiad --home "$GAIA_HOME" keys show val -a --keyring-backend test)"
  $h tx ft-transfer --dst-chain $GAIA_ID --src-chain $JUNO_ID --src-port transfer --src-channel channel-0 \
    --amount 1000000 --denom ujuno --receiver "$receiver" --timeout-height-offset 1000 >/dev/null
  $h clear packets --chain $JUNO_ID --port transfer --channel channel-0 >/dev/null
  sleep 3
  local bal
  bal="$(gaiad q bank balances "$receiver" --node tcp://127.0.0.1:28000 -o json | jq -r '[.balances[] | select(.denom | startswith("ibc/"))][0].amount // 0')"
  [[ "$bal" == 1000000 ]] || { echo "expected 1000000 ibc voucher on gaia, got $bal" >&2; exit 1; }
  echo "v1 channel-0 open, gaia holds $bal ujuno vouchers"
}

# Native has 18 decimals, ujuno 6. Keep in sync with ICS20NativeAdapter.SCALE.
SCALE=1000000000000

halt() {
  local dir="$ROOT/target/junod-localnet" chain=$JUNO_ID
  local j="junod --home $dir/node0" node="--node tcp://127.0.0.1:27000"
  local f="--from val --keyring-backend test --chain-id $chain $node --gas-prices 0.0025ujuno --gas auto --gas-adjustment 2 -y -o json"
  local cur h pid
  cur="$(curl -s localhost:27000/status | jq -r .result.sync_info.latest_block_height)"
  h=$((cur + 45))
  $j tx upgrade software-upgrade halt-for-migration --upgrade-height $h --upgrade-info '{}' --no-validate \
    --title halt --summary halt --deposit 1ujuno $f >/dev/null
  sleep 3
  pid="$($j q gov proposals $node -o json | jq -r '.proposals[-1].id')"
  $j tx gov vote "$pid" yes $f >/dev/null
  echo "halt proposal $pid, waiting for height $h"
  for _ in $(seq 1 120); do
    grep -q "UPGRADE .* NEEDED at height: $h" "$dir"/node0/node.log 2>/dev/null && break
    sleep 1
  done
  grep -q "UPGRADE .* NEEDED at height: $h" "$dir"/node0/node.log || { echo "juno didn't halt at $h" >&2; exit 1; }
  for n in 0 1; do kill "$(cat "$dir/node$n/node.pid")" 2>/dev/null || true; done
  sleep 2

  $j export 2>/dev/null | grep '^{' >"$dir/export.json"
  local escrow
  escrow="$($j q ibc-transfer escrow-address transfer channel-0)"
  # User accounts only. Module accounts are dropped, the channel escrow is seeded into the adapter later.
  jq -r --arg escrow "$escrow" '
    [.app_state.auth.accounts[] | select(."@type"=="/cosmos.auth.v1beta1.ModuleAccount") | .base_account.address] as $mods
    | .app_state.bank.balances[]
    | select(.address as $a | ($mods | index($a) | not) and $a != $escrow)
    | "\(.address) \(.coins[] | select(.denom=="ujuno") | .amount)"' "$dir/export.json" |
  while read -r addr amt; do
    hex="$($j debug addr "$addr" 2>/dev/null | awk '/Address \(hex\)/{print tolower($3)}')"
    printf '%s %s %s\n' "$addr" "0x$hex" "$amt"
  done | python3 -c '
import json, sys
scale = int(sys.argv[1])
alloc, rows = {}, []
for line in sys.stdin:
    b, a, amt = line.split()
    alloc[a] = hex(int(amt) * scale)
    rows.append({"bech32": b, "address": a, "ujuno": amt})
json.dump(alloc, open(sys.argv[2], "w"), indent=2)
json.dump(rows, open(sys.argv[3], "w"), indent=2)
' "$SCALE" "$dir/genesis-alloc.json" "$dir/alloc.json"
  echo "halted at $h, $(jq length "$dir/alloc.json") accounts in $dir/genesis-alloc.json, channel-0 escrow $escrow"
}

ADMIN_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ROUTER=0x4be2f106a550b243B60Fa279228f4e94b1EF8AeC
ADAPTER=0xBA01319fA1739A1D69aBae52B64105C74764CA4c
BANKD_RPC=http://127.0.0.1:8545

bridge() {
  local bridge="$ROOT/scripts/bankd/gaia-bridge.sh" gaia_client rcv lc tx bal
  local relayer_bin
  relayer_bin="${RELAYER_BIN:-$ROOT/relayer/target/debug/bankd-relayer}"
  [[ -x "$relayer_bin" ]] || (cd "$ROOT/relayer" && cargo build)
  export GAIA_HOME GAIA_CHAIN_ID=$GAIA_ID GAIA_RPC=http://127.0.0.1:28000 RELAYER_BIN="$relayer_bin"

  # The real client, replacing the dummy one v1-up stored.
  GAIA_CHAIN_ID=$GAIA_ID GAIA_RPC_PORT=28000 "$ROOT/scripts/bankd/gaia-localnet.sh" store \
    "$ROOT/light-clients/cw-commonware/artifacts/cw_commonware.wasm"
  gaia_client="$("$bridge" gaia-client | jq -r .gaia_client)"

  # gaia to commonware still uses a mock client here (accepts any proof). A real one is SP1 based.
  lc="$(cd "$ROOT/contracts/lib/ibc-contracts/ibc-solidity" && forge create --rpc-url $BANKD_RPC --private-key $ADMIN_PK \
    --broadcast --json test/solidity-ibc/mocks/DummyLightClient.sol:DummyLightClient --constructor-args 0 0 false | jq -r .deployedTo)"
  cast send --rpc-url $BANKD_RPC --private-key $ADMIN_PK --json $ROUTER "addClient(string,(string,bytes[]),address)" \
    "$GAIA_ID" "($gaia_client,[0x696263,0x])" "$lc" | jq -e '.status == "0x1"' >/dev/null
  gaiad --home "$GAIA_HOME" tx ibc client add-counterparty "$gaia_client" "$GAIA_ID" "" --from val --keyring-backend test \
    --chain-id $GAIA_ID --node tcp://127.0.0.1:28000 --gas 500000 --gas-prices 0.1uatom -y -o json | jq -e '.code == 0' >/dev/null
  sleep 3
  jq -n --arg g "$gaia_client" --arg b "$GAIA_ID" '{gaia_client: $g, bankd_client: $b}' >"$ROOT/target/gaia-bridge/state.json"

  rcv="$(gaiad --home "$GAIA_HOME" keys show val -a --keyring-backend test)"
  tx="$(cast send --rpc-url $BANKD_RPC --private-key $ADMIN_PK --value $((1000000 * SCALE)) --json $ADAPTER \
    "sendTransfer(string,string,uint64,string)" "$GAIA_ID" "$rcv" $(( $(date +%s) + 3600 )) "" | jq -r .transactionHash)"
  sleep 4
  "$bridge" to-gaia "$tx" | tail -1
  bal="$(gaiad --home "$GAIA_HOME" q bank balances "$rcv" --node tcp://127.0.0.1:28000 -o json \
    | jq -r --arg d "ibc/$(printf 'transfer/%s/ujuno' "$gaia_client" | shasum -a 256 | cut -d' ' -f1 | tr a-f A-F)" '.balances[] | select(.denom==$d) | .amount')"
  [[ "$bal" == 1000000 ]] || { echo "expected 1000000 v2 voucher on gaia, got '$bal'" >&2; exit 1; }
  echo "commonware to gaia over v2 works, gaia holds $bal ujuno (transfer/$gaia_client/ujuno)"
}

launch() {
  GENESIS_ALLOC="$ROOT/target/junod-localnet/genesis-alloc.json" "$ROOT/scripts/bankd/localnet.sh" up 9001 8545 9000 2
  # Every exported account must hold ujuno * SCALE wei on both validators.
  local bad=0 row addr want
  for row in $(jq -r '.[] | "\(.address),\(.ujuno)"' "$ROOT/target/junod-localnet/alloc.json"); do
    addr="${row%,*}"; want="$(python3 -c "print(${row#*,} * $SCALE)")"
    for port in 8545 8546; do
      [[ "$(cast balance "$addr" --rpc-url "http://127.0.0.1:$port")" == "$want" ]] || { echo "balance mismatch $addr on $port" >&2; bad=1; }
    done
  done
  [[ $bad == 0 ]] || exit 1
  echo "all exported balances match on both validators"
}

down() {
  "$ROOT/scripts/bankd/localnet.sh" down 9001 >/dev/null 2>&1 || true
  "$LN" down || true
  BIN=gaiad "$LN" down || true
  rm -rf "$WORK"
}

case "${1:-}" in
  v1-up) v1_up ;;
  halt) halt ;;
  launch) launch ;;
  bridge) bridge ;;
  down) down ;;
  *) echo "usage: $0 v1-up|halt|launch|bridge|down" >&2; exit 1 ;;
esac
