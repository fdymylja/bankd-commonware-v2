import { buildTx } from "../../../helper-func-types";
import { MsgUpdateParams } from "./tx";
/**
 * UpdateParams defines a governance operation for updating the parameters.
 * 
 * Since: cosmos-sdk 0.47
 * @name updateParams
 * @package mizufinance.native.v1
 * @see proto service: mizufinance.native.v1.UpdateParams
 */
export const updateParams = buildTx<MsgUpdateParams>({
  msg: MsgUpdateParams
});