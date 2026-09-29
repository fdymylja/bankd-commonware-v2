#!/usr/bin/env bash
# Builds the counter into artifacts/cw_counter.wasm. See light-clients/cw-commonware/build.sh for why wasm-opt.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
RUSTFLAGS="-C link-arg=-s" cargo build --release --lib --target wasm32-unknown-unknown
mkdir -p artifacts
wasm-opt -Os --mvp-features --enable-sign-ext --enable-mutable-globals \
  target/wasm32-unknown-unknown/release/cw_counter.wasm -o artifacts/cw_counter.wasm
shasum -a 256 artifacts/cw_counter.wasm
