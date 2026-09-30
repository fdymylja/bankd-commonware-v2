# Browser SDK bundles

The admin and mobile WASM packages are built from tracked Shieldd Web source.
Each archive contains `build-provenance.json` with the source and Shieldd pins;
the WASM packages also record the binary and Cargo lock hashes.

The browser SDK source is `mizufinance/shieldd-web`. Compile its pinned Rust
crate with the Bankd WASM workflow, then generate and build the protobuf package
and WASM TypeScript package at the recorded source revision. Package with:

```sh
python3 scripts/package-browser-sdk.py /path/to/shieldd-web /path/to/bankd-wasm-artifact
```

The script verifies the source, Shieldd pin, native module, lock file, and existing
native exports before writing the admin, mobile, and protobuf archives.
