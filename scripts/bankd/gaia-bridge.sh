#!/usr/bin/env bash
# IBC v2 between a bankd hub and a gaia localnet, using ibc-contracts' proof-api.
#
#   gaia-bridge.sh api                  write the proof-api config and start it
#   gaia-bridge.sh restart-api          restart proof-api, keeping the connection
#   gaia-bridge.sh connect              create both light clients and register counterparties
#   gaia-bridge.sh gaia-client         only the gaia half of connect: create the cw-commonware client on gaia
#   gaia-bridge.sh to-gaia <tx hash>    relay packets from a bankd tx (recv on gaia, or acks)
#   gaia-bridge.sh to-bankd <tx hash>   relay packets from a gaia tx (recv on bankd, or acks)
#   gaia-bridge.sh send-from-gaia <0x receiver> <amount> <denom>
#                                       ICS20 over v2 from gaia, solidity-abi encoded
#   gaia-bridge.sh down                 stop proof-api, drop state
#
# bankd -> gaia: bankd-relayer (relayer/src/gaia.rs), against the cw-commonware 08-wasm client stored by
#   gaia-localnet.sh. It checks bankd's BLS finalizations and MPT proofs of the router's storage.
# gaia -> bankd: proof-api cosmos_to_eth with SP1 network proofs, against SP1ICS07Tendermint on bankd.
# Needs NETWORK_PRIVATE_KEY (read from .env if present), grpcurl (see GRPCURL), cast, gaiad, jq.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ -f "$ROOT/.env" ]] && { set -a; source "$ROOT/.env"; set +a; }
IBC="$ROOT/contracts/lib/ibc-contracts"
WORK="${GAIA_BRIDGE_WORK:-$ROOT/target/gaia-bridge}"
GAIA_HOME="${GAIA_HOME:-$ROOT/target/gaia-localnet}"

BANKD_RPC="${BANKD_RPC:-http://127.0.0.1:8545}"
BANKD_CHAIN_ID="${BANKD_CHAIN_ID:-9001}"
GAIA_CHAIN_ID="${GAIA_CHAIN_ID:-localgaia-1}"
GAIA_RPC="${GAIA_RPC:-http://127.0.0.1:26657}"
API_PORT="${PROOF_API_PORT:-3000}"
API_BIN="${PROOF_API_BIN:-$IBC/target/release/proof-api}"
# GOBIN=target/tools go install github.com/fullstorydev/grpcurl/cmd/grpcurl@v1.9.3
GRPCURL="${GRPCURL:-$ROOT/target/tools/grpcurl}"
ROUTER=0x4be2f106a550b243B60Fa279228f4e94b1EF8AeC
# Authority owner (router admin) and the relayer granted RELAYER_ROLE at genesis, anvil accts 0 and 1.
ADMIN_PK="${ADMIN_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
RELAYER_PK="${RELAYER_PK:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
SP1_VERIFIER="${SP1_VERIFIER:-}"
SP1_ELFS="${SP1_ELFS:-$ROOT/target/sp1-programs}"
RELAYER_BIN="${RELAYER_BIN:-$(cargo metadata --format-version 1 --no-deps --manifest-path "$ROOT/relayer/Cargo.toml" | jq -r .target_directory)/debug/bankd-relayer}"
BANKD_EPOCH_LENGTH="${BANKD_EPOCH_LENGTH:-600}"
# Client id of gaia on bankd. Custom ids go through the admin-only addClient overload.
BANKD_CLIENT_ID="${BANKD_CLIENT_ID:-$GAIA_CHAIN_ID}"

fail() { echo "error: $*" >&2; exit 1; }
mkdir -p "$WORK"

# proof-api call via grpcurl with the proto file, since proof-api has no reflection.
# $1 = rpc name, stdin = json request.
api() {
  "$GRPCURL" -plaintext -import-path "$IBC/proto" -proto proofapi/proofapi.proto -d @ \
    "127.0.0.1:$API_PORT" "proofapi.ProofApiService/$1"
}

b64hex() { xxd -r -p <<<"${1#0x}" | base64; }
hexb64() { base64 -d <<<"$1" | xxd -p | tr -d '\n'; }

gaia_addr() { gaiad --home "$GAIA_HOME" keys show val -a --keyring-backend test; }

