//! Cw precompile (CWASM): runs CosmWasm contracts.
//!
//! Everything lives in EVM state so reverts, state roots and gas metering come for free. Code is
//! the bytecode of a code account, contract state is hashed slots on this address. Submessages,
//! funds, iterators, migrate and sudo aren't supported.

use super::bankd_err;
use crate::{
    Precompile, charge_input_cost, dispatch,
    error::{Result, TempoPrecompileError},
    mutate, mutate_void,
    storage::{Handler, Mapping, StorageCtx},
    view,
};
use alloy::primitives::{Address, Bytes, U256, keccak256};
use bankd_cw::{
    BackendError, BackendResult, Ctx, Entry, Error as CwError, GasInfo, Querier, Storage,
    WASM_GAS_PER_EVM_GAS,
    cosmwasm_std::{
        BalanceResponse, BankQuery, Binary, Coin, ContractResult, Empty, QueryRequest, SystemError,
        SystemResult, from_json, to_json_binary,
    },
};
use revm::{precompile::PrecompileResult, state::Bytecode};
use tempo_contracts::precompiles::{BankdError, CW_ADDRESS, ICw, SHIELD_BRL_DENOM};
use tempo_precompiles_macros::contract;

/// Charged on top of the input cost for instantiate and execute.
const BASE_GAS: u64 = 200_000;
/// Base for queries, which don't write.
const QUERY_BASE_GAS: u64 = 50_000;
/// Most EVM gas a single call can spend inside wasm.
const MAX_WASM_EVM_GAS: u64 = 5_000_000;
const MAX_CODE_LEN: usize = 1 << 20;
/// Keeps one chunk under the tx gas cap (~1100 gas per stored byte).
const MAX_CHUNK_LEN: usize = 10_000;
/// Marks contract addresses so they stand out in explorers.
const ADDR_PREFIX: [u8; 4] = [0xC0, 0xDE, 0xC0, 0xDE];

/// Storage layout. Contract key/values are not in the declared slots, see [`HostStorage`].
/// ```solidity
/// contract Cw {
///     uint64 lastCodeId;                              // slot 0
///     uint64 instanceCount;                           // slot 1
///     mapping(uint64 => uint64) codeChunks;           // slot 2, chunk i is the bytecode of chunkAccount(id, i)
///     mapping(uint64 => address) codeUploader;        // slot 3
///     mapping(uint64 => bool) codeFinal;              // slot 4
///     mapping(address => uint64) contractCodeId;      // slot 5, 0 means not a contract
///     mapping(address => address) contractCreator;    // slot 6
/// }
/// ```
#[contract(addr = CW_ADDRESS)]
pub struct Cw {
    last_code_id: u64,
    instance_count: u64,
    code_chunks: Mapping<u64, u64>,
    code_uploader: Mapping<u64, Address>,
    code_final: Mapping<u64, bool>,
    contract_code_id: Mapping<Address, u64>,
    contract_creator: Mapping<Address, Address>,
}

fn cw_err(reason: impl ToString) -> TempoPrecompileError {
    bankd_err(BankdError::cw_failed(reason.to_string()))
}

fn from_cw(e: CwError) -> TempoPrecompileError {
    match e {
        CwError::OutOfGas => TempoPrecompileError::OutOfGas,
        e => cw_err(e),
    }
}

/// Key/value store for one contract. A key hashes to a header slot holding `len + 1` (0 means
/// absent), the value sits in the slots hashed from the header slot.
struct HostStorage {
    contract: Address,
}

impl HostStorage {
    fn header(&self, key: &[u8]) -> U256 {
        let mut buf = Vec::with_capacity(20 + key.len());
        buf.extend_from_slice(self.contract.as_slice());
        buf.extend_from_slice(key);
        U256::from_be_bytes(keccak256(buf).0)
    }

    fn chunk(header: U256, i: usize) -> U256 {
        let mut buf = [0u8; 40];
        buf[..32].copy_from_slice(&header.to_be_bytes::<32>());
        buf[32..].copy_from_slice(&(i as u64).to_be_bytes());
        U256::from_be_bytes(keccak256(buf).0)
    }

