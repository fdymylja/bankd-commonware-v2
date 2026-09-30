use anyhow::{anyhow, Result};
use shieldd_compliance::{
    structs::{MsgRegisterAsset, MsgRegisterUser},
    AssetPolicy,
};
use shieldd_proto::{core::component::compliance::v1 as pb, DomainType, Message};
use wasm_bindgen::prelude::*;

/// Validate issued evidence; registrar allowlists and current state remain enforced at chain admission.
#[wasm_bindgen(js_name = validateAssetRegistration)]
pub fn validate_asset_registration(
    message: &[u8],
    chain_id: String,
    current_unix: u64,
) -> Result<Vec<u8>, JsValue> {
    let result = (|| -> Result<Vec<u8>> {
        let message = MsgRegisterAsset::try_from(pb::MsgRegisterAsset::decode(message)?)?;
        let policy =
            shieldd_compliance::registration::policy_from_asset_grant(&message, current_unix)?;
        if message.is_regulated {
            message
                .audit_certificate
                .as_ref()
                .ok_or_else(|| anyhow!("missing ring encryption-key certificate"))?
                .verify_general(message.asset_id, &policy, &chain_id)?;
        } else {
            anyhow::ensure!(
                message.audit_certificate.is_none(),
                "unregulated asset cannot have audit certificate"
            );
        }
        Ok(message.encode_to_vec())
    })();
    result.map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen(js_name = validateUserRegistration)]
pub fn validate_user_registration(
    message: &[u8],
    policy_bytes: &[u8],
    chain_id: String,
    current_unix: u64,
) -> Result<Vec<u8>, JsValue> {
    let result = (|| -> Result<Vec<u8>> {
        let message = MsgRegisterUser::try_from(pb::MsgRegisterUser::decode(message)?)?;
        let policy = AssetPolicy::try_from(pb::AssetPolicy::decode(policy_bytes)?)?;
        shieldd_compliance::registration::validate_user_grant(&message, &policy, current_unix)?;
        message
            .capability_certificate
            .as_ref()
            .ok_or_else(|| anyhow!("missing registration capability certificate"))?
            .verify(&message.leaf, &policy, &chain_id)?;
        Ok(message.encode_to_vec())
    })();
    result.map_err(|error| JsValue::from_str(&error.to_string()))
}
