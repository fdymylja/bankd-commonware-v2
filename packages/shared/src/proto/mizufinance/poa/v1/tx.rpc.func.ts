import { buildTx } from "../../../helper-func-types";
import { MsgAddValidator, MsgAddWhitelist, MsgRemoveWhitelist, MsgRemoveValidator, MsgUpdateValidatorWeight, MsgUpdateParams } from "./tx";
/**
 * AddValidator creates a new validator with authority-minted tokens.
 * @name addValidator
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.AddValidator
 */
export const addValidator = buildTx<MsgAddValidator>({
  msg: MsgAddValidator
});
/**
 * AddWhitelist adds an address to the validator whitelist.
 * @name addWhitelist
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.AddWhitelist
 */
export const addWhitelist = buildTx<MsgAddWhitelist>({
  msg: MsgAddWhitelist
});
/**
 * RemoveWhitelist removes an address from the validator whitelist.
 * @name removeWhitelist
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.RemoveWhitelist
 */
export const removeWhitelist = buildTx<MsgRemoveWhitelist>({
  msg: MsgRemoveWhitelist
});
/**
 * RemoveValidator evicts a validator from the active set.
 * @name removeValidator
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.RemoveValidator
 */
export const removeValidator = buildTx<MsgRemoveValidator>({
  msg: MsgRemoveValidator
});
/**
 * UpdateValidatorWeight sets a validator's power to an exact value.
 * @name updateValidatorWeight
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.UpdateValidatorWeight
 */
export const updateValidatorWeight = buildTx<MsgUpdateValidatorWeight>({
  msg: MsgUpdateValidatorWeight
});
/**
 * UpdateParams updates the module parameters.
 * @name updateParams
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.UpdateParams
 */
export const updateParams = buildTx<MsgUpdateParams>({
  msg: MsgUpdateParams
});