    fn read(&self, key: &[u8]) -> Result<Option<Vec<u8>>> {
        let ctx = StorageCtx;
        let header = self.header(key);
        let stored = ctx.sload(CW_ADDRESS, header)?;
        if stored.is_zero() {
            return Ok(None);
        }
        let len = stored.saturating_to::<usize>() - 1;
        let mut out = Vec::with_capacity(len.next_multiple_of(32));
        for i in 0..len.div_ceil(32) {
            out.extend_from_slice(
                &ctx.sload(CW_ADDRESS, Self::chunk(header, i))?
                    .to_be_bytes::<32>(),
            );
        }
        out.truncate(len);
        Ok(Some(out))
    }

    fn write(&self, key: &[u8], value: Option<&[u8]>) -> Result<()> {
        let mut ctx = StorageCtx;
        let header = self.header(key);
        let old = ctx.sload(CW_ADDRESS, header)?;
        let old_chunks = match old.is_zero() {
            true => 0,
            false => (old.saturating_to::<usize>() - 1).div_ceil(32),
        };
        let new_chunks = value.map_or(0, |v| v.len().div_ceil(32));
        for i in 0..new_chunks {
            let mut word = [0u8; 32];
            let v = value.unwrap_or_default();
            let part = &v[i * 32..(i * 32 + 32).min(v.len())];
            word[..part.len()].copy_from_slice(part);
            ctx.sstore(
                CW_ADDRESS,
                Self::chunk(header, i),
                U256::from_be_bytes(word),
            )?;
        }
        // clear leftovers from a longer old value
        for i in new_chunks..old_chunks {
            ctx.sstore(CW_ADDRESS, Self::chunk(header, i), U256::ZERO)?;
        }
        let stored = value.map_or(U256::ZERO, |v| U256::from(v.len() + 1));
        ctx.sstore(CW_ADDRESS, header, stored)
    }
}

// Gas is charged by the EVM storage calls themselves, so the vm sees free backend calls.
impl Storage for HostStorage {
    fn get(&self, key: &[u8]) -> BackendResult<Option<Vec<u8>>> {
        (
            self.read(key)
                .map_err(|e| BackendError::unknown(format!("{e:?}"))),
            GasInfo::free(),
        )
    }

    fn set(&mut self, key: &[u8], value: &[u8]) -> BackendResult<()> {
        (
            self.write(key, Some(value))
                .map_err(|e| BackendError::unknown(format!("{e:?}"))),
            GasInfo::free(),
        )
    }

    fn remove(&mut self, key: &[u8]) -> BackendResult<()> {
        (
            self.write(key, None)
                .map_err(|e| BackendError::unknown(format!("{e:?}"))),
            GasInfo::free(),
        )
    }
}

/// Only bank balance queries, against the native BRL balance.
struct HostQuerier;

impl Querier for HostQuerier {
    fn query_raw(
        &self,
        request: &[u8],
        _gas_limit: u64,
    ) -> BackendResult<SystemResult<ContractResult<Binary>>> {
        let free = GasInfo::free();
        let req: QueryRequest<Empty> = match from_json(request) {
            Ok(r) => r,
            Err(e) => {
                let err = SystemError::InvalidRequest {
                    error: e.to_string(),
                    request: request.to_vec().into(),
                };
                return (Ok(SystemResult::Err(err)), free);
            }
        };
        let QueryRequest::Bank(BankQuery::Balance { address, denom }) = req else {
            let err = SystemError::UnsupportedRequest {
                kind: "only bank balance".to_owned(),
            };
            return (Ok(SystemResult::Err(err)), free);
        };
        let Some(addr) = bankd_cw::parse_addr(&address) else {
            return (Err(BackendError::user_err("bad address")), free);
        };
        let amount = match denom == SHIELD_BRL_DENOM {
            true => StorageCtx
                .balance(Address::from(addr))
                .map_err(|e| BackendError::unknown(format!("{e:?}"))),
            false => Ok(U256::ZERO),
        };
        let res = amount.and_then(|a| {
            let coin = Coin::new(a.saturating_to::<u128>(), denom);
            to_json_binary(&BalanceResponse::new(coin))
                .map_err(|e| BackendError::unknown(e.to_string()))
        });
        (res.map(|b| SystemResult::Ok(ContractResult::Ok(b))), free)
    }
}

impl Cw {
    /// Marks the precompile account as deployed.
    pub fn initialize(&mut self) -> Result<()> {
        self.__initialize()
    }

