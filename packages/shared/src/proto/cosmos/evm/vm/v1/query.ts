//@ts-nocheck
import { MsgEthereumTx, MsgEthereumTxAmino, MsgEthereumTxSDKType } from "./tx";
import { TraceConfig, TraceConfigAmino, TraceConfigSDKType, ChainConfig, ChainConfigAmino, ChainConfigSDKType, Log, LogAmino, LogSDKType, Params, ParamsAmino, ParamsSDKType } from "./evm";
import { Timestamp } from "../../../../google/protobuf/timestamp";
import { PageRequest, PageRequestAmino, PageRequestSDKType, PageResponse, PageResponseAmino, PageResponseSDKType } from "../../../base/query/v1beta1/pagination";
import { BinaryReader, BinaryWriter } from "../../../../binary";
import { GlobalDecoderRegistry } from "../../../../registry";
import { bytesFromBase64, base64FromBytes, toTimestamp, fromTimestamp } from "../../../../helpers";
/**
 * QueryConfigRequest defines the request type for querying the config
 * @name QueryConfigRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigRequest
 */
export interface QueryConfigRequest {}
export interface QueryConfigRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryConfigRequest";
  value: Uint8Array;
}
/**
 * QueryConfigRequest defines the request type for querying the config
 * @name QueryConfigRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigRequest
 */
export interface QueryConfigRequestAmino {}
export interface QueryConfigRequestAminoMsg {
  type: "cosmos-sdk/QueryConfigRequest";
  value: QueryConfigRequestAmino;
}
/**
 * QueryConfigRequest defines the request type for querying the config
 * @name QueryConfigRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigRequest
 */
export interface QueryConfigRequestSDKType {}
/**
 * QueryConfigResponse returns the EVM config.
 * @name QueryConfigResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigResponse
 */
export interface QueryConfigResponse {
  /**
   * config is the evm configuration
   */
  config?: ChainConfig | undefined;
}
export interface QueryConfigResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryConfigResponse";
  value: Uint8Array;
}
/**
 * QueryConfigResponse returns the EVM config.
 * @name QueryConfigResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigResponse
 */
export interface QueryConfigResponseAmino {
  /**
   * config is the evm configuration
   */
  config?: ChainConfigAmino | undefined;
}
export interface QueryConfigResponseAminoMsg {
  type: "cosmos-sdk/QueryConfigResponse";
  value: QueryConfigResponseAmino;
}
/**
 * QueryConfigResponse returns the EVM config.
 * @name QueryConfigResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigResponse
 */
export interface QueryConfigResponseSDKType {
  config?: ChainConfigSDKType | undefined;
}
/**
 * QueryAccountRequest is the request type for the Query/Account RPC method.
 * @name QueryAccountRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountRequest
 */
export interface QueryAccountRequest {
  /**
   * address is the ethereum hex address to query the account for.
   */
  address: string;
}
export interface QueryAccountRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryAccountRequest";
  value: Uint8Array;
}
/**
 * QueryAccountRequest is the request type for the Query/Account RPC method.
 * @name QueryAccountRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountRequest
 */
export interface QueryAccountRequestAmino {
  /**
   * address is the ethereum hex address to query the account for.
   */
  address?: string;
}
export interface QueryAccountRequestAminoMsg {
  type: "cosmos-sdk/QueryAccountRequest";
  value: QueryAccountRequestAmino;
}
/**
 * QueryAccountRequest is the request type for the Query/Account RPC method.
 * @name QueryAccountRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountRequest
 */
export interface QueryAccountRequestSDKType {
  address: string;
}
/**
 * QueryAccountResponse is the response type for the Query/Account RPC method.
 * @name QueryAccountResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountResponse
 */
export interface QueryAccountResponse {
  /**
   * balance is the balance of the EVM denomination.
   */
  balance: string;
  /**
   * code_hash is the hex-formatted code bytes from the EOA.
   */
  codeHash: string;
  /**
   * nonce is the account's sequence number.
   */
  nonce: bigint;
}
export interface QueryAccountResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryAccountResponse";
  value: Uint8Array;
}
/**
 * QueryAccountResponse is the response type for the Query/Account RPC method.
 * @name QueryAccountResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountResponse
 */
export interface QueryAccountResponseAmino {
  /**
   * balance is the balance of the EVM denomination.
   */
  balance?: string;
  /**
   * code_hash is the hex-formatted code bytes from the EOA.
   */
  code_hash?: string;
  /**
   * nonce is the account's sequence number.
   */
  nonce?: string;
}
export interface QueryAccountResponseAminoMsg {
  type: "cosmos-sdk/QueryAccountResponse";
  value: QueryAccountResponseAmino;
}
/**
 * QueryAccountResponse is the response type for the Query/Account RPC method.
 * @name QueryAccountResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountResponse
 */
export interface QueryAccountResponseSDKType {
  balance: string;
  code_hash: string;
  nonce: bigint;
}
/**
 * QueryCosmosAccountRequest is the request type for the Query/CosmosAccount RPC
 * method.
 * @name QueryCosmosAccountRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountRequest
 */
export interface QueryCosmosAccountRequest {
  /**
   * address is the ethereum hex address to query the account for.
   */
  address: string;
}
export interface QueryCosmosAccountRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryCosmosAccountRequest";
  value: Uint8Array;
}
/**
 * QueryCosmosAccountRequest is the request type for the Query/CosmosAccount RPC
 * method.
 * @name QueryCosmosAccountRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountRequest
 */
export interface QueryCosmosAccountRequestAmino {
  /**
   * address is the ethereum hex address to query the account for.
   */
  address?: string;
}
export interface QueryCosmosAccountRequestAminoMsg {
  type: "cosmos-sdk/QueryCosmosAccountRequest";
  value: QueryCosmosAccountRequestAmino;
}
/**
 * QueryCosmosAccountRequest is the request type for the Query/CosmosAccount RPC
 * method.
 * @name QueryCosmosAccountRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountRequest
 */
export interface QueryCosmosAccountRequestSDKType {
  address: string;
}
/**
 * QueryCosmosAccountResponse is the response type for the Query/CosmosAccount
 * RPC method.
 * @name QueryCosmosAccountResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountResponse
 */
export interface QueryCosmosAccountResponse {
  /**
   * cosmos_address is the cosmos address of the account.
   */
  cosmosAddress: string;
  /**
   * sequence is the account's sequence number.
   */
  sequence: bigint;
  /**
   * account_number is the account number
   */
  accountNumber: bigint;
}
export interface QueryCosmosAccountResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryCosmosAccountResponse";
  value: Uint8Array;
}
/**
 * QueryCosmosAccountResponse is the response type for the Query/CosmosAccount
 * RPC method.
 * @name QueryCosmosAccountResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountResponse
 */
export interface QueryCosmosAccountResponseAmino {
  /**
   * cosmos_address is the cosmos address of the account.
   */
  cosmos_address?: string;
  /**
   * sequence is the account's sequence number.
   */
  sequence?: string;
  /**
   * account_number is the account number
   */
  account_number?: string;
}
export interface QueryCosmosAccountResponseAminoMsg {
  type: "cosmos-sdk/QueryCosmosAccountResponse";
  value: QueryCosmosAccountResponseAmino;
}
/**
 * QueryCosmosAccountResponse is the response type for the Query/CosmosAccount
 * RPC method.
 * @name QueryCosmosAccountResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountResponse
 */
export interface QueryCosmosAccountResponseSDKType {
  cosmos_address: string;
  sequence: bigint;
  account_number: bigint;
}
/**
 * QueryValidatorAccountRequest is the request type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountRequest
 */
export interface QueryValidatorAccountRequest {
  /**
   * cons_address is the validator cons address to query the account for.
   */
  consAddress: string;
}
export interface QueryValidatorAccountRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryValidatorAccountRequest";
  value: Uint8Array;
}
/**
 * QueryValidatorAccountRequest is the request type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountRequest
 */
export interface QueryValidatorAccountRequestAmino {
  /**
   * cons_address is the validator cons address to query the account for.
   */
  cons_address?: string;
}
export interface QueryValidatorAccountRequestAminoMsg {
  type: "cosmos-sdk/QueryValidatorAccountRequest";
  value: QueryValidatorAccountRequestAmino;
}
/**
 * QueryValidatorAccountRequest is the request type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountRequest
 */
export interface QueryValidatorAccountRequestSDKType {
  cons_address: string;
}
/**
 * QueryValidatorAccountResponse is the response type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountResponse
 */
export interface QueryValidatorAccountResponse {
  /**
   * account_address is the cosmos address of the account in bech32 format.
   */
  accountAddress: string;
  /**
   * sequence is the account's sequence number.
   */
  sequence: bigint;
  /**
   * account_number is the account number
   */
  accountNumber: bigint;
}
export interface QueryValidatorAccountResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryValidatorAccountResponse";
  value: Uint8Array;
}
/**
 * QueryValidatorAccountResponse is the response type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountResponse
 */
export interface QueryValidatorAccountResponseAmino {
  /**
   * account_address is the cosmos address of the account in bech32 format.
   */
  account_address?: string;
  /**
   * sequence is the account's sequence number.
   */
  sequence?: string;
  /**
   * account_number is the account number
   */
  account_number?: string;
}
export interface QueryValidatorAccountResponseAminoMsg {
  type: "cosmos-sdk/QueryValidatorAccountResponse";
  value: QueryValidatorAccountResponseAmino;
}
/**
 * QueryValidatorAccountResponse is the response type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountResponse
 */
export interface QueryValidatorAccountResponseSDKType {
  account_address: string;
  sequence: bigint;
  account_number: bigint;
}
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceRequest
 */
export interface QueryBalanceRequest {
  /**
   * address is the ethereum hex address to query the balance for.
   */
  address: string;
}
export interface QueryBalanceRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryBalanceRequest";
  value: Uint8Array;
}
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceRequest
 */
export interface QueryBalanceRequestAmino {
  /**
   * address is the ethereum hex address to query the balance for.
   */
  address?: string;
}
export interface QueryBalanceRequestAminoMsg {
  type: "cosmos-sdk/QueryBalanceRequest";
  value: QueryBalanceRequestAmino;
}
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceRequest
 */
export interface QueryBalanceRequestSDKType {
  address: string;
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceResponse
 */
export interface QueryBalanceResponse {
  /**
   * balance is the balance of the EVM denomination.
   */
  balance: string;
}
export interface QueryBalanceResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryBalanceResponse";
  value: Uint8Array;
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceResponse
 */
export interface QueryBalanceResponseAmino {
  /**
   * balance is the balance of the EVM denomination.
   */
  balance?: string;
}
export interface QueryBalanceResponseAminoMsg {
  type: "cosmos-sdk/QueryBalanceResponse";
  value: QueryBalanceResponseAmino;
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceResponse
 */
export interface QueryBalanceResponseSDKType {
  balance: string;
}
/**
 * QueryStorageRequest is the request type for the Query/Storage RPC method.
 * @name QueryStorageRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageRequest
 */
export interface QueryStorageRequest {
  /**
   * address is the ethereum hex address to query the storage state for.
   */
  address: string;
  /**
   * key defines the key of the storage state
   */
  key: string;
}
export interface QueryStorageRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryStorageRequest";
  value: Uint8Array;
}
/**
 * QueryStorageRequest is the request type for the Query/Storage RPC method.
 * @name QueryStorageRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageRequest
 */
export interface QueryStorageRequestAmino {
  /**
   * address is the ethereum hex address to query the storage state for.
   */
  address?: string;
  /**
   * key defines the key of the storage state
   */
  key?: string;
}
export interface QueryStorageRequestAminoMsg {
  type: "cosmos-sdk/QueryStorageRequest";
  value: QueryStorageRequestAmino;
}
/**
 * QueryStorageRequest is the request type for the Query/Storage RPC method.
 * @name QueryStorageRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageRequest
 */
export interface QueryStorageRequestSDKType {
  address: string;
  key: string;
}
/**
 * QueryStorageResponse is the response type for the Query/Storage RPC
 * method.
 * @name QueryStorageResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageResponse
 */
export interface QueryStorageResponse {
  /**
   * value defines the storage state value hash associated with the given key.
   */
  value: string;
}
export interface QueryStorageResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryStorageResponse";
  value: Uint8Array;
}
/**
 * QueryStorageResponse is the response type for the Query/Storage RPC
 * method.
 * @name QueryStorageResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageResponse
 */
export interface QueryStorageResponseAmino {
  /**
   * value defines the storage state value hash associated with the given key.
   */
  value?: string;
}
export interface QueryStorageResponseAminoMsg {
  type: "cosmos-sdk/QueryStorageResponse";
  value: QueryStorageResponseAmino;
}
/**
 * QueryStorageResponse is the response type for the Query/Storage RPC
 * method.
 * @name QueryStorageResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageResponse
 */
export interface QueryStorageResponseSDKType {
  value: string;
}
/**
 * QueryCodeRequest is the request type for the Query/Code RPC method.
 * @name QueryCodeRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeRequest
 */
export interface QueryCodeRequest {
  /**
   * address is the ethereum hex address to query the code for.
   */
  address: string;
}
export interface QueryCodeRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryCodeRequest";
  value: Uint8Array;
}
/**
 * QueryCodeRequest is the request type for the Query/Code RPC method.
 * @name QueryCodeRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeRequest
 */
export interface QueryCodeRequestAmino {
  /**
   * address is the ethereum hex address to query the code for.
   */
  address?: string;
}
export interface QueryCodeRequestAminoMsg {
  type: "cosmos-sdk/QueryCodeRequest";
  value: QueryCodeRequestAmino;
}
/**
 * QueryCodeRequest is the request type for the Query/Code RPC method.
 * @name QueryCodeRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeRequest
 */
export interface QueryCodeRequestSDKType {
  address: string;
}
/**
 * QueryCodeResponse is the response type for the Query/Code RPC
 * method.
 * @name QueryCodeResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeResponse
 */
export interface QueryCodeResponse {
  /**
   * code represents the code bytes from an ethereum address.
   */
  code: Uint8Array;
}
export interface QueryCodeResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryCodeResponse";
  value: Uint8Array;
}
/**
 * QueryCodeResponse is the response type for the Query/Code RPC
 * method.
 * @name QueryCodeResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeResponse
 */
export interface QueryCodeResponseAmino {
  /**
   * code represents the code bytes from an ethereum address.
   */
  code?: string;
}
export interface QueryCodeResponseAminoMsg {
  type: "cosmos-sdk/QueryCodeResponse";
  value: QueryCodeResponseAmino;
}
/**
 * QueryCodeResponse is the response type for the Query/Code RPC
 * method.
 * @name QueryCodeResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeResponse
 */
export interface QueryCodeResponseSDKType {
  code: Uint8Array;
}
/**
 * QueryTxLogsRequest is the request type for the Query/TxLogs RPC method.
 * @name QueryTxLogsRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsRequest
 */
export interface QueryTxLogsRequest {
  /**
   * hash is the ethereum transaction hex hash to query the logs for.
   */
  hash: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequest | undefined;
}
export interface QueryTxLogsRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTxLogsRequest";
  value: Uint8Array;
}
/**
 * QueryTxLogsRequest is the request type for the Query/TxLogs RPC method.
 * @name QueryTxLogsRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsRequest
 */
export interface QueryTxLogsRequestAmino {
  /**
   * hash is the ethereum transaction hex hash to query the logs for.
   */
  hash?: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequestAmino | undefined;
}
export interface QueryTxLogsRequestAminoMsg {
  type: "cosmos-sdk/QueryTxLogsRequest";
  value: QueryTxLogsRequestAmino;
}
/**
 * QueryTxLogsRequest is the request type for the Query/TxLogs RPC method.
 * @name QueryTxLogsRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsRequest
 */
