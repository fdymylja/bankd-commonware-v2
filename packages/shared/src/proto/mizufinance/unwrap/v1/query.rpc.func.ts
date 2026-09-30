import { buildQuery } from "../../../helper-func-types";
import { QueryParamsRequest, QueryParamsResponse } from "./query";
/**
 * Parameters queries the parameters of the module.
 * @name getParams
 * @package mizufinance.unwrap.v1
 * @see proto service: mizufinance.unwrap.v1.Params
 */
export const getParams = buildQuery<QueryParamsRequest, QueryParamsResponse>({
  encode: QueryParamsRequest.encode,
  decode: QueryParamsResponse.decode,
  service: "mizufinance.unwrap.v1.Query",
  method: "Params",
  deps: [QueryParamsRequest, QueryParamsResponse]
});