    fn code_of(&self, contract: Address) -> Result<Bytes> {
        let code_id = self.contract_code_id[contract].read()?;
        if code_id == 0 {
            return Err(cw_err("not a contract"));
        }
        self.load_code(code_id)
    }

    fn chunk_account(code_id: u64, i: u64) -> Address {
        let mut seed = b"cw-code".to_vec();
        seed.extend_from_slice(&code_id.to_be_bytes());
        seed.extend_from_slice(&i.to_be_bytes());
        Address::from_slice(&keccak256(seed)[12..])
    }

    fn load_code(&self, code_id: u64) -> Result<Bytes> {
        let mut out = Vec::new();
        for i in 0..self.code_chunks[code_id].read()? {
            let (_, chunk) = self.storage.account_code(Self::chunk_account(code_id, i))?;
            out.extend_from_slice(&chunk.original_bytes());
        }
        Ok(out.into())
    }

    /// Wasm gas the rest of this call may burn.
    fn wasm_budget(&self) -> u64 {
        let left = self
            .storage
            .gas_limit()
            .saturating_sub(self.storage.gas_used());
        left.min(MAX_WASM_EVM_GAS) * WASM_GAS_PER_EVM_GAS
    }

    fn charge_wasm(&mut self, wasm_gas: u64) -> Result<()> {
        self.storage
            .deduct_gas(wasm_gas.div_ceil(WASM_GAS_PER_EVM_GAS))
    }

    fn ctx(&self, contract: Address, sender: Address) -> Ctx {
        Ctx {
            chain_id: self.storage.chain_id().to_string(),
            height: self.storage.block_number(),
            // block timestamps are seconds
            time_nanos: self
                .storage
                .timestamp()
                .saturating_to::<u64>()
                .saturating_mul(1_000_000_000),
            contract: contract.0.0,
            sender: sender.0.0,
        }
    }

    /// One tx upload for blobs that fit a chunk.
    pub fn store_code(&mut self, sender: Address, call: ICw::storeCodeCall) -> Result<u64> {
        let id = self.upload_code(
            sender,
            ICw::uploadCodeCall {
                codeId: 0,
                chunk: call.wasm,
            },
        )?;
        self.finalize_code(sender, ICw::finalizeCodeCall { codeId: id })?;
        Ok(id)
    }

    pub fn upload_code(&mut self, sender: Address, call: ICw::uploadCodeCall) -> Result<u64> {
        if call.chunk.is_empty() || call.chunk.len() > MAX_CHUNK_LEN {
            return Err(cw_err("bad chunk size"));
        }
        let id = match call.codeId {
            0 => {
                let id = self.last_code_id.read()? + 1;
                self.last_code_id.write(id)?;
                self.code_uploader[id].write(sender)?;
                id
            }
            id => {
                if self.code_uploader[id].read()? != sender || self.code_final[id].read()? {
                    return Err(cw_err("not your unfinished upload"));
                }
                id
            }
        };
        let n = self.code_chunks[id].read()?;
        self.storage
            .set_code(Self::chunk_account(id, n), Bytecode::new_raw(call.chunk))?;
        self.code_chunks[id].write(n + 1)?;
        Ok(id)
    }

    pub fn finalize_code(&mut self, sender: Address, call: ICw::finalizeCodeCall) -> Result<()> {
        let id = call.codeId;
        if id == 0 || self.code_uploader[id].read()? != sender || self.code_final[id].read()? {
            return Err(cw_err("not your unfinished upload"));
        }
        let wasm = self.load_code(id)?;
        if wasm.len() > MAX_CODE_LEN {
            return Err(cw_err("code too large"));
        }
        bankd_cw::validate(&wasm).map_err(from_cw)?;
        self.code_final[id].write(true)?;
        self.emit_event(ICw::CodeStored {
            codeId: id,
            creator: sender,
            codeHash: keccak256(&wasm),
        })
    }

