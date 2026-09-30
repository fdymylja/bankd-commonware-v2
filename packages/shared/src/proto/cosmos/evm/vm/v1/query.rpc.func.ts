import { MsgEthereumTxResponse } from "./tx";
import { buildQuery } from "../../../../helper-func-types";
import { QueryAccountRequest, QueryAccountResponse, QueryCosmosAccountRequest, QueryCosmosAccountResponse, QueryValidatorAccountRequest, QueryValidatorAccountResponse, QueryBalanceRequest, QueryBalanceResponse, QueryStorageRequest, QueryStorageResponse, QueryCodeRequest, QueryCodeResponse, QueryParamsRequest, QueryParamsResponse, EthCallRequest, EstimateGasResponse, QueryTraceTxRequest, QueryTraceTxResponse, QueryTraceBlockRequest, QueryTraceBlockResponse, QueryTraceCallRequest, QueryTraceCallResponse, QueryBaseFeeRequest, QueryBaseFeeResponse, QueryConfigRequest, QueryConfigResponse, QueryGlobalMinGasPriceRequest, QueryGlobalMinGasPriceResponse } from "./query";
/**
 * Account queries an Ethereum account.
 * @name getAccount
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.Account
 */
export const getAccount = buildQuery<QueryAccountRequest, QueryAccountResponse>({
  encode: QueryAccountRequest.encode,
  decode: QueryAccountResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "Account",
  deps: [QueryAccountRequest, QueryAccountResponse]
});
/**
 * CosmosAccount queries an Ethereum account's Cosmos Address.
 * @name getCosmosAccount
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.CosmosAccount
 */
export const getCosmosAccount = buildQuery<QueryCosmosAccountRequest, QueryCosmosAccountResponse>({
  encode: QueryCosmosAccountRequest.encode,
  decode: QueryCosmosAccountResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "CosmosAccount",
  deps: [QueryCosmosAccountRequest, QueryCosmosAccountResponse]
});
/**
 * ValidatorAccount queries an Ethereum account's from a validator consensus
 * Address.
 * @name getValidatorAccount
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.ValidatorAccount
 */
export const getValidatorAccount = buildQuery<QueryValidatorAccountRequest, QueryValidatorAccountResponse>({
  encode: QueryValidatorAccountRequest.encode,
  decode: QueryValidatorAccountResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "ValidatorAccount",
  deps: [QueryValidatorAccountRequest, QueryValidatorAccountResponse]
});
/**
 * Balance queries the balance of a the EVM denomination for a single
 * account.
 * @name getBalance
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.Balance
 */
export const getBalance = buildQuery<QueryBalanceRequest, QueryBalanceResponse>({
  encode: QueryBalanceRequest.encode,
  decode: QueryBalanceResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "Balance",
  deps: [QueryBalanceRequest, QueryBalanceResponse]
});
/**
 * Storage queries the balance of all coins for a single account.
 * @name getStorage
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.Storage
 */
export const getStorage = buildQuery<QueryStorageRequest, QueryStorageResponse>({
  encode: QueryStorageRequest.encode,
  decode: QueryStorageResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "Storage",
  deps: [QueryStorageRequest, QueryStorageResponse]
});
/**
 * Code queries the balance of all coins for a single account.
 * @name getCode
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.Code
 */
export const getCode = buildQuery<QueryCodeRequest, QueryCodeResponse>({
  encode: QueryCodeRequest.encode,
  decode: QueryCodeResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "Code",
  deps: [QueryCodeRequest, QueryCodeResponse]
});
/**
 * Params queries the parameters of x/vm module.
 * @name getParams
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.Params
 */
export const getParams = buildQuery<QueryParamsRequest, QueryParamsResponse>({
  encode: QueryParamsRequest.encode,
  decode: QueryParamsResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "Params",
  deps: [QueryParamsRequest, QueryParamsResponse]
});
/**
 * EthCall implements the `eth_call` rpc api
 * @name getEthCall
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.EthCall
 */
export const getEthCall = buildQuery<EthCallRequest, MsgEthereumTxResponse>({
  encode: EthCallRequest.encode,
  decode: MsgEthereumTxResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "EthCall",
  deps: [EthCallRequest, MsgEthereumTxResponse]
});
/**
 * EstimateGas implements the `eth_estimateGas` rpc api
 * @name getEstimateGas
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.EstimateGas
 */
export const getEstimateGas = buildQuery<EthCallRequest, EstimateGasResponse>({
  encode: EthCallRequest.encode,
  decode: EstimateGasResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "EstimateGas",
  deps: [EthCallRequest, EstimateGasResponse]
});
/**
 * TraceTx implements the `debug_traceTransaction` rpc api
 * @name getTraceTx
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.TraceTx
 */
export const getTraceTx = buildQuery<QueryTraceTxRequest, QueryTraceTxResponse>({
  encode: QueryTraceTxRequest.encode,
  decode: QueryTraceTxResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "TraceTx",
  deps: [QueryTraceTxRequest, QueryTraceTxResponse]
});
/**
 * TraceBlock implements the `debug_traceBlockByNumber` and
 * `debug_traceBlockByHash` rpc api
 * @name getTraceBlock
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.TraceBlock
 */
export const getTraceBlock = buildQuery<QueryTraceBlockRequest, QueryTraceBlockResponse>({
  encode: QueryTraceBlockRequest.encode,
  decode: QueryTraceBlockResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "TraceBlock",
  deps: [QueryTraceBlockRequest, QueryTraceBlockResponse]
});
/**
 * TraceCall implements the `debug_traceCall` rpc api
 * @name getTraceCall
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.TraceCall
 */
export const getTraceCall = buildQuery<QueryTraceCallRequest, QueryTraceCallResponse>({
  encode: QueryTraceCallRequest.encode,
  decode: QueryTraceCallResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "TraceCall",
  deps: [QueryTraceCallRequest, QueryTraceCallResponse]
});
/**
 * BaseFee queries the base fee of the parent block of the current block,
 * it's similar to feemarket module's method, but also checks london hardfork
 * status.
 * @name getBaseFee
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.BaseFee
 */
export const getBaseFee = buildQuery<QueryBaseFeeRequest, QueryBaseFeeResponse>({
  encode: QueryBaseFeeRequest.encode,
  decode: QueryBaseFeeResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "BaseFee",
  deps: [QueryBaseFeeRequest, QueryBaseFeeResponse]
});
/**
 * Config queries the EVM configuration
 * @name getConfig
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.Config
 */
export const getConfig = buildQuery<QueryConfigRequest, QueryConfigResponse>({
  encode: QueryConfigRequest.encode,
  decode: QueryConfigResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "Config",
  deps: [QueryConfigRequest, QueryConfigResponse]
});
/**
 * GlobalMinGasPrice queries the MinGasPrice
 * it's similar to feemarket module's method,
 * but makes the conversion to 18 decimals
 * when the evm denom is represented with a different precision.
 * @name getGlobalMinGasPrice
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.GlobalMinGasPrice
 */
export const getGlobalMinGasPrice = buildQuery<QueryGlobalMinGasPriceRequest, QueryGlobalMinGasPriceResponse>({
  encode: QueryGlobalMinGasPriceRequest.encode,
  decode: QueryGlobalMinGasPriceResponse.decode,
  service: "cosmos.evm.vm.v1.Query",
  method: "GlobalMinGasPrice",
  deps: [QueryGlobalMinGasPriceRequest, QueryGlobalMinGasPriceResponse]
});