//! bankd: IBC contracts predeployed at genesis. AccessManager, ICS26Router (UUPS proxy +
//! implementation) and the ICS20 native adapter, built by `forge build` in `contracts/`.
//!
//! The constructors and setup calls run for real in a throwaway genesis EVM, and the resulting
//! code + storage goes into the alloc. That keeps immutables (`ROUTER`, UUPS `__self`), the
//! ERC-1967 slots and initializer state exactly what a normal deploy would produce.

use alloy::{
    genesis::GenesisAccount,
    primitives::{Address, B256, Bytes, U256, address, hex, keccak256},
    sol,
    sol_types::{SolCall, SolValue},
};
use eyre::{WrapErr as _, eyre};
use reth_evm::{
    Evm as _, EvmEnv, EvmFactory as _,
    revm::{
        DatabaseCommit as _,
        database::{CacheDB, EmptyDB},
        state::{AccountInfo, Bytecode},
    },
};
use std::{collections::BTreeMap, path::Path};
use tempo_evm::evm::{TempoEvm, TempoEvmFactory};

/// Keyless deployer that CREATEs whatever calldata it gets and returns the new address. It only
/// lives in the throwaway EVM, so the predeploy addresses depend on nothing but its address and
/// nonce, not on the owner, mode or bytecode.
const IBC_DEPLOYER: Address = address!("0x0000000000000000000000000000000049424344"); // "IBCD"

/// calldatacopy(0, 0, cds); a := create(0, 0, cds); if a == 0 revert(returndata); return a
const DEPLOYER_CODE: [u8; 27] = hex!("365f5f37365f5ff080156013575f5260205ff35b3d5f5f3e3d5ffd");

/// `IBC_DEPLOYER.create(1)`
pub(crate) const ACCESS_MANAGER: Address = address!("0xF0A69d75d5903afF51d51BBf3b0752B6aBfcEC33");
/// `IBC_DEPLOYER.create(2)`
pub(crate) const ROUTER_IMPL: Address = address!("0xD8517Af4f4767F16DF0916966B259BE075711A28");
/// `IBC_DEPLOYER.create(3)`, the ERC1967Proxy everything talks to.
pub(crate) const ROUTER: Address = address!("0x4be2f106a550b243B60Fa279228f4e94b1EF8AeC");
/// `IBC_DEPLOYER.create(4)`
pub(crate) const ADAPTER: Address = address!("0xBA01319fA1739A1D69aBae52B64105C74764CA4c");

/// IBCRolesLib.RELAYER_ROLE
const RELAYER_ROLE: u64 = 1;
/// IBCRolesLib.ics26RelayerSelectors(): recvPacket, timeoutPacket, ackPacket, updateClient.
const RELAYER_SELECTORS: [[u8; 4]; 4] = [
    hex!("5ebd10ca"),
    hex!("b98c330a"),
    hex!("1bca011a"),
    hex!("6fbf8079"),
];

sol! {
    function initialize(address authority);
    function addIBCApp(string portId, address app);
    function setTargetFunctionRole(address target, bytes4[] selectors, uint64 roleId);
    function grantRole(uint64 roleId, address account, uint32 executionDelay);
    function setTrustedClient(string clientId, bool trusted);
    function setLegacyDenom(string denom, bool allowed);
}

/// ICS20NativeAdapter storage slot of `escrowed`.
const ESCROWED_SLOT: u64 = 1;

/// ICS20NativeAdapter.Mode
#[derive(Clone, Copy, Debug, PartialEq, Eq, clap::ValueEnum)]
pub(crate) enum IbcMode {
    /// Central bank: escrows native BRL on send, releases on receive.
    Hub,
    /// Commercial bank: burns on send, mints through the Native precompile on receive.
    Spoke,
}

