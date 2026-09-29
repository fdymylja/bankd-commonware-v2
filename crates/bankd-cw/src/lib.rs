//! CosmWasm runtime for bankd. See docs/PLAN-cosmwasm.md.
//!
//! Thin wrapper over `cosmwasm-vm`. The host (the `cw` precompile) supplies `Storage` and
//! `Querier`, this crate supplies the `Api`, wasm validation and the entry point calls.

pub use cosmwasm_std;
use cosmwasm_std::{
    Addr, Binary, BlockInfo, Coin, ContractInfo, ContractResult, Env, Event, MessageInfo, Response,
    Timestamp,
};
use cosmwasm_vm::{
    Backend, BackendApi, Instance, InstanceOptions, Size, WasmLimits, call_execute,
    call_instantiate, call_query, capabilities_from_csv,
    internals::{Logger, check_wasm},
};
pub use cosmwasm_vm::{BackendError, BackendResult, GasInfo, Querier, Storage};

/// Wasm gas per EVM gas. Not benchmarked, the counter costs ~15M wasm gas per call.
pub const WASM_GAS_PER_EVM_GAS: u64 = 200;
/// Max wasm memory for an instance.
const MEMORY_LIMIT_MIB: usize = 16;
/// Host features the chain offers. All pure std features, nothing needs extra host support.
const CAPABILITIES: &str =
    "cosmwasm_1_1,cosmwasm_1_2,cosmwasm_1_3,cosmwasm_1_4,cosmwasm_2_0,cosmwasm_2_1,cosmwasm_2_2";

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("vm: {0}")]
    Vm(String),
    #[error("contract: {0}")]
    Contract(String),
    #[error("out of gas")]
    OutOfGas,
    #[error("unsupported: {0}")]
    Unsupported(&'static str),
}

impl From<cosmwasm_vm::VmError> for Error {
    fn from(e: cosmwasm_vm::VmError) -> Self {
        match e {
            cosmwasm_vm::VmError::GasDepletion { .. } => Error::OutOfGas,
            e => Error::Vm(e.to_string()),
        }
    }
}

/// Canonical addresses are 32 bytes (12 zero bytes + the 20 byte EVM address). Human form is
/// lowercase `0x` hex.
#[derive(Clone, Copy, Default)]
pub struct HexApi;

const PAD: usize = 12;

fn parse_hex_addr(human: &str) -> Result<[u8; 20], BackendError> {
    let hex = human
        .strip_prefix("0x")
        .ok_or_else(|| BackendError::user_err("address must start with 0x"))?;
    if hex.len() != 40 {
        return Err(BackendError::user_err("address must be 20 bytes"));
    }
    let mut out = [0u8; 20];
    for (i, b) in out.iter_mut().enumerate() {
        *b = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16)
            .map_err(|_| BackendError::user_err("address is not hex"))?;
    }
    Ok(out)
}

