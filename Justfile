[group('deps')]
[doc('Bump all reth dependencies to a specific commit hash')]
bump-reth commit:
    sed -i '' 's/\(reth[a-z_-]* = { git = "https:\/\/github.com\/paradigmxyz\/reth", rev = "\)[a-f0-9]*"/\1{{commit}}"/g' Cargo.toml
    cargo update

mod scripts

[group('dev')]
tempo-dev-up: scripts::tempo-dev-up
tempo-dev-down: scripts::tempo-dev-down

[group('bankd')]
[doc('Start a native multi-validator bankd localnet (defaults: chain 9001, rpc 8545, 4 validators)')]
bankd-localnet-up chain_id="9001" rpc_port="8545" consensus_port="9000" validators="4" epoch_length="600":
    cargo build --bin tempo --bin tempo-xtask
    ./scripts/bankd/localnet.sh up {{chain_id}} {{rpc_port}} {{consensus_port}} {{validators}} {{epoch_length}}

[group('bankd')]
[doc('Stop a bankd localnet and delete its data')]
bankd-localnet-down chain_id="9001":
    ./scripts/bankd/localnet.sh down {{chain_id}}

[group('bankd')]
[doc('Smoke test a running bankd localnet')]
bankd-smoke rpc_port="8545" chain_id="9001":
    ./scripts/bankd/smoke.sh {{rpc_port}} {{chain_id}}

[group('specs')]
[doc('Build tempo-std interfaces and compare them against Rust sol! ABIs')]
check-abi tempo_std="":
    @if [ -n "{{tempo_std}}" ]; then cd "{{tempo_std}}" && forge build --sizes 2>&1 | tail -1; else cd tips/verify/lib/tempo-std && forge build --sizes 2>&1 | tail -1; fi
    @cargo run -q -p tempo-xtask -- check-abi {{ if tempo_std != "" { "--tempo-std " + tempo_std } else { "" } }}
