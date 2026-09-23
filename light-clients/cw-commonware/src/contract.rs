//! 08-wasm entry points.

use alloy_primitives::B256;
#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    to_json_binary, Api, Binary, Deps, DepsMut, Env, MessageInfo, Response, Storage,
};

use crate::{
    membership,
    msg::{
        CheckForMisbehaviourResult, ClientMessageMsg, Height, InstantiateMsg, MigrateMsg, QueryMsg,
        StatusResult, SudoMsg, TimestampAtHeightResult, UpdateStateResult, VerifyMembershipMsg,
        VerifyNonMembershipMsg,
    },
    state,
    types::{ClientState, ConsensusState, EpochKey, Header, MembershipProof},
    verify::{verify_header, Params, VerifiedHeader},
    Error,
};

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, Error> {
    let cs: ClientState = serde_json::from_slice(&msg.client_state)?;
    let consensus: ConsensusState = serde_json::from_slice(&msg.consensus_state)?;
    if cs.epoch_length == 0 {
        return Err(Error::Decode("epoch_length is 0".into()));
    }
    // The trusted height's committee has to be known, or no update can ever verify.
    if cs.key(cs.latest_height / cs.epoch_length).is_none() {
        return Err(Error::MissingKey);
    }
    for k in &cs.keys {
        deps.api
            .bls12_381_aggregate_g2(k.key.as_slice())
            .map_err(|e| Error::Bls(e.to_string()))?;
    }
    state::save_client_state(deps.storage, &cs, Some(msg.checksum.to_vec()))?;
    state::save_consensus_state(deps.storage, cs.latest_height, &consensus)?;
    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn sudo(deps: DepsMut, _env: Env, msg: SudoMsg) -> Result<Response, Error> {
    let data = match msg {
        SudoMsg::VerifyMembership(m) => verify_membership(deps.storage, m)?,
        SudoMsg::VerifyNonMembership(m) => verify_non_membership(deps.storage, m)?,
        SudoMsg::UpdateState(m) => update_state(deps.storage, deps.api, &m)?,
        SudoMsg::UpdateStateOnMisbehaviour(_) => freeze(deps.storage)?,
        SudoMsg::VerifyUpgradeAndUpdateState(_) => {
            return Err(Error::Unsupported("client upgrades"))
        }
        SudoMsg::MigrateClientStore(_) => return Err(Error::Unsupported("client recovery")),
    };
    Ok(Response::default().set_data(data))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> Result<Binary, Error> {
    match msg {
        QueryMsg::VerifyClientMessage(m) => {
            verify(deps.storage, deps.api, &m)?;
            json(&())
        }
        QueryMsg::CheckForMisbehaviour(m) => {
            let v = verify(deps.storage, deps.api, &m)?;
            let found = state::consensus_state(deps.storage, v.height)?
                .is_some_and(|existing| existing != consensus_of(&v));
            json(&CheckForMisbehaviourResult {
                found_misbehaviour: found,
            })
        }
        QueryMsg::TimestampAtHeight(m) => {
            let cs = consensus_at(deps.storage, m.height)?;
            json(&TimestampAtHeightResult {
                timestamp: cs.timestamp * 1_000_000_000,
            })
        }
        // No trusting period: a committee is only trusted for its own epoch and newer ones need
        // a boundary header, so the client doesn't expire. It only freezes on conflicting headers.
        QueryMsg::Status(_) => {
            let status = if state::client_state(deps.storage)?.frozen {
                "Frozen"
            } else {
                "Active"
            };
            json(&StatusResult {
                status: status.into(),
            })
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, Error> {
    Ok(Response::default())
}

fn json<T: serde::Serialize>(v: &T) -> Result<Binary, Error> {
    to_json_binary(v).map_err(|e| Error::Decode(e.to_string()))
}

fn consensus_of(v: &VerifiedHeader) -> ConsensusState {
    ConsensusState {
        timestamp: v.timestamp,
        state_root: B256::from(v.state_root),
    }
}

fn consensus_at(storage: &dyn Storage, height: Height) -> Result<ConsensusState, Error> {
    if height.revision_number != 0 {
        return Err(Error::InvalidRevision);
    }
    state::consensus_state(storage, height.revision_height)?
        .ok_or(Error::ConsensusStateNotFound(height.revision_height))
}

/// Decodes and checks a header against the stored client state.
fn verify(
    storage: &dyn Storage,
    api: &dyn Api,
    m: &ClientMessageMsg,
) -> Result<VerifiedHeader, Error> {
    let cs = state::client_state(storage)?;
    if cs.frozen {
        return Err(Error::Frozen);
    }
    let header: Header = serde_json::from_slice(&m.client_message)?;
    let params = Params {
        namespace: &cs.namespace,
        epoch_length: cs.epoch_length,
        latest_height: cs.latest_height,
    };
    verify_header(
        api,
        &params,
        |e| cs.key(e),
        &header.header_rlp,
        &header.certificate,
    )
}

/// Stores the header's consensus state and, on boundary blocks, the next committee's key.
/// ibc-go already ran VerifyClientMessage, verifying again keeps this safe on its own.
fn update_state(
    storage: &mut dyn Storage,
    api: &dyn Api,
    m: &ClientMessageMsg,
) -> Result<Binary, Error> {
    let v = verify(storage, api, m)?;
    let mut cs = state::client_state(storage)?;
    let heights = vec![Height {
        revision_number: 0,
        revision_height: v.height,
    }];

    if state::consensus_state(storage, v.height)?.is_none() {
        state::save_consensus_state(storage, v.height, &consensus_of(&v))?;
    }
    if let Some((epoch, key)) = v.next_key {
        if cs.key(epoch).is_none() {
            cs.keys.push(EpochKey {
                epoch,
                key: key.into(),
            });
        }
    }
    cs.latest_height = cs.latest_height.max(v.height);
    // Headers from older epochs are refused anyway, so their keys are dead weight.
    let latest_epoch = cs.latest_height / cs.epoch_length;
    cs.keys.retain(|k| k.epoch >= latest_epoch);
    state::save_client_state(storage, &cs, None)?;

    json(&UpdateStateResult { heights })
}

fn freeze(storage: &mut dyn Storage) -> Result<Binary, Error> {
    let mut cs = state::client_state(storage)?;
    cs.frozen = true;
    state::save_client_state(storage, &cs, None)?;
    Ok(Binary::default())
}

fn membership_inputs(
    storage: &dyn Storage,
    height: Height,
    proof: &Binary,
) -> Result<(ClientState, ConsensusState, MembershipProof), Error> {
    let cs = state::client_state(storage)?;
    if cs.frozen {
        return Err(Error::Frozen);
    }
    let consensus = consensus_at(storage, height)?;
    let proof: MembershipProof = serde_json::from_slice(proof)?;
    Ok((cs, consensus, proof))
}

fn verify_membership(storage: &dyn Storage, m: VerifyMembershipMsg) -> Result<Binary, Error> {
    let (cs, consensus, proof) = membership_inputs(storage, m.height, &m.proof)?;
    let path: Vec<Vec<u8>> = m
        .merkle_path
        .key_path
        .into_iter()
        .map(|p| p.to_vec())
        .collect();
    membership::verify(
        consensus.state_root,
        cs.router,
        &path,
        &proof,
        Some(m.value.as_slice()),
    )?;
    Ok(Binary::default())
}

fn verify_non_membership(
    storage: &dyn Storage,
    m: VerifyNonMembershipMsg,
) -> Result<Binary, Error> {
    let (cs, consensus, proof) = membership_inputs(storage, m.height, &m.proof)?;
    let path: Vec<Vec<u8>> = m
        .merkle_path
        .key_path
        .into_iter()
        .map(|p| p.to_vec())
        .collect();
    membership::verify(consensus.state_root, cs.router, &path, &proof, None)?;
    Ok(Binary::default())
}
