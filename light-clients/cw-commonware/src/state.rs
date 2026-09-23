//! Client store layout. ibc-go reads `clientState` and `consensusStates/{rev}-{height}` directly,
//! both as `Any`-wrapped `ibc.lightclients.wasm.v1` protos whose `data` is our JSON.

use cosmwasm_std::Storage;
use prost::Message;

use crate::{
    types::{ClientState, ConsensusState},
    Error,
};

pub const CLIENT_STATE_KEY: &[u8] = b"clientState";
const WASM_CLIENT_STATE_URL: &str = "/ibc.lightclients.wasm.v1.ClientState";
const WASM_CONSENSUS_STATE_URL: &str = "/ibc.lightclients.wasm.v1.ConsensusState";

#[derive(Clone, PartialEq, Message)]
pub struct Any {
    #[prost(string, tag = "1")]
    pub type_url: String,
    #[prost(bytes = "vec", tag = "2")]
    pub value: Vec<u8>,
}

#[derive(Clone, Copy, PartialEq, Message)]
pub struct ProtoHeight {
    #[prost(uint64, tag = "1")]
    pub revision_number: u64,
    #[prost(uint64, tag = "2")]
    pub revision_height: u64,
}

/// `ibc.lightclients.wasm.v1.ClientState`
#[derive(Clone, PartialEq, Message)]
pub struct WasmClientState {
    #[prost(bytes = "vec", tag = "1")]
    pub data: Vec<u8>,
    #[prost(bytes = "vec", tag = "2")]
    pub checksum: Vec<u8>,
    #[prost(message, optional, tag = "3")]
    pub latest_height: Option<ProtoHeight>,
}

/// `ibc.lightclients.wasm.v1.ConsensusState`
#[derive(Clone, PartialEq, Message)]
pub struct WasmConsensusState {
    #[prost(bytes = "vec", tag = "1")]
    pub data: Vec<u8>,
}

pub fn consensus_key(height: u64) -> Vec<u8> {
    format!("consensusStates/0-{height}").into_bytes()
}

fn wasm_client_state(storage: &dyn Storage) -> Result<WasmClientState, Error> {
    let raw = storage
        .get(CLIENT_STATE_KEY)
        .ok_or(Error::ClientStateNotFound)?;
    Ok(WasmClientState::decode(
        Any::decode(raw.as_slice())?.value.as_slice(),
    )?)
}

pub fn client_state(storage: &dyn Storage) -> Result<ClientState, Error> {
    Ok(serde_json::from_slice(&wasm_client_state(storage)?.data)?)
}

/// Saves `cs`, keeping the checksum ibc-go stored at instantiate.
pub fn save_client_state(
    storage: &mut dyn Storage,
    cs: &ClientState,
    checksum: Option<Vec<u8>>,
) -> Result<(), Error> {
    let checksum = match checksum {
        Some(c) => c,
        None => wasm_client_state(storage)?.checksum,
    };
    let wasm = WasmClientState {
        data: serde_json::to_vec(cs)?,
        checksum,
        latest_height: Some(ProtoHeight {
            revision_number: 0,
            revision_height: cs.latest_height,
        }),
    };
    let any = Any {
        type_url: WASM_CLIENT_STATE_URL.into(),
        value: wasm.encode_to_vec(),
    };
    storage.set(CLIENT_STATE_KEY, &any.encode_to_vec());
    Ok(())
}

pub fn consensus_state(
    storage: &dyn Storage,
    height: u64,
) -> Result<Option<ConsensusState>, Error> {
    let Some(raw) = storage.get(&consensus_key(height)) else {
        return Ok(None);
    };
    let wasm = WasmConsensusState::decode(Any::decode(raw.as_slice())?.value.as_slice())?;
    Ok(Some(serde_json::from_slice(&wasm.data)?))
}

pub fn save_consensus_state(
    storage: &mut dyn Storage,
    height: u64,
    cs: &ConsensusState,
) -> Result<(), Error> {
    let wasm = WasmConsensusState {
        data: serde_json::to_vec(cs)?,
    };
    let any = Any {
        type_url: WASM_CONSENSUS_STATE_URL.into(),
        value: wasm.encode_to_vec(),
    };
    storage.set(&consensus_key(height), &any.encode_to_vec());
    Ok(())
}
