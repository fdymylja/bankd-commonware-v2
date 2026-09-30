#!/usr/bin/env bash
# Development browser prover using the same artifacts as the embedded Shieldd node.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$ROOT/target/bankd-admin"
(cd "$ROOT/shieldd/tools/gnark" && GOMAXPROCS=2 go build -p 2 -o "$ROOT/target/bankd-admin/proverdaemon" ./cmd/proverdaemon)
(cd "$ROOT" && GOMAXPROCS=2 go build -p 2 -o "$ROOT/target/bankd-admin/proverhttp" scripts/proverhttp/main.go)
exec env GOMAXPROCS=2 "$ROOT/target/bankd-admin/proverhttp" --daemon "$ROOT/target/bankd-admin/proverdaemon" --artifact-dir "$ROOT/shieldd/tools/gnark/artifacts" --addr "${BANKD_PROVER_ADDR:-127.0.0.1:8090}" "$@"