pub(crate) struct PredeployInput<'a> {
    /// forge `out/` directory of `contracts/`.
    pub(crate) artifacts: &'a Path,
    pub(crate) mode: IbcMode,
    /// Authority owner. Becomes AccessManager admin and adapter owner.
    pub(crate) owner: Address,
    /// Granted RELAYER_ROLE on the router.
    pub(crate) relayers: &'a [Address],
    /// Spoke only: local client ids trusted as the hub route.
    pub(crate) hub_clients: &'a [String],
    /// Hub only: legacy denom traces treated as native ujuno coming home.
    pub(crate) legacy_denoms: &'a [String],
    /// Hub only: (client id, wei) escrow seeded in the adapter, which is funded with the same wei.
    pub(crate) seed_escrow: &'a [(String, U256)],
}

/// Deploys and configures the IBC contracts in a fresh EVM and returns their genesis accounts.
/// Own EVM because system calls finalize the journal, which would drop the precompile state the
/// main genesis EVM keeps there.
pub(crate) fn predeploy(
    input: PredeployInput<'_>,
    chain_id: u64,
) -> eyre::Result<BTreeMap<Address, GenesisAccount>> {
    if !input.hub_clients.is_empty() && input.mode != IbcMode::Spoke {
        eyre::bail!("--ibc-hub-clients only applies to --ibc-mode spoke");
    }
    // Generated ids (client-N) come from the permissionless addClient, so anyone could register
    // the light client behind a pre-trusted one. Custom ids can only be added by the admin.
    for id in input.hub_clients {
        eyre::ensure!(
            is_custom_client_id(id),
            "--ibc-hub-clients {id:?}: use a custom id (4-128 of [a-zA-Z0-9._+-#[]<>], not \
             client-/channel-), generated ids can be taken by anyone"
        );
    }
    if input.mode != IbcMode::Hub
        && !(input.legacy_denoms.is_empty() && input.seed_escrow.is_empty())
    {
        eyre::bail!("--ibc-legacy-denoms and --ibc-seed-escrow only apply to --ibc-mode hub");
    }
    let owner = input.owner;

    // AccessManager stores role grants as `since = block.timestamp` and treats since == 0 as "no
    // role", so grants made at timestamp 0 would never count. 1 is still before every real block.
    let mut env = EvmEnv::default().with_timestamp(U256::from(1));
    env.cfg_env.chain_id = chain_id;
    let evm = &mut TempoEvmFactory::default().create_evm(CacheDB::default(), env);

    evm.db_mut().insert_account_info(
        IBC_DEPLOYER,
        AccountInfo {
            code: Some(Bytecode::new_raw(Bytes::from_static(&DEPLOYER_CODE))),
            nonce: 1,
            ..Default::default()
        },
    );

    let init = |name: &str, args: Vec<u8>| -> eyre::Result<Bytes> {
        let mut code = creation_code(input.artifacts, name)?;
        code.extend_from_slice(&args);
        Ok(code.into())
    };

    deploy(
        evm,
        ACCESS_MANAGER,
        init("AccessManager", owner.abi_encode())?,
    )?;
    deploy(evm, ROUTER_IMPL, init("ICS26Router", vec![])?)?;
    let proxy_args = (
        ROUTER_IMPL,
        Bytes::from(
            initializeCall {
                authority: ACCESS_MANAGER,
            }
            .abi_encode(),
        ),
    );
    deploy(
        evm,
        ROUTER,
        init("ERC1967Proxy", proxy_args.abi_encode_params())?,
    )?;
    let mode = match input.mode {
        IbcMode::Hub => U256::ZERO,
        IbcMode::Spoke => U256::from(1),
    };
    deploy(
        evm,
        ADAPTER,
        init(
            "ICS20NativeAdapter",
            (ROUTER, mode, owner).abi_encode_params(),
        )?,
    )?;

    // Same setup the post-genesis deploy did, sent as the owner.
    call(
        evm,
        owner,
        ROUTER,
        addIBCAppCall {
            portId: "transfer".into(),
            app: ADAPTER,
        }
        .abi_encode(),
    )?;
    call(
        evm,
        owner,
        ACCESS_MANAGER,
        setTargetFunctionRoleCall {
            target: ROUTER,
            selectors: RELAYER_SELECTORS.iter().map(|s| (*s).into()).collect(),
            roleId: RELAYER_ROLE,
        }
        .abi_encode(),
    )?;
    for &relayer in input.relayers {
        call(
            evm,
            owner,
            ACCESS_MANAGER,
            grantRoleCall {
                roleId: RELAYER_ROLE,
                account: relayer,
                executionDelay: 0,
            }
            .abi_encode(),
        )?;
    }
    for client in input.hub_clients {
        call(
            evm,
            owner,
            ADAPTER,
            setTrustedClientCall {
                clientId: client.clone(),
                trusted: true,
            }
            .abi_encode(),
        )?;
    }
    for denom in input.legacy_denoms {
        call(
            evm,
            owner,
            ADAPTER,
            setLegacyDenomCall {
                denom: denom.clone(),
                allowed: true,
            }
            .abi_encode(),
        )?;
    }
    // Stands in for what the old chain had outstanding. Balance and mapping must move together.
    let mut seeded = U256::ZERO;
    for (client, wei) in input.seed_escrow {
        let slot = keccak256(
            [
                client.as_bytes(),
                &U256::from(ESCROWED_SLOT).to_be_bytes::<32>(),
            ]
            .concat(),
        );
        evm.db_mut()
            .insert_account_storage(ADAPTER, slot.into(), *wei)?;
        seeded += wei;
    }
    if !seeded.is_zero() {
        let mut info = evm.db_mut().cache.accounts[&ADAPTER].info.clone();
        info.balance = seeded;
        evm.db_mut().insert_account_info(ADAPTER, info);
    }

    let db = evm.db_mut();
    [ACCESS_MANAGER, ROUTER_IMPL, ROUTER, ADAPTER]
        .into_iter()
        .map(|addr| {
            let acc = db
                .cache
                .accounts
                .get(&addr)
                .ok_or_else(|| eyre!("{addr} missing after deploy"))?;
            let storage: BTreeMap<B256, B256> = acc
                .storage
                .iter()
                .filter(|(_, v)| !v.is_zero())
                .map(|(k, v)| (B256::from(*k), B256::from(*v)))
                .collect();
            Ok((
                addr,
                GenesisAccount {
                    nonce: Some(acc.info.nonce),
                    balance: acc.info.balance,
                    code: acc.info.code.as_ref().map(|c| c.original_bytes()),
                    storage: (!storage.is_empty()).then_some(storage),
                    ..Default::default()
                },
            ))
        })
        .collect()
}