/// Lowercase `0x` hex, the only form [`HexApi`] accepts.
pub fn human_addr(addr: &[u8; 20]) -> String {
    let mut s = String::with_capacity(42);
    s.push_str("0x");
    for b in addr {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// Parses a human address the way [`HexApi`] does.
pub fn parse_addr(human: &str) -> Option<[u8; 20]> {
    parse_hex_addr(human).ok()
}

impl BackendApi for HexApi {
    fn addr_validate(&self, input: &str) -> BackendResult<()> {
        let r = parse_hex_addr(input).and_then(|a| {
            // only canonical (lowercase) text validates, so humanize(canonicalize(x)) == x
            if human_addr(&a) == input {
                Ok(())
            } else {
                Err(BackendError::user_err("address must be lowercase"))
            }
        });
        (r, GasInfo::free())
    }

    fn addr_canonicalize(&self, human: &str) -> BackendResult<Vec<u8>> {
        let r = parse_hex_addr(human).map(|a| {
            let mut out = vec![0u8; PAD];
            out.extend_from_slice(&a);
            out
        });
        (r, GasInfo::free())
    }

    fn addr_humanize(&self, canonical: &[u8]) -> BackendResult<String> {
        let r = match canonical.len() == 32 && canonical[..PAD].iter().all(|b| *b == 0) {
            true => {
                let mut a = [0u8; 20];
                a.copy_from_slice(&canonical[PAD..]);
                Ok(human_addr(&a))
            }
            false => Err(BackendError::user_err("bad canonical address")),
        };
        (r, GasInfo::free())
    }
}

/// Rejects wasm that isn't a valid, deterministic CosmWasm contract.
pub fn validate(code: &[u8]) -> Result<(), Error> {
    let caps = capabilities_from_csv(CAPABILITIES);
    check_wasm(code, &caps, &WasmLimits::default(), Logger::Off)?;
    Ok(())
}

/// Block and contract context for an entry point call.
pub struct Ctx {
    pub chain_id: String,
    pub height: u64,
    pub time_nanos: u64,
    pub contract: [u8; 20],
    pub sender: [u8; 20],
}

impl Ctx {
    fn env(&self) -> Env {
        Env {
            block: BlockInfo {
                height: self.height,
                time: Timestamp::from_nanos(self.time_nanos),
                chain_id: self.chain_id.clone(),
            },
            transaction: None,
            contract: ContractInfo {
                address: Addr::unchecked(human_addr(&self.contract)),
            },
        }
    }

    fn info(&self) -> MessageInfo {
        MessageInfo {
            sender: Addr::unchecked(human_addr(&self.sender)),
            funds: Vec::<Coin>::new(),
        }
    }
}

/// What an entry point call produced.
pub struct Executed {
    pub data: Option<Binary>,
    /// The response attributes as a `wasm` event first, then the custom events.
    pub events: Vec<Event>,
    /// Wasm gas burned.
    pub gas_used: u64,
}

#[derive(Clone, Copy)]
pub enum Entry {
    Instantiate,
    Execute,
}

fn instance<S: Storage + 'static, Q: Querier + 'static>(
    code: &[u8],
    storage: S,
    querier: Q,
    gas_limit: u64,
) -> Result<Instance<HexApi, S, Q>, Error> {
    let backend = Backend {
        api: HexApi,
        storage,
        querier,
    };
    Ok(Instance::from_code(
        code,
        backend,
        InstanceOptions { gas_limit },
        Some(Size::mebi(MEMORY_LIMIT_MIB)),
    )?)
}

/// Runs `instantiate` or `execute`. Storage writes go straight to `storage`, the caller's
/// journal is what makes a failure roll back.
pub fn call<S: Storage + 'static, Q: Querier + 'static>(
    entry: Entry,
    code: &[u8],
    storage: S,
    querier: Q,
    ctx: &Ctx,
    msg: &[u8],
    gas_limit: u64,
) -> Result<Executed, Error> {
    let mut inst = instance(code, storage, querier, gas_limit)?;
    let (env, info) = (ctx.env(), ctx.info());
    let res: ContractResult<Response> = match entry {
        Entry::Instantiate => call_instantiate(&mut inst, &env, &info, msg)?,
        Entry::Execute => call_execute(&mut inst, &env, &info, msg)?,
    };
    let gas_used = gas_limit.saturating_sub(inst.get_gas_left());
    let resp = match res {
        ContractResult::Ok(r) => r,
        ContractResult::Err(e) => return Err(Error::Contract(e)),
    };
    if !resp.messages.is_empty() {
        return Err(Error::Unsupported("submessages"));
    }
    let mut events = vec![Event::new("wasm").add_attributes(resp.attributes)];
    events.extend(resp.events);
    Ok(Executed {
        data: resp.data,
        events,
        gas_used,
    })
}

/// Runs `query`. Returns the raw response bytes and the wasm gas burned.
pub fn query<S: Storage + 'static, Q: Querier + 'static>(
    code: &[u8],
    storage: S,
    querier: Q,
    ctx: &Ctx,
    msg: &[u8],
    gas_limit: u64,
) -> Result<(Binary, u64), Error> {
    let mut inst = instance(code, storage, querier, gas_limit)?;
    let res: ContractResult<Binary> = call_query(&mut inst, &ctx.env(), msg)?;
    let gas_used = gas_limit.saturating_sub(inst.get_gas_left());
    match res {
        ContractResult::Ok(b) => Ok((b, gas_used)),
        ContractResult::Err(e) => Err(Error::Contract(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{ContractResult as CR, SystemResult, Uint64, from_json};
    use cosmwasm_vm::testing::MockStorage;
    use std::{cell::RefCell, rc::Rc};

    const WASM: &[u8] = include_bytes!("../../../cw-contracts/counter/artifacts/cw_counter.wasm");
    const GAS: u64 = 100_000_000_000;

    #[derive(Clone, Default)]
    struct Shared(Rc<RefCell<MockStorage>>);
    // Instance needs Send only via the backend api, storage just needs 'static.
    impl Storage for Shared {
        fn get(&self, key: &[u8]) -> BackendResult<Option<Vec<u8>>> {
            self.0.borrow().get(key)
        }
        fn set(&mut self, key: &[u8], value: &[u8]) -> BackendResult<()> {
            self.0.borrow_mut().set(key, value)
        }
        fn remove(&mut self, key: &[u8]) -> BackendResult<()> {
            self.0.borrow_mut().remove(key)
        }
    }

    struct NoQuery;
    impl Querier for NoQuery {
        fn query_raw(&self, _: &[u8], _: u64) -> BackendResult<SystemResult<CR<Binary>>> {
            (Err(BackendError::unknown("no queries")), GasInfo::free())
        }
    }

    #[derive(serde::Deserialize)]
    struct Count {
        count: Uint64,
    }

    fn ctx() -> Ctx {
        Ctx {
            chain_id: "9001".into(),
            height: 1,
            time_nanos: 1,
            contract: [1; 20],
            sender: [2; 20],
        }
    }

    #[test]
    fn counter_roundtrip() {
        validate(WASM).unwrap();
        let st = Shared::default();
        let c = ctx();
        call(
            Entry::Instantiate,
            WASM,
            st.clone(),
            NoQuery,
            &c,
            br#"{"count":5}"#,
            GAS,
        )
        .unwrap();
        let r = call(
            Entry::Execute,
            WASM,
            st.clone(),
            NoQuery,
            &c,
            br#"{"increment":{}}"#,
            GAS,
        )
        .unwrap();
        assert_eq!(r.data.unwrap().as_slice(), 6u64.to_be_bytes());
        println!("execute wasm gas: {}", r.gas_used);
        let (q, _) = query(WASM, st, NoQuery, &c, br#"{"get_count":{}}"#, GAS).unwrap();
        assert_eq!(from_json::<Count>(&q).unwrap().count.u64(), 6);
    }

    #[test]
    fn api_roundtrip() {
        let a = [0xab; 20];
        let h = human_addr(&a);
        let c = HexApi.addr_canonicalize(&h).0.unwrap();
        assert_eq!(c.len(), 32);
        assert_eq!(HexApi.addr_humanize(&c).0.unwrap(), h);
        assert!(HexApi.addr_validate("0xABAB").0.is_err());
    }

    #[test]
    fn out_of_gas() {
        let e = call(
            Entry::Instantiate,
            WASM,
            Shared::default(),
            NoQuery,
            &ctx(),
            br#"{"count":5}"#,
            1000,
        )
        .err()
        .unwrap();
        assert!(matches!(e, Error::OutOfGas), "{e}");
    }
}