    pub fn instantiate(
        &mut self,
        sender: Address,
        call: ICw::instantiateCall,
    ) -> Result<ICw::instantiateReturn> {
        self.storage.deduct_gas(BASE_GAS)?;
        if !self.code_final[call.codeId].read()? {
            return Err(cw_err("unknown code id"));
        }
        let code = self.load_code(call.codeId)?;

        let count = self.instance_count.read()? + 1;
        self.instance_count.write(count)?;
        let mut seed = call.codeId.to_be_bytes().to_vec();
        seed.extend_from_slice(sender.as_slice());
        seed.extend_from_slice(&count.to_be_bytes());
        let mut addr = keccak256(seed)[..20].to_vec();
        addr[..4].copy_from_slice(&ADDR_PREFIX);
        let contract = Address::from_slice(&addr);

        self.contract_code_id[contract].write(call.codeId)?;
        self.contract_creator[contract].write(sender)?;
        self.emit_event(ICw::Instantiated {
            contractAddress: contract,
            codeId: call.codeId,
            creator: sender,
        })?;

        let data = self.run(Entry::Instantiate, &code, contract, sender, &call.msg)?;
        Ok(ICw::instantiateReturn {
            contractAddress: contract,
            data,
        })
    }

    pub fn execute(&mut self, sender: Address, call: ICw::executeCall) -> Result<Bytes> {
        self.storage.deduct_gas(BASE_GAS)?;
        let code = self.code_of(call.contractAddress)?;
        self.run(
            Entry::Execute,
            &code,
            call.contractAddress,
            sender,
            &call.msg,
        )
    }

    fn run(
        &mut self,
        entry: Entry,
        code: &[u8],
        contract: Address,
        sender: Address,
        msg: &[u8],
    ) -> Result<Bytes> {
        let ctx = self.ctx(contract, sender);
        let out = bankd_cw::call(
            entry,
            code,
            HostStorage { contract },
            HostQuerier,
            &ctx,
            msg,
            self.wasm_budget(),
        )
        .map_err(from_cw)?;
        self.charge_wasm(out.gas_used)?;
        for ev in out.events {
            self.emit_event(ICw::WasmEvent {
                contractAddress: contract,
                eventType: ev.ty,
                keys: ev.attributes.iter().map(|a| a.key.clone()).collect(),
                values: ev.attributes.iter().map(|a| a.value.clone()).collect(),
            })?;
        }
        Ok(out
            .data
            .map(|d| Bytes::from(d.to_vec()))
            .unwrap_or_default())
    }

    pub fn query(&mut self, call: ICw::queryCall) -> Result<Bytes> {
        self.storage.deduct_gas(QUERY_BASE_GAS)?;
        let code = self.code_of(call.contractAddress)?;
        let ctx = self.ctx(call.contractAddress, Address::ZERO);
        let (res, used) = bankd_cw::query(
            &code,
            HostStorage {
                contract: call.contractAddress,
            },
            HostQuerier,
            &ctx,
            &call.msg,
            self.wasm_budget(),
        )
        .map_err(from_cw)?;
        self.charge_wasm(used)?;
        Ok(Bytes::from(res.to_vec()))
    }

    pub fn is_contract(&self, account: Address) -> Result<bool> {
        Ok(self.contract_code_id[account].read()? != 0)
    }

    pub fn contract_info(&self, contract: Address) -> Result<ICw::contractInfoReturn> {
        Ok(ICw::contractInfoReturn {
            codeId: self.contract_code_id[contract].read()?,
            creator: self.contract_creator[contract].read()?,
        })
    }
}

impl Precompile for Cw {
    fn call(&mut self, calldata: &[u8], msg_sender: Address) -> PrecompileResult {
        if let Some(err) = charge_input_cost(&mut self.storage, calldata) {
            return err;
        }

        dispatch!(calldata, |call| match call {
            ICw::ICwCalls {
                storeCode(call) => mutate(call, msg_sender, |s, c| self.store_code(s, c)),
                uploadCode(call) => mutate(call, msg_sender, |s, c| self.upload_code(s, c)),
                finalizeCode(call) => mutate_void(call, msg_sender, |s, c| self.finalize_code(s, c)),
                instantiate(call) => mutate(call, msg_sender, |s, c| self.instantiate(s, c)),
                execute(call) => mutate(call, msg_sender, |s, c| self.execute(s, c)),
                query(call) => view(call, |c| self.query(c)),
                isContract(call) => view(call, |c| self.is_contract(c.account)),
                contractInfo(call) => view(call, |c| self.contract_info(c.contractAddress)),
            }
        })
    }
}
