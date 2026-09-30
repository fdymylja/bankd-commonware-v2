import { buildQuery } from "../../../helper-func-types";
import { QueryParamsRequest, QueryParamsResponse } from "./query";
/**
 * Params queries all parameters of the module.
 * @name getParams
 * @package mizufinance.native.v1
 * @see proto service: mizufinance.native.v1.Params
 */
export const getParams = buildQuery<QueryParamsRequest, QueryParamsResponse>({
  encode: QueryParamsRequest.encode,
  decode: QueryParamsResponse.decode,
  service: "mizufinance.native.v1.Query",
  method: "Params",
  deps: [QueryParamsRequest, QueryParamsResponse]
});