# Signs and broadcasts an unsigned TxBody (base64) from proof-api with the gaia relayer key.
gaia_submit() {
  local body="$1" f="$WORK/gaia-tx"
  # Wrap the body as Tx{body: 1, auth_info: 2 (empty)} so gaiad can decode it into json.
  python3 - "$body" >"$f.b64" <<'EOF'
import base64, sys
body = base64.b64decode(sys.argv[1])
def varint(n):
    out = b""
    while True:
        b = n & 0x7f
        n >>= 7
        out += bytes([b | (0x80 if n else 0)])
        if not n:
            return out
print(base64.b64encode(b"\x0a" + varint(len(body)) + body + b"\x12\x00").decode())
EOF
  gaiad --home "$GAIA_HOME" tx decode "$(cat "$f.b64")" >"$f.json"
  gaia_sign_broadcast "$f.json"
}

# Sets the fee, signs an unsigned tx json with the gaia relayer key and broadcasts it.
# Prints the tx hash, the result lands in $WORK/gaia-tx.result.json.
gaia_sign_broadcast() {
  local f="$WORK/gaia-tx"
  jq '.auth_info.fee = {"amount": [{"denom": "uatom", "amount": "50000"}], "gas_limit": "20000000"}' "$1" >"$f.unsigned.json"
  gaiad --home "$GAIA_HOME" tx sign "$f.unsigned.json" --from val --keyring-backend test --chain-id "$GAIA_CHAIN_ID" \
    --node "${GAIA_RPC/http/tcp}" >"$f.signed.json"
  local res code hash
  res="$(gaiad --home "$GAIA_HOME" tx broadcast "$f.signed.json" --node "${GAIA_RPC/http/tcp}" -o json)"
  code="$(jq -r .code <<<"$res")"
  [[ "$code" == 0 ]] || fail "gaia broadcast: $(jq -r .raw_log <<<"$res")"
  hash="$(jq -r .txhash <<<"$res")"
  for _ in $(seq 1 30); do
    if res="$(gaiad --home "$GAIA_HOME" q tx "$hash" --node "${GAIA_RPC/http/tcp}" -o json 2>/dev/null)"; then
      [[ "$(jq -r .code <<<"$res")" == 0 ]] || fail "gaia tx $hash: $(jq -r .raw_log <<<"$res")"
      echo "$res" >"$f.result.json"
      echo "$hash"
      return
    fi
    sleep 1
  done
  fail "gaia tx $hash not found"
}

cmd_api() {
  [[ -x "$API_BIN" ]] || fail "no proof-api at $API_BIN (cargo build --release --bin proof-api in $IBC)"
  [[ -n "${NETWORK_PRIVATE_KEY:-}" ]] || fail "NETWORK_PRIVATE_KEY not set"
  lsof -iTCP:"$API_PORT" -sTCP:LISTEN >/dev/null 2>&1 && fail "port $API_PORT in use"
  # The network key comes from the env (NETWORK_PRIVATE_KEY) so it never lands in the config file.
  [[ "${SP1_PROVER:-}" == network ]] || fail "SP1_PROVER=network not set"
  jq -n --arg port "$API_PORT" --arg bankd "$BANKD_CHAIN_ID" --arg gaia "$GAIA_CHAIN_ID" \
    --arg router "$ROUTER" --arg eth "$BANKD_RPC" --arg tm "$GAIA_RPC" --arg elfs "$SP1_ELFS" '{
    server: {address: "127.0.0.1", port: ($port | tonumber)},
    observability: {level: "info", use_otel: false, service_name: "gaia-bridge"},
    modules: [
      {name: "cosmos_to_eth", src_chain: $gaia, dst_chain: $bankd, config: {
        tm_rpc_url: $tm, ics26_address: $router, eth_rpc_url: $eth,
        mode: {sp1: {
          # "network" hardcodes the Hosted strategy, which mainnet rejects. env takes SP1_PROVER=network
          # and NETWORK_PRIVATE_KEY from .env and uses the default auction strategy.
          sp1_prover: {type: "env"},
          sp1_programs: {
            update_client: ($elfs + "/sp1-ics07-tendermint-update-client"),
            membership: ($elfs + "/sp1-ics07-tendermint-membership"),
            update_client_and_membership: ($elfs + "/sp1-ics07-tendermint-uc-and-membership"),
            misbehaviour: ($elfs + "/sp1-ics07-tendermint-misbehaviour")}}}}}
    ]}' >"$WORK/proof-api.json"
  nohup "$API_BIN" start --config "$WORK/proof-api.json" >"$WORK/proof-api.log" 2>&1 &
  echo $! >"$WORK/proof-api.pid"
  for _ in $(seq 1 30); do
    lsof -iTCP:"$API_PORT" -sTCP:LISTEN >/dev/null 2>&1 && { echo "proof-api up on :$API_PORT, log $WORK/proof-api.log"; return; }
    kill -0 "$(cat "$WORK/proof-api.pid")" 2>/dev/null || { tail -20 "$WORK/proof-api.log"; fail "proof-api died"; }
    sleep 1
  done
  fail "proof-api didn't listen on :$API_PORT"
}