export interface QueryTxLogsRequestSDKType {
  hash: string;
  pagination?: PageRequestSDKType | undefined;
}
/**
 * QueryTxLogsResponse is the response type for the Query/TxLogs RPC method.
 * @name QueryTxLogsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsResponse
 */
export interface QueryTxLogsResponse {
  /**
   * logs represents the ethereum logs generated from the given transaction.
   */
  logs: Log[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponse | undefined;
}
export interface QueryTxLogsResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTxLogsResponse";
  value: Uint8Array;
}
/**
 * QueryTxLogsResponse is the response type for the Query/TxLogs RPC method.
 * @name QueryTxLogsResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsResponse
 */
export interface QueryTxLogsResponseAmino {
  /**
   * logs represents the ethereum logs generated from the given transaction.
   */
  logs?: LogAmino[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QueryTxLogsResponseAminoMsg {
  type: "cosmos-sdk/QueryTxLogsResponse";
  value: QueryTxLogsResponseAmino;
}
/**
 * QueryTxLogsResponse is the response type for the Query/TxLogs RPC method.
 * @name QueryTxLogsResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsResponse
 */
export interface QueryTxLogsResponseSDKType {
  logs: LogSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
/**
 * QueryParamsRequest defines the request type for querying x/vm parameters.
 * @name QueryParamsRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsRequest
 */
export interface QueryParamsRequest {}
export interface QueryParamsRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryParamsRequest";
  value: Uint8Array;
}
/**
 * QueryParamsRequest defines the request type for querying x/vm parameters.
 * @name QueryParamsRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsRequest
 */
export interface QueryParamsRequestAmino {}
export interface QueryParamsRequestAminoMsg {
  type: "cosmos-sdk/QueryParamsRequest";
  value: QueryParamsRequestAmino;
}
/**
 * QueryParamsRequest defines the request type for querying x/vm parameters.
 * @name QueryParamsRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsRequest
 */
export interface QueryParamsRequestSDKType {}
/**
 * QueryParamsResponse defines the response type for querying x/vm parameters.
 * @name QueryParamsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsResponse
 */
export interface QueryParamsResponse {
  /**
   * params define the evm module parameters.
   */
  params: Params | undefined;
}
export interface QueryParamsResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryParamsResponse";
  value: Uint8Array;
}
/**
 * QueryParamsResponse defines the response type for querying x/vm parameters.
 * @name QueryParamsResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsResponse
 */
export interface QueryParamsResponseAmino {
  /**
   * params define the evm module parameters.
   */
  params: ParamsAmino | undefined;
}
export interface QueryParamsResponseAminoMsg {
  type: "cosmos-sdk/QueryParamsResponse";
  value: QueryParamsResponseAmino;
}
/**
 * QueryParamsResponse defines the response type for querying x/vm parameters.
 * @name QueryParamsResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsResponse
 */
export interface QueryParamsResponseSDKType {
  params: ParamsSDKType | undefined;
}
/**
 * EthCallRequest defines EthCall request
 * @name EthCallRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EthCallRequest
 */
export interface EthCallRequest {
  /**
   * args uses the same json format as the json rpc api.
   */
  args: Uint8Array;
  /**
   * gas_cap defines the default gas cap to be used
   */
  gasCap: bigint;
  /**
   * proposer_address of the requested block in hex format
   */
  proposerAddress: Uint8Array;
  /**
   * chain_id is the eip155 chain id parsed from the requested block header
   */
  chainId: bigint;
  /**
   * state overrides encoded as json
   */
  overrides: Uint8Array;
}
export interface EthCallRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.EthCallRequest";
  value: Uint8Array;
}
/**
 * EthCallRequest defines EthCall request
 * @name EthCallRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EthCallRequest
 */
export interface EthCallRequestAmino {
  /**
   * args uses the same json format as the json rpc api.
   */
  args?: string;
  /**
   * gas_cap defines the default gas cap to be used
   */
  gas_cap?: string;
  /**
   * proposer_address of the requested block in hex format
   */
  proposer_address?: string;
  /**
   * chain_id is the eip155 chain id parsed from the requested block header
   */
  chain_id?: string;
  /**
   * state overrides encoded as json
   */
  overrides?: string;
}
export interface EthCallRequestAminoMsg {
  type: "cosmos-sdk/EthCallRequest";
  value: EthCallRequestAmino;
}
/**
 * EthCallRequest defines EthCall request
 * @name EthCallRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EthCallRequest
 */
export interface EthCallRequestSDKType {
  args: Uint8Array;
  gas_cap: bigint;
  proposer_address: Uint8Array;
  chain_id: bigint;
  overrides: Uint8Array;
}
/**
 * EstimateGasResponse defines EstimateGas response
 * @name EstimateGasResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EstimateGasResponse
 */
export interface EstimateGasResponse {
  /**
   * gas returns the estimated gas
   */
  gas: bigint;
  /**
   * ret is the returned data from evm function (result or data supplied with
   * revert opcode)
   */
  ret: Uint8Array;
  /**
   * vm_error is the error returned by vm execution
   */
  vmError: string;
}
export interface EstimateGasResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.EstimateGasResponse";
  value: Uint8Array;
}
/**
 * EstimateGasResponse defines EstimateGas response
 * @name EstimateGasResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EstimateGasResponse
 */
export interface EstimateGasResponseAmino {
  /**
   * gas returns the estimated gas
   */
  gas?: string;
  /**
   * ret is the returned data from evm function (result or data supplied with
   * revert opcode)
   */
  ret?: string;
  /**
   * vm_error is the error returned by vm execution
   */
  vm_error?: string;
}
export interface EstimateGasResponseAminoMsg {
  type: "cosmos-sdk/EstimateGasResponse";
  value: EstimateGasResponseAmino;
}
/**
 * EstimateGasResponse defines EstimateGas response
 * @name EstimateGasResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EstimateGasResponse
 */
export interface EstimateGasResponseSDKType {
  gas: bigint;
  ret: Uint8Array;
  vm_error: string;
}
/**
 * QueryTraceTxRequest defines TraceTx request
 * @name QueryTraceTxRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxRequest
 */
export interface QueryTraceTxRequest {
  /**
   * msg is the MsgEthereumTx for the requested transaction
   */
  msg?: MsgEthereumTx | undefined;
  /**
   * trace_config holds extra parameters to trace functions.
   */
  traceConfig?: TraceConfig | undefined;
  /**
   * predecessors is an array of transactions included in the same block
   * need to be replayed first to get correct context for tracing.
   */
  predecessors: MsgEthereumTx[];
  /**
   * block_number of requested transaction
   */
  blockNumber: bigint;
  /**
   * block_hash of requested transaction
   */
  blockHash: string;
  /**
   * block_time of requested transaction
   */
  blockTime: Date | undefined;
  /**
   * proposer_address is the proposer of the requested block
   */
  proposerAddress: Uint8Array;
  /**
   * chain_id is the eip155 chain id parsed from the requested block header
   */
  chainId: bigint;
  /**
   * block_max_gas of the block of the requested transaction
   */
  blockMaxGas: bigint;
}
export interface QueryTraceTxRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceTxRequest";
  value: Uint8Array;
}
/**
 * QueryTraceTxRequest defines TraceTx request
 * @name QueryTraceTxRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxRequest
 */
export interface QueryTraceTxRequestAmino {
  /**
   * msg is the MsgEthereumTx for the requested transaction
   */
  msg?: MsgEthereumTxAmino | undefined;
  /**
   * trace_config holds extra parameters to trace functions.
   */
  trace_config?: TraceConfigAmino | undefined;
  /**
   * predecessors is an array of transactions included in the same block
   * need to be replayed first to get correct context for tracing.
   */
  predecessors?: MsgEthereumTxAmino[];
  /**
   * block_number of requested transaction
   */
  block_number?: string;
  /**
   * block_hash of requested transaction
   */
  block_hash?: string;
  /**
   * block_time of requested transaction
   */
  block_time: string | undefined;
  /**
   * proposer_address is the proposer of the requested block
   */
  proposer_address?: string;
  /**
   * chain_id is the eip155 chain id parsed from the requested block header
   */
  chain_id?: string;
  /**
   * block_max_gas of the block of the requested transaction
   */
  block_max_gas?: string;
}
export interface QueryTraceTxRequestAminoMsg {
  type: "cosmos-sdk/QueryTraceTxRequest";
  value: QueryTraceTxRequestAmino;
}
/**
 * QueryTraceTxRequest defines TraceTx request
 * @name QueryTraceTxRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxRequest
 */
export interface QueryTraceTxRequestSDKType {
  msg?: MsgEthereumTxSDKType | undefined;
  trace_config?: TraceConfigSDKType | undefined;
  predecessors: MsgEthereumTxSDKType[];
  block_number: bigint;
  block_hash: string;
  block_time: Date | undefined;
  proposer_address: Uint8Array;
  chain_id: bigint;
  block_max_gas: bigint;
}
/**
 * QueryTraceTxResponse defines TraceTx response
 * @name QueryTraceTxResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxResponse
 */
export interface QueryTraceTxResponse {
  /**
   * data is the response serialized in bytes
   */
  data: Uint8Array;
}
export interface QueryTraceTxResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceTxResponse";
  value: Uint8Array;
}
/**
 * QueryTraceTxResponse defines TraceTx response
 * @name QueryTraceTxResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxResponse
 */
export interface QueryTraceTxResponseAmino {
  /**
   * data is the response serialized in bytes
   */
  data?: string;
}
export interface QueryTraceTxResponseAminoMsg {
  type: "cosmos-sdk/QueryTraceTxResponse";
  value: QueryTraceTxResponseAmino;
}
/**
 * QueryTraceTxResponse defines TraceTx response
 * @name QueryTraceTxResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxResponse
 */
export interface QueryTraceTxResponseSDKType {
  data: Uint8Array;
}
/**
 * QueryTraceBlockRequest defines TraceTx request
 * @name QueryTraceBlockRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockRequest
 */
export interface QueryTraceBlockRequest {
  /**
   * txs is an array of messages in the block
   */
  txs: MsgEthereumTx[];
  /**
   * trace_config holds extra parameters to trace functions.
   */
  traceConfig?: TraceConfig | undefined;
  /**
   * block_number of the traced block
   */
  blockNumber: bigint;
  /**
   * block_hash (hex) of the traced block
   */
  blockHash: string;
  /**
   * block_time of the traced block
   */
  blockTime: Date | undefined;
  /**
   * proposer_address is the address of the requested block
   */
  proposerAddress: Uint8Array;
  /**
   * chain_id is the eip155 chain id parsed from the requested block header
   */
  chainId: bigint;
  /**
   * block_max_gas of the traced block
   */
  blockMaxGas: bigint;
}
export interface QueryTraceBlockRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceBlockRequest";
  value: Uint8Array;
}
/**
 * QueryTraceBlockRequest defines TraceTx request
 * @name QueryTraceBlockRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockRequest
 */
export interface QueryTraceBlockRequestAmino {
  /**
   * txs is an array of messages in the block
   */
  txs?: MsgEthereumTxAmino[];
  /**
   * trace_config holds extra parameters to trace functions.
   */
  trace_config?: TraceConfigAmino | undefined;
  /**
   * block_number of the traced block
   */
  block_number?: string;
  /**
   * block_hash (hex) of the traced block
   */
  block_hash?: string;
  /**
   * block_time of the traced block
   */
  block_time: string | undefined;
  /**
   * proposer_address is the address of the requested block
   */
  proposer_address?: string;
  /**
   * chain_id is the eip155 chain id parsed from the requested block header
   */
  chain_id?: string;
  /**
   * block_max_gas of the traced block
   */
  block_max_gas?: string;
}
export interface QueryTraceBlockRequestAminoMsg {
  type: "cosmos-sdk/QueryTraceBlockRequest";
  value: QueryTraceBlockRequestAmino;
}
/**
 * QueryTraceBlockRequest defines TraceTx request
 * @name QueryTraceBlockRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockRequest
 */
export interface QueryTraceBlockRequestSDKType {
  txs: MsgEthereumTxSDKType[];
  trace_config?: TraceConfigSDKType | undefined;
  block_number: bigint;
  block_hash: string;
  block_time: Date | undefined;
  proposer_address: Uint8Array;
  chain_id: bigint;
  block_max_gas: bigint;
}
/**
 * QueryTraceBlockResponse defines TraceBlock response
 * @name QueryTraceBlockResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockResponse
 */
export interface QueryTraceBlockResponse {
  /**
   * data is the response serialized in bytes
   */
  data: Uint8Array;
}
export interface QueryTraceBlockResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceBlockResponse";
  value: Uint8Array;
}
/**
 * QueryTraceBlockResponse defines TraceBlock response
 * @name QueryTraceBlockResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockResponse
 */
export interface QueryTraceBlockResponseAmino {
  /**
   * data is the response serialized in bytes
   */
  data?: string;
}
export interface QueryTraceBlockResponseAminoMsg {
  type: "cosmos-sdk/QueryTraceBlockResponse";
  value: QueryTraceBlockResponseAmino;
}
/**
 * QueryTraceBlockResponse defines TraceBlock response
 * @name QueryTraceBlockResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockResponse
 */
export interface QueryTraceBlockResponseSDKType {
  data: Uint8Array;
}
/**
 * QueryTraceCallRequest defines TraceCall request
 * @name QueryTraceCallRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallRequest
 */
export interface QueryTraceCallRequest {
  /**
   * args uses the same json format as the json rpc api.
   */
  args: Uint8Array;
  /**
   * gas_cap defines the default gas cap to be used
   */
  gasCap: bigint;
  /**
   * proposer_address of the requested block in hex format
   */
  proposerAddress: Uint8Array;
  /**
   * trace_config holds extra parameters to trace functions.
   */
  traceConfig?: TraceConfig | undefined;
  /**
   * block_number of requested transaction
   */
  blockNumber: bigint;
  /**
   * block_hash of requested transaction
   */
  blockHash: string;
  /**
   * block_time of requested transaction
   */
  blockTime: Date | undefined;
  /**
   * chain_id is the the eip155 chain id parsed from the requested block header
   */
  chainId: bigint;
}
export interface QueryTraceCallRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceCallRequest";
  value: Uint8Array;
}
/**
 * QueryTraceCallRequest defines TraceCall request
 * @name QueryTraceCallRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallRequest
 */
export interface QueryTraceCallRequestAmino {
  /**
   * args uses the same json format as the json rpc api.
   */
  args?: string;
  /**
   * gas_cap defines the default gas cap to be used
   */
  gas_cap?: string;
  /**
   * proposer_address of the requested block in hex format
   */
  proposer_address?: string;
  /**
   * trace_config holds extra parameters to trace functions.
   */
  trace_config?: TraceConfigAmino | undefined;
  /**
   * block_number of requested transaction
   */
  block_number?: string;
  /**
   * block_hash of requested transaction
   */
  block_hash?: string;
  /**
   * block_time of requested transaction
   */
  block_time?: string | undefined;
  /**
   * chain_id is the the eip155 chain id parsed from the requested block header
   */
  chain_id?: string;
}
export interface QueryTraceCallRequestAminoMsg {
  type: "cosmos-sdk/QueryTraceCallRequest";
  value: QueryTraceCallRequestAmino;
}
/**
 * QueryTraceCallRequest defines TraceCall request
 * @name QueryTraceCallRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallRequest
 */
export interface QueryTraceCallRequestSDKType {
  args: Uint8Array;
  gas_cap: bigint;
  proposer_address: Uint8Array;
  trace_config?: TraceConfigSDKType | undefined;
  block_number: bigint;
  block_hash: string;
  block_time: Date | undefined;
  chain_id: bigint;
}
/**
 * QueryTraceCallResponse defines TraceCall response
 * @name QueryTraceCallResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallResponse
 */
