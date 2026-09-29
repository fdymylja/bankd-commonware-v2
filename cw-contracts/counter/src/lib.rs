use cosmwasm_std::{
    entry_point, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult,
};
use cosmwasm_std::{StdError, Uint64};
use serde::{Deserialize, Serialize};

const KEY: &[u8] = b"count";

#[derive(Serialize, Deserialize)]
pub struct InstantiateMsg {
    pub count: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Increment {},
    Reset { count: u64 },
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetCount {},
}

#[derive(Serialize, Deserialize)]
pub struct CountResponse {
    pub count: Uint64,
}

fn load(deps: Deps) -> StdResult<u64> {
    let raw = deps
        .storage
        .get(KEY)
        .ok_or_else(|| StdError::generic_err("count not set"))?;
    Ok(u64::from_be_bytes(
        raw.try_into()
            .map_err(|_| StdError::generic_err("bad count"))?,
    ))
}

fn save(deps: DepsMut, count: u64) {
    deps.storage.set(KEY, &count.to_be_bytes());
}

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    save(deps, msg.count);
    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
    let count = match msg {
        ExecuteMsg::Increment {} => load(deps.as_ref())? + 1,
        ExecuteMsg::Reset { count } => count,
    };
    save(deps, count);
    // data is the return value the caller gets back
    Ok(Response::new()
        .add_attribute("action", "execute")
        .set_data(count.to_be_bytes()))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetCount {} => to_json_binary(&CountResponse {
            count: load(deps)?.into(),
        }),
    }
}