# Creates the cw-commonware client on gaia and prints its id.
create_gaia_client() {
  local checksum gaia_client
  checksum="$(cat "$GAIA_HOME/wasm-checksum")"
  echo "gaia: creating cw-commonware client for bankd $BANKD_CHAIN_ID (checksum $checksum)" >&2
  gaia_submit "$(relayer gaia-create-client)" >/dev/null
  gaia_client="$(jq -r '.events[] | select(.type=="create_client") | .attributes[] | select(.key=="client_id") | .value' "$WORK/gaia-tx.result.json")"
  [[ -n "$gaia_client" ]] || fail "no client id in create_client event"
  echo "  $gaia_client" >&2
  echo "$gaia_client"
}

cmd_gaia_client() {
  jq -n --arg g "$(create_gaia_client)" '{gaia_client: $g}' >"$WORK/state.json"
  cat "$WORK/state.json"
}

cmd_connect() {
  [[ -n "$SP1_VERIFIER" ]] || fail "SP1_VERIFIER not set (SP1VerifierGroth16 v6.1.0 address on bankd)"
  local res gaia_client
  gaia_client="$(create_gaia_client)"

  echo "bankd: deploying SP1ICS07Tendermint for $GAIA_CHAIN_ID"
  local code lc
  res="$(jq -n --arg s "$GAIA_CHAIN_ID" --arg d "$BANKD_CHAIN_ID" --arg v "$SP1_VERIFIER" \
    '{src_chain: $s, dst_chain: $d, parameters: {sp1_verifier: $v, zk_algorithm: "groth16"}}' | api CreateClient)"
  code="0x$(hexb64 "$(jq -r .tx <<<"$res")")"
  lc="$(cast send --rpc-url "$BANKD_RPC" --private-key "$ADMIN_PK" --json --create "$code" | jq -r .contractAddress)"
  [[ "$lc" != null ]] || fail "SP1ICS07Tendermint deploy failed"
  echo "  $lc"

  # Gaia's commitments live under the "ibc" store with an empty key prefix. The router is bankd's
  # prefix-less store, so gaia gets a single empty prefix.
  echo "bankd: addClient $BANKD_CLIENT_ID -> $gaia_client"
  cast send --rpc-url "$BANKD_RPC" --private-key "$ADMIN_PK" --json "$ROUTER" \
    "addClient(string,(string,bytes[]),address)" "$BANKD_CLIENT_ID" "($gaia_client,[0x696263,0x])" "$lc" \
    | jq -e '.status == "0x1"' >/dev/null || fail "addClient reverted"

  echo "gaia: add-counterparty $gaia_client -> $BANKD_CLIENT_ID"
  res="$(gaiad --home "$GAIA_HOME" tx ibc client add-counterparty "$gaia_client" "$BANKD_CLIENT_ID" "" \
    --from val --keyring-backend test --chain-id "$GAIA_CHAIN_ID" --node "${GAIA_RPC/http/tcp}" \
    --gas 500000 --gas-prices 0.1uatom -y -o json)"
  [[ "$(jq -r .code <<<"$res")" == 0 ]] || fail "add-counterparty: $(jq -r .raw_log <<<"$res")"
  sleep 3

  jq -n --arg g "$gaia_client" --arg b "$BANKD_CLIENT_ID" --arg lc "$lc" \
    '{gaia_client: $g, bankd_client: $b, sp1_ics07: $lc}' >"$WORK/state.json"
  echo "connected: gaia $gaia_client <-> bankd $BANKD_CLIENT_ID (SP1ICS07 $lc)"
}

state() { jq -r ".$1" "$WORK/state.json"; }

# bankd-relayer's gaia commands, which print an unsigned TxBody (base64).
relayer() {
  [[ -x "$RELAYER_BIN" ]] || fail "no bankd-relayer at $RELAYER_BIN (cargo build in relayer/)"
  BANKD_RPC="$BANKD_RPC" BANKD_ROUTER="$ROUTER" BANKD_EPOCH_LENGTH="$BANKD_EPOCH_LENGTH" \
    GAIA_SIGNER="$(gaia_addr)" WASM_CHECKSUM="$(cat "$GAIA_HOME/wasm-checksum")" \
    GAIA_CLIENT_ID="${GAIA_CLIENT_ID:-}" GAIA_CLIENT_HEIGHT="${GAIA_CLIENT_HEIGHT:-}" "$RELAYER_BIN" "$@"
}

