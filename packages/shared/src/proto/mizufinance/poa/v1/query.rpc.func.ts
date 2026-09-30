import { buildQuery } from "../../../helper-func-types";
import { QueryParamsRequest, QueryParamsResponse, QueryWhitelistRequest, QueryWhitelistResponse, QueryAccessStatusRequest, QueryAccessStatusResponse, QueryAuthorityRequest, QueryAuthorityResponse } from "./query";
/**
 * Params queries the parameters of the module.
 * @name getParams
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.Params
 */
export const getParams = buildQuery<QueryParamsRequest, QueryParamsResponse>({
  encode: QueryParamsRequest.encode,
  decode: QueryParamsResponse.decode,
  service: "mizufinance.poa.v1.Query",
  method: "Params",
  deps: [QueryParamsRequest, QueryParamsResponse]
});
/**
 * Whitelist queries all whitelisted addresses.
 * @name getWhitelist
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.Whitelist
 */
export const getWhitelist = buildQuery<QueryWhitelistRequest, QueryWhitelistResponse>({
  encode: QueryWhitelistRequest.encode,
  decode: QueryWhitelistResponse.decode,
  service: "mizufinance.poa.v1.Query",
  method: "Whitelist",
  deps: [QueryWhitelistRequest, QueryWhitelistResponse]
});
/**
 * AccessStatus returns the access status of a validator address.
 * @name getAccessStatus
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.AccessStatus
 */
export const getAccessStatus = buildQuery<QueryAccessStatusRequest, QueryAccessStatusResponse>({
  encode: QueryAccessStatusRequest.encode,
  decode: QueryAccessStatusResponse.decode,
  service: "mizufinance.poa.v1.Query",
  method: "AccessStatus",
  deps: [QueryAccessStatusRequest, QueryAccessStatusResponse]
});
/**
 * Authority queries the module authority.
 * @name getAuthority
 * @package mizufinance.poa.v1
 * @see proto service: mizufinance.poa.v1.Authority
 */
export const getAuthority = buildQuery<QueryAuthorityRequest, QueryAuthorityResponse>({
  encode: QueryAuthorityRequest.encode,
  decode: QueryAuthorityResponse.decode,
  service: "mizufinance.poa.v1.Query",
  method: "Authority",
  deps: [QueryAuthorityRequest, QueryAuthorityResponse]
});