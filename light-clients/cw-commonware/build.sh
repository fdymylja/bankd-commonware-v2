#!/usr/bin/env bash
# Builds the 08-wasm client into artifacts/cw_commonware.wasm.
#
# rustc (1.86, see rust-toolchain.toml) emits the reference-types call_indirect encoding, which
# wasmvm 2.x refuses. wasm-opt re-encodes to the MVP features, same as the cosmwasm optimizer.
# Needs wasm-opt (brew install binaryen).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
RUSTFLAGS="-C link-arg=-s" cargo build --release --lib --locked --target wasm32-unknown-unknown
mkdir -p artifacts
wasm-opt -Os --mvp-features --enable-sign-ext --enable-mutable-globals \
  target/wasm32-unknown-unknown/release/cw_commonware.wasm -o artifacts/cw_commonware.wasm
shasum -a 256 artifacts/cw_commonware.wasm