cmd_to_gaia() {
  local tx="${1:?bankd tx hash}"
  GAIA_CLIENT_ID="$(state gaia_client)"
  GAIA_CLIENT_HEIGHT="$(gaiad --home "$GAIA_HOME" q ibc client state "$GAIA_CLIENT_ID" --node "${GAIA_RPC/http/tcp}" -o json \
    | jq -r .client_state.latest_height.revision_height)"
  echo "gaia tx $(gaia_submit "$(relayer gaia-relay "$tx")")"
}

cmd_to_bankd() {
  local tx="${1:?gaia tx hash}" res to data h
  # A block's state is only committed by the next header's app hash, so proving right after the
  # tx lands can miss it. Wait until gaia is 2 blocks past it.
  h="$(gaiad --home "$GAIA_HOME" q tx "$tx" --node "${GAIA_RPC/http/tcp}" -o json | jq -r .height)"
  until (( $(curl -s "$GAIA_RPC/status" | jq -r .result.sync_info.latest_block_height) >= h + 2 )); do sleep 1; done
  res="$(jq -n --arg s "$GAIA_CHAIN_ID" --arg d "$BANKD_CHAIN_ID" --arg t "$(b64hex "$tx")" \
    --arg sc "$(state gaia_client)" --arg dc "$(state bankd_client)" \
    '{src_chain: $s, dst_chain: $d, source_tx_ids: [$t], src_client_id: $sc, dst_client_id: $dc}' | api RelayByTx)"
  to="$(jq -r .address <<<"$res")"
  data="0x$(hexb64 "$(jq -r .tx <<<"$res")")"
  cast send --rpc-url "$BANKD_RPC" --private-key "$RELAYER_PK" --json "$to" "$data" \
    | jq -e -r 'if .status == "0x1" then "bankd tx \(.transactionHash)" else error("reverted \(.transactionHash)") end'
}

# Sends an ICS20 transfer from gaia over IBC v2, ABI encoded like the bankd adapter expects.
# gaiad's transfer CLI can't pick the encoding, so this builds the channel/v2 MsgSendPacket itself.
cmd_send_from_gaia() {
  local receiver="${1:?bankd receiver 0x address}" amount="${2:?amount}" denom="${3:?denom (full trace, e.g. transfer/08-wasm-0/ujuno)}"
  local sender value timeout
  sender="$(gaia_addr)"
  value="$(cast abi-encode "f((string,string,string,uint256,string))" "($denom,$sender,$receiver,$amount,\"\")")"
  timeout=$(( $(date +%s) + 3600 ))
  jq -n --arg client "$(state gaia_client)" --arg t "$timeout" --arg v "$(xxd -r -p <<<"${value#0x}" | base64)" --arg s "$sender" '{
    body: {messages: [{"@type": "/ibc.core.channel.v2.MsgSendPacket", source_client: $client, timeout_timestamp: $t,
      payloads: [{source_port: "transfer", destination_port: "transfer", version: "ics20-1",
        encoding: "application/x-solidity-abi", value: $v}], signer: $s}],
      memo: "", timeout_height: "0", extension_options: [], non_critical_extension_options: []},
    auth_info: {signer_infos: [], fee: {amount: [], gas_limit: "0", payer: "", granter: ""}},
    signatures: []}' >"$WORK/send.json"
  echo "gaia tx $(gaia_sign_broadcast "$WORK/send.json")"
}

cmd_down() {
  [[ -f "$WORK/proof-api.pid" ]] && kill "$(cat "$WORK/proof-api.pid")" 2>/dev/null || true
  rm -rf "$WORK"
  echo "proof-api stopped, $WORK removed"
}

# Restarts proof-api only, keeping the connection state.
cmd_restart_api() {
  [[ -f "$WORK/proof-api.pid" ]] && kill "$(cat "$WORK/proof-api.pid")" 2>/dev/null || true
  sleep 1
  cmd_api
}

case "${1:-}" in
  api) cmd_api ;;
  restart-api) cmd_restart_api ;;
  gaia-client) cmd_gaia_client ;;
  connect) cmd_connect ;;
  to-gaia) cmd_to_gaia "${2:-}" ;;
  to-bankd) cmd_to_bankd "${2:-}" ;;
  send-from-gaia) cmd_send_from_gaia "${2:-}" "${3:-}" "${4:-}" ;;
  down) cmd_down ;;
  *) echo "usage: $0 api|restart-api|connect|to-gaia <tx>|to-bankd <tx>|send-from-gaia <to> <amt> <denom>|down" >&2; exit 1 ;;
esac
