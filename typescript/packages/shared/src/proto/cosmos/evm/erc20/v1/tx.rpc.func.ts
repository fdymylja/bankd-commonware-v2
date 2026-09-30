import { buildTx } from "../../../../helper-func-types";
import { MsgConvertERC20, MsgConvertCoin, MsgUpdateParams, MsgRegisterERC20, MsgToggleConversion } from "./tx";
/**
 * ConvertERC20 mints a native Cosmos coin representation of the ERC20 token
 * contract that is registered on the token mapping.
 * @name convertERC20
 * @package cosmos.evm.erc20.v1
 * @see proto service: cosmos.evm.erc20.v1.ConvertERC20
 */
export const convertERC20 = buildTx<MsgConvertERC20>({
  msg: MsgConvertERC20
});
/**
 * ConvertCoin mints a ERC20 token representation of the native Cosmos coin
 * that is registered on the token mapping.
 * @name convertCoin
 * @package cosmos.evm.erc20.v1
 * @see proto service: cosmos.evm.erc20.v1.ConvertCoin
 */
export const convertCoin = buildTx<MsgConvertCoin>({
  msg: MsgConvertCoin
});
/**
 * UpdateParams defines a governance operation for updating the x/erc20 module
 * parameters. The authority is hard-coded to the Cosmos SDK x/gov module
 * account
 * @name updateParams
 * @package cosmos.evm.erc20.v1
 * @see proto service: cosmos.evm.erc20.v1.UpdateParams
 */
export const updateParams = buildTx<MsgUpdateParams>({
  msg: MsgUpdateParams
});
/**
 * RegisterERC20 defines a governance operation for registering a token pair
 * for the specified erc20 contract. The authority is hard-coded to the Cosmos
 * SDK x/gov module account
 * @name registerERC20
 * @package cosmos.evm.erc20.v1
 * @see proto service: cosmos.evm.erc20.v1.RegisterERC20
 */
export const registerERC20 = buildTx<MsgRegisterERC20>({
  msg: MsgRegisterERC20
});
/**
 * ToggleConversion defines a governance operation for enabling/disabling a
 * token pair conversion. The authority is hard-coded to the Cosmos SDK x/gov
 * module account
 * @name toggleConversion
 * @package cosmos.evm.erc20.v1
 * @see proto service: cosmos.evm.erc20.v1.ToggleConversion
 */
export const toggleConversion = buildTx<MsgToggleConversion>({
  msg: MsgToggleConversion
});