/// Mirrors IBCIdentifiers.validateCustomIBCIdentifier, so a trusted id can actually be registered
/// later through the admin-only addClient overload.
fn is_custom_client_id(id: &str) -> bool {
    (4..=128).contains(&id.len())
        && !id.starts_with("client-")
        && !id.starts_with("channel-")
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"._+-#[]<>".contains(&c))
}

/// Reads `bytecode.object` from forge's `<out>/<name>.sol/<name>.json`.
fn creation_code(out: &Path, name: &str) -> eyre::Result<Vec<u8>> {
    let path = out.join(format!("{name}.sol/{name}.json"));
    let json: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).wrap_err_with(|| {
            format!("read {} (run `forge build` in contracts/)", path.display())
        })?)
        .wrap_err_with(|| format!("parse {}", path.display()))?;
    let obj = json["bytecode"]["object"]
        .as_str()
        .ok_or_else(|| eyre!("{}: no bytecode.object", path.display()))?;
    let code = hex::decode(obj).wrap_err_with(|| format!("{}: bad bytecode", path.display()))?;
    eyre::ensure!(!code.is_empty(), "{}: empty bytecode", path.display());
    Ok(code)
}

fn deploy(
    evm: &mut TempoEvm<CacheDB<EmptyDB>>,
    expected: Address,
    initcode: Bytes,
) -> eyre::Result<()> {
    let out = call(evm, Address::ZERO, IBC_DEPLOYER, initcode.into())
        .wrap_err_with(|| format!("deploy {expected}"))?;
    let got = Address::abi_decode(&out)?;
    eyre::ensure!(got == expected, "deployed at {got}, expected {expected}");
    Ok(())
}

fn call(
    evm: &mut TempoEvm<CacheDB<EmptyDB>>,
    caller: Address,
    to: Address,
    data: Vec<u8>,
) -> eyre::Result<Bytes> {
    let res = evm.transact_system_call(caller, to, data.into())?;
    eyre::ensure!(
        res.result.is_success(),
        "call to {to} failed: {:?}",
        res.result
    );
    let out = res.result.output().cloned().unwrap_or_default();
    evm.db_mut().commit(res.state);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::primitives::{b256, keccak256};

    sol! {
        struct CounterpartyInfo { string clientId; bytes[] merklePrefix; }
        function owner() returns (address);
        function MODE() returns (uint8);
        function trustedClients(string clientId) returns (bool);
        function legacyDenoms(bytes32 traceHash) returns (bool);
        function escrowed(string clientId) returns (uint256);
        function getIBCApp(string portId) returns (address);
        function authority() returns (address);
        function hasRole(uint64 roleId, address account) returns (bool isMember, uint32 executionDelay);
        function getTargetFunctionRole(address target, bytes4 selector) returns (uint64);
        function addClient(string clientId, CounterpartyInfo counterpartyInfo, address client);
    }

    const OWNER: Address = address!("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const RELAYER: Address = address!("0x70997970C51812dc3A010C7d01b50e0d17dC79C8");
    const STRANGER: Address = address!("0x000000000000000000000000000000000000dEaD");
    /// ERC-1967 implementation slot.
    const IMPL_SLOT: B256 =
        b256!("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");

    /// forge output of contracts/, or None when it hasn't been built.
    fn artifacts() -> Option<std::path::PathBuf> {
        let out = Path::new(env!("CARGO_MANIFEST_DIR")).join("../contracts/out");
        if out.join("ICS26Router.sol/ICS26Router.json").exists() {
            Some(out)
        } else {
            eprintln!(
                "skipping: no {} (run `forge build` in contracts/)",
                out.display()
            );
            None
        }
    }

    fn input<'a>(
        artifacts: &'a Path,
        mode: IbcMode,
        relayers: &'a [Address],
        hub_clients: &'a [String],
    ) -> PredeployInput<'a> {
        PredeployInput {
            artifacts,
            mode,
            owner: OWNER,
            relayers,
            hub_clients,
            legacy_denoms: &[],
            seed_escrow: &[],
        }
    }

    /// Fresh EVM holding only the predeployed accounts, like the chain right after genesis.
    fn chain(alloc: &BTreeMap<Address, GenesisAccount>) -> TempoEvm<CacheDB<EmptyDB>> {
        let env = EvmEnv::default().with_timestamp(U256::from(2));
        let mut evm = TempoEvmFactory::default().create_evm(CacheDB::default(), env);
        for (addr, acc) in alloc {
            let code = acc.code.clone().expect("predeploy has code");
            evm.db_mut().insert_account_info(
                *addr,
                AccountInfo {
                    nonce: acc.nonce.unwrap_or_default(),
                    code_hash: keccak256(&code),
                    code: Some(Bytecode::new_raw(code)),
                    ..Default::default()
                },
            );
            for (k, v) in acc.storage.iter().flatten() {
                evm.db_mut()
                    .insert_account_storage(*addr, (*k).into(), (*v).into())
                    .unwrap();
            }
        }
        evm
    }

    fn view<C: SolCall>(evm: &mut TempoEvm<CacheDB<EmptyDB>>, to: Address, c: C) -> C::Return {
        let out = call(evm, STRANGER, to, c.abi_encode()).unwrap();
        C::abi_decode_returns(&out).unwrap()
    }

    fn reverts(
        evm: &mut TempoEvm<CacheDB<EmptyDB>>,
        from: Address,
        to: Address,
        data: Vec<u8>,
    ) -> bool {
        !evm.transact_system_call(from, to, data.into())
            .unwrap()
            .result
            .is_success()
    }

    #[test]
    fn predeploy_addresses_match_deployer_nonces() {
        assert_eq!(IBC_DEPLOYER.create(1), ACCESS_MANAGER);
        assert_eq!(IBC_DEPLOYER.create(2), ROUTER_IMPL);
        assert_eq!(IBC_DEPLOYER.create(3), ROUTER);
        assert_eq!(IBC_DEPLOYER.create(4), ADAPTER);
    }

    #[test]
    fn custom_client_ids() {
        for ok in ["bankd-hub", "spoke-9002", "abcd", "a.b_c+d#[x]<y>"] {
            assert!(is_custom_client_id(ok), "{ok}");
        }
        let long = "a".repeat(129);
        for bad in [
            "client-0",
            "channel-1",
            "abc",
            "has space",
            "bankd/hub",
            long.as_str(),
        ] {
            assert!(!is_custom_client_id(bad), "{bad}");
        }
    }

    #[test]
    fn rejects_bad_hub_clients_before_reading_artifacts() {
        let missing = Path::new("/nonexistent");
        let generated = ["client-0".to_string()];
        let err = predeploy(input(missing, IbcMode::Spoke, &[], &generated), 1).unwrap_err();
        assert!(err.to_string().contains("custom id"), "{err}");
        let custom = ["bankd-hub".to_string()];
        let err = predeploy(input(missing, IbcMode::Hub, &[], &custom), 1).unwrap_err();
        assert!(err.to_string().contains("spoke"), "{err}");
    }

    #[test]
    fn spoke_predeploy_is_wired_up() {
        let Some(out) = artifacts() else { return };
        let hub_clients = ["bankd-hub".to_string()];
        let alloc = predeploy(input(&out, IbcMode::Spoke, &[RELAYER], &hub_clients), 9002).unwrap();
        assert_eq!(alloc.keys().copied().collect::<Vec<_>>(), {
            let mut v = vec![ACCESS_MANAGER, ROUTER_IMPL, ROUTER, ADAPTER];
            v.sort();
            v
        });
        assert_eq!(
            alloc[&ROUTER].storage.as_ref().unwrap()[&IMPL_SLOT],
            ROUTER_IMPL.into_word()
        );

        let evm = &mut chain(&alloc);
        assert_eq!(view(evm, ADAPTER, ownerCall {}), OWNER);
        assert_eq!(view(evm, ADAPTER, MODECall {}), 1);
        assert!(view(
            evm,
            ADAPTER,
            trustedClientsCall {
                clientId: "bankd-hub".into()
            }
        ));
        assert!(!view(
            evm,
            ADAPTER,
            trustedClientsCall {
                clientId: "client-0".into()
            }
        ));
        assert_eq!(
            view(
                evm,
                ROUTER,
                getIBCAppCall {
                    portId: "transfer".into()
                }
            ),
            ADAPTER
        );
        assert_eq!(view(evm, ROUTER, authorityCall {}), ACCESS_MANAGER);
        assert!(
            view(
                evm,
                ACCESS_MANAGER,
                hasRoleCall {
                    roleId: 0,
                    account: OWNER
                }
            )
            .isMember
        );
        assert!(
            view(
                evm,
                ACCESS_MANAGER,
                hasRoleCall {
                    roleId: RELAYER_ROLE,
                    account: RELAYER
                }
            )
            .isMember
        );
        assert!(
            !view(
                evm,
                ACCESS_MANAGER,
                hasRoleCall {
                    roleId: 0,
                    account: RELAYER
                }
            )
            .isMember
        );
        for sel in RELAYER_SELECTORS {
            let role = view(
                evm,
                ACCESS_MANAGER,
                getTargetFunctionRoleCall {
                    target: ROUTER,
                    selector: sel.into(),
                },
            );
            assert_eq!(role, RELAYER_ROLE);
        }

        // Proxy and implementation are both initialized, so neither can be re-initialized.
        let reinit = initializeCall {
            authority: STRANGER,
        }
        .abi_encode();
        assert!(reverts(evm, STRANGER, ROUTER, reinit.clone()));
        assert!(reverts(evm, STRANGER, ROUTER_IMPL, reinit));

        // Only the admin can register a custom client id, so nobody can squat the trusted one.
        let add = addClientCall {
            clientId: "bankd-hub".into(),
            counterpartyInfo: CounterpartyInfo {
                clientId: "spoke-9002".into(),
                merklePrefix: vec![Bytes::new()],
            },
            client: STRANGER,
        }
        .abi_encode();
        assert!(reverts(evm, STRANGER, ROUTER, add.clone()));
        assert!(reverts(evm, RELAYER, ROUTER, add.clone()));
        let set_trusted = setTrustedClientCall {
            clientId: "evil-hub".into(),
            trusted: true,
        }
        .abi_encode();
        assert!(reverts(evm, STRANGER, ADAPTER, set_trusted));
        call(evm, OWNER, ROUTER, add).unwrap();
    }

    #[test]
    fn hub_seeds_escrow_and_legacy_alias() {
        let Some(out) = artifacts() else { return };
        let denoms = ["transfer/channel-0/ujuno".to_string()];
        let seed = [(
            "localgaia-mig-1".to_string(),
            U256::from(10).pow(U256::from(18)),
        )];
        let alloc = predeploy(
            PredeployInput {
                legacy_denoms: &denoms,
                seed_escrow: &seed,
                ..input(&out, IbcMode::Hub, &[], &[])
            },
            9001,
        )
        .unwrap();
        assert_eq!(alloc[&ADAPTER].balance, seed[0].1);
        let evm = &mut chain(&alloc);
        assert_eq!(
            view(
                evm,
                ADAPTER,
                escrowedCall {
                    clientId: seed[0].0.clone()
                }
            ),
            seed[0].1
        );
        assert_eq!(
            view(
                evm,
                ADAPTER,
                escrowedCall {
                    clientId: "other-client".into()
                }
            ),
            U256::ZERO
        );
        assert!(view(
            evm,
            ADAPTER,
            legacyDenomsCall {
                traceHash: keccak256(denoms[0].as_bytes())
            }
        ));
        assert!(!view(
            evm,
            ADAPTER,
            legacyDenomsCall {
                traceHash: keccak256("transfer/channel-1/ujuno")
            }
        ));
    }

    #[test]
    fn spoke_rejects_hub_only_seeding() {
        let denoms = ["transfer/channel-0/ujuno".to_string()];
        let err = predeploy(
            PredeployInput {
                legacy_denoms: &denoms,
                ..input(Path::new("/nonexistent"), IbcMode::Spoke, &[], &[])
            },
            1,
        )
        .unwrap_err();
        assert!(err.to_string().contains("hub"), "{err}");
    }

    #[test]
    fn predeploy_addresses_are_independent_of_mode_and_owner() {
        let Some(out) = artifacts() else { return };
        let hub = predeploy(input(&out, IbcMode::Hub, &[], &[]), 9001).unwrap();
        let evm = &mut chain(&hub);
        assert_eq!(view(evm, ADAPTER, MODECall {}), 0);
        assert!(
            !view(
                evm,
                ACCESS_MANAGER,
                hasRoleCall {
                    roleId: RELAYER_ROLE,
                    account: RELAYER
                }
            )
            .isMember
        );
        let other = predeploy(
            PredeployInput {
                owner: RELAYER,
                ..input(&out, IbcMode::Spoke, &[], &[])
            },
            9002,
        )
        .unwrap();
        assert_eq!(
            hub.keys().collect::<Vec<_>>(),
            other.keys().collect::<Vec<_>>()
        );
        assert_eq!(view(&mut chain(&other), ADAPTER, ownerCall {}), RELAYER);
    }
}