export interface QueryTraceCallResponse {
  /**
   * data is the response serialized in bytes
   */
  data: Uint8Array;
}
export interface QueryTraceCallResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceCallResponse";
  value: Uint8Array;
}
/**
 * QueryTraceCallResponse defines TraceCall response
 * @name QueryTraceCallResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallResponse
 */
export interface QueryTraceCallResponseAmino {
  /**
   * data is the response serialized in bytes
   */
  data?: string;
}
export interface QueryTraceCallResponseAminoMsg {
  type: "cosmos-sdk/QueryTraceCallResponse";
  value: QueryTraceCallResponseAmino;
}
/**
 * QueryTraceCallResponse defines TraceCall response
 * @name QueryTraceCallResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallResponse
 */
export interface QueryTraceCallResponseSDKType {
  data: Uint8Array;
}
/**
 * QueryBaseFeeRequest defines the request type for querying the EIP1559 base
 * fee.
 * @name QueryBaseFeeRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeRequest
 */
export interface QueryBaseFeeRequest {}
export interface QueryBaseFeeRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryBaseFeeRequest";
  value: Uint8Array;
}
/**
 * QueryBaseFeeRequest defines the request type for querying the EIP1559 base
 * fee.
 * @name QueryBaseFeeRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeRequest
 */
export interface QueryBaseFeeRequestAmino {}
export interface QueryBaseFeeRequestAminoMsg {
  type: "cosmos-sdk/QueryBaseFeeRequest";
  value: QueryBaseFeeRequestAmino;
}
/**
 * QueryBaseFeeRequest defines the request type for querying the EIP1559 base
 * fee.
 * @name QueryBaseFeeRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeRequest
 */
export interface QueryBaseFeeRequestSDKType {}
/**
 * QueryBaseFeeResponse returns the EIP1559 base fee.
 * @name QueryBaseFeeResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeResponse
 */
export interface QueryBaseFeeResponse {
  /**
   * base_fee is the EIP1559 base fee
   */
  baseFee: string;
}
export interface QueryBaseFeeResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryBaseFeeResponse";
  value: Uint8Array;
}
/**
 * QueryBaseFeeResponse returns the EIP1559 base fee.
 * @name QueryBaseFeeResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeResponse
 */
export interface QueryBaseFeeResponseAmino {
  /**
   * base_fee is the EIP1559 base fee
   */
  base_fee?: string;
}
export interface QueryBaseFeeResponseAminoMsg {
  type: "cosmos-sdk/QueryBaseFeeResponse";
  value: QueryBaseFeeResponseAmino;
}
/**
 * QueryBaseFeeResponse returns the EIP1559 base fee.
 * @name QueryBaseFeeResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeResponse
 */
export interface QueryBaseFeeResponseSDKType {
  base_fee: string;
}
/**
 * QueryGlobalMinGasPriceRequest defines the request type for querying the
 * GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceRequest
 */
export interface QueryGlobalMinGasPriceRequest {}
export interface QueryGlobalMinGasPriceRequestProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryGlobalMinGasPriceRequest";
  value: Uint8Array;
}
/**
 * QueryGlobalMinGasPriceRequest defines the request type for querying the
 * GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceRequestAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceRequest
 */
export interface QueryGlobalMinGasPriceRequestAmino {}
export interface QueryGlobalMinGasPriceRequestAminoMsg {
  type: "cosmos-sdk/QueryGlobalMinGasPriceRequest";
  value: QueryGlobalMinGasPriceRequestAmino;
}
/**
 * QueryGlobalMinGasPriceRequest defines the request type for querying the
 * GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceRequestSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceRequest
 */
export interface QueryGlobalMinGasPriceRequestSDKType {}
/**
 * QueryGlobalMinGasPriceResponse returns the GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceResponse
 */
export interface QueryGlobalMinGasPriceResponse {
  /**
   * min_gas_price is the feemarket's min_gas_price
   */
  minGasPrice: string;
}
export interface QueryGlobalMinGasPriceResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.QueryGlobalMinGasPriceResponse";
  value: Uint8Array;
}
/**
 * QueryGlobalMinGasPriceResponse returns the GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceResponse
 */
export interface QueryGlobalMinGasPriceResponseAmino {
  /**
   * min_gas_price is the feemarket's min_gas_price
   */
  min_gas_price?: string;
}
export interface QueryGlobalMinGasPriceResponseAminoMsg {
  type: "cosmos-sdk/QueryGlobalMinGasPriceResponse";
  value: QueryGlobalMinGasPriceResponseAmino;
}
/**
 * QueryGlobalMinGasPriceResponse returns the GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceResponse
 */
export interface QueryGlobalMinGasPriceResponseSDKType {
  min_gas_price: string;
}
function createBaseQueryConfigRequest(): QueryConfigRequest {
  return {};
}
/**
 * QueryConfigRequest defines the request type for querying the config
 * @name QueryConfigRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigRequest
 */
export const QueryConfigRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryConfigRequest",
  aminoType: "cosmos-sdk/QueryConfigRequest",
  is(o: any): o is QueryConfigRequest {
    return o && o.$typeUrl === QueryConfigRequest.typeUrl;
  },
  isSDK(o: any): o is QueryConfigRequestSDKType {
    return o && o.$typeUrl === QueryConfigRequest.typeUrl;
  },
  isAmino(o: any): o is QueryConfigRequestAmino {
    return o && o.$typeUrl === QueryConfigRequest.typeUrl;
  },
  encode(_: QueryConfigRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryConfigRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConfigRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(_: Partial<QueryConfigRequest>): QueryConfigRequest {
    const message = createBaseQueryConfigRequest();
    return message;
  },
  fromAmino(_: QueryConfigRequestAmino): QueryConfigRequest {
    const message = createBaseQueryConfigRequest();
    return message;
  },
  toAmino(_: QueryConfigRequest, useInterfaces: boolean = false): QueryConfigRequestAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: QueryConfigRequestAminoMsg): QueryConfigRequest {
    return QueryConfigRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryConfigRequest, useInterfaces: boolean = false): QueryConfigRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryConfigRequest",
      value: QueryConfigRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryConfigRequestProtoMsg, useInterfaces: boolean = false): QueryConfigRequest {
    return QueryConfigRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryConfigRequest): Uint8Array {
    return QueryConfigRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryConfigRequest): QueryConfigRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryConfigRequest",
      value: QueryConfigRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryConfigResponse(): QueryConfigResponse {
  return {
    config: undefined
  };
}
/**
 * QueryConfigResponse returns the EVM config.
 * @name QueryConfigResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryConfigResponse
 */
export const QueryConfigResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryConfigResponse",
  aminoType: "cosmos-sdk/QueryConfigResponse",
  is(o: any): o is QueryConfigResponse {
    return o && o.$typeUrl === QueryConfigResponse.typeUrl;
  },
  isSDK(o: any): o is QueryConfigResponseSDKType {
    return o && o.$typeUrl === QueryConfigResponse.typeUrl;
  },
  isAmino(o: any): o is QueryConfigResponseAmino {
    return o && o.$typeUrl === QueryConfigResponse.typeUrl;
  },
  encode(message: QueryConfigResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.config !== undefined) {
      ChainConfig.encode(message.config, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryConfigResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConfigResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.config = ChainConfig.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryConfigResponse>): QueryConfigResponse {
    const message = createBaseQueryConfigResponse();
    message.config = object.config !== undefined && object.config !== null ? ChainConfig.fromPartial(object.config) : undefined;
    return message;
  },
  fromAmino(object: QueryConfigResponseAmino): QueryConfigResponse {
    const message = createBaseQueryConfigResponse();
    if (object.config !== undefined && object.config !== null) {
      message.config = ChainConfig.fromAmino(object.config);
    }
    return message;
  },
  toAmino(message: QueryConfigResponse, useInterfaces: boolean = false): QueryConfigResponseAmino {
    const obj: any = {};
    obj.config = message.config ? ChainConfig.toAmino(message.config, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryConfigResponseAminoMsg): QueryConfigResponse {
    return QueryConfigResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryConfigResponse, useInterfaces: boolean = false): QueryConfigResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryConfigResponse",
      value: QueryConfigResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryConfigResponseProtoMsg, useInterfaces: boolean = false): QueryConfigResponse {
    return QueryConfigResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryConfigResponse): Uint8Array {
    return QueryConfigResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryConfigResponse): QueryConfigResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryConfigResponse",
      value: QueryConfigResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryConfigResponse.typeUrl)) {
      return;
    }
    ChainConfig.registerTypeUrl();
  }
};
function createBaseQueryAccountRequest(): QueryAccountRequest {
  return {
    address: ""
  };
}
/**
 * QueryAccountRequest is the request type for the Query/Account RPC method.
 * @name QueryAccountRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountRequest
 */
export const QueryAccountRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryAccountRequest",
  aminoType: "cosmos-sdk/QueryAccountRequest",
  is(o: any): o is QueryAccountRequest {
    return o && (o.$typeUrl === QueryAccountRequest.typeUrl || typeof o.address === "string");
  },
  isSDK(o: any): o is QueryAccountRequestSDKType {
    return o && (o.$typeUrl === QueryAccountRequest.typeUrl || typeof o.address === "string");
  },
  isAmino(o: any): o is QueryAccountRequestAmino {
    return o && (o.$typeUrl === QueryAccountRequest.typeUrl || typeof o.address === "string");
  },
  encode(message: QueryAccountRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAccountRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAccountRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryAccountRequest>): QueryAccountRequest {
    const message = createBaseQueryAccountRequest();
    message.address = object.address ?? "";
    return message;
  },
  fromAmino(object: QueryAccountRequestAmino): QueryAccountRequest {
    const message = createBaseQueryAccountRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    return message;
  },
  toAmino(message: QueryAccountRequest, useInterfaces: boolean = false): QueryAccountRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    return obj;
  },
  fromAminoMsg(object: QueryAccountRequestAminoMsg): QueryAccountRequest {
    return QueryAccountRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryAccountRequest, useInterfaces: boolean = false): QueryAccountRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryAccountRequest",
      value: QueryAccountRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryAccountRequestProtoMsg, useInterfaces: boolean = false): QueryAccountRequest {
    return QueryAccountRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAccountRequest): Uint8Array {
    return QueryAccountRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryAccountRequest): QueryAccountRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryAccountRequest",
      value: QueryAccountRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryAccountResponse(): QueryAccountResponse {
  return {
    balance: "",
    codeHash: "",
    nonce: BigInt(0)
  };
}
/**
 * QueryAccountResponse is the response type for the Query/Account RPC method.
 * @name QueryAccountResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryAccountResponse
 */
export const QueryAccountResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryAccountResponse",
  aminoType: "cosmos-sdk/QueryAccountResponse",
  is(o: any): o is QueryAccountResponse {
    return o && (o.$typeUrl === QueryAccountResponse.typeUrl || typeof o.balance === "string" && typeof o.codeHash === "string" && typeof o.nonce === "bigint");
  },
  isSDK(o: any): o is QueryAccountResponseSDKType {
    return o && (o.$typeUrl === QueryAccountResponse.typeUrl || typeof o.balance === "string" && typeof o.code_hash === "string" && typeof o.nonce === "bigint");
  },
  isAmino(o: any): o is QueryAccountResponseAmino {
    return o && (o.$typeUrl === QueryAccountResponse.typeUrl || typeof o.balance === "string" && typeof o.code_hash === "string" && typeof o.nonce === "bigint");
  },
  encode(message: QueryAccountResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.balance !== "") {
      writer.uint32(10).string(message.balance);
    }
    if (message.codeHash !== "") {
      writer.uint32(18).string(message.codeHash);
    }
    if (message.nonce !== BigInt(0)) {
      writer.uint32(24).uint64(message.nonce);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAccountResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAccountResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.balance = reader.string();
          break;
        case 2:
          message.codeHash = reader.string();
          break;
        case 3:
          message.nonce = reader.uint64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryAccountResponse>): QueryAccountResponse {
    const message = createBaseQueryAccountResponse();
    message.balance = object.balance ?? "";
    message.codeHash = object.codeHash ?? "";
    message.nonce = object.nonce !== undefined && object.nonce !== null ? BigInt(object.nonce.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: QueryAccountResponseAmino): QueryAccountResponse {
    const message = createBaseQueryAccountResponse();
    if (object.balance !== undefined && object.balance !== null) {
      message.balance = object.balance;
    }
    if (object.code_hash !== undefined && object.code_hash !== null) {
      message.codeHash = object.code_hash;
    }
    if (object.nonce !== undefined && object.nonce !== null) {
      message.nonce = BigInt(object.nonce);
    }
    return message;
  },
  toAmino(message: QueryAccountResponse, useInterfaces: boolean = false): QueryAccountResponseAmino {
    const obj: any = {};
    obj.balance = message.balance === "" ? undefined : message.balance;
    obj.code_hash = message.codeHash === "" ? undefined : message.codeHash;
    obj.nonce = message.nonce !== BigInt(0) ? message.nonce?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryAccountResponseAminoMsg): QueryAccountResponse {
    return QueryAccountResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryAccountResponse, useInterfaces: boolean = false): QueryAccountResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryAccountResponse",
      value: QueryAccountResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryAccountResponseProtoMsg, useInterfaces: boolean = false): QueryAccountResponse {
    return QueryAccountResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAccountResponse): Uint8Array {
    return QueryAccountResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryAccountResponse): QueryAccountResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryAccountResponse",
      value: QueryAccountResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryCosmosAccountRequest(): QueryCosmosAccountRequest {
  return {
    address: ""
  };
}
/**
 * QueryCosmosAccountRequest is the request type for the Query/CosmosAccount RPC
 * method.
 * @name QueryCosmosAccountRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountRequest
 */
export const QueryCosmosAccountRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryCosmosAccountRequest",
  aminoType: "cosmos-sdk/QueryCosmosAccountRequest",
  is(o: any): o is QueryCosmosAccountRequest {
    return o && (o.$typeUrl === QueryCosmosAccountRequest.typeUrl || typeof o.address === "string");
  },
  isSDK(o: any): o is QueryCosmosAccountRequestSDKType {
    return o && (o.$typeUrl === QueryCosmosAccountRequest.typeUrl || typeof o.address === "string");
  },
  isAmino(o: any): o is QueryCosmosAccountRequestAmino {
    return o && (o.$typeUrl === QueryCosmosAccountRequest.typeUrl || typeof o.address === "string");
  },
  encode(message: QueryCosmosAccountRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryCosmosAccountRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryCosmosAccountRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryCosmosAccountRequest>): QueryCosmosAccountRequest {
    const message = createBaseQueryCosmosAccountRequest();
    message.address = object.address ?? "";
    return message;
  },
  fromAmino(object: QueryCosmosAccountRequestAmino): QueryCosmosAccountRequest {
    const message = createBaseQueryCosmosAccountRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    return message;
  },
  toAmino(message: QueryCosmosAccountRequest, useInterfaces: boolean = false): QueryCosmosAccountRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    return obj;
  },
  fromAminoMsg(object: QueryCosmosAccountRequestAminoMsg): QueryCosmosAccountRequest {
    return QueryCosmosAccountRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryCosmosAccountRequest, useInterfaces: boolean = false): QueryCosmosAccountRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryCosmosAccountRequest",
      value: QueryCosmosAccountRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryCosmosAccountRequestProtoMsg, useInterfaces: boolean = false): QueryCosmosAccountRequest {
    return QueryCosmosAccountRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryCosmosAccountRequest): Uint8Array {
    return QueryCosmosAccountRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryCosmosAccountRequest): QueryCosmosAccountRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryCosmosAccountRequest",
      value: QueryCosmosAccountRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryCosmosAccountResponse(): QueryCosmosAccountResponse {
  return {
    cosmosAddress: "",
    sequence: BigInt(0),
    accountNumber: BigInt(0)
  };
}
/**
 * QueryCosmosAccountResponse is the response type for the Query/CosmosAccount
 * RPC method.
 * @name QueryCosmosAccountResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCosmosAccountResponse
 */
export const QueryCosmosAccountResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryCosmosAccountResponse",
  aminoType: "cosmos-sdk/QueryCosmosAccountResponse",
  is(o: any): o is QueryCosmosAccountResponse {
    return o && (o.$typeUrl === QueryCosmosAccountResponse.typeUrl || typeof o.cosmosAddress === "string" && typeof o.sequence === "bigint" && typeof o.accountNumber === "bigint");
  },
  isSDK(o: any): o is QueryCosmosAccountResponseSDKType {
    return o && (o.$typeUrl === QueryCosmosAccountResponse.typeUrl || typeof o.cosmos_address === "string" && typeof o.sequence === "bigint" && typeof o.account_number === "bigint");
  },
  isAmino(o: any): o is QueryCosmosAccountResponseAmino {
    return o && (o.$typeUrl === QueryCosmosAccountResponse.typeUrl || typeof o.cosmos_address === "string" && typeof o.sequence === "bigint" && typeof o.account_number === "bigint");
  },
  encode(message: QueryCosmosAccountResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.cosmosAddress !== "") {
      writer.uint32(10).string(message.cosmosAddress);
    }
    if (message.sequence !== BigInt(0)) {
      writer.uint32(16).uint64(message.sequence);
    }
    if (message.accountNumber !== BigInt(0)) {
      writer.uint32(24).uint64(message.accountNumber);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryCosmosAccountResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryCosmosAccountResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.cosmosAddress = reader.string();
          break;
        case 2:
          message.sequence = reader.uint64();
          break;
        case 3:
          message.accountNumber = reader.uint64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryCosmosAccountResponse>): QueryCosmosAccountResponse {
    const message = createBaseQueryCosmosAccountResponse();
    message.cosmosAddress = object.cosmosAddress ?? "";
    message.sequence = object.sequence !== undefined && object.sequence !== null ? BigInt(object.sequence.toString()) : BigInt(0);
    message.accountNumber = object.accountNumber !== undefined && object.accountNumber !== null ? BigInt(object.accountNumber.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: QueryCosmosAccountResponseAmino): QueryCosmosAccountResponse {
    const message = createBaseQueryCosmosAccountResponse();
    if (object.cosmos_address !== undefined && object.cosmos_address !== null) {
      message.cosmosAddress = object.cosmos_address;
    }
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = BigInt(object.sequence);
    }
    if (object.account_number !== undefined && object.account_number !== null) {
      message.accountNumber = BigInt(object.account_number);
    }
    return message;
  },
  toAmino(message: QueryCosmosAccountResponse, useInterfaces: boolean = false): QueryCosmosAccountResponseAmino {
    const obj: any = {};
    obj.cosmos_address = message.cosmosAddress === "" ? undefined : message.cosmosAddress;
    obj.sequence = message.sequence !== BigInt(0) ? message.sequence?.toString() : undefined;
    obj.account_number = message.accountNumber !== BigInt(0) ? message.accountNumber?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryCosmosAccountResponseAminoMsg): QueryCosmosAccountResponse {
    return QueryCosmosAccountResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryCosmosAccountResponse, useInterfaces: boolean = false): QueryCosmosAccountResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryCosmosAccountResponse",
      value: QueryCosmosAccountResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryCosmosAccountResponseProtoMsg, useInterfaces: boolean = false): QueryCosmosAccountResponse {
    return QueryCosmosAccountResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryCosmosAccountResponse): Uint8Array {
    return QueryCosmosAccountResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryCosmosAccountResponse): QueryCosmosAccountResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryCosmosAccountResponse",
      value: QueryCosmosAccountResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryValidatorAccountRequest(): QueryValidatorAccountRequest {
  return {
    consAddress: ""
  };
}
/**
 * QueryValidatorAccountRequest is the request type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountRequest
 */
export const QueryValidatorAccountRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryValidatorAccountRequest",
  aminoType: "cosmos-sdk/QueryValidatorAccountRequest",
  is(o: any): o is QueryValidatorAccountRequest {
    return o && (o.$typeUrl === QueryValidatorAccountRequest.typeUrl || typeof o.consAddress === "string");
  },
  isSDK(o: any): o is QueryValidatorAccountRequestSDKType {
    return o && (o.$typeUrl === QueryValidatorAccountRequest.typeUrl || typeof o.cons_address === "string");
  },
  isAmino(o: any): o is QueryValidatorAccountRequestAmino {
    return o && (o.$typeUrl === QueryValidatorAccountRequest.typeUrl || typeof o.cons_address === "string");
  },
  encode(message: QueryValidatorAccountRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.consAddress !== "") {
      writer.uint32(10).string(message.consAddress);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryValidatorAccountRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryValidatorAccountRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consAddress = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryValidatorAccountRequest>): QueryValidatorAccountRequest {
    const message = createBaseQueryValidatorAccountRequest();
    message.consAddress = object.consAddress ?? "";
    return message;
  },
  fromAmino(object: QueryValidatorAccountRequestAmino): QueryValidatorAccountRequest {
    const message = createBaseQueryValidatorAccountRequest();
    if (object.cons_address !== undefined && object.cons_address !== null) {
      message.consAddress = object.cons_address;
    }
    return message;
  },
  toAmino(message: QueryValidatorAccountRequest, useInterfaces: boolean = false): QueryValidatorAccountRequestAmino {
    const obj: any = {};
    obj.cons_address = message.consAddress === "" ? undefined : message.consAddress;
    return obj;
  },
  fromAminoMsg(object: QueryValidatorAccountRequestAminoMsg): QueryValidatorAccountRequest {
    return QueryValidatorAccountRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryValidatorAccountRequest, useInterfaces: boolean = false): QueryValidatorAccountRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryValidatorAccountRequest",
      value: QueryValidatorAccountRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryValidatorAccountRequestProtoMsg, useInterfaces: boolean = false): QueryValidatorAccountRequest {
    return QueryValidatorAccountRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryValidatorAccountRequest): Uint8Array {
    return QueryValidatorAccountRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryValidatorAccountRequest): QueryValidatorAccountRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryValidatorAccountRequest",
      value: QueryValidatorAccountRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryValidatorAccountResponse(): QueryValidatorAccountResponse {
  return {
    accountAddress: "",
    sequence: BigInt(0),
    accountNumber: BigInt(0)
  };
}
/**
 * QueryValidatorAccountResponse is the response type for the
 * Query/ValidatorAccount RPC method.
 * @name QueryValidatorAccountResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryValidatorAccountResponse
 */
export const QueryValidatorAccountResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryValidatorAccountResponse",
  aminoType: "cosmos-sdk/QueryValidatorAccountResponse",
  is(o: any): o is QueryValidatorAccountResponse {
    return o && (o.$typeUrl === QueryValidatorAccountResponse.typeUrl || typeof o.accountAddress === "string" && typeof o.sequence === "bigint" && typeof o.accountNumber === "bigint");
  },
  isSDK(o: any): o is QueryValidatorAccountResponseSDKType {
    return o && (o.$typeUrl === QueryValidatorAccountResponse.typeUrl || typeof o.account_address === "string" && typeof o.sequence === "bigint" && typeof o.account_number === "bigint");
  },
  isAmino(o: any): o is QueryValidatorAccountResponseAmino {
    return o && (o.$typeUrl === QueryValidatorAccountResponse.typeUrl || typeof o.account_address === "string" && typeof o.sequence === "bigint" && typeof o.account_number === "bigint");
  },
  encode(message: QueryValidatorAccountResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.accountAddress !== "") {
      writer.uint32(10).string(message.accountAddress);
    }
    if (message.sequence !== BigInt(0)) {
      writer.uint32(16).uint64(message.sequence);
    }
    if (message.accountNumber !== BigInt(0)) {
      writer.uint32(24).uint64(message.accountNumber);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryValidatorAccountResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryValidatorAccountResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.accountAddress = reader.string();
          break;
        case 2:
          message.sequence = reader.uint64();
          break;
        case 3:
          message.accountNumber = reader.uint64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryValidatorAccountResponse>): QueryValidatorAccountResponse {
    const message = createBaseQueryValidatorAccountResponse();
    message.accountAddress = object.accountAddress ?? "";
    message.sequence = object.sequence !== undefined && object.sequence !== null ? BigInt(object.sequence.toString()) : BigInt(0);
    message.accountNumber = object.accountNumber !== undefined && object.accountNumber !== null ? BigInt(object.accountNumber.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: QueryValidatorAccountResponseAmino): QueryValidatorAccountResponse {
    const message = createBaseQueryValidatorAccountResponse();
    if (object.account_address !== undefined && object.account_address !== null) {
      message.accountAddress = object.account_address;
    }
    if (object.sequence !== undefined && object.sequence !== null) {
      message.sequence = BigInt(object.sequence);
    }
    if (object.account_number !== undefined && object.account_number !== null) {
      message.accountNumber = BigInt(object.account_number);
    }
    return message;
  },
  toAmino(message: QueryValidatorAccountResponse, useInterfaces: boolean = false): QueryValidatorAccountResponseAmino {
    const obj: any = {};
    obj.account_address = message.accountAddress === "" ? undefined : message.accountAddress;
    obj.sequence = message.sequence !== BigInt(0) ? message.sequence?.toString() : undefined;
    obj.account_number = message.accountNumber !== BigInt(0) ? message.accountNumber?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryValidatorAccountResponseAminoMsg): QueryValidatorAccountResponse {
    return QueryValidatorAccountResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryValidatorAccountResponse, useInterfaces: boolean = false): QueryValidatorAccountResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryValidatorAccountResponse",
      value: QueryValidatorAccountResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryValidatorAccountResponseProtoMsg, useInterfaces: boolean = false): QueryValidatorAccountResponse {
    return QueryValidatorAccountResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryValidatorAccountResponse): Uint8Array {
    return QueryValidatorAccountResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryValidatorAccountResponse): QueryValidatorAccountResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryValidatorAccountResponse",
      value: QueryValidatorAccountResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryBalanceRequest(): QueryBalanceRequest {
  return {
    address: ""
  };
}
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceRequest
 */
export const QueryBalanceRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryBalanceRequest",
  aminoType: "cosmos-sdk/QueryBalanceRequest",
  is(o: any): o is QueryBalanceRequest {
    return o && (o.$typeUrl === QueryBalanceRequest.typeUrl || typeof o.address === "string");
  },
  isSDK(o: any): o is QueryBalanceRequestSDKType {
    return o && (o.$typeUrl === QueryBalanceRequest.typeUrl || typeof o.address === "string");
  },
  isAmino(o: any): o is QueryBalanceRequestAmino {
    return o && (o.$typeUrl === QueryBalanceRequest.typeUrl || typeof o.address === "string");
  },
  encode(message: QueryBalanceRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryBalanceRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryBalanceRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryBalanceRequest>): QueryBalanceRequest {
    const message = createBaseQueryBalanceRequest();
    message.address = object.address ?? "";
    return message;
  },
  fromAmino(object: QueryBalanceRequestAmino): QueryBalanceRequest {
    const message = createBaseQueryBalanceRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    return message;
  },
  toAmino(message: QueryBalanceRequest, useInterfaces: boolean = false): QueryBalanceRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    return obj;
  },
  fromAminoMsg(object: QueryBalanceRequestAminoMsg): QueryBalanceRequest {
    return QueryBalanceRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryBalanceRequest, useInterfaces: boolean = false): QueryBalanceRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryBalanceRequest",
      value: QueryBalanceRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryBalanceRequestProtoMsg, useInterfaces: boolean = false): QueryBalanceRequest {
    return QueryBalanceRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryBalanceRequest): Uint8Array {
    return QueryBalanceRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryBalanceRequest): QueryBalanceRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryBalanceRequest",
      value: QueryBalanceRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryBalanceResponse(): QueryBalanceResponse {
  return {
    balance: ""
  };
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBalanceResponse
 */
export const QueryBalanceResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryBalanceResponse",
  aminoType: "cosmos-sdk/QueryBalanceResponse",
  is(o: any): o is QueryBalanceResponse {
    return o && (o.$typeUrl === QueryBalanceResponse.typeUrl || typeof o.balance === "string");
  },
  isSDK(o: any): o is QueryBalanceResponseSDKType {
    return o && (o.$typeUrl === QueryBalanceResponse.typeUrl || typeof o.balance === "string");
  },
  isAmino(o: any): o is QueryBalanceResponseAmino {
    return o && (o.$typeUrl === QueryBalanceResponse.typeUrl || typeof o.balance === "string");
  },
  encode(message: QueryBalanceResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.balance !== "") {
      writer.uint32(10).string(message.balance);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryBalanceResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryBalanceResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.balance = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryBalanceResponse>): QueryBalanceResponse {
    const message = createBaseQueryBalanceResponse();
    message.balance = object.balance ?? "";
    return message;
  },
  fromAmino(object: QueryBalanceResponseAmino): QueryBalanceResponse {
    const message = createBaseQueryBalanceResponse();
    if (object.balance !== undefined && object.balance !== null) {
      message.balance = object.balance;
    }
    return message;
  },
  toAmino(message: QueryBalanceResponse, useInterfaces: boolean = false): QueryBalanceResponseAmino {
    const obj: any = {};
    obj.balance = message.balance === "" ? undefined : message.balance;
    return obj;
  },
  fromAminoMsg(object: QueryBalanceResponseAminoMsg): QueryBalanceResponse {
    return QueryBalanceResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryBalanceResponse, useInterfaces: boolean = false): QueryBalanceResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryBalanceResponse",
      value: QueryBalanceResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryBalanceResponseProtoMsg, useInterfaces: boolean = false): QueryBalanceResponse {
    return QueryBalanceResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryBalanceResponse): Uint8Array {
    return QueryBalanceResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryBalanceResponse): QueryBalanceResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryBalanceResponse",
      value: QueryBalanceResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryStorageRequest(): QueryStorageRequest {
  return {
    address: "",
    key: ""
  };
}
/**
 * QueryStorageRequest is the request type for the Query/Storage RPC method.
 * @name QueryStorageRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageRequest
 */
export const QueryStorageRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryStorageRequest",
  aminoType: "cosmos-sdk/QueryStorageRequest",
  is(o: any): o is QueryStorageRequest {
    return o && (o.$typeUrl === QueryStorageRequest.typeUrl || typeof o.address === "string" && typeof o.key === "string");
  },
  isSDK(o: any): o is QueryStorageRequestSDKType {
    return o && (o.$typeUrl === QueryStorageRequest.typeUrl || typeof o.address === "string" && typeof o.key === "string");
  },
  isAmino(o: any): o is QueryStorageRequestAmino {
    return o && (o.$typeUrl === QueryStorageRequest.typeUrl || typeof o.address === "string" && typeof o.key === "string");
  },
  encode(message: QueryStorageRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.key !== "") {
      writer.uint32(18).string(message.key);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryStorageRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryStorageRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        case 2:
          message.key = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryStorageRequest>): QueryStorageRequest {
    const message = createBaseQueryStorageRequest();
    message.address = object.address ?? "";
    message.key = object.key ?? "";
    return message;
  },
  fromAmino(object: QueryStorageRequestAmino): QueryStorageRequest {
    const message = createBaseQueryStorageRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.key !== undefined && object.key !== null) {
      message.key = object.key;
    }
    return message;
  },
  toAmino(message: QueryStorageRequest, useInterfaces: boolean = false): QueryStorageRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.key = message.key === "" ? undefined : message.key;
    return obj;
  },
  fromAminoMsg(object: QueryStorageRequestAminoMsg): QueryStorageRequest {
    return QueryStorageRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryStorageRequest, useInterfaces: boolean = false): QueryStorageRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryStorageRequest",
      value: QueryStorageRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryStorageRequestProtoMsg, useInterfaces: boolean = false): QueryStorageRequest {
    return QueryStorageRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryStorageRequest): Uint8Array {
    return QueryStorageRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryStorageRequest): QueryStorageRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryStorageRequest",
      value: QueryStorageRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryStorageResponse(): QueryStorageResponse {
  return {
    value: ""
  };
}
/**
 * QueryStorageResponse is the response type for the Query/Storage RPC
 * method.
 * @name QueryStorageResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryStorageResponse
 */
export const QueryStorageResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryStorageResponse",
  aminoType: "cosmos-sdk/QueryStorageResponse",
  is(o: any): o is QueryStorageResponse {
    return o && (o.$typeUrl === QueryStorageResponse.typeUrl || typeof o.value === "string");
  },
  isSDK(o: any): o is QueryStorageResponseSDKType {
    return o && (o.$typeUrl === QueryStorageResponse.typeUrl || typeof o.value === "string");
  },
  isAmino(o: any): o is QueryStorageResponseAmino {
    return o && (o.$typeUrl === QueryStorageResponse.typeUrl || typeof o.value === "string");
  },
  encode(message: QueryStorageResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.value !== "") {
      writer.uint32(10).string(message.value);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryStorageResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryStorageResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.value = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryStorageResponse>): QueryStorageResponse {
    const message = createBaseQueryStorageResponse();
    message.value = object.value ?? "";
    return message;
  },
  fromAmino(object: QueryStorageResponseAmino): QueryStorageResponse {
    const message = createBaseQueryStorageResponse();
    if (object.value !== undefined && object.value !== null) {
      message.value = object.value;
    }
    return message;
  },
  toAmino(message: QueryStorageResponse, useInterfaces: boolean = false): QueryStorageResponseAmino {
    const obj: any = {};
    obj.value = message.value === "" ? undefined : message.value;
    return obj;
  },
  fromAminoMsg(object: QueryStorageResponseAminoMsg): QueryStorageResponse {
    return QueryStorageResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryStorageResponse, useInterfaces: boolean = false): QueryStorageResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryStorageResponse",
      value: QueryStorageResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryStorageResponseProtoMsg, useInterfaces: boolean = false): QueryStorageResponse {
    return QueryStorageResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryStorageResponse): Uint8Array {
    return QueryStorageResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryStorageResponse): QueryStorageResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryStorageResponse",
      value: QueryStorageResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryCodeRequest(): QueryCodeRequest {
  return {
    address: ""
  };
}
/**
 * QueryCodeRequest is the request type for the Query/Code RPC method.
 * @name QueryCodeRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeRequest
 */
export const QueryCodeRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryCodeRequest",
  aminoType: "cosmos-sdk/QueryCodeRequest",
  is(o: any): o is QueryCodeRequest {
    return o && (o.$typeUrl === QueryCodeRequest.typeUrl || typeof o.address === "string");
  },
  isSDK(o: any): o is QueryCodeRequestSDKType {
    return o && (o.$typeUrl === QueryCodeRequest.typeUrl || typeof o.address === "string");
  },
  isAmino(o: any): o is QueryCodeRequestAmino {
    return o && (o.$typeUrl === QueryCodeRequest.typeUrl || typeof o.address === "string");
  },
  encode(message: QueryCodeRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryCodeRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryCodeRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryCodeRequest>): QueryCodeRequest {
    const message = createBaseQueryCodeRequest();
    message.address = object.address ?? "";
    return message;
  },
  fromAmino(object: QueryCodeRequestAmino): QueryCodeRequest {
    const message = createBaseQueryCodeRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    return message;
  },
  toAmino(message: QueryCodeRequest, useInterfaces: boolean = false): QueryCodeRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    return obj;
  },
  fromAminoMsg(object: QueryCodeRequestAminoMsg): QueryCodeRequest {
    return QueryCodeRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryCodeRequest, useInterfaces: boolean = false): QueryCodeRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryCodeRequest",
      value: QueryCodeRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryCodeRequestProtoMsg, useInterfaces: boolean = false): QueryCodeRequest {
    return QueryCodeRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryCodeRequest): Uint8Array {
    return QueryCodeRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryCodeRequest): QueryCodeRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryCodeRequest",
      value: QueryCodeRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryCodeResponse(): QueryCodeResponse {
  return {
    code: new Uint8Array()
  };
}
/**
 * QueryCodeResponse is the response type for the Query/Code RPC
 * method.
 * @name QueryCodeResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryCodeResponse
 */
export const QueryCodeResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryCodeResponse",
  aminoType: "cosmos-sdk/QueryCodeResponse",
  is(o: any): o is QueryCodeResponse {
    return o && (o.$typeUrl === QueryCodeResponse.typeUrl || o.code instanceof Uint8Array || typeof o.code === "string");
  },
  isSDK(o: any): o is QueryCodeResponseSDKType {
    return o && (o.$typeUrl === QueryCodeResponse.typeUrl || o.code instanceof Uint8Array || typeof o.code === "string");
  },
  isAmino(o: any): o is QueryCodeResponseAmino {
    return o && (o.$typeUrl === QueryCodeResponse.typeUrl || o.code instanceof Uint8Array || typeof o.code === "string");
  },
  encode(message: QueryCodeResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.code.length !== 0) {
      writer.uint32(10).bytes(message.code);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryCodeResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryCodeResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.code = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryCodeResponse>): QueryCodeResponse {
    const message = createBaseQueryCodeResponse();
    message.code = object.code ?? new Uint8Array();
    return message;
  },
  fromAmino(object: QueryCodeResponseAmino): QueryCodeResponse {
    const message = createBaseQueryCodeResponse();
    if (object.code !== undefined && object.code !== null) {
      message.code = bytesFromBase64(object.code);
    }
    return message;
  },
  toAmino(message: QueryCodeResponse, useInterfaces: boolean = false): QueryCodeResponseAmino {
    const obj: any = {};
    obj.code = message.code ? base64FromBytes(message.code) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryCodeResponseAminoMsg): QueryCodeResponse {
    return QueryCodeResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryCodeResponse, useInterfaces: boolean = false): QueryCodeResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryCodeResponse",
      value: QueryCodeResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryCodeResponseProtoMsg, useInterfaces: boolean = false): QueryCodeResponse {
    return QueryCodeResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryCodeResponse): Uint8Array {
    return QueryCodeResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryCodeResponse): QueryCodeResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryCodeResponse",
      value: QueryCodeResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryTxLogsRequest(): QueryTxLogsRequest {
  return {
    hash: "",
    pagination: undefined
  };
}
/**
 * QueryTxLogsRequest is the request type for the Query/TxLogs RPC method.
 * @name QueryTxLogsRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsRequest
 */
export const QueryTxLogsRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTxLogsRequest",
  aminoType: "cosmos-sdk/QueryTxLogsRequest",
  is(o: any): o is QueryTxLogsRequest {
    return o && (o.$typeUrl === QueryTxLogsRequest.typeUrl || typeof o.hash === "string");
  },
  isSDK(o: any): o is QueryTxLogsRequestSDKType {
    return o && (o.$typeUrl === QueryTxLogsRequest.typeUrl || typeof o.hash === "string");
  },
  isAmino(o: any): o is QueryTxLogsRequestAmino {
    return o && (o.$typeUrl === QueryTxLogsRequest.typeUrl || typeof o.hash === "string");
  },
  encode(message: QueryTxLogsRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.hash !== "") {
      writer.uint32(10).string(message.hash);
    }
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTxLogsRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTxLogsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.hash = reader.string();
          break;
        case 2:
          message.pagination = PageRequest.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTxLogsRequest>): QueryTxLogsRequest {
    const message = createBaseQueryTxLogsRequest();
    message.hash = object.hash ?? "";
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryTxLogsRequestAmino): QueryTxLogsRequest {
    const message = createBaseQueryTxLogsRequest();
    if (object.hash !== undefined && object.hash !== null) {
      message.hash = object.hash;
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryTxLogsRequest, useInterfaces: boolean = false): QueryTxLogsRequestAmino {
    const obj: any = {};
    obj.hash = message.hash === "" ? undefined : message.hash;
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTxLogsRequestAminoMsg): QueryTxLogsRequest {
    return QueryTxLogsRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTxLogsRequest, useInterfaces: boolean = false): QueryTxLogsRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryTxLogsRequest",
      value: QueryTxLogsRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTxLogsRequestProtoMsg, useInterfaces: boolean = false): QueryTxLogsRequest {
    return QueryTxLogsRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTxLogsRequest): Uint8Array {
    return QueryTxLogsRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryTxLogsRequest): QueryTxLogsRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTxLogsRequest",
      value: QueryTxLogsRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryTxLogsRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseQueryTxLogsResponse(): QueryTxLogsResponse {
  return {
    logs: [],
    pagination: undefined
  };
}
/**
 * QueryTxLogsResponse is the response type for the Query/TxLogs RPC method.
 * @name QueryTxLogsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTxLogsResponse
 */
export const QueryTxLogsResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTxLogsResponse",
  aminoType: "cosmos-sdk/QueryTxLogsResponse",
  is(o: any): o is QueryTxLogsResponse {
    return o && (o.$typeUrl === QueryTxLogsResponse.typeUrl || Array.isArray(o.logs) && (!o.logs.length || Log.is(o.logs[0])));
  },
  isSDK(o: any): o is QueryTxLogsResponseSDKType {
    return o && (o.$typeUrl === QueryTxLogsResponse.typeUrl || Array.isArray(o.logs) && (!o.logs.length || Log.isSDK(o.logs[0])));
  },
  isAmino(o: any): o is QueryTxLogsResponseAmino {
    return o && (o.$typeUrl === QueryTxLogsResponse.typeUrl || Array.isArray(o.logs) && (!o.logs.length || Log.isAmino(o.logs[0])));
  },
  encode(message: QueryTxLogsResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.logs) {
      Log.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTxLogsResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTxLogsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.logs.push(Log.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTxLogsResponse>): QueryTxLogsResponse {
    const message = createBaseQueryTxLogsResponse();
    message.logs = object.logs?.map(e => Log.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryTxLogsResponseAmino): QueryTxLogsResponse {
    const message = createBaseQueryTxLogsResponse();
    message.logs = object.logs?.map(e => Log.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryTxLogsResponse, useInterfaces: boolean = false): QueryTxLogsResponseAmino {
    const obj: any = {};
    if (message.logs) {
      obj.logs = message.logs.map(e => e ? Log.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.logs = message.logs;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTxLogsResponseAminoMsg): QueryTxLogsResponse {
    return QueryTxLogsResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTxLogsResponse, useInterfaces: boolean = false): QueryTxLogsResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryTxLogsResponse",
      value: QueryTxLogsResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTxLogsResponseProtoMsg, useInterfaces: boolean = false): QueryTxLogsResponse {
    return QueryTxLogsResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTxLogsResponse): Uint8Array {
    return QueryTxLogsResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryTxLogsResponse): QueryTxLogsResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTxLogsResponse",
      value: QueryTxLogsResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryTxLogsResponse.typeUrl)) {
      return;
    }
    Log.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};
function createBaseQueryParamsRequest(): QueryParamsRequest {
  return {};
}
/**
 * QueryParamsRequest defines the request type for querying x/vm parameters.
 * @name QueryParamsRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsRequest
 */
export const QueryParamsRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryParamsRequest",
  aminoType: "cosmos-sdk/QueryParamsRequest",
  is(o: any): o is QueryParamsRequest {
    return o && o.$typeUrl === QueryParamsRequest.typeUrl;
  },
  isSDK(o: any): o is QueryParamsRequestSDKType {
    return o && o.$typeUrl === QueryParamsRequest.typeUrl;
  },
  isAmino(o: any): o is QueryParamsRequestAmino {
    return o && o.$typeUrl === QueryParamsRequest.typeUrl;
  },
  encode(_: QueryParamsRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryParamsRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryParamsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(_: Partial<QueryParamsRequest>): QueryParamsRequest {
    const message = createBaseQueryParamsRequest();
    return message;
  },
  fromAmino(_: QueryParamsRequestAmino): QueryParamsRequest {
    const message = createBaseQueryParamsRequest();
    return message;
  },
  toAmino(_: QueryParamsRequest, useInterfaces: boolean = false): QueryParamsRequestAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: QueryParamsRequestAminoMsg): QueryParamsRequest {
    return QueryParamsRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryParamsRequest, useInterfaces: boolean = false): QueryParamsRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryParamsRequest",
      value: QueryParamsRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryParamsRequestProtoMsg, useInterfaces: boolean = false): QueryParamsRequest {
    return QueryParamsRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryParamsRequest): Uint8Array {
    return QueryParamsRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryParamsRequest): QueryParamsRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryParamsRequest",
      value: QueryParamsRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryParamsResponse(): QueryParamsResponse {
  return {
    params: Params.fromPartial({})
  };
}
/**
 * QueryParamsResponse defines the response type for querying x/vm parameters.
 * @name QueryParamsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryParamsResponse
 */
export const QueryParamsResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryParamsResponse",
  aminoType: "cosmos-sdk/QueryParamsResponse",
  is(o: any): o is QueryParamsResponse {
    return o && (o.$typeUrl === QueryParamsResponse.typeUrl || Params.is(o.params));
  },
  isSDK(o: any): o is QueryParamsResponseSDKType {
    return o && (o.$typeUrl === QueryParamsResponse.typeUrl || Params.isSDK(o.params));
  },
  isAmino(o: any): o is QueryParamsResponseAmino {
    return o && (o.$typeUrl === QueryParamsResponse.typeUrl || Params.isAmino(o.params));
  },
  encode(message: QueryParamsResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryParamsResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryParamsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.params = Params.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryParamsResponse>): QueryParamsResponse {
    const message = createBaseQueryParamsResponse();
    message.params = object.params !== undefined && object.params !== null ? Params.fromPartial(object.params) : undefined;
    return message;
  },
  fromAmino(object: QueryParamsResponseAmino): QueryParamsResponse {
    const message = createBaseQueryParamsResponse();
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromAmino(object.params);
    }
    return message;
  },
  toAmino(message: QueryParamsResponse, useInterfaces: boolean = false): QueryParamsResponseAmino {
    const obj: any = {};
    obj.params = message.params ? Params.toAmino(message.params, useInterfaces) : Params.toAmino(Params.fromPartial({}));
    return obj;
  },
  fromAminoMsg(object: QueryParamsResponseAminoMsg): QueryParamsResponse {
    return QueryParamsResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryParamsResponse, useInterfaces: boolean = false): QueryParamsResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryParamsResponse",
      value: QueryParamsResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryParamsResponseProtoMsg, useInterfaces: boolean = false): QueryParamsResponse {
    return QueryParamsResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryParamsResponse): Uint8Array {
    return QueryParamsResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryParamsResponse): QueryParamsResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryParamsResponse",
      value: QueryParamsResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryParamsResponse.typeUrl)) {
      return;
    }
    Params.registerTypeUrl();
  }
};
function createBaseEthCallRequest(): EthCallRequest {
  return {
    args: new Uint8Array(),
    gasCap: BigInt(0),
    proposerAddress: new Uint8Array(),
    chainId: BigInt(0),
    overrides: new Uint8Array()
  };
}
/**
 * EthCallRequest defines EthCall request
 * @name EthCallRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EthCallRequest
 */
export const EthCallRequest = {
  typeUrl: "/cosmos.evm.vm.v1.EthCallRequest",
  aminoType: "cosmos-sdk/EthCallRequest",
  is(o: any): o is EthCallRequest {
    return o && (o.$typeUrl === EthCallRequest.typeUrl || (o.args instanceof Uint8Array || typeof o.args === "string") && typeof o.gasCap === "bigint" && (o.proposerAddress instanceof Uint8Array || typeof o.proposerAddress === "string") && typeof o.chainId === "bigint" && (o.overrides instanceof Uint8Array || typeof o.overrides === "string"));
  },
  isSDK(o: any): o is EthCallRequestSDKType {
    return o && (o.$typeUrl === EthCallRequest.typeUrl || (o.args instanceof Uint8Array || typeof o.args === "string") && typeof o.gas_cap === "bigint" && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.chain_id === "bigint" && (o.overrides instanceof Uint8Array || typeof o.overrides === "string"));
  },
  isAmino(o: any): o is EthCallRequestAmino {
    return o && (o.$typeUrl === EthCallRequest.typeUrl || (o.args instanceof Uint8Array || typeof o.args === "string") && typeof o.gas_cap === "bigint" && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.chain_id === "bigint" && (o.overrides instanceof Uint8Array || typeof o.overrides === "string"));
  },
  encode(message: EthCallRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.args.length !== 0) {
      writer.uint32(10).bytes(message.args);
    }
    if (message.gasCap !== BigInt(0)) {
      writer.uint32(16).uint64(message.gasCap);
    }
    if (message.proposerAddress.length !== 0) {
      writer.uint32(26).bytes(message.proposerAddress);
    }
    if (message.chainId !== BigInt(0)) {
      writer.uint32(32).int64(message.chainId);
    }
    if (message.overrides.length !== 0) {
      writer.uint32(42).bytes(message.overrides);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): EthCallRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEthCallRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.args = reader.bytes();
          break;
        case 2:
          message.gasCap = reader.uint64();
          break;
        case 3:
          message.proposerAddress = reader.bytes();
          break;
        case 4:
          message.chainId = reader.int64();
          break;
        case 5:
          message.overrides = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<EthCallRequest>): EthCallRequest {
    const message = createBaseEthCallRequest();
    message.args = object.args ?? new Uint8Array();
    message.gasCap = object.gasCap !== undefined && object.gasCap !== null ? BigInt(object.gasCap.toString()) : BigInt(0);
    message.proposerAddress = object.proposerAddress ?? new Uint8Array();
    message.chainId = object.chainId !== undefined && object.chainId !== null ? BigInt(object.chainId.toString()) : BigInt(0);
    message.overrides = object.overrides ?? new Uint8Array();
    return message;
  },
  fromAmino(object: EthCallRequestAmino): EthCallRequest {
    const message = createBaseEthCallRequest();
    if (object.args !== undefined && object.args !== null) {
      message.args = bytesFromBase64(object.args);
    }
    if (object.gas_cap !== undefined && object.gas_cap !== null) {
      message.gasCap = BigInt(object.gas_cap);
    }
    if (object.proposer_address !== undefined && object.proposer_address !== null) {
      message.proposerAddress = bytesFromBase64(object.proposer_address);
    }
    if (object.chain_id !== undefined && object.chain_id !== null) {
      message.chainId = BigInt(object.chain_id);
    }
    if (object.overrides !== undefined && object.overrides !== null) {
      message.overrides = bytesFromBase64(object.overrides);
    }
    return message;
  },
  toAmino(message: EthCallRequest, useInterfaces: boolean = false): EthCallRequestAmino {
    const obj: any = {};
    obj.args = message.args ? base64FromBytes(message.args) : undefined;
    obj.gas_cap = message.gasCap !== BigInt(0) ? message.gasCap?.toString() : undefined;
    obj.proposer_address = message.proposerAddress ? base64FromBytes(message.proposerAddress) : undefined;
    obj.chain_id = message.chainId !== BigInt(0) ? message.chainId?.toString() : undefined;
    obj.overrides = message.overrides ? base64FromBytes(message.overrides) : undefined;
    return obj;
  },
  fromAminoMsg(object: EthCallRequestAminoMsg): EthCallRequest {
    return EthCallRequest.fromAmino(object.value);
  },
  toAminoMsg(message: EthCallRequest, useInterfaces: boolean = false): EthCallRequestAminoMsg {
    return {
      type: "cosmos-sdk/EthCallRequest",
      value: EthCallRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: EthCallRequestProtoMsg, useInterfaces: boolean = false): EthCallRequest {
    return EthCallRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: EthCallRequest): Uint8Array {
    return EthCallRequest.encode(message).finish();
  },
  toProtoMsg(message: EthCallRequest): EthCallRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.EthCallRequest",
      value: EthCallRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseEstimateGasResponse(): EstimateGasResponse {
  return {
    gas: BigInt(0),
    ret: new Uint8Array(),
    vmError: ""
  };
}
/**
 * EstimateGasResponse defines EstimateGas response
 * @name EstimateGasResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.EstimateGasResponse
 */
export const EstimateGasResponse = {
  typeUrl: "/cosmos.evm.vm.v1.EstimateGasResponse",
  aminoType: "cosmos-sdk/EstimateGasResponse",
  is(o: any): o is EstimateGasResponse {
    return o && (o.$typeUrl === EstimateGasResponse.typeUrl || typeof o.gas === "bigint" && (o.ret instanceof Uint8Array || typeof o.ret === "string") && typeof o.vmError === "string");
  },
  isSDK(o: any): o is EstimateGasResponseSDKType {
    return o && (o.$typeUrl === EstimateGasResponse.typeUrl || typeof o.gas === "bigint" && (o.ret instanceof Uint8Array || typeof o.ret === "string") && typeof o.vm_error === "string");
  },
  isAmino(o: any): o is EstimateGasResponseAmino {
    return o && (o.$typeUrl === EstimateGasResponse.typeUrl || typeof o.gas === "bigint" && (o.ret instanceof Uint8Array || typeof o.ret === "string") && typeof o.vm_error === "string");
  },
  encode(message: EstimateGasResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.gas !== BigInt(0)) {
      writer.uint32(8).uint64(message.gas);
    }
    if (message.ret.length !== 0) {
      writer.uint32(18).bytes(message.ret);
    }
    if (message.vmError !== "") {
      writer.uint32(26).string(message.vmError);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): EstimateGasResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEstimateGasResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.gas = reader.uint64();
          break;
        case 2:
          message.ret = reader.bytes();
          break;
        case 3:
          message.vmError = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<EstimateGasResponse>): EstimateGasResponse {
    const message = createBaseEstimateGasResponse();
    message.gas = object.gas !== undefined && object.gas !== null ? BigInt(object.gas.toString()) : BigInt(0);
    message.ret = object.ret ?? new Uint8Array();
    message.vmError = object.vmError ?? "";
    return message;
  },
  fromAmino(object: EstimateGasResponseAmino): EstimateGasResponse {
    const message = createBaseEstimateGasResponse();
    if (object.gas !== undefined && object.gas !== null) {
      message.gas = BigInt(object.gas);
    }
    if (object.ret !== undefined && object.ret !== null) {
      message.ret = bytesFromBase64(object.ret);
    }
    if (object.vm_error !== undefined && object.vm_error !== null) {
      message.vmError = object.vm_error;
    }
    return message;
  },
  toAmino(message: EstimateGasResponse, useInterfaces: boolean = false): EstimateGasResponseAmino {
    const obj: any = {};
    obj.gas = message.gas !== BigInt(0) ? message.gas?.toString() : undefined;
    obj.ret = message.ret ? base64FromBytes(message.ret) : undefined;
    obj.vm_error = message.vmError === "" ? undefined : message.vmError;
    return obj;
  },
  fromAminoMsg(object: EstimateGasResponseAminoMsg): EstimateGasResponse {
    return EstimateGasResponse.fromAmino(object.value);
  },
  toAminoMsg(message: EstimateGasResponse, useInterfaces: boolean = false): EstimateGasResponseAminoMsg {
    return {
      type: "cosmos-sdk/EstimateGasResponse",
      value: EstimateGasResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: EstimateGasResponseProtoMsg, useInterfaces: boolean = false): EstimateGasResponse {
    return EstimateGasResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: EstimateGasResponse): Uint8Array {
    return EstimateGasResponse.encode(message).finish();
  },
  toProtoMsg(message: EstimateGasResponse): EstimateGasResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.EstimateGasResponse",
      value: EstimateGasResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryTraceTxRequest(): QueryTraceTxRequest {
  return {
    msg: undefined,
    traceConfig: undefined,
    predecessors: [],
    blockNumber: BigInt(0),
    blockHash: "",
    blockTime: new Date(),
    proposerAddress: new Uint8Array(),
    chainId: BigInt(0),
    blockMaxGas: BigInt(0)
  };
}
/**
 * QueryTraceTxRequest defines TraceTx request
 * @name QueryTraceTxRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxRequest
 */
export const QueryTraceTxRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceTxRequest",
  aminoType: "cosmos-sdk/QueryTraceTxRequest",
  is(o: any): o is QueryTraceTxRequest {
    return o && (o.$typeUrl === QueryTraceTxRequest.typeUrl || Array.isArray(o.predecessors) && (!o.predecessors.length || MsgEthereumTx.is(o.predecessors[0])) && typeof o.blockNumber === "bigint" && typeof o.blockHash === "string" && Timestamp.is(o.blockTime) && (o.proposerAddress instanceof Uint8Array || typeof o.proposerAddress === "string") && typeof o.chainId === "bigint" && typeof o.blockMaxGas === "bigint");
  },
  isSDK(o: any): o is QueryTraceTxRequestSDKType {
    return o && (o.$typeUrl === QueryTraceTxRequest.typeUrl || Array.isArray(o.predecessors) && (!o.predecessors.length || MsgEthereumTx.isSDK(o.predecessors[0])) && typeof o.block_number === "bigint" && typeof o.block_hash === "string" && Timestamp.isSDK(o.block_time) && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.chain_id === "bigint" && typeof o.block_max_gas === "bigint");
  },
  isAmino(o: any): o is QueryTraceTxRequestAmino {
    return o && (o.$typeUrl === QueryTraceTxRequest.typeUrl || Array.isArray(o.predecessors) && (!o.predecessors.length || MsgEthereumTx.isAmino(o.predecessors[0])) && typeof o.block_number === "bigint" && typeof o.block_hash === "string" && Timestamp.isAmino(o.block_time) && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.chain_id === "bigint" && typeof o.block_max_gas === "bigint");
  },
  encode(message: QueryTraceTxRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.msg !== undefined) {
      MsgEthereumTx.encode(message.msg, writer.uint32(10).fork()).ldelim();
    }
    if (message.traceConfig !== undefined) {
      TraceConfig.encode(message.traceConfig, writer.uint32(26).fork()).ldelim();
    }
    for (const v of message.predecessors) {
      MsgEthereumTx.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    if (message.blockNumber !== BigInt(0)) {
      writer.uint32(40).int64(message.blockNumber);
    }
    if (message.blockHash !== "") {
      writer.uint32(50).string(message.blockHash);
    }
    if (message.blockTime !== undefined) {
      Timestamp.encode(toTimestamp(message.blockTime), writer.uint32(58).fork()).ldelim();
    }
    if (message.proposerAddress.length !== 0) {
      writer.uint32(66).bytes(message.proposerAddress);
    }
    if (message.chainId !== BigInt(0)) {
      writer.uint32(72).int64(message.chainId);
    }
    if (message.blockMaxGas !== BigInt(0)) {
      writer.uint32(80).int64(message.blockMaxGas);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTraceTxRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTraceTxRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.msg = MsgEthereumTx.decode(reader, reader.uint32(), useInterfaces);
          break;
        case 3:
          message.traceConfig = TraceConfig.decode(reader, reader.uint32(), useInterfaces);
          break;
        case 4:
          message.predecessors.push(MsgEthereumTx.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 5:
          message.blockNumber = reader.int64();
          break;
        case 6:
          message.blockHash = reader.string();
          break;
        case 7:
          message.blockTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 8:
          message.proposerAddress = reader.bytes();
          break;
        case 9:
          message.chainId = reader.int64();
          break;
        case 10:
          message.blockMaxGas = reader.int64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTraceTxRequest>): QueryTraceTxRequest {
    const message = createBaseQueryTraceTxRequest();
    message.msg = object.msg !== undefined && object.msg !== null ? MsgEthereumTx.fromPartial(object.msg) : undefined;
    message.traceConfig = object.traceConfig !== undefined && object.traceConfig !== null ? TraceConfig.fromPartial(object.traceConfig) : undefined;
    message.predecessors = object.predecessors?.map(e => MsgEthereumTx.fromPartial(e)) || [];
    message.blockNumber = object.blockNumber !== undefined && object.blockNumber !== null ? BigInt(object.blockNumber.toString()) : BigInt(0);
    message.blockHash = object.blockHash ?? "";
    message.blockTime = object.blockTime ?? undefined;
    message.proposerAddress = object.proposerAddress ?? new Uint8Array();
    message.chainId = object.chainId !== undefined && object.chainId !== null ? BigInt(object.chainId.toString()) : BigInt(0);
    message.blockMaxGas = object.blockMaxGas !== undefined && object.blockMaxGas !== null ? BigInt(object.blockMaxGas.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: QueryTraceTxRequestAmino): QueryTraceTxRequest {
    const message = createBaseQueryTraceTxRequest();
    if (object.msg !== undefined && object.msg !== null) {
      message.msg = MsgEthereumTx.fromAmino(object.msg);
    }
    if (object.trace_config !== undefined && object.trace_config !== null) {
      message.traceConfig = TraceConfig.fromAmino(object.trace_config);
    }
    message.predecessors = object.predecessors?.map(e => MsgEthereumTx.fromAmino(e)) || [];
    if (object.block_number !== undefined && object.block_number !== null) {
      message.blockNumber = BigInt(object.block_number);
    }
    if (object.block_hash !== undefined && object.block_hash !== null) {
      message.blockHash = object.block_hash;
    }
    if (object.block_time !== undefined && object.block_time !== null) {
      message.blockTime = fromTimestamp(Timestamp.fromAmino(object.block_time));
    }
    if (object.proposer_address !== undefined && object.proposer_address !== null) {
      message.proposerAddress = bytesFromBase64(object.proposer_address);
    }
    if (object.chain_id !== undefined && object.chain_id !== null) {
      message.chainId = BigInt(object.chain_id);
    }
    if (object.block_max_gas !== undefined && object.block_max_gas !== null) {
      message.blockMaxGas = BigInt(object.block_max_gas);
    }
    return message;
  },
  toAmino(message: QueryTraceTxRequest, useInterfaces: boolean = false): QueryTraceTxRequestAmino {
    const obj: any = {};
    obj.msg = message.msg ? MsgEthereumTx.toAmino(message.msg, useInterfaces) : undefined;
    obj.trace_config = message.traceConfig ? TraceConfig.toAmino(message.traceConfig, useInterfaces) : undefined;
    if (message.predecessors) {
      obj.predecessors = message.predecessors.map(e => e ? MsgEthereumTx.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.predecessors = message.predecessors;
    }
    obj.block_number = message.blockNumber !== BigInt(0) ? message.blockNumber?.toString() : undefined;
    obj.block_hash = message.blockHash === "" ? undefined : message.blockHash;
    obj.block_time = message.blockTime ? Timestamp.toAmino(toTimestamp(message.blockTime)) : new Date();
    obj.proposer_address = message.proposerAddress ? base64FromBytes(message.proposerAddress) : undefined;
    obj.chain_id = message.chainId !== BigInt(0) ? message.chainId?.toString() : undefined;
    obj.block_max_gas = message.blockMaxGas !== BigInt(0) ? message.blockMaxGas?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTraceTxRequestAminoMsg): QueryTraceTxRequest {
    return QueryTraceTxRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTraceTxRequest, useInterfaces: boolean = false): QueryTraceTxRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryTraceTxRequest",
      value: QueryTraceTxRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTraceTxRequestProtoMsg, useInterfaces: boolean = false): QueryTraceTxRequest {
    return QueryTraceTxRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTraceTxRequest): Uint8Array {
    return QueryTraceTxRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryTraceTxRequest): QueryTraceTxRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTraceTxRequest",
      value: QueryTraceTxRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryTraceTxRequest.typeUrl)) {
      return;
    }
    MsgEthereumTx.registerTypeUrl();
    TraceConfig.registerTypeUrl();
  }
};
function createBaseQueryTraceTxResponse(): QueryTraceTxResponse {
  return {
    data: new Uint8Array()
  };
}
/**
 * QueryTraceTxResponse defines TraceTx response
 * @name QueryTraceTxResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceTxResponse
 */
export const QueryTraceTxResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceTxResponse",
  aminoType: "cosmos-sdk/QueryTraceTxResponse",
  is(o: any): o is QueryTraceTxResponse {
    return o && (o.$typeUrl === QueryTraceTxResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  isSDK(o: any): o is QueryTraceTxResponseSDKType {
    return o && (o.$typeUrl === QueryTraceTxResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  isAmino(o: any): o is QueryTraceTxResponseAmino {
    return o && (o.$typeUrl === QueryTraceTxResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  encode(message: QueryTraceTxResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.data.length !== 0) {
      writer.uint32(10).bytes(message.data);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTraceTxResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTraceTxResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.data = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTraceTxResponse>): QueryTraceTxResponse {
    const message = createBaseQueryTraceTxResponse();
    message.data = object.data ?? new Uint8Array();
    return message;
  },
  fromAmino(object: QueryTraceTxResponseAmino): QueryTraceTxResponse {
    const message = createBaseQueryTraceTxResponse();
    if (object.data !== undefined && object.data !== null) {
      message.data = bytesFromBase64(object.data);
    }
    return message;
  },
  toAmino(message: QueryTraceTxResponse, useInterfaces: boolean = false): QueryTraceTxResponseAmino {
    const obj: any = {};
    obj.data = message.data ? base64FromBytes(message.data) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTraceTxResponseAminoMsg): QueryTraceTxResponse {
    return QueryTraceTxResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTraceTxResponse, useInterfaces: boolean = false): QueryTraceTxResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryTraceTxResponse",
      value: QueryTraceTxResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTraceTxResponseProtoMsg, useInterfaces: boolean = false): QueryTraceTxResponse {
    return QueryTraceTxResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTraceTxResponse): Uint8Array {
    return QueryTraceTxResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryTraceTxResponse): QueryTraceTxResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTraceTxResponse",
      value: QueryTraceTxResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryTraceBlockRequest(): QueryTraceBlockRequest {
  return {
    txs: [],
    traceConfig: undefined,
    blockNumber: BigInt(0),
    blockHash: "",
    blockTime: new Date(),
    proposerAddress: new Uint8Array(),
    chainId: BigInt(0),
    blockMaxGas: BigInt(0)
  };
}
/**
 * QueryTraceBlockRequest defines TraceTx request
 * @name QueryTraceBlockRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockRequest
 */
export const QueryTraceBlockRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceBlockRequest",
  aminoType: "cosmos-sdk/QueryTraceBlockRequest",
  is(o: any): o is QueryTraceBlockRequest {
    return o && (o.$typeUrl === QueryTraceBlockRequest.typeUrl || Array.isArray(o.txs) && (!o.txs.length || MsgEthereumTx.is(o.txs[0])) && typeof o.blockNumber === "bigint" && typeof o.blockHash === "string" && Timestamp.is(o.blockTime) && (o.proposerAddress instanceof Uint8Array || typeof o.proposerAddress === "string") && typeof o.chainId === "bigint" && typeof o.blockMaxGas === "bigint");
  },
  isSDK(o: any): o is QueryTraceBlockRequestSDKType {
    return o && (o.$typeUrl === QueryTraceBlockRequest.typeUrl || Array.isArray(o.txs) && (!o.txs.length || MsgEthereumTx.isSDK(o.txs[0])) && typeof o.block_number === "bigint" && typeof o.block_hash === "string" && Timestamp.isSDK(o.block_time) && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.chain_id === "bigint" && typeof o.block_max_gas === "bigint");
  },
  isAmino(o: any): o is QueryTraceBlockRequestAmino {
    return o && (o.$typeUrl === QueryTraceBlockRequest.typeUrl || Array.isArray(o.txs) && (!o.txs.length || MsgEthereumTx.isAmino(o.txs[0])) && typeof o.block_number === "bigint" && typeof o.block_hash === "string" && Timestamp.isAmino(o.block_time) && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.chain_id === "bigint" && typeof o.block_max_gas === "bigint");
  },
  encode(message: QueryTraceBlockRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.txs) {
      MsgEthereumTx.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.traceConfig !== undefined) {
      TraceConfig.encode(message.traceConfig, writer.uint32(26).fork()).ldelim();
    }
    if (message.blockNumber !== BigInt(0)) {
      writer.uint32(40).int64(message.blockNumber);
    }
    if (message.blockHash !== "") {
      writer.uint32(50).string(message.blockHash);
    }
    if (message.blockTime !== undefined) {
      Timestamp.encode(toTimestamp(message.blockTime), writer.uint32(58).fork()).ldelim();
    }
    if (message.proposerAddress.length !== 0) {
      writer.uint32(66).bytes(message.proposerAddress);
    }
    if (message.chainId !== BigInt(0)) {
      writer.uint32(72).int64(message.chainId);
    }
    if (message.blockMaxGas !== BigInt(0)) {
      writer.uint32(80).int64(message.blockMaxGas);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTraceBlockRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTraceBlockRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.txs.push(MsgEthereumTx.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 3:
          message.traceConfig = TraceConfig.decode(reader, reader.uint32(), useInterfaces);
          break;
        case 5:
          message.blockNumber = reader.int64();
          break;
        case 6:
          message.blockHash = reader.string();
          break;
        case 7:
          message.blockTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 8:
          message.proposerAddress = reader.bytes();
          break;
        case 9:
          message.chainId = reader.int64();
          break;
        case 10:
          message.blockMaxGas = reader.int64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTraceBlockRequest>): QueryTraceBlockRequest {
    const message = createBaseQueryTraceBlockRequest();
    message.txs = object.txs?.map(e => MsgEthereumTx.fromPartial(e)) || [];
    message.traceConfig = object.traceConfig !== undefined && object.traceConfig !== null ? TraceConfig.fromPartial(object.traceConfig) : undefined;
    message.blockNumber = object.blockNumber !== undefined && object.blockNumber !== null ? BigInt(object.blockNumber.toString()) : BigInt(0);
    message.blockHash = object.blockHash ?? "";
    message.blockTime = object.blockTime ?? undefined;
    message.proposerAddress = object.proposerAddress ?? new Uint8Array();
    message.chainId = object.chainId !== undefined && object.chainId !== null ? BigInt(object.chainId.toString()) : BigInt(0);
    message.blockMaxGas = object.blockMaxGas !== undefined && object.blockMaxGas !== null ? BigInt(object.blockMaxGas.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: QueryTraceBlockRequestAmino): QueryTraceBlockRequest {
    const message = createBaseQueryTraceBlockRequest();
    message.txs = object.txs?.map(e => MsgEthereumTx.fromAmino(e)) || [];
    if (object.trace_config !== undefined && object.trace_config !== null) {
      message.traceConfig = TraceConfig.fromAmino(object.trace_config);
    }
    if (object.block_number !== undefined && object.block_number !== null) {
      message.blockNumber = BigInt(object.block_number);
    }
    if (object.block_hash !== undefined && object.block_hash !== null) {
      message.blockHash = object.block_hash;
    }
    if (object.block_time !== undefined && object.block_time !== null) {
      message.blockTime = fromTimestamp(Timestamp.fromAmino(object.block_time));
    }
    if (object.proposer_address !== undefined && object.proposer_address !== null) {
      message.proposerAddress = bytesFromBase64(object.proposer_address);
    }
    if (object.chain_id !== undefined && object.chain_id !== null) {
      message.chainId = BigInt(object.chain_id);
    }
    if (object.block_max_gas !== undefined && object.block_max_gas !== null) {
      message.blockMaxGas = BigInt(object.block_max_gas);
    }
    return message;
  },
  toAmino(message: QueryTraceBlockRequest, useInterfaces: boolean = false): QueryTraceBlockRequestAmino {
    const obj: any = {};
    if (message.txs) {
      obj.txs = message.txs.map(e => e ? MsgEthereumTx.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.txs = message.txs;
    }
    obj.trace_config = message.traceConfig ? TraceConfig.toAmino(message.traceConfig, useInterfaces) : undefined;
    obj.block_number = message.blockNumber !== BigInt(0) ? message.blockNumber?.toString() : undefined;
    obj.block_hash = message.blockHash === "" ? undefined : message.blockHash;
    obj.block_time = message.blockTime ? Timestamp.toAmino(toTimestamp(message.blockTime)) : new Date();
    obj.proposer_address = message.proposerAddress ? base64FromBytes(message.proposerAddress) : undefined;
    obj.chain_id = message.chainId !== BigInt(0) ? message.chainId?.toString() : undefined;
    obj.block_max_gas = message.blockMaxGas !== BigInt(0) ? message.blockMaxGas?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTraceBlockRequestAminoMsg): QueryTraceBlockRequest {
    return QueryTraceBlockRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTraceBlockRequest, useInterfaces: boolean = false): QueryTraceBlockRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryTraceBlockRequest",
      value: QueryTraceBlockRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTraceBlockRequestProtoMsg, useInterfaces: boolean = false): QueryTraceBlockRequest {
    return QueryTraceBlockRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTraceBlockRequest): Uint8Array {
    return QueryTraceBlockRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryTraceBlockRequest): QueryTraceBlockRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTraceBlockRequest",
      value: QueryTraceBlockRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryTraceBlockRequest.typeUrl)) {
      return;
    }
    MsgEthereumTx.registerTypeUrl();
    TraceConfig.registerTypeUrl();
  }
};
function createBaseQueryTraceBlockResponse(): QueryTraceBlockResponse {
  return {
    data: new Uint8Array()
  };
}
/**
 * QueryTraceBlockResponse defines TraceBlock response
 * @name QueryTraceBlockResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceBlockResponse
 */
export const QueryTraceBlockResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceBlockResponse",
  aminoType: "cosmos-sdk/QueryTraceBlockResponse",
  is(o: any): o is QueryTraceBlockResponse {
    return o && (o.$typeUrl === QueryTraceBlockResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  isSDK(o: any): o is QueryTraceBlockResponseSDKType {
    return o && (o.$typeUrl === QueryTraceBlockResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  isAmino(o: any): o is QueryTraceBlockResponseAmino {
    return o && (o.$typeUrl === QueryTraceBlockResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  encode(message: QueryTraceBlockResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.data.length !== 0) {
      writer.uint32(10).bytes(message.data);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTraceBlockResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTraceBlockResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.data = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTraceBlockResponse>): QueryTraceBlockResponse {
    const message = createBaseQueryTraceBlockResponse();
    message.data = object.data ?? new Uint8Array();
    return message;
  },
  fromAmino(object: QueryTraceBlockResponseAmino): QueryTraceBlockResponse {
    const message = createBaseQueryTraceBlockResponse();
    if (object.data !== undefined && object.data !== null) {
      message.data = bytesFromBase64(object.data);
    }
    return message;
  },
  toAmino(message: QueryTraceBlockResponse, useInterfaces: boolean = false): QueryTraceBlockResponseAmino {
    const obj: any = {};
    obj.data = message.data ? base64FromBytes(message.data) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTraceBlockResponseAminoMsg): QueryTraceBlockResponse {
    return QueryTraceBlockResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTraceBlockResponse, useInterfaces: boolean = false): QueryTraceBlockResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryTraceBlockResponse",
      value: QueryTraceBlockResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTraceBlockResponseProtoMsg, useInterfaces: boolean = false): QueryTraceBlockResponse {
    return QueryTraceBlockResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTraceBlockResponse): Uint8Array {
    return QueryTraceBlockResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryTraceBlockResponse): QueryTraceBlockResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTraceBlockResponse",
      value: QueryTraceBlockResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryTraceCallRequest(): QueryTraceCallRequest {
  return {
    args: new Uint8Array(),
    gasCap: BigInt(0),
    proposerAddress: new Uint8Array(),
    traceConfig: undefined,
    blockNumber: BigInt(0),
    blockHash: "",
    blockTime: new Date(),
    chainId: BigInt(0)
  };
}
/**
 * QueryTraceCallRequest defines TraceCall request
 * @name QueryTraceCallRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallRequest
 */
export const QueryTraceCallRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceCallRequest",
  aminoType: "cosmos-sdk/QueryTraceCallRequest",
  is(o: any): o is QueryTraceCallRequest {
    return o && (o.$typeUrl === QueryTraceCallRequest.typeUrl || (o.args instanceof Uint8Array || typeof o.args === "string") && typeof o.gasCap === "bigint" && (o.proposerAddress instanceof Uint8Array || typeof o.proposerAddress === "string") && typeof o.blockNumber === "bigint" && typeof o.blockHash === "string" && Timestamp.is(o.blockTime) && typeof o.chainId === "bigint");
  },
  isSDK(o: any): o is QueryTraceCallRequestSDKType {
    return o && (o.$typeUrl === QueryTraceCallRequest.typeUrl || (o.args instanceof Uint8Array || typeof o.args === "string") && typeof o.gas_cap === "bigint" && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.block_number === "bigint" && typeof o.block_hash === "string" && Timestamp.isSDK(o.block_time) && typeof o.chain_id === "bigint");
  },
  isAmino(o: any): o is QueryTraceCallRequestAmino {
    return o && (o.$typeUrl === QueryTraceCallRequest.typeUrl || (o.args instanceof Uint8Array || typeof o.args === "string") && typeof o.gas_cap === "bigint" && (o.proposer_address instanceof Uint8Array || typeof o.proposer_address === "string") && typeof o.block_number === "bigint" && typeof o.block_hash === "string" && Timestamp.isAmino(o.block_time) && typeof o.chain_id === "bigint");
  },
  encode(message: QueryTraceCallRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.args.length !== 0) {
      writer.uint32(10).bytes(message.args);
    }
    if (message.gasCap !== BigInt(0)) {
      writer.uint32(16).uint64(message.gasCap);
    }
    if (message.proposerAddress.length !== 0) {
      writer.uint32(26).bytes(message.proposerAddress);
    }
    if (message.traceConfig !== undefined) {
      TraceConfig.encode(message.traceConfig, writer.uint32(34).fork()).ldelim();
    }
    if (message.blockNumber !== BigInt(0)) {
      writer.uint32(40).int64(message.blockNumber);
    }
    if (message.blockHash !== "") {
      writer.uint32(50).string(message.blockHash);
    }
    if (message.blockTime !== undefined) {
      Timestamp.encode(toTimestamp(message.blockTime), writer.uint32(58).fork()).ldelim();
    }
    if (message.chainId !== BigInt(0)) {
      writer.uint32(64).int64(message.chainId);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTraceCallRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTraceCallRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.args = reader.bytes();
          break;
        case 2:
          message.gasCap = reader.uint64();
          break;
        case 3:
          message.proposerAddress = reader.bytes();
          break;
        case 4:
          message.traceConfig = TraceConfig.decode(reader, reader.uint32(), useInterfaces);
          break;
        case 5:
          message.blockNumber = reader.int64();
          break;
        case 6:
          message.blockHash = reader.string();
          break;
        case 7:
          message.blockTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 8:
          message.chainId = reader.int64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTraceCallRequest>): QueryTraceCallRequest {
    const message = createBaseQueryTraceCallRequest();
    message.args = object.args ?? new Uint8Array();
    message.gasCap = object.gasCap !== undefined && object.gasCap !== null ? BigInt(object.gasCap.toString()) : BigInt(0);
    message.proposerAddress = object.proposerAddress ?? new Uint8Array();
    message.traceConfig = object.traceConfig !== undefined && object.traceConfig !== null ? TraceConfig.fromPartial(object.traceConfig) : undefined;
    message.blockNumber = object.blockNumber !== undefined && object.blockNumber !== null ? BigInt(object.blockNumber.toString()) : BigInt(0);
    message.blockHash = object.blockHash ?? "";
    message.blockTime = object.blockTime ?? undefined;
    message.chainId = object.chainId !== undefined && object.chainId !== null ? BigInt(object.chainId.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: QueryTraceCallRequestAmino): QueryTraceCallRequest {
    const message = createBaseQueryTraceCallRequest();
    if (object.args !== undefined && object.args !== null) {
      message.args = bytesFromBase64(object.args);
    }
    if (object.gas_cap !== undefined && object.gas_cap !== null) {
      message.gasCap = BigInt(object.gas_cap);
    }
    if (object.proposer_address !== undefined && object.proposer_address !== null) {
      message.proposerAddress = bytesFromBase64(object.proposer_address);
    }
    if (object.trace_config !== undefined && object.trace_config !== null) {
      message.traceConfig = TraceConfig.fromAmino(object.trace_config);
    }
    if (object.block_number !== undefined && object.block_number !== null) {
      message.blockNumber = BigInt(object.block_number);
    }
    if (object.block_hash !== undefined && object.block_hash !== null) {
      message.blockHash = object.block_hash;
    }
    if (object.block_time !== undefined && object.block_time !== null) {
      message.blockTime = fromTimestamp(Timestamp.fromAmino(object.block_time));
    }
    if (object.chain_id !== undefined && object.chain_id !== null) {
      message.chainId = BigInt(object.chain_id);
    }
    return message;
  },
  toAmino(message: QueryTraceCallRequest, useInterfaces: boolean = false): QueryTraceCallRequestAmino {
    const obj: any = {};
    obj.args = message.args ? base64FromBytes(message.args) : undefined;
    obj.gas_cap = message.gasCap !== BigInt(0) ? message.gasCap?.toString() : undefined;
    obj.proposer_address = message.proposerAddress ? base64FromBytes(message.proposerAddress) : undefined;
    obj.trace_config = message.traceConfig ? TraceConfig.toAmino(message.traceConfig, useInterfaces) : undefined;
    obj.block_number = message.blockNumber !== BigInt(0) ? message.blockNumber?.toString() : undefined;
    obj.block_hash = message.blockHash === "" ? undefined : message.blockHash;
    obj.block_time = message.blockTime ? Timestamp.toAmino(toTimestamp(message.blockTime)) : undefined;
    obj.chain_id = message.chainId !== BigInt(0) ? message.chainId?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTraceCallRequestAminoMsg): QueryTraceCallRequest {
    return QueryTraceCallRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTraceCallRequest, useInterfaces: boolean = false): QueryTraceCallRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryTraceCallRequest",
      value: QueryTraceCallRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTraceCallRequestProtoMsg, useInterfaces: boolean = false): QueryTraceCallRequest {
    return QueryTraceCallRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTraceCallRequest): Uint8Array {
    return QueryTraceCallRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryTraceCallRequest): QueryTraceCallRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTraceCallRequest",
      value: QueryTraceCallRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryTraceCallRequest.typeUrl)) {
      return;
    }
    TraceConfig.registerTypeUrl();
  }
};
function createBaseQueryTraceCallResponse(): QueryTraceCallResponse {
  return {
    data: new Uint8Array()
  };
}
/**
 * QueryTraceCallResponse defines TraceCall response
 * @name QueryTraceCallResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryTraceCallResponse
 */
export const QueryTraceCallResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryTraceCallResponse",
  aminoType: "cosmos-sdk/QueryTraceCallResponse",
  is(o: any): o is QueryTraceCallResponse {
    return o && (o.$typeUrl === QueryTraceCallResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  isSDK(o: any): o is QueryTraceCallResponseSDKType {
    return o && (o.$typeUrl === QueryTraceCallResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  isAmino(o: any): o is QueryTraceCallResponseAmino {
    return o && (o.$typeUrl === QueryTraceCallResponse.typeUrl || o.data instanceof Uint8Array || typeof o.data === "string");
  },
  encode(message: QueryTraceCallResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.data.length !== 0) {
      writer.uint32(10).bytes(message.data);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTraceCallResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTraceCallResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.data = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTraceCallResponse>): QueryTraceCallResponse {
    const message = createBaseQueryTraceCallResponse();
    message.data = object.data ?? new Uint8Array();
    return message;
  },
  fromAmino(object: QueryTraceCallResponseAmino): QueryTraceCallResponse {
    const message = createBaseQueryTraceCallResponse();
    if (object.data !== undefined && object.data !== null) {
      message.data = bytesFromBase64(object.data);
    }
    return message;
  },
  toAmino(message: QueryTraceCallResponse, useInterfaces: boolean = false): QueryTraceCallResponseAmino {
    const obj: any = {};
    obj.data = message.data ? base64FromBytes(message.data) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTraceCallResponseAminoMsg): QueryTraceCallResponse {
    return QueryTraceCallResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTraceCallResponse, useInterfaces: boolean = false): QueryTraceCallResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryTraceCallResponse",
      value: QueryTraceCallResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTraceCallResponseProtoMsg, useInterfaces: boolean = false): QueryTraceCallResponse {
    return QueryTraceCallResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTraceCallResponse): Uint8Array {
    return QueryTraceCallResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryTraceCallResponse): QueryTraceCallResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryTraceCallResponse",
      value: QueryTraceCallResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryBaseFeeRequest(): QueryBaseFeeRequest {
  return {};
}
/**
 * QueryBaseFeeRequest defines the request type for querying the EIP1559 base
 * fee.
 * @name QueryBaseFeeRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeRequest
 */
export const QueryBaseFeeRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryBaseFeeRequest",
  aminoType: "cosmos-sdk/QueryBaseFeeRequest",
  is(o: any): o is QueryBaseFeeRequest {
    return o && o.$typeUrl === QueryBaseFeeRequest.typeUrl;
  },
  isSDK(o: any): o is QueryBaseFeeRequestSDKType {
    return o && o.$typeUrl === QueryBaseFeeRequest.typeUrl;
  },
  isAmino(o: any): o is QueryBaseFeeRequestAmino {
    return o && o.$typeUrl === QueryBaseFeeRequest.typeUrl;
  },
  encode(_: QueryBaseFeeRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryBaseFeeRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryBaseFeeRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(_: Partial<QueryBaseFeeRequest>): QueryBaseFeeRequest {
    const message = createBaseQueryBaseFeeRequest();
    return message;
  },
  fromAmino(_: QueryBaseFeeRequestAmino): QueryBaseFeeRequest {
    const message = createBaseQueryBaseFeeRequest();
    return message;
  },
  toAmino(_: QueryBaseFeeRequest, useInterfaces: boolean = false): QueryBaseFeeRequestAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: QueryBaseFeeRequestAminoMsg): QueryBaseFeeRequest {
    return QueryBaseFeeRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryBaseFeeRequest, useInterfaces: boolean = false): QueryBaseFeeRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryBaseFeeRequest",
      value: QueryBaseFeeRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryBaseFeeRequestProtoMsg, useInterfaces: boolean = false): QueryBaseFeeRequest {
    return QueryBaseFeeRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryBaseFeeRequest): Uint8Array {
    return QueryBaseFeeRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryBaseFeeRequest): QueryBaseFeeRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryBaseFeeRequest",
      value: QueryBaseFeeRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryBaseFeeResponse(): QueryBaseFeeResponse {
  return {
    baseFee: ""
  };
}
/**
 * QueryBaseFeeResponse returns the EIP1559 base fee.
 * @name QueryBaseFeeResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryBaseFeeResponse
 */
export const QueryBaseFeeResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryBaseFeeResponse",
  aminoType: "cosmos-sdk/QueryBaseFeeResponse",
  is(o: any): o is QueryBaseFeeResponse {
    return o && (o.$typeUrl === QueryBaseFeeResponse.typeUrl || typeof o.baseFee === "string");
  },
  isSDK(o: any): o is QueryBaseFeeResponseSDKType {
    return o && (o.$typeUrl === QueryBaseFeeResponse.typeUrl || typeof o.base_fee === "string");
  },
  isAmino(o: any): o is QueryBaseFeeResponseAmino {
    return o && (o.$typeUrl === QueryBaseFeeResponse.typeUrl || typeof o.base_fee === "string");
  },
  encode(message: QueryBaseFeeResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.baseFee !== "") {
      writer.uint32(10).string(message.baseFee);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryBaseFeeResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryBaseFeeResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.baseFee = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryBaseFeeResponse>): QueryBaseFeeResponse {
    const message = createBaseQueryBaseFeeResponse();
    message.baseFee = object.baseFee ?? "";
    return message;
  },
  fromAmino(object: QueryBaseFeeResponseAmino): QueryBaseFeeResponse {
    const message = createBaseQueryBaseFeeResponse();
    if (object.base_fee !== undefined && object.base_fee !== null) {
      message.baseFee = object.base_fee;
    }
    return message;
  },
  toAmino(message: QueryBaseFeeResponse, useInterfaces: boolean = false): QueryBaseFeeResponseAmino {
    const obj: any = {};
    obj.base_fee = message.baseFee === "" ? undefined : message.baseFee;
    return obj;
  },
  fromAminoMsg(object: QueryBaseFeeResponseAminoMsg): QueryBaseFeeResponse {
    return QueryBaseFeeResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryBaseFeeResponse, useInterfaces: boolean = false): QueryBaseFeeResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryBaseFeeResponse",
      value: QueryBaseFeeResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryBaseFeeResponseProtoMsg, useInterfaces: boolean = false): QueryBaseFeeResponse {
    return QueryBaseFeeResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryBaseFeeResponse): Uint8Array {
    return QueryBaseFeeResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryBaseFeeResponse): QueryBaseFeeResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryBaseFeeResponse",
      value: QueryBaseFeeResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryGlobalMinGasPriceRequest(): QueryGlobalMinGasPriceRequest {
  return {};
}
/**
 * QueryGlobalMinGasPriceRequest defines the request type for querying the
 * GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceRequest
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceRequest
 */
export const QueryGlobalMinGasPriceRequest = {
  typeUrl: "/cosmos.evm.vm.v1.QueryGlobalMinGasPriceRequest",
  aminoType: "cosmos-sdk/QueryGlobalMinGasPriceRequest",
  is(o: any): o is QueryGlobalMinGasPriceRequest {
    return o && o.$typeUrl === QueryGlobalMinGasPriceRequest.typeUrl;
  },
  isSDK(o: any): o is QueryGlobalMinGasPriceRequestSDKType {
    return o && o.$typeUrl === QueryGlobalMinGasPriceRequest.typeUrl;
  },
  isAmino(o: any): o is QueryGlobalMinGasPriceRequestAmino {
    return o && o.$typeUrl === QueryGlobalMinGasPriceRequest.typeUrl;
  },
  encode(_: QueryGlobalMinGasPriceRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryGlobalMinGasPriceRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGlobalMinGasPriceRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(_: Partial<QueryGlobalMinGasPriceRequest>): QueryGlobalMinGasPriceRequest {
    const message = createBaseQueryGlobalMinGasPriceRequest();
    return message;
  },
  fromAmino(_: QueryGlobalMinGasPriceRequestAmino): QueryGlobalMinGasPriceRequest {
    const message = createBaseQueryGlobalMinGasPriceRequest();
    return message;
  },
  toAmino(_: QueryGlobalMinGasPriceRequest, useInterfaces: boolean = false): QueryGlobalMinGasPriceRequestAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: QueryGlobalMinGasPriceRequestAminoMsg): QueryGlobalMinGasPriceRequest {
    return QueryGlobalMinGasPriceRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryGlobalMinGasPriceRequest, useInterfaces: boolean = false): QueryGlobalMinGasPriceRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryGlobalMinGasPriceRequest",
      value: QueryGlobalMinGasPriceRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryGlobalMinGasPriceRequestProtoMsg, useInterfaces: boolean = false): QueryGlobalMinGasPriceRequest {
    return QueryGlobalMinGasPriceRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryGlobalMinGasPriceRequest): Uint8Array {
    return QueryGlobalMinGasPriceRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryGlobalMinGasPriceRequest): QueryGlobalMinGasPriceRequestProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryGlobalMinGasPriceRequest",
      value: QueryGlobalMinGasPriceRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryGlobalMinGasPriceResponse(): QueryGlobalMinGasPriceResponse {
  return {
    minGasPrice: ""
  };
}
/**
 * QueryGlobalMinGasPriceResponse returns the GlobalMinGasPrice
 * @name QueryGlobalMinGasPriceResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.QueryGlobalMinGasPriceResponse
 */
export const QueryGlobalMinGasPriceResponse = {
  typeUrl: "/cosmos.evm.vm.v1.QueryGlobalMinGasPriceResponse",
  aminoType: "cosmos-sdk/QueryGlobalMinGasPriceResponse",
  is(o: any): o is QueryGlobalMinGasPriceResponse {
    return o && (o.$typeUrl === QueryGlobalMinGasPriceResponse.typeUrl || typeof o.minGasPrice === "string");
  },
  isSDK(o: any): o is QueryGlobalMinGasPriceResponseSDKType {
    return o && (o.$typeUrl === QueryGlobalMinGasPriceResponse.typeUrl || typeof o.min_gas_price === "string");
  },
  isAmino(o: any): o is QueryGlobalMinGasPriceResponseAmino {
    return o && (o.$typeUrl === QueryGlobalMinGasPriceResponse.typeUrl || typeof o.min_gas_price === "string");
  },
  encode(message: QueryGlobalMinGasPriceResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.minGasPrice !== "") {
      writer.uint32(10).string(message.minGasPrice);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryGlobalMinGasPriceResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGlobalMinGasPriceResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.minGasPrice = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryGlobalMinGasPriceResponse>): QueryGlobalMinGasPriceResponse {
    const message = createBaseQueryGlobalMinGasPriceResponse();
    message.minGasPrice = object.minGasPrice ?? "";
    return message;
  },
  fromAmino(object: QueryGlobalMinGasPriceResponseAmino): QueryGlobalMinGasPriceResponse {
    const message = createBaseQueryGlobalMinGasPriceResponse();
    if (object.min_gas_price !== undefined && object.min_gas_price !== null) {
      message.minGasPrice = object.min_gas_price;
    }
    return message;
  },
  toAmino(message: QueryGlobalMinGasPriceResponse, useInterfaces: boolean = false): QueryGlobalMinGasPriceResponseAmino {
    const obj: any = {};
    obj.min_gas_price = message.minGasPrice === "" ? undefined : message.minGasPrice;
    return obj;
  },
  fromAminoMsg(object: QueryGlobalMinGasPriceResponseAminoMsg): QueryGlobalMinGasPriceResponse {
    return QueryGlobalMinGasPriceResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryGlobalMinGasPriceResponse, useInterfaces: boolean = false): QueryGlobalMinGasPriceResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryGlobalMinGasPriceResponse",
      value: QueryGlobalMinGasPriceResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryGlobalMinGasPriceResponseProtoMsg, useInterfaces: boolean = false): QueryGlobalMinGasPriceResponse {
    return QueryGlobalMinGasPriceResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryGlobalMinGasPriceResponse): Uint8Array {
    return QueryGlobalMinGasPriceResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryGlobalMinGasPriceResponse): QueryGlobalMinGasPriceResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.QueryGlobalMinGasPriceResponse",
      value: QueryGlobalMinGasPriceResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};