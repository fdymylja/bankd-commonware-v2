import { buildQuery } from "../../../../helper-func-types";
import { QueryDenomTraceRequest, QueryDenomTraceResponse, QueryDenomTracesRequest, QueryDenomTracesResponse, QueryParamsRequest, QueryParamsResponse, QueryDenomsRequest, QueryDenomsResponse, QueryDenomRequest, QueryDenomResponse, QueryDenomHashRequest, QueryDenomHashResponse, QueryEscrowAddressRequest, QueryEscrowAddressResponse, QueryTotalEscrowForDenomRequest, QueryTotalEscrowForDenomResponse } from "./query";
/**
 * DenomTrace queries a denomination trace information.
 * @name getDenomTrace
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.DenomTrace
 */
export const getDenomTrace = buildQuery<QueryDenomTraceRequest, QueryDenomTraceResponse>({
  encode: QueryDenomTraceRequest.encode,
  decode: QueryDenomTraceResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "DenomTrace",
  deps: [QueryDenomTraceRequest, QueryDenomTraceResponse]
});
/**
 * DenomTraces queries all denomination traces.
 * @name getDenomTraces
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.DenomTraces
 */
export const getDenomTraces = buildQuery<QueryDenomTracesRequest, QueryDenomTracesResponse>({
  encode: QueryDenomTracesRequest.encode,
  decode: QueryDenomTracesResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "DenomTraces",
  deps: [QueryDenomTracesRequest, QueryDenomTracesResponse]
});
/**
 * Params queries all parameters of the ibc-transfer module.
 * @name getParams
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.Params
 */
export const getParams = buildQuery<QueryParamsRequest, QueryParamsResponse>({
  encode: QueryParamsRequest.encode,
  decode: QueryParamsResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "Params",
  deps: [QueryParamsRequest, QueryParamsResponse]
});
/**
 * Denoms queries all denominations
 * @name getDenoms
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.Denoms
 */
export const getDenoms = buildQuery<QueryDenomsRequest, QueryDenomsResponse>({
  encode: QueryDenomsRequest.encode,
  decode: QueryDenomsResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "Denoms",
  deps: [QueryDenomsRequest, QueryDenomsResponse]
});
/**
 * Denom queries a denomination
 * @name getDenom
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.Denom
 */
export const getDenom = buildQuery<QueryDenomRequest, QueryDenomResponse>({
  encode: QueryDenomRequest.encode,
  decode: QueryDenomResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "Denom",
  deps: [QueryDenomRequest, QueryDenomResponse]
});
/**
 * DenomHash queries a denomination hash information.
 * @name getDenomHash
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.DenomHash
 */
export const getDenomHash = buildQuery<QueryDenomHashRequest, QueryDenomHashResponse>({
  encode: QueryDenomHashRequest.encode,
  decode: QueryDenomHashResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "DenomHash",
  deps: [QueryDenomHashRequest, QueryDenomHashResponse]
});
/**
 * EscrowAddress returns the escrow address for a particular port and channel id.
 * @name getEscrowAddress
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.EscrowAddress
 */
export const getEscrowAddress = buildQuery<QueryEscrowAddressRequest, QueryEscrowAddressResponse>({
  encode: QueryEscrowAddressRequest.encode,
  decode: QueryEscrowAddressResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "EscrowAddress",
  deps: [QueryEscrowAddressRequest, QueryEscrowAddressResponse]
});
/**
 * TotalEscrowForDenom returns the total amount of tokens in escrow based on the denom.
 * @name getTotalEscrowForDenom
 * @package ibc.applications.transfer.v1
 * @see proto service: ibc.applications.transfer.v1.TotalEscrowForDenom
 */
export const getTotalEscrowForDenom = buildQuery<QueryTotalEscrowForDenomRequest, QueryTotalEscrowForDenomResponse>({
  encode: QueryTotalEscrowForDenomRequest.encode,
  decode: QueryTotalEscrowForDenomResponse.decode,
  service: "ibc.applications.transfer.v1.Query",
  method: "TotalEscrowForDenom",
  deps: [QueryTotalEscrowForDenomRequest, QueryTotalEscrowForDenomResponse]
});