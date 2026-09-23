//! The 08-wasm contract interface (ibc-go `modules/light-clients/08-wasm`), same shapes as
//! ibc-contracts' `cw-ics08-wasm-eth`.

use cosmwasm_std::Binary;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InstantiateMsg {
    pub client_state: Binary,
    pub consensus_state: Binary,
    pub checksum: Binary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum SudoMsg {
    VerifyMembership(VerifyMembershipMsg),
    VerifyNonMembership(VerifyNonMembershipMsg),
    UpdateState(ClientMessageMsg),
    UpdateStateOnMisbehaviour(ClientMessageMsg),
    VerifyUpgradeAndUpdateState(serde_json::Value),
    MigrateClientStore(serde_json::Value),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum QueryMsg {
    VerifyClientMessage(ClientMessageMsg),
    CheckForMisbehaviour(ClientMessageMsg),
    TimestampAtHeight(TimestampAtHeightMsg),
    Status(StatusMsg),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrateMsg {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyMembershipMsg {
    pub height: Height,
    pub delay_time_period: u64,
    pub delay_block_period: u64,
    pub proof: Binary,
    pub merkle_path: MerklePath,
    pub value: Binary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyNonMembershipMsg {
    pub height: Height,
    pub delay_time_period: u64,
    pub delay_block_period: u64,
    pub proof: Binary,
    pub merkle_path: MerklePath,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientMessageMsg {
    pub client_message: Binary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimestampAtHeightMsg {
    pub height: Height,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusMsg {}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Height {
    #[serde(default)]
    pub revision_number: u64,
    #[serde(default)]
    pub revision_height: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerklePath {
    pub key_path: Vec<Binary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStateResult {
    pub heights: Vec<Height>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusResult {
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckForMisbehaviourResult {
    pub found_misbehaviour: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimestampAtHeightResult {
    /// Nanoseconds, what ibc-go expects.
    pub timestamp: u64,
}
