//@ts-nocheck
import { PageRequest, PageRequestAmino, PageRequestSDKType, PageResponse, PageResponseAmino, PageResponseSDKType } from "../../base/query/v1beta1/pagination";
import { Coin, CoinAmino, CoinSDKType } from "../../base/v1beta1/coin";
import { Params, ParamsAmino, ParamsSDKType, Metadata, MetadataAmino, MetadataSDKType, SendEnabled, SendEnabledAmino, SendEnabledSDKType } from "./bank";
import { BinaryReader, BinaryWriter } from "../../../binary";
import { GlobalDecoderRegistry } from "../../../registry";
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceRequest
 */
export interface QueryBalanceRequest {
  /**
   * address is the address to query balances for.
   */
  address: string;
  /**
   * denom is the coin denom to query balances for.
   */
  denom: string;
}
export interface QueryBalanceRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryBalanceRequest";
  value: Uint8Array;
}
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceRequest
 */
export interface QueryBalanceRequestAmino {
  /**
   * address is the address to query balances for.
   */
  address?: string;
  /**
   * denom is the coin denom to query balances for.
   */
  denom?: string;
}
export interface QueryBalanceRequestAminoMsg {
  type: "cosmos-sdk/QueryBalanceRequest";
  value: QueryBalanceRequestAmino;
}
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceRequest
 */
export interface QueryBalanceRequestSDKType {
  address: string;
  denom: string;
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceResponse
 */
export interface QueryBalanceResponse {
  /**
   * balance is the balance of the coin.
   */
  balance?: Coin | undefined;
}
export interface QueryBalanceResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryBalanceResponse";
  value: Uint8Array;
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceResponse
 */
export interface QueryBalanceResponseAmino {
  /**
   * balance is the balance of the coin.
   */
  balance?: CoinAmino | undefined;
}
export interface QueryBalanceResponseAminoMsg {
  type: "cosmos-sdk/QueryBalanceResponse";
  value: QueryBalanceResponseAmino;
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceResponse
 */
export interface QueryBalanceResponseSDKType {
  balance?: CoinSDKType | undefined;
}
/**
 * QueryBalanceRequest is the request type for the Query/AllBalances RPC method.
 * @name QueryAllBalancesRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesRequest
 */
export interface QueryAllBalancesRequest {
  /**
   * address is the address to query balances for.
   */
  address: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequest | undefined;
  /**
   * resolve_denom is the flag to resolve the denom into a human-readable form from the metadata.
   * 
   * Since: cosmos-sdk 0.50
   */
  resolveDenom: boolean;
}
export interface QueryAllBalancesRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryAllBalancesRequest";
  value: Uint8Array;
}
/**
 * QueryBalanceRequest is the request type for the Query/AllBalances RPC method.
 * @name QueryAllBalancesRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesRequest
 */
export interface QueryAllBalancesRequestAmino {
  /**
   * address is the address to query balances for.
   */
  address?: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequestAmino | undefined;
  /**
   * resolve_denom is the flag to resolve the denom into a human-readable form from the metadata.
   * 
   * Since: cosmos-sdk 0.50
   */
  resolve_denom?: boolean;
}
export interface QueryAllBalancesRequestAminoMsg {
  type: "cosmos-sdk/QueryAllBalancesRequest";
  value: QueryAllBalancesRequestAmino;
}
/**
 * QueryBalanceRequest is the request type for the Query/AllBalances RPC method.
 * @name QueryAllBalancesRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesRequest
 */
export interface QueryAllBalancesRequestSDKType {
  address: string;
  pagination?: PageRequestSDKType | undefined;
  resolve_denom: boolean;
}
/**
 * QueryAllBalancesResponse is the response type for the Query/AllBalances RPC
 * method.
 * @name QueryAllBalancesResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesResponse
 */
export interface QueryAllBalancesResponse {
  /**
   * balances is the balances of all the coins.
   */
  balances: Coin[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponse | undefined;
}
export interface QueryAllBalancesResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryAllBalancesResponse";
  value: Uint8Array;
}
/**
 * QueryAllBalancesResponse is the response type for the Query/AllBalances RPC
 * method.
 * @name QueryAllBalancesResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesResponse
 */
export interface QueryAllBalancesResponseAmino {
  /**
   * balances is the balances of all the coins.
   */
  balances: CoinAmino[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QueryAllBalancesResponseAminoMsg {
  type: "cosmos-sdk/QueryAllBalancesResponse";
  value: QueryAllBalancesResponseAmino;
}
/**
 * QueryAllBalancesResponse is the response type for the Query/AllBalances RPC
 * method.
 * @name QueryAllBalancesResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesResponse
 */
export interface QueryAllBalancesResponseSDKType {
  balances: CoinSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
/**
 * QuerySpendableBalancesRequest defines the gRPC request structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesRequest
 */
export interface QuerySpendableBalancesRequest {
  /**
   * address is the address to query spendable balances for.
   */
  address: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequest | undefined;
}
export interface QuerySpendableBalancesRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalancesRequest";
  value: Uint8Array;
}
/**
 * QuerySpendableBalancesRequest defines the gRPC request structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesRequest
 */
export interface QuerySpendableBalancesRequestAmino {
  /**
   * address is the address to query spendable balances for.
   */
  address?: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequestAmino | undefined;
}
export interface QuerySpendableBalancesRequestAminoMsg {
  type: "cosmos-sdk/QuerySpendableBalancesRequest";
  value: QuerySpendableBalancesRequestAmino;
}
/**
 * QuerySpendableBalancesRequest defines the gRPC request structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesRequest
 */
export interface QuerySpendableBalancesRequestSDKType {
  address: string;
  pagination?: PageRequestSDKType | undefined;
}
/**
 * QuerySpendableBalancesResponse defines the gRPC response structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesResponse
 */
export interface QuerySpendableBalancesResponse {
  /**
   * balances is the spendable balances of all the coins.
   */
  balances: Coin[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponse | undefined;
}
export interface QuerySpendableBalancesResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalancesResponse";
  value: Uint8Array;
}
/**
 * QuerySpendableBalancesResponse defines the gRPC response structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesResponse
 */
export interface QuerySpendableBalancesResponseAmino {
  /**
   * balances is the spendable balances of all the coins.
   */
  balances: CoinAmino[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QuerySpendableBalancesResponseAminoMsg {
  type: "cosmos-sdk/QuerySpendableBalancesResponse";
  value: QuerySpendableBalancesResponseAmino;
}
/**
 * QuerySpendableBalancesResponse defines the gRPC response structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesResponse
 */
export interface QuerySpendableBalancesResponseSDKType {
  balances: CoinSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
/**
 * QuerySpendableBalanceByDenomRequest defines the gRPC request structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomRequest
 */
export interface QuerySpendableBalanceByDenomRequest {
  /**
   * address is the address to query balances for.
   */
  address: string;
  /**
   * denom is the coin denom to query balances for.
   */
  denom: string;
}
export interface QuerySpendableBalanceByDenomRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalanceByDenomRequest";
  value: Uint8Array;
}
/**
 * QuerySpendableBalanceByDenomRequest defines the gRPC request structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomRequest
 */
export interface QuerySpendableBalanceByDenomRequestAmino {
  /**
   * address is the address to query balances for.
   */
  address?: string;
  /**
   * denom is the coin denom to query balances for.
   */
  denom?: string;
}
export interface QuerySpendableBalanceByDenomRequestAminoMsg {
  type: "cosmos-sdk/QuerySpendableBalanceByDenomRequest";
  value: QuerySpendableBalanceByDenomRequestAmino;
}
/**
 * QuerySpendableBalanceByDenomRequest defines the gRPC request structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomRequest
 */
export interface QuerySpendableBalanceByDenomRequestSDKType {
  address: string;
  denom: string;
}
/**
 * QuerySpendableBalanceByDenomResponse defines the gRPC response structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomResponse
 */
export interface QuerySpendableBalanceByDenomResponse {
  /**
   * balance is the balance of the coin.
   */
  balance?: Coin | undefined;
}
export interface QuerySpendableBalanceByDenomResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalanceByDenomResponse";
  value: Uint8Array;
}
/**
 * QuerySpendableBalanceByDenomResponse defines the gRPC response structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomResponse
 */
export interface QuerySpendableBalanceByDenomResponseAmino {
  /**
   * balance is the balance of the coin.
   */
  balance?: CoinAmino | undefined;
}
export interface QuerySpendableBalanceByDenomResponseAminoMsg {
  type: "cosmos-sdk/QuerySpendableBalanceByDenomResponse";
  value: QuerySpendableBalanceByDenomResponseAmino;
}
/**
 * QuerySpendableBalanceByDenomResponse defines the gRPC response structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomResponse
 */
export interface QuerySpendableBalanceByDenomResponseSDKType {
  balance?: CoinSDKType | undefined;
}
/**
 * QueryTotalSupplyRequest is the request type for the Query/TotalSupply RPC
 * method.
 * @name QueryTotalSupplyRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyRequest
 */
export interface QueryTotalSupplyRequest {
  /**
   * pagination defines an optional pagination for the request.
   * 
   * Since: cosmos-sdk 0.43
   */
  pagination?: PageRequest | undefined;
}
export interface QueryTotalSupplyRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryTotalSupplyRequest";
  value: Uint8Array;
}
/**
 * QueryTotalSupplyRequest is the request type for the Query/TotalSupply RPC
 * method.
 * @name QueryTotalSupplyRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyRequest
 */
export interface QueryTotalSupplyRequestAmino {
  /**
   * pagination defines an optional pagination for the request.
   * 
   * Since: cosmos-sdk 0.43
   */
  pagination?: PageRequestAmino | undefined;
}
export interface QueryTotalSupplyRequestAminoMsg {
  type: "cosmos-sdk/QueryTotalSupplyRequest";
  value: QueryTotalSupplyRequestAmino;
}
/**
 * QueryTotalSupplyRequest is the request type for the Query/TotalSupply RPC
 * method.
 * @name QueryTotalSupplyRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyRequest
 */
export interface QueryTotalSupplyRequestSDKType {
  pagination?: PageRequestSDKType | undefined;
}
/**
 * QueryTotalSupplyResponse is the response type for the Query/TotalSupply RPC
 * method
 * @name QueryTotalSupplyResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyResponse
 */
export interface QueryTotalSupplyResponse {
  /**
   * supply is the supply of the coins
   */
  supply: Coin[];
  /**
   * pagination defines the pagination in the response.
   * 
   * Since: cosmos-sdk 0.43
   */
  pagination?: PageResponse | undefined;
}
export interface QueryTotalSupplyResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryTotalSupplyResponse";
  value: Uint8Array;
}
/**
 * QueryTotalSupplyResponse is the response type for the Query/TotalSupply RPC
 * method
 * @name QueryTotalSupplyResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyResponse
 */
export interface QueryTotalSupplyResponseAmino {
  /**
   * supply is the supply of the coins
   */
  supply: CoinAmino[];
  /**
   * pagination defines the pagination in the response.
   * 
   * Since: cosmos-sdk 0.43
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QueryTotalSupplyResponseAminoMsg {
  type: "cosmos-sdk/QueryTotalSupplyResponse";
  value: QueryTotalSupplyResponseAmino;
}
/**
 * QueryTotalSupplyResponse is the response type for the Query/TotalSupply RPC
 * method
 * @name QueryTotalSupplyResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyResponse
 */
export interface QueryTotalSupplyResponseSDKType {
  supply: CoinSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
/**
 * QuerySupplyOfRequest is the request type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfRequest
 */
export interface QuerySupplyOfRequest {
  /**
   * denom is the coin denom to query balances for.
   */
  denom: string;
}
export interface QuerySupplyOfRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySupplyOfRequest";
  value: Uint8Array;
}
/**
 * QuerySupplyOfRequest is the request type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfRequest
 */
export interface QuerySupplyOfRequestAmino {
  /**
   * denom is the coin denom to query balances for.
   */
  denom?: string;
}
export interface QuerySupplyOfRequestAminoMsg {
  type: "cosmos-sdk/QuerySupplyOfRequest";
  value: QuerySupplyOfRequestAmino;
}
/**
 * QuerySupplyOfRequest is the request type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfRequest
 */
export interface QuerySupplyOfRequestSDKType {
  denom: string;
}
/**
 * QuerySupplyOfResponse is the response type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfResponse
 */
export interface QuerySupplyOfResponse {
  /**
   * amount is the supply of the coin.
   */
  amount: Coin | undefined;
}
export interface QuerySupplyOfResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySupplyOfResponse";
  value: Uint8Array;
}
/**
 * QuerySupplyOfResponse is the response type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfResponse
 */
export interface QuerySupplyOfResponseAmino {
  /**
   * amount is the supply of the coin.
   */
  amount: CoinAmino | undefined;
}
export interface QuerySupplyOfResponseAminoMsg {
  type: "cosmos-sdk/QuerySupplyOfResponse";
  value: QuerySupplyOfResponseAmino;
}
/**
 * QuerySupplyOfResponse is the response type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfResponse
 */
export interface QuerySupplyOfResponseSDKType {
  amount: CoinSDKType | undefined;
}
/**
 * QueryParamsRequest defines the request type for querying x/bank parameters.
 * @name QueryParamsRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsRequest
 */
export interface QueryParamsRequest {}
export interface QueryParamsRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryParamsRequest";
  value: Uint8Array;
}
/**
 * QueryParamsRequest defines the request type for querying x/bank parameters.
 * @name QueryParamsRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsRequest
 */
export interface QueryParamsRequestAmino {}
export interface QueryParamsRequestAminoMsg {
  type: "cosmos-sdk/QueryParamsRequest";
  value: QueryParamsRequestAmino;
}
/**
 * QueryParamsRequest defines the request type for querying x/bank parameters.
 * @name QueryParamsRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsRequest
 */
export interface QueryParamsRequestSDKType {}
/**
 * QueryParamsResponse defines the response type for querying x/bank parameters.
 * @name QueryParamsResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsResponse
 */
export interface QueryParamsResponse {
  /**
   * params provides the parameters of the bank module.
   */
  params: Params | undefined;
}
export interface QueryParamsResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryParamsResponse";
  value: Uint8Array;
}
/**
 * QueryParamsResponse defines the response type for querying x/bank parameters.
 * @name QueryParamsResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsResponse
 */
export interface QueryParamsResponseAmino {
  /**
   * params provides the parameters of the bank module.
   */
  params: ParamsAmino | undefined;
}
export interface QueryParamsResponseAminoMsg {
  type: "cosmos-sdk/QueryParamsResponse";
  value: QueryParamsResponseAmino;
}
/**
 * QueryParamsResponse defines the response type for querying x/bank parameters.
 * @name QueryParamsResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsResponse
 */
export interface QueryParamsResponseSDKType {
  params: ParamsSDKType | undefined;
}
/**
 * QueryDenomsMetadataRequest is the request type for the Query/DenomsMetadata RPC method.
 * @name QueryDenomsMetadataRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataRequest
 */
export interface QueryDenomsMetadataRequest {
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequest | undefined;
}
export interface QueryDenomsMetadataRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomsMetadataRequest";
  value: Uint8Array;
}
/**
 * QueryDenomsMetadataRequest is the request type for the Query/DenomsMetadata RPC method.
 * @name QueryDenomsMetadataRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataRequest
 */
export interface QueryDenomsMetadataRequestAmino {
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequestAmino | undefined;
}
export interface QueryDenomsMetadataRequestAminoMsg {
  type: "cosmos-sdk/QueryDenomsMetadataRequest";
  value: QueryDenomsMetadataRequestAmino;
}
/**
 * QueryDenomsMetadataRequest is the request type for the Query/DenomsMetadata RPC method.
 * @name QueryDenomsMetadataRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataRequest
 */
export interface QueryDenomsMetadataRequestSDKType {
  pagination?: PageRequestSDKType | undefined;
}
/**
 * QueryDenomsMetadataResponse is the response type for the Query/DenomsMetadata RPC
 * method.
 * @name QueryDenomsMetadataResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataResponse
 */
export interface QueryDenomsMetadataResponse {
  /**
   * metadata provides the client information for all the registered tokens.
   */
  metadatas: Metadata[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponse | undefined;
}
export interface QueryDenomsMetadataResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomsMetadataResponse";
  value: Uint8Array;
}
/**
 * QueryDenomsMetadataResponse is the response type for the Query/DenomsMetadata RPC
 * method.
 * @name QueryDenomsMetadataResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataResponse
 */
export interface QueryDenomsMetadataResponseAmino {
  /**
   * metadata provides the client information for all the registered tokens.
   */
  metadatas: MetadataAmino[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QueryDenomsMetadataResponseAminoMsg {
  type: "cosmos-sdk/QueryDenomsMetadataResponse";
  value: QueryDenomsMetadataResponseAmino;
}
/**
 * QueryDenomsMetadataResponse is the response type for the Query/DenomsMetadata RPC
 * method.
 * @name QueryDenomsMetadataResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataResponse
 */
export interface QueryDenomsMetadataResponseSDKType {
  metadatas: MetadataSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
/**
 * QueryDenomMetadataRequest is the request type for the Query/DenomMetadata RPC method.
 * @name QueryDenomMetadataRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataRequest
 */
export interface QueryDenomMetadataRequest {
  /**
   * denom is the coin denom to query the metadata for.
   */
  denom: string;
}
export interface QueryDenomMetadataRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataRequest";
  value: Uint8Array;
}
/**
 * QueryDenomMetadataRequest is the request type for the Query/DenomMetadata RPC method.
 * @name QueryDenomMetadataRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataRequest
 */
export interface QueryDenomMetadataRequestAmino {
  /**
   * denom is the coin denom to query the metadata for.
   */
  denom?: string;
}
export interface QueryDenomMetadataRequestAminoMsg {
  type: "cosmos-sdk/QueryDenomMetadataRequest";
  value: QueryDenomMetadataRequestAmino;
}
/**
 * QueryDenomMetadataRequest is the request type for the Query/DenomMetadata RPC method.
 * @name QueryDenomMetadataRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataRequest
 */
export interface QueryDenomMetadataRequestSDKType {
  denom: string;
}
/**
 * QueryDenomMetadataResponse is the response type for the Query/DenomMetadata RPC
 * method.
 * @name QueryDenomMetadataResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataResponse
 */
export interface QueryDenomMetadataResponse {
  /**
   * metadata describes and provides all the client information for the requested token.
   */
  metadata: Metadata | undefined;
}
export interface QueryDenomMetadataResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataResponse";
  value: Uint8Array;
}
/**
 * QueryDenomMetadataResponse is the response type for the Query/DenomMetadata RPC
 * method.
 * @name QueryDenomMetadataResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataResponse
 */
export interface QueryDenomMetadataResponseAmino {
  /**
   * metadata describes and provides all the client information for the requested token.
   */
  metadata: MetadataAmino | undefined;
}
export interface QueryDenomMetadataResponseAminoMsg {
  type: "cosmos-sdk/QueryDenomMetadataResponse";
  value: QueryDenomMetadataResponseAmino;
}
/**
 * QueryDenomMetadataResponse is the response type for the Query/DenomMetadata RPC
 * method.
 * @name QueryDenomMetadataResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataResponse
 */
export interface QueryDenomMetadataResponseSDKType {
  metadata: MetadataSDKType | undefined;
}
/**
 * QueryDenomMetadataByQueryStringRequest is the request type for the Query/DenomMetadata RPC method.
 * Identical with QueryDenomMetadataRequest but receives denom as query string.
 * @name QueryDenomMetadataByQueryStringRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringRequest
 */
export interface QueryDenomMetadataByQueryStringRequest {
  /**
   * denom is the coin denom to query the metadata for.
   */
  denom: string;
}
export interface QueryDenomMetadataByQueryStringRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringRequest";
  value: Uint8Array;
}
/**
 * QueryDenomMetadataByQueryStringRequest is the request type for the Query/DenomMetadata RPC method.
 * Identical with QueryDenomMetadataRequest but receives denom as query string.
 * @name QueryDenomMetadataByQueryStringRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringRequest
 */
export interface QueryDenomMetadataByQueryStringRequestAmino {
  /**
   * denom is the coin denom to query the metadata for.
   */
  denom?: string;
}
export interface QueryDenomMetadataByQueryStringRequestAminoMsg {
  type: "cosmos-sdk/QueryDenomMetadataByQueryStringRequest";
  value: QueryDenomMetadataByQueryStringRequestAmino;
}
/**
 * QueryDenomMetadataByQueryStringRequest is the request type for the Query/DenomMetadata RPC method.
 * Identical with QueryDenomMetadataRequest but receives denom as query string.
 * @name QueryDenomMetadataByQueryStringRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringRequest
 */
export interface QueryDenomMetadataByQueryStringRequestSDKType {
  denom: string;
}
/**
 * QueryDenomMetadataByQueryStringResponse is the response type for the Query/DenomMetadata RPC
 * method. Identical with QueryDenomMetadataResponse but receives denom as query string in request.
 * @name QueryDenomMetadataByQueryStringResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringResponse
 */
export interface QueryDenomMetadataByQueryStringResponse {
  /**
   * metadata describes and provides all the client information for the requested token.
   */
  metadata: Metadata | undefined;
}
export interface QueryDenomMetadataByQueryStringResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringResponse";
  value: Uint8Array;
}
/**
 * QueryDenomMetadataByQueryStringResponse is the response type for the Query/DenomMetadata RPC
 * method. Identical with QueryDenomMetadataResponse but receives denom as query string in request.
 * @name QueryDenomMetadataByQueryStringResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringResponse
 */
export interface QueryDenomMetadataByQueryStringResponseAmino {
  /**
   * metadata describes and provides all the client information for the requested token.
   */
  metadata: MetadataAmino | undefined;
}
export interface QueryDenomMetadataByQueryStringResponseAminoMsg {
  type: "cosmos-sdk/QueryDenomMetadataByQueryStringResponse";
  value: QueryDenomMetadataByQueryStringResponseAmino;
}
/**
 * QueryDenomMetadataByQueryStringResponse is the response type for the Query/DenomMetadata RPC
 * method. Identical with QueryDenomMetadataResponse but receives denom as query string in request.
 * @name QueryDenomMetadataByQueryStringResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringResponse
 */
export interface QueryDenomMetadataByQueryStringResponseSDKType {
  metadata: MetadataSDKType | undefined;
}
/**
 * QueryDenomOwnersRequest defines the request type for the DenomOwners RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * @name QueryDenomOwnersRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersRequest
 */
export interface QueryDenomOwnersRequest {
  /**
   * denom defines the coin denomination to query all account holders for.
   */
  denom: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequest | undefined;
}
export interface QueryDenomOwnersRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersRequest";
  value: Uint8Array;
}
/**
 * QueryDenomOwnersRequest defines the request type for the DenomOwners RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * @name QueryDenomOwnersRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersRequest
 */
export interface QueryDenomOwnersRequestAmino {
  /**
   * denom defines the coin denomination to query all account holders for.
   */
  denom?: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequestAmino | undefined;
}
export interface QueryDenomOwnersRequestAminoMsg {
  type: "cosmos-sdk/QueryDenomOwnersRequest";
  value: QueryDenomOwnersRequestAmino;
}
/**
 * QueryDenomOwnersRequest defines the request type for the DenomOwners RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * @name QueryDenomOwnersRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersRequest
 */
export interface QueryDenomOwnersRequestSDKType {
  denom: string;
  pagination?: PageRequestSDKType | undefined;
}
/**
 * DenomOwner defines structure representing an account that owns or holds a
 * particular denominated token. It contains the account address and account
 * balance of the denominated token.
 * 
 * Since: cosmos-sdk 0.46
 * @name DenomOwner
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.DenomOwner
 */
export interface DenomOwner {
  /**
   * address defines the address that owns a particular denomination.
   */
  address: string;
  /**
   * balance is the balance of the denominated coin for an account.
   */
  balance: Coin | undefined;
}
export interface DenomOwnerProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.DenomOwner";
  value: Uint8Array;
}
/**
 * DenomOwner defines structure representing an account that owns or holds a
 * particular denominated token. It contains the account address and account
 * balance of the denominated token.
 * 
 * Since: cosmos-sdk 0.46
 * @name DenomOwnerAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.DenomOwner
 */
export interface DenomOwnerAmino {
  /**
   * address defines the address that owns a particular denomination.
   */
  address?: string;
  /**
   * balance is the balance of the denominated coin for an account.
   */
  balance: CoinAmino | undefined;
}
export interface DenomOwnerAminoMsg {
  type: "cosmos-sdk/DenomOwner";
  value: DenomOwnerAmino;
}
/**
 * DenomOwner defines structure representing an account that owns or holds a
 * particular denominated token. It contains the account address and account
 * balance of the denominated token.
 * 
 * Since: cosmos-sdk 0.46
 * @name DenomOwnerSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.DenomOwner
 */
export interface DenomOwnerSDKType {
  address: string;
  balance: CoinSDKType | undefined;
}
/**
 * QueryDenomOwnersResponse defines the RPC response of a DenomOwners RPC query.
 * 
 * Since: cosmos-sdk 0.46
 * @name QueryDenomOwnersResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersResponse
 */
export interface QueryDenomOwnersResponse {
  denomOwners: DenomOwner[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponse | undefined;
}
export interface QueryDenomOwnersResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersResponse";
  value: Uint8Array;
}
/**
 * QueryDenomOwnersResponse defines the RPC response of a DenomOwners RPC query.
 * 
 * Since: cosmos-sdk 0.46
 * @name QueryDenomOwnersResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersResponse
 */
export interface QueryDenomOwnersResponseAmino {
  denom_owners?: DenomOwnerAmino[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QueryDenomOwnersResponseAminoMsg {
  type: "cosmos-sdk/QueryDenomOwnersResponse";
  value: QueryDenomOwnersResponseAmino;
}
/**
 * QueryDenomOwnersResponse defines the RPC response of a DenomOwners RPC query.
 * 
 * Since: cosmos-sdk 0.46
 * @name QueryDenomOwnersResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersResponse
 */
export interface QueryDenomOwnersResponseSDKType {
  denom_owners: DenomOwnerSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
/**
 * QueryDenomOwnersByQueryRequest defines the request type for the DenomOwnersByQuery RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryRequest
 */
export interface QueryDenomOwnersByQueryRequest {
  /**
   * denom defines the coin denomination to query all account holders for.
   */
  denom: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequest | undefined;
}
export interface QueryDenomOwnersByQueryRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersByQueryRequest";
  value: Uint8Array;
}
/**
 * QueryDenomOwnersByQueryRequest defines the request type for the DenomOwnersByQuery RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryRequest
 */
export interface QueryDenomOwnersByQueryRequestAmino {
  /**
   * denom defines the coin denomination to query all account holders for.
   */
  denom?: string;
  /**
   * pagination defines an optional pagination for the request.
   */
  pagination?: PageRequestAmino | undefined;
}
export interface QueryDenomOwnersByQueryRequestAminoMsg {
  type: "cosmos-sdk/QueryDenomOwnersByQueryRequest";
  value: QueryDenomOwnersByQueryRequestAmino;
}
/**
 * QueryDenomOwnersByQueryRequest defines the request type for the DenomOwnersByQuery RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryRequest
 */
export interface QueryDenomOwnersByQueryRequestSDKType {
  denom: string;
  pagination?: PageRequestSDKType | undefined;
}
/**
 * QueryDenomOwnersByQueryResponse defines the RPC response of a DenomOwnersByQuery RPC query.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryResponse
 */
export interface QueryDenomOwnersByQueryResponse {
  denomOwners: DenomOwner[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponse | undefined;
}
export interface QueryDenomOwnersByQueryResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersByQueryResponse";
  value: Uint8Array;
}
/**
 * QueryDenomOwnersByQueryResponse defines the RPC response of a DenomOwnersByQuery RPC query.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryResponse
 */
export interface QueryDenomOwnersByQueryResponseAmino {
  denom_owners?: DenomOwnerAmino[];
  /**
   * pagination defines the pagination in the response.
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QueryDenomOwnersByQueryResponseAminoMsg {
  type: "cosmos-sdk/QueryDenomOwnersByQueryResponse";
  value: QueryDenomOwnersByQueryResponseAmino;
}
/**
 * QueryDenomOwnersByQueryResponse defines the RPC response of a DenomOwnersByQuery RPC query.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryResponse
 */
export interface QueryDenomOwnersByQueryResponseSDKType {
  denom_owners: DenomOwnerSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
/**
 * QuerySendEnabledRequest defines the RPC request for looking up SendEnabled entries.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledRequest
 */
export interface QuerySendEnabledRequest {
  /**
   * denoms is the specific denoms you want look up. Leave empty to get all entries.
   */
  denoms: string[];
  /**
   * pagination defines an optional pagination for the request. This field is
   * only read if the denoms field is empty.
   */
  pagination?: PageRequest | undefined;
}
export interface QuerySendEnabledRequestProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySendEnabledRequest";
  value: Uint8Array;
}
/**
 * QuerySendEnabledRequest defines the RPC request for looking up SendEnabled entries.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledRequestAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledRequest
 */
export interface QuerySendEnabledRequestAmino {
  /**
   * denoms is the specific denoms you want look up. Leave empty to get all entries.
   */
  denoms?: string[];
  /**
   * pagination defines an optional pagination for the request. This field is
   * only read if the denoms field is empty.
   */
  pagination?: PageRequestAmino | undefined;
}
export interface QuerySendEnabledRequestAminoMsg {
  type: "cosmos-sdk/QuerySendEnabledRequest";
  value: QuerySendEnabledRequestAmino;
}
/**
 * QuerySendEnabledRequest defines the RPC request for looking up SendEnabled entries.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledRequestSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledRequest
 */
export interface QuerySendEnabledRequestSDKType {
  denoms: string[];
  pagination?: PageRequestSDKType | undefined;
}
/**
 * QuerySendEnabledResponse defines the RPC response of a SendEnable query.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledResponse
 */
export interface QuerySendEnabledResponse {
  sendEnabled: SendEnabled[];
  /**
   * pagination defines the pagination in the response. This field is only
   * populated if the denoms field in the request is empty.
   */
  pagination?: PageResponse | undefined;
}
export interface QuerySendEnabledResponseProtoMsg {
  typeUrl: "/cosmos.bank.v1beta1.QuerySendEnabledResponse";
  value: Uint8Array;
}
/**
 * QuerySendEnabledResponse defines the RPC response of a SendEnable query.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledResponseAmino
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledResponse
 */
export interface QuerySendEnabledResponseAmino {
  send_enabled?: SendEnabledAmino[];
  /**
   * pagination defines the pagination in the response. This field is only
   * populated if the denoms field in the request is empty.
   */
  pagination?: PageResponseAmino | undefined;
}
export interface QuerySendEnabledResponseAminoMsg {
  type: "cosmos-sdk/QuerySendEnabledResponse";
  value: QuerySendEnabledResponseAmino;
}
/**
 * QuerySendEnabledResponse defines the RPC response of a SendEnable query.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledResponseSDKType
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledResponse
 */
export interface QuerySendEnabledResponseSDKType {
  send_enabled: SendEnabledSDKType[];
  pagination?: PageResponseSDKType | undefined;
}
function createBaseQueryBalanceRequest(): QueryBalanceRequest {
  return {
    address: "",
    denom: ""
  };
}
/**
 * QueryBalanceRequest is the request type for the Query/Balance RPC method.
 * @name QueryBalanceRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceRequest
 */
export const QueryBalanceRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryBalanceRequest",
  aminoType: "cosmos-sdk/QueryBalanceRequest",
  is(o: any): o is QueryBalanceRequest {
    return o && (o.$typeUrl === QueryBalanceRequest.typeUrl || typeof o.address === "string" && typeof o.denom === "string");
  },
  isSDK(o: any): o is QueryBalanceRequestSDKType {
    return o && (o.$typeUrl === QueryBalanceRequest.typeUrl || typeof o.address === "string" && typeof o.denom === "string");
  },
  isAmino(o: any): o is QueryBalanceRequestAmino {
    return o && (o.$typeUrl === QueryBalanceRequest.typeUrl || typeof o.address === "string" && typeof o.denom === "string");
  },
  encode(message: QueryBalanceRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.denom !== "") {
      writer.uint32(18).string(message.denom);
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
        case 2:
          message.denom = reader.string();
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
    message.denom = object.denom ?? "";
    return message;
  },
  fromAmino(object: QueryBalanceRequestAmino): QueryBalanceRequest {
    const message = createBaseQueryBalanceRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    return message;
  },
  toAmino(message: QueryBalanceRequest, useInterfaces: boolean = false): QueryBalanceRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.denom = message.denom === "" ? undefined : message.denom;
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
      typeUrl: "/cosmos.bank.v1beta1.QueryBalanceRequest",
      value: QueryBalanceRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryBalanceResponse(): QueryBalanceResponse {
  return {
    balance: undefined
  };
}
/**
 * QueryBalanceResponse is the response type for the Query/Balance RPC method.
 * @name QueryBalanceResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryBalanceResponse
 */
export const QueryBalanceResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryBalanceResponse",
  aminoType: "cosmos-sdk/QueryBalanceResponse",
  is(o: any): o is QueryBalanceResponse {
    return o && o.$typeUrl === QueryBalanceResponse.typeUrl;
  },
  isSDK(o: any): o is QueryBalanceResponseSDKType {
    return o && o.$typeUrl === QueryBalanceResponse.typeUrl;
  },
  isAmino(o: any): o is QueryBalanceResponseAmino {
    return o && o.$typeUrl === QueryBalanceResponse.typeUrl;
  },
  encode(message: QueryBalanceResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.balance !== undefined) {
      Coin.encode(message.balance, writer.uint32(10).fork()).ldelim();
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
          message.balance = Coin.decode(reader, reader.uint32(), useInterfaces);
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
    message.balance = object.balance !== undefined && object.balance !== null ? Coin.fromPartial(object.balance) : undefined;
    return message;
  },
  fromAmino(object: QueryBalanceResponseAmino): QueryBalanceResponse {
    const message = createBaseQueryBalanceResponse();
    if (object.balance !== undefined && object.balance !== null) {
      message.balance = Coin.fromAmino(object.balance);
    }
    return message;
  },
  toAmino(message: QueryBalanceResponse, useInterfaces: boolean = false): QueryBalanceResponseAmino {
    const obj: any = {};
    obj.balance = message.balance ? Coin.toAmino(message.balance, useInterfaces) : undefined;
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
      typeUrl: "/cosmos.bank.v1beta1.QueryBalanceResponse",
      value: QueryBalanceResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryBalanceResponse.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
  }
};
function createBaseQueryAllBalancesRequest(): QueryAllBalancesRequest {
  return {
    address: "",
    pagination: undefined,
    resolveDenom: false
  };
}
/**
 * QueryBalanceRequest is the request type for the Query/AllBalances RPC method.
 * @name QueryAllBalancesRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesRequest
 */
export const QueryAllBalancesRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryAllBalancesRequest",
  aminoType: "cosmos-sdk/QueryAllBalancesRequest",
  is(o: any): o is QueryAllBalancesRequest {
    return o && (o.$typeUrl === QueryAllBalancesRequest.typeUrl || typeof o.address === "string" && typeof o.resolveDenom === "boolean");
  },
  isSDK(o: any): o is QueryAllBalancesRequestSDKType {
    return o && (o.$typeUrl === QueryAllBalancesRequest.typeUrl || typeof o.address === "string" && typeof o.resolve_denom === "boolean");
  },
  isAmino(o: any): o is QueryAllBalancesRequestAmino {
    return o && (o.$typeUrl === QueryAllBalancesRequest.typeUrl || typeof o.address === "string" && typeof o.resolve_denom === "boolean");
  },
  encode(message: QueryAllBalancesRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    if (message.resolveDenom === true) {
      writer.uint32(24).bool(message.resolveDenom);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAllBalancesRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllBalancesRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        case 2:
          message.pagination = PageRequest.decode(reader, reader.uint32(), useInterfaces);
          break;
        case 3:
          message.resolveDenom = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryAllBalancesRequest>): QueryAllBalancesRequest {
    const message = createBaseQueryAllBalancesRequest();
    message.address = object.address ?? "";
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    message.resolveDenom = object.resolveDenom ?? false;
    return message;
  },
  fromAmino(object: QueryAllBalancesRequestAmino): QueryAllBalancesRequest {
    const message = createBaseQueryAllBalancesRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    if (object.resolve_denom !== undefined && object.resolve_denom !== null) {
      message.resolveDenom = object.resolve_denom;
    }
    return message;
  },
  toAmino(message: QueryAllBalancesRequest, useInterfaces: boolean = false): QueryAllBalancesRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    obj.resolve_denom = message.resolveDenom === false ? undefined : message.resolveDenom;
    return obj;
  },
  fromAminoMsg(object: QueryAllBalancesRequestAminoMsg): QueryAllBalancesRequest {
    return QueryAllBalancesRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryAllBalancesRequest, useInterfaces: boolean = false): QueryAllBalancesRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryAllBalancesRequest",
      value: QueryAllBalancesRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryAllBalancesRequestProtoMsg, useInterfaces: boolean = false): QueryAllBalancesRequest {
    return QueryAllBalancesRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAllBalancesRequest): Uint8Array {
    return QueryAllBalancesRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryAllBalancesRequest): QueryAllBalancesRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryAllBalancesRequest",
      value: QueryAllBalancesRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryAllBalancesRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseQueryAllBalancesResponse(): QueryAllBalancesResponse {
  return {
    balances: [],
    pagination: undefined
  };
}
/**
 * QueryAllBalancesResponse is the response type for the Query/AllBalances RPC
 * method.
 * @name QueryAllBalancesResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryAllBalancesResponse
 */
export const QueryAllBalancesResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryAllBalancesResponse",
  aminoType: "cosmos-sdk/QueryAllBalancesResponse",
  is(o: any): o is QueryAllBalancesResponse {
    return o && (o.$typeUrl === QueryAllBalancesResponse.typeUrl || Array.isArray(o.balances) && (!o.balances.length || Coin.is(o.balances[0])));
  },
  isSDK(o: any): o is QueryAllBalancesResponseSDKType {
    return o && (o.$typeUrl === QueryAllBalancesResponse.typeUrl || Array.isArray(o.balances) && (!o.balances.length || Coin.isSDK(o.balances[0])));
  },
  isAmino(o: any): o is QueryAllBalancesResponseAmino {
    return o && (o.$typeUrl === QueryAllBalancesResponse.typeUrl || Array.isArray(o.balances) && (!o.balances.length || Coin.isAmino(o.balances[0])));
  },
  encode(message: QueryAllBalancesResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.balances) {
      Coin.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAllBalancesResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllBalancesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.balances.push(Coin.decode(reader, reader.uint32(), useInterfaces));
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
  fromPartial(object: Partial<QueryAllBalancesResponse>): QueryAllBalancesResponse {
    const message = createBaseQueryAllBalancesResponse();
    message.balances = object.balances?.map(e => Coin.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryAllBalancesResponseAmino): QueryAllBalancesResponse {
    const message = createBaseQueryAllBalancesResponse();
    message.balances = object.balances?.map(e => Coin.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryAllBalancesResponse, useInterfaces: boolean = false): QueryAllBalancesResponseAmino {
    const obj: any = {};
    if (message.balances) {
      obj.balances = message.balances.map(e => e ? Coin.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.balances = message.balances;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryAllBalancesResponseAminoMsg): QueryAllBalancesResponse {
    return QueryAllBalancesResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryAllBalancesResponse, useInterfaces: boolean = false): QueryAllBalancesResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryAllBalancesResponse",
      value: QueryAllBalancesResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryAllBalancesResponseProtoMsg, useInterfaces: boolean = false): QueryAllBalancesResponse {
    return QueryAllBalancesResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAllBalancesResponse): Uint8Array {
    return QueryAllBalancesResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryAllBalancesResponse): QueryAllBalancesResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryAllBalancesResponse",
      value: QueryAllBalancesResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryAllBalancesResponse.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};
function createBaseQuerySpendableBalancesRequest(): QuerySpendableBalancesRequest {
  return {
    address: "",
    pagination: undefined
  };
}
/**
 * QuerySpendableBalancesRequest defines the gRPC request structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesRequest
 */
export const QuerySpendableBalancesRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalancesRequest",
  aminoType: "cosmos-sdk/QuerySpendableBalancesRequest",
  is(o: any): o is QuerySpendableBalancesRequest {
    return o && (o.$typeUrl === QuerySpendableBalancesRequest.typeUrl || typeof o.address === "string");
  },
  isSDK(o: any): o is QuerySpendableBalancesRequestSDKType {
    return o && (o.$typeUrl === QuerySpendableBalancesRequest.typeUrl || typeof o.address === "string");
  },
  isAmino(o: any): o is QuerySpendableBalancesRequestAmino {
    return o && (o.$typeUrl === QuerySpendableBalancesRequest.typeUrl || typeof o.address === "string");
  },
  encode(message: QuerySpendableBalancesRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySpendableBalancesRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySpendableBalancesRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
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
  fromPartial(object: Partial<QuerySpendableBalancesRequest>): QuerySpendableBalancesRequest {
    const message = createBaseQuerySpendableBalancesRequest();
    message.address = object.address ?? "";
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QuerySpendableBalancesRequestAmino): QuerySpendableBalancesRequest {
    const message = createBaseQuerySpendableBalancesRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QuerySpendableBalancesRequest, useInterfaces: boolean = false): QuerySpendableBalancesRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QuerySpendableBalancesRequestAminoMsg): QuerySpendableBalancesRequest {
    return QuerySpendableBalancesRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySpendableBalancesRequest, useInterfaces: boolean = false): QuerySpendableBalancesRequestAminoMsg {
    return {
      type: "cosmos-sdk/QuerySpendableBalancesRequest",
      value: QuerySpendableBalancesRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySpendableBalancesRequestProtoMsg, useInterfaces: boolean = false): QuerySpendableBalancesRequest {
    return QuerySpendableBalancesRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySpendableBalancesRequest): Uint8Array {
    return QuerySpendableBalancesRequest.encode(message).finish();
  },
  toProtoMsg(message: QuerySpendableBalancesRequest): QuerySpendableBalancesRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalancesRequest",
      value: QuerySpendableBalancesRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QuerySpendableBalancesRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseQuerySpendableBalancesResponse(): QuerySpendableBalancesResponse {
  return {
    balances: [],
    pagination: undefined
  };
}
/**
 * QuerySpendableBalancesResponse defines the gRPC response structure for querying
 * an account's spendable balances.
 * 
 * Since: cosmos-sdk 0.46
 * @name QuerySpendableBalancesResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalancesResponse
 */
export const QuerySpendableBalancesResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalancesResponse",
  aminoType: "cosmos-sdk/QuerySpendableBalancesResponse",
  is(o: any): o is QuerySpendableBalancesResponse {
    return o && (o.$typeUrl === QuerySpendableBalancesResponse.typeUrl || Array.isArray(o.balances) && (!o.balances.length || Coin.is(o.balances[0])));
  },
  isSDK(o: any): o is QuerySpendableBalancesResponseSDKType {
    return o && (o.$typeUrl === QuerySpendableBalancesResponse.typeUrl || Array.isArray(o.balances) && (!o.balances.length || Coin.isSDK(o.balances[0])));
  },
  isAmino(o: any): o is QuerySpendableBalancesResponseAmino {
    return o && (o.$typeUrl === QuerySpendableBalancesResponse.typeUrl || Array.isArray(o.balances) && (!o.balances.length || Coin.isAmino(o.balances[0])));
  },
  encode(message: QuerySpendableBalancesResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.balances) {
      Coin.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySpendableBalancesResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySpendableBalancesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.balances.push(Coin.decode(reader, reader.uint32(), useInterfaces));
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
  fromPartial(object: Partial<QuerySpendableBalancesResponse>): QuerySpendableBalancesResponse {
    const message = createBaseQuerySpendableBalancesResponse();
    message.balances = object.balances?.map(e => Coin.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QuerySpendableBalancesResponseAmino): QuerySpendableBalancesResponse {
    const message = createBaseQuerySpendableBalancesResponse();
    message.balances = object.balances?.map(e => Coin.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QuerySpendableBalancesResponse, useInterfaces: boolean = false): QuerySpendableBalancesResponseAmino {
    const obj: any = {};
    if (message.balances) {
      obj.balances = message.balances.map(e => e ? Coin.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.balances = message.balances;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QuerySpendableBalancesResponseAminoMsg): QuerySpendableBalancesResponse {
    return QuerySpendableBalancesResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySpendableBalancesResponse, useInterfaces: boolean = false): QuerySpendableBalancesResponseAminoMsg {
    return {
      type: "cosmos-sdk/QuerySpendableBalancesResponse",
      value: QuerySpendableBalancesResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySpendableBalancesResponseProtoMsg, useInterfaces: boolean = false): QuerySpendableBalancesResponse {
    return QuerySpendableBalancesResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySpendableBalancesResponse): Uint8Array {
    return QuerySpendableBalancesResponse.encode(message).finish();
  },
  toProtoMsg(message: QuerySpendableBalancesResponse): QuerySpendableBalancesResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalancesResponse",
      value: QuerySpendableBalancesResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QuerySpendableBalancesResponse.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};
function createBaseQuerySpendableBalanceByDenomRequest(): QuerySpendableBalanceByDenomRequest {
  return {
    address: "",
    denom: ""
  };
}
/**
 * QuerySpendableBalanceByDenomRequest defines the gRPC request structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomRequest
 */
export const QuerySpendableBalanceByDenomRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalanceByDenomRequest",
  aminoType: "cosmos-sdk/QuerySpendableBalanceByDenomRequest",
  is(o: any): o is QuerySpendableBalanceByDenomRequest {
    return o && (o.$typeUrl === QuerySpendableBalanceByDenomRequest.typeUrl || typeof o.address === "string" && typeof o.denom === "string");
  },
  isSDK(o: any): o is QuerySpendableBalanceByDenomRequestSDKType {
    return o && (o.$typeUrl === QuerySpendableBalanceByDenomRequest.typeUrl || typeof o.address === "string" && typeof o.denom === "string");
  },
  isAmino(o: any): o is QuerySpendableBalanceByDenomRequestAmino {
    return o && (o.$typeUrl === QuerySpendableBalanceByDenomRequest.typeUrl || typeof o.address === "string" && typeof o.denom === "string");
  },
  encode(message: QuerySpendableBalanceByDenomRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.denom !== "") {
      writer.uint32(18).string(message.denom);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySpendableBalanceByDenomRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySpendableBalanceByDenomRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        case 2:
          message.denom = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QuerySpendableBalanceByDenomRequest>): QuerySpendableBalanceByDenomRequest {
    const message = createBaseQuerySpendableBalanceByDenomRequest();
    message.address = object.address ?? "";
    message.denom = object.denom ?? "";
    return message;
  },
  fromAmino(object: QuerySpendableBalanceByDenomRequestAmino): QuerySpendableBalanceByDenomRequest {
    const message = createBaseQuerySpendableBalanceByDenomRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    return message;
  },
  toAmino(message: QuerySpendableBalanceByDenomRequest, useInterfaces: boolean = false): QuerySpendableBalanceByDenomRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.denom = message.denom === "" ? undefined : message.denom;
    return obj;
  },
  fromAminoMsg(object: QuerySpendableBalanceByDenomRequestAminoMsg): QuerySpendableBalanceByDenomRequest {
    return QuerySpendableBalanceByDenomRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySpendableBalanceByDenomRequest, useInterfaces: boolean = false): QuerySpendableBalanceByDenomRequestAminoMsg {
    return {
      type: "cosmos-sdk/QuerySpendableBalanceByDenomRequest",
      value: QuerySpendableBalanceByDenomRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySpendableBalanceByDenomRequestProtoMsg, useInterfaces: boolean = false): QuerySpendableBalanceByDenomRequest {
    return QuerySpendableBalanceByDenomRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySpendableBalanceByDenomRequest): Uint8Array {
    return QuerySpendableBalanceByDenomRequest.encode(message).finish();
  },
  toProtoMsg(message: QuerySpendableBalanceByDenomRequest): QuerySpendableBalanceByDenomRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalanceByDenomRequest",
      value: QuerySpendableBalanceByDenomRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQuerySpendableBalanceByDenomResponse(): QuerySpendableBalanceByDenomResponse {
  return {
    balance: undefined
  };
}
/**
 * QuerySpendableBalanceByDenomResponse defines the gRPC response structure for
 * querying an account's spendable balance for a specific denom.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySpendableBalanceByDenomResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySpendableBalanceByDenomResponse
 */
export const QuerySpendableBalanceByDenomResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalanceByDenomResponse",
  aminoType: "cosmos-sdk/QuerySpendableBalanceByDenomResponse",
  is(o: any): o is QuerySpendableBalanceByDenomResponse {
    return o && o.$typeUrl === QuerySpendableBalanceByDenomResponse.typeUrl;
  },
  isSDK(o: any): o is QuerySpendableBalanceByDenomResponseSDKType {
    return o && o.$typeUrl === QuerySpendableBalanceByDenomResponse.typeUrl;
  },
  isAmino(o: any): o is QuerySpendableBalanceByDenomResponseAmino {
    return o && o.$typeUrl === QuerySpendableBalanceByDenomResponse.typeUrl;
  },
  encode(message: QuerySpendableBalanceByDenomResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.balance !== undefined) {
      Coin.encode(message.balance, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySpendableBalanceByDenomResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySpendableBalanceByDenomResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.balance = Coin.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QuerySpendableBalanceByDenomResponse>): QuerySpendableBalanceByDenomResponse {
    const message = createBaseQuerySpendableBalanceByDenomResponse();
    message.balance = object.balance !== undefined && object.balance !== null ? Coin.fromPartial(object.balance) : undefined;
    return message;
  },
  fromAmino(object: QuerySpendableBalanceByDenomResponseAmino): QuerySpendableBalanceByDenomResponse {
    const message = createBaseQuerySpendableBalanceByDenomResponse();
    if (object.balance !== undefined && object.balance !== null) {
      message.balance = Coin.fromAmino(object.balance);
    }
    return message;
  },
  toAmino(message: QuerySpendableBalanceByDenomResponse, useInterfaces: boolean = false): QuerySpendableBalanceByDenomResponseAmino {
    const obj: any = {};
    obj.balance = message.balance ? Coin.toAmino(message.balance, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QuerySpendableBalanceByDenomResponseAminoMsg): QuerySpendableBalanceByDenomResponse {
    return QuerySpendableBalanceByDenomResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySpendableBalanceByDenomResponse, useInterfaces: boolean = false): QuerySpendableBalanceByDenomResponseAminoMsg {
    return {
      type: "cosmos-sdk/QuerySpendableBalanceByDenomResponse",
      value: QuerySpendableBalanceByDenomResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySpendableBalanceByDenomResponseProtoMsg, useInterfaces: boolean = false): QuerySpendableBalanceByDenomResponse {
    return QuerySpendableBalanceByDenomResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySpendableBalanceByDenomResponse): Uint8Array {
    return QuerySpendableBalanceByDenomResponse.encode(message).finish();
  },
  toProtoMsg(message: QuerySpendableBalanceByDenomResponse): QuerySpendableBalanceByDenomResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySpendableBalanceByDenomResponse",
      value: QuerySpendableBalanceByDenomResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QuerySpendableBalanceByDenomResponse.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
  }
};
function createBaseQueryTotalSupplyRequest(): QueryTotalSupplyRequest {
  return {
    pagination: undefined
  };
}
/**
 * QueryTotalSupplyRequest is the request type for the Query/TotalSupply RPC
 * method.
 * @name QueryTotalSupplyRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyRequest
 */
export const QueryTotalSupplyRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryTotalSupplyRequest",
  aminoType: "cosmos-sdk/QueryTotalSupplyRequest",
  is(o: any): o is QueryTotalSupplyRequest {
    return o && o.$typeUrl === QueryTotalSupplyRequest.typeUrl;
  },
  isSDK(o: any): o is QueryTotalSupplyRequestSDKType {
    return o && o.$typeUrl === QueryTotalSupplyRequest.typeUrl;
  },
  isAmino(o: any): o is QueryTotalSupplyRequestAmino {
    return o && o.$typeUrl === QueryTotalSupplyRequest.typeUrl;
  },
  encode(message: QueryTotalSupplyRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTotalSupplyRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTotalSupplyRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryTotalSupplyRequest>): QueryTotalSupplyRequest {
    const message = createBaseQueryTotalSupplyRequest();
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryTotalSupplyRequestAmino): QueryTotalSupplyRequest {
    const message = createBaseQueryTotalSupplyRequest();
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryTotalSupplyRequest, useInterfaces: boolean = false): QueryTotalSupplyRequestAmino {
    const obj: any = {};
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTotalSupplyRequestAminoMsg): QueryTotalSupplyRequest {
    return QueryTotalSupplyRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTotalSupplyRequest, useInterfaces: boolean = false): QueryTotalSupplyRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryTotalSupplyRequest",
      value: QueryTotalSupplyRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTotalSupplyRequestProtoMsg, useInterfaces: boolean = false): QueryTotalSupplyRequest {
    return QueryTotalSupplyRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTotalSupplyRequest): Uint8Array {
    return QueryTotalSupplyRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryTotalSupplyRequest): QueryTotalSupplyRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryTotalSupplyRequest",
      value: QueryTotalSupplyRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryTotalSupplyRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseQueryTotalSupplyResponse(): QueryTotalSupplyResponse {
  return {
    supply: [],
    pagination: undefined
  };
}
/**
 * QueryTotalSupplyResponse is the response type for the Query/TotalSupply RPC
 * method
 * @name QueryTotalSupplyResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryTotalSupplyResponse
 */
export const QueryTotalSupplyResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryTotalSupplyResponse",
  aminoType: "cosmos-sdk/QueryTotalSupplyResponse",
  is(o: any): o is QueryTotalSupplyResponse {
    return o && (o.$typeUrl === QueryTotalSupplyResponse.typeUrl || Array.isArray(o.supply) && (!o.supply.length || Coin.is(o.supply[0])));
  },
  isSDK(o: any): o is QueryTotalSupplyResponseSDKType {
    return o && (o.$typeUrl === QueryTotalSupplyResponse.typeUrl || Array.isArray(o.supply) && (!o.supply.length || Coin.isSDK(o.supply[0])));
  },
  isAmino(o: any): o is QueryTotalSupplyResponseAmino {
    return o && (o.$typeUrl === QueryTotalSupplyResponse.typeUrl || Array.isArray(o.supply) && (!o.supply.length || Coin.isAmino(o.supply[0])));
  },
  encode(message: QueryTotalSupplyResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.supply) {
      Coin.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryTotalSupplyResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryTotalSupplyResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.supply.push(Coin.decode(reader, reader.uint32(), useInterfaces));
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
  fromPartial(object: Partial<QueryTotalSupplyResponse>): QueryTotalSupplyResponse {
    const message = createBaseQueryTotalSupplyResponse();
    message.supply = object.supply?.map(e => Coin.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryTotalSupplyResponseAmino): QueryTotalSupplyResponse {
    const message = createBaseQueryTotalSupplyResponse();
    message.supply = object.supply?.map(e => Coin.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryTotalSupplyResponse, useInterfaces: boolean = false): QueryTotalSupplyResponseAmino {
    const obj: any = {};
    if (message.supply) {
      obj.supply = message.supply.map(e => e ? Coin.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.supply = message.supply;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryTotalSupplyResponseAminoMsg): QueryTotalSupplyResponse {
    return QueryTotalSupplyResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryTotalSupplyResponse, useInterfaces: boolean = false): QueryTotalSupplyResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryTotalSupplyResponse",
      value: QueryTotalSupplyResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryTotalSupplyResponseProtoMsg, useInterfaces: boolean = false): QueryTotalSupplyResponse {
    return QueryTotalSupplyResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryTotalSupplyResponse): Uint8Array {
    return QueryTotalSupplyResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryTotalSupplyResponse): QueryTotalSupplyResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryTotalSupplyResponse",
      value: QueryTotalSupplyResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryTotalSupplyResponse.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};
function createBaseQuerySupplyOfRequest(): QuerySupplyOfRequest {
  return {
    denom: ""
  };
}
/**
 * QuerySupplyOfRequest is the request type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfRequest
 */
export const QuerySupplyOfRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySupplyOfRequest",
  aminoType: "cosmos-sdk/QuerySupplyOfRequest",
  is(o: any): o is QuerySupplyOfRequest {
    return o && (o.$typeUrl === QuerySupplyOfRequest.typeUrl || typeof o.denom === "string");
  },
  isSDK(o: any): o is QuerySupplyOfRequestSDKType {
    return o && (o.$typeUrl === QuerySupplyOfRequest.typeUrl || typeof o.denom === "string");
  },
  isAmino(o: any): o is QuerySupplyOfRequestAmino {
    return o && (o.$typeUrl === QuerySupplyOfRequest.typeUrl || typeof o.denom === "string");
  },
  encode(message: QuerySupplyOfRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.denom !== "") {
      writer.uint32(10).string(message.denom);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySupplyOfRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySupplyOfRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denom = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QuerySupplyOfRequest>): QuerySupplyOfRequest {
    const message = createBaseQuerySupplyOfRequest();
    message.denom = object.denom ?? "";
    return message;
  },
  fromAmino(object: QuerySupplyOfRequestAmino): QuerySupplyOfRequest {
    const message = createBaseQuerySupplyOfRequest();
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    return message;
  },
  toAmino(message: QuerySupplyOfRequest, useInterfaces: boolean = false): QuerySupplyOfRequestAmino {
    const obj: any = {};
    obj.denom = message.denom === "" ? undefined : message.denom;
    return obj;
  },
  fromAminoMsg(object: QuerySupplyOfRequestAminoMsg): QuerySupplyOfRequest {
    return QuerySupplyOfRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySupplyOfRequest, useInterfaces: boolean = false): QuerySupplyOfRequestAminoMsg {
    return {
      type: "cosmos-sdk/QuerySupplyOfRequest",
      value: QuerySupplyOfRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySupplyOfRequestProtoMsg, useInterfaces: boolean = false): QuerySupplyOfRequest {
    return QuerySupplyOfRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySupplyOfRequest): Uint8Array {
    return QuerySupplyOfRequest.encode(message).finish();
  },
  toProtoMsg(message: QuerySupplyOfRequest): QuerySupplyOfRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySupplyOfRequest",
      value: QuerySupplyOfRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQuerySupplyOfResponse(): QuerySupplyOfResponse {
  return {
    amount: Coin.fromPartial({})
  };
}
/**
 * QuerySupplyOfResponse is the response type for the Query/SupplyOf RPC method.
 * @name QuerySupplyOfResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySupplyOfResponse
 */
export const QuerySupplyOfResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySupplyOfResponse",
  aminoType: "cosmos-sdk/QuerySupplyOfResponse",
  is(o: any): o is QuerySupplyOfResponse {
    return o && (o.$typeUrl === QuerySupplyOfResponse.typeUrl || Coin.is(o.amount));
  },
  isSDK(o: any): o is QuerySupplyOfResponseSDKType {
    return o && (o.$typeUrl === QuerySupplyOfResponse.typeUrl || Coin.isSDK(o.amount));
  },
  isAmino(o: any): o is QuerySupplyOfResponseAmino {
    return o && (o.$typeUrl === QuerySupplyOfResponse.typeUrl || Coin.isAmino(o.amount));
  },
  encode(message: QuerySupplyOfResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.amount !== undefined) {
      Coin.encode(message.amount, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySupplyOfResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySupplyOfResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.amount = Coin.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QuerySupplyOfResponse>): QuerySupplyOfResponse {
    const message = createBaseQuerySupplyOfResponse();
    message.amount = object.amount !== undefined && object.amount !== null ? Coin.fromPartial(object.amount) : undefined;
    return message;
  },
  fromAmino(object: QuerySupplyOfResponseAmino): QuerySupplyOfResponse {
    const message = createBaseQuerySupplyOfResponse();
    if (object.amount !== undefined && object.amount !== null) {
      message.amount = Coin.fromAmino(object.amount);
    }
    return message;
  },
  toAmino(message: QuerySupplyOfResponse, useInterfaces: boolean = false): QuerySupplyOfResponseAmino {
    const obj: any = {};
    obj.amount = message.amount ? Coin.toAmino(message.amount, useInterfaces) : Coin.toAmino(Coin.fromPartial({}));
    return obj;
  },
  fromAminoMsg(object: QuerySupplyOfResponseAminoMsg): QuerySupplyOfResponse {
    return QuerySupplyOfResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySupplyOfResponse, useInterfaces: boolean = false): QuerySupplyOfResponseAminoMsg {
    return {
      type: "cosmos-sdk/QuerySupplyOfResponse",
      value: QuerySupplyOfResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySupplyOfResponseProtoMsg, useInterfaces: boolean = false): QuerySupplyOfResponse {
    return QuerySupplyOfResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySupplyOfResponse): Uint8Array {
    return QuerySupplyOfResponse.encode(message).finish();
  },
  toProtoMsg(message: QuerySupplyOfResponse): QuerySupplyOfResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySupplyOfResponse",
      value: QuerySupplyOfResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QuerySupplyOfResponse.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
  }
};
function createBaseQueryParamsRequest(): QueryParamsRequest {
  return {};
}
/**
 * QueryParamsRequest defines the request type for querying x/bank parameters.
 * @name QueryParamsRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsRequest
 */
export const QueryParamsRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryParamsRequest",
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
      typeUrl: "/cosmos.bank.v1beta1.QueryParamsRequest",
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
 * QueryParamsResponse defines the response type for querying x/bank parameters.
 * @name QueryParamsResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryParamsResponse
 */
export const QueryParamsResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryParamsResponse",
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
      typeUrl: "/cosmos.bank.v1beta1.QueryParamsResponse",
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
function createBaseQueryDenomsMetadataRequest(): QueryDenomsMetadataRequest {
  return {
    pagination: undefined
  };
}
/**
 * QueryDenomsMetadataRequest is the request type for the Query/DenomsMetadata RPC method.
 * @name QueryDenomsMetadataRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataRequest
 */
export const QueryDenomsMetadataRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomsMetadataRequest",
  aminoType: "cosmos-sdk/QueryDenomsMetadataRequest",
  is(o: any): o is QueryDenomsMetadataRequest {
    return o && o.$typeUrl === QueryDenomsMetadataRequest.typeUrl;
  },
  isSDK(o: any): o is QueryDenomsMetadataRequestSDKType {
    return o && o.$typeUrl === QueryDenomsMetadataRequest.typeUrl;
  },
  isAmino(o: any): o is QueryDenomsMetadataRequestAmino {
    return o && o.$typeUrl === QueryDenomsMetadataRequest.typeUrl;
  },
  encode(message: QueryDenomsMetadataRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomsMetadataRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomsMetadataRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryDenomsMetadataRequest>): QueryDenomsMetadataRequest {
    const message = createBaseQueryDenomsMetadataRequest();
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomsMetadataRequestAmino): QueryDenomsMetadataRequest {
    const message = createBaseQueryDenomsMetadataRequest();
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryDenomsMetadataRequest, useInterfaces: boolean = false): QueryDenomsMetadataRequestAmino {
    const obj: any = {};
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryDenomsMetadataRequestAminoMsg): QueryDenomsMetadataRequest {
    return QueryDenomsMetadataRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomsMetadataRequest, useInterfaces: boolean = false): QueryDenomsMetadataRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomsMetadataRequest",
      value: QueryDenomsMetadataRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomsMetadataRequestProtoMsg, useInterfaces: boolean = false): QueryDenomsMetadataRequest {
    return QueryDenomsMetadataRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomsMetadataRequest): Uint8Array {
    return QueryDenomsMetadataRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomsMetadataRequest): QueryDenomsMetadataRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomsMetadataRequest",
      value: QueryDenomsMetadataRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomsMetadataRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseQueryDenomsMetadataResponse(): QueryDenomsMetadataResponse {
  return {
    metadatas: [],
    pagination: undefined
  };
}
/**
 * QueryDenomsMetadataResponse is the response type for the Query/DenomsMetadata RPC
 * method.
 * @name QueryDenomsMetadataResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomsMetadataResponse
 */
export const QueryDenomsMetadataResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomsMetadataResponse",
  aminoType: "cosmos-sdk/QueryDenomsMetadataResponse",
  is(o: any): o is QueryDenomsMetadataResponse {
    return o && (o.$typeUrl === QueryDenomsMetadataResponse.typeUrl || Array.isArray(o.metadatas) && (!o.metadatas.length || Metadata.is(o.metadatas[0])));
  },
  isSDK(o: any): o is QueryDenomsMetadataResponseSDKType {
    return o && (o.$typeUrl === QueryDenomsMetadataResponse.typeUrl || Array.isArray(o.metadatas) && (!o.metadatas.length || Metadata.isSDK(o.metadatas[0])));
  },
  isAmino(o: any): o is QueryDenomsMetadataResponseAmino {
    return o && (o.$typeUrl === QueryDenomsMetadataResponse.typeUrl || Array.isArray(o.metadatas) && (!o.metadatas.length || Metadata.isAmino(o.metadatas[0])));
  },
  encode(message: QueryDenomsMetadataResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.metadatas) {
      Metadata.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomsMetadataResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomsMetadataResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.metadatas.push(Metadata.decode(reader, reader.uint32(), useInterfaces));
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
  fromPartial(object: Partial<QueryDenomsMetadataResponse>): QueryDenomsMetadataResponse {
    const message = createBaseQueryDenomsMetadataResponse();
    message.metadatas = object.metadatas?.map(e => Metadata.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomsMetadataResponseAmino): QueryDenomsMetadataResponse {
    const message = createBaseQueryDenomsMetadataResponse();
    message.metadatas = object.metadatas?.map(e => Metadata.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryDenomsMetadataResponse, useInterfaces: boolean = false): QueryDenomsMetadataResponseAmino {
    const obj: any = {};
    if (message.metadatas) {
      obj.metadatas = message.metadatas.map(e => e ? Metadata.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.metadatas = message.metadatas;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryDenomsMetadataResponseAminoMsg): QueryDenomsMetadataResponse {
    return QueryDenomsMetadataResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomsMetadataResponse, useInterfaces: boolean = false): QueryDenomsMetadataResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomsMetadataResponse",
      value: QueryDenomsMetadataResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomsMetadataResponseProtoMsg, useInterfaces: boolean = false): QueryDenomsMetadataResponse {
    return QueryDenomsMetadataResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomsMetadataResponse): Uint8Array {
    return QueryDenomsMetadataResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomsMetadataResponse): QueryDenomsMetadataResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomsMetadataResponse",
      value: QueryDenomsMetadataResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomsMetadataResponse.typeUrl)) {
      return;
    }
    Metadata.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};
function createBaseQueryDenomMetadataRequest(): QueryDenomMetadataRequest {
  return {
    denom: ""
  };
}
/**
 * QueryDenomMetadataRequest is the request type for the Query/DenomMetadata RPC method.
 * @name QueryDenomMetadataRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataRequest
 */
export const QueryDenomMetadataRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataRequest",
  aminoType: "cosmos-sdk/QueryDenomMetadataRequest",
  is(o: any): o is QueryDenomMetadataRequest {
    return o && (o.$typeUrl === QueryDenomMetadataRequest.typeUrl || typeof o.denom === "string");
  },
  isSDK(o: any): o is QueryDenomMetadataRequestSDKType {
    return o && (o.$typeUrl === QueryDenomMetadataRequest.typeUrl || typeof o.denom === "string");
  },
  isAmino(o: any): o is QueryDenomMetadataRequestAmino {
    return o && (o.$typeUrl === QueryDenomMetadataRequest.typeUrl || typeof o.denom === "string");
  },
  encode(message: QueryDenomMetadataRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.denom !== "") {
      writer.uint32(10).string(message.denom);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomMetadataRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomMetadataRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denom = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryDenomMetadataRequest>): QueryDenomMetadataRequest {
    const message = createBaseQueryDenomMetadataRequest();
    message.denom = object.denom ?? "";
    return message;
  },
  fromAmino(object: QueryDenomMetadataRequestAmino): QueryDenomMetadataRequest {
    const message = createBaseQueryDenomMetadataRequest();
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    return message;
  },
  toAmino(message: QueryDenomMetadataRequest, useInterfaces: boolean = false): QueryDenomMetadataRequestAmino {
    const obj: any = {};
    obj.denom = message.denom === "" ? undefined : message.denom;
    return obj;
  },
  fromAminoMsg(object: QueryDenomMetadataRequestAminoMsg): QueryDenomMetadataRequest {
    return QueryDenomMetadataRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomMetadataRequest, useInterfaces: boolean = false): QueryDenomMetadataRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomMetadataRequest",
      value: QueryDenomMetadataRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomMetadataRequestProtoMsg, useInterfaces: boolean = false): QueryDenomMetadataRequest {
    return QueryDenomMetadataRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomMetadataRequest): Uint8Array {
    return QueryDenomMetadataRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomMetadataRequest): QueryDenomMetadataRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataRequest",
      value: QueryDenomMetadataRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryDenomMetadataResponse(): QueryDenomMetadataResponse {
  return {
    metadata: Metadata.fromPartial({})
  };
}
/**
 * QueryDenomMetadataResponse is the response type for the Query/DenomMetadata RPC
 * method.
 * @name QueryDenomMetadataResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataResponse
 */
export const QueryDenomMetadataResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataResponse",
  aminoType: "cosmos-sdk/QueryDenomMetadataResponse",
  is(o: any): o is QueryDenomMetadataResponse {
    return o && (o.$typeUrl === QueryDenomMetadataResponse.typeUrl || Metadata.is(o.metadata));
  },
  isSDK(o: any): o is QueryDenomMetadataResponseSDKType {
    return o && (o.$typeUrl === QueryDenomMetadataResponse.typeUrl || Metadata.isSDK(o.metadata));
  },
  isAmino(o: any): o is QueryDenomMetadataResponseAmino {
    return o && (o.$typeUrl === QueryDenomMetadataResponse.typeUrl || Metadata.isAmino(o.metadata));
  },
  encode(message: QueryDenomMetadataResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.metadata !== undefined) {
      Metadata.encode(message.metadata, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomMetadataResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomMetadataResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.metadata = Metadata.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryDenomMetadataResponse>): QueryDenomMetadataResponse {
    const message = createBaseQueryDenomMetadataResponse();
    message.metadata = object.metadata !== undefined && object.metadata !== null ? Metadata.fromPartial(object.metadata) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomMetadataResponseAmino): QueryDenomMetadataResponse {
    const message = createBaseQueryDenomMetadataResponse();
    if (object.metadata !== undefined && object.metadata !== null) {
      message.metadata = Metadata.fromAmino(object.metadata);
    }
    return message;
  },
  toAmino(message: QueryDenomMetadataResponse, useInterfaces: boolean = false): QueryDenomMetadataResponseAmino {
    const obj: any = {};
    obj.metadata = message.metadata ? Metadata.toAmino(message.metadata, useInterfaces) : Metadata.toAmino(Metadata.fromPartial({}));
    return obj;
  },
  fromAminoMsg(object: QueryDenomMetadataResponseAminoMsg): QueryDenomMetadataResponse {
    return QueryDenomMetadataResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomMetadataResponse, useInterfaces: boolean = false): QueryDenomMetadataResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomMetadataResponse",
      value: QueryDenomMetadataResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomMetadataResponseProtoMsg, useInterfaces: boolean = false): QueryDenomMetadataResponse {
    return QueryDenomMetadataResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomMetadataResponse): Uint8Array {
    return QueryDenomMetadataResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomMetadataResponse): QueryDenomMetadataResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataResponse",
      value: QueryDenomMetadataResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomMetadataResponse.typeUrl)) {
      return;
    }
    Metadata.registerTypeUrl();
  }
};
function createBaseQueryDenomMetadataByQueryStringRequest(): QueryDenomMetadataByQueryStringRequest {
  return {
    denom: ""
  };
}
/**
 * QueryDenomMetadataByQueryStringRequest is the request type for the Query/DenomMetadata RPC method.
 * Identical with QueryDenomMetadataRequest but receives denom as query string.
 * @name QueryDenomMetadataByQueryStringRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringRequest
 */
export const QueryDenomMetadataByQueryStringRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringRequest",
  aminoType: "cosmos-sdk/QueryDenomMetadataByQueryStringRequest",
  is(o: any): o is QueryDenomMetadataByQueryStringRequest {
    return o && (o.$typeUrl === QueryDenomMetadataByQueryStringRequest.typeUrl || typeof o.denom === "string");
  },
  isSDK(o: any): o is QueryDenomMetadataByQueryStringRequestSDKType {
    return o && (o.$typeUrl === QueryDenomMetadataByQueryStringRequest.typeUrl || typeof o.denom === "string");
  },
  isAmino(o: any): o is QueryDenomMetadataByQueryStringRequestAmino {
    return o && (o.$typeUrl === QueryDenomMetadataByQueryStringRequest.typeUrl || typeof o.denom === "string");
  },
  encode(message: QueryDenomMetadataByQueryStringRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.denom !== "") {
      writer.uint32(10).string(message.denom);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomMetadataByQueryStringRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denom = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryDenomMetadataByQueryStringRequest>): QueryDenomMetadataByQueryStringRequest {
    const message = createBaseQueryDenomMetadataByQueryStringRequest();
    message.denom = object.denom ?? "";
    return message;
  },
  fromAmino(object: QueryDenomMetadataByQueryStringRequestAmino): QueryDenomMetadataByQueryStringRequest {
    const message = createBaseQueryDenomMetadataByQueryStringRequest();
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    return message;
  },
  toAmino(message: QueryDenomMetadataByQueryStringRequest, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringRequestAmino {
    const obj: any = {};
    obj.denom = message.denom === "" ? undefined : message.denom;
    return obj;
  },
  fromAminoMsg(object: QueryDenomMetadataByQueryStringRequestAminoMsg): QueryDenomMetadataByQueryStringRequest {
    return QueryDenomMetadataByQueryStringRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomMetadataByQueryStringRequest, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomMetadataByQueryStringRequest",
      value: QueryDenomMetadataByQueryStringRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomMetadataByQueryStringRequestProtoMsg, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringRequest {
    return QueryDenomMetadataByQueryStringRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomMetadataByQueryStringRequest): Uint8Array {
    return QueryDenomMetadataByQueryStringRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomMetadataByQueryStringRequest): QueryDenomMetadataByQueryStringRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringRequest",
      value: QueryDenomMetadataByQueryStringRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryDenomMetadataByQueryStringResponse(): QueryDenomMetadataByQueryStringResponse {
  return {
    metadata: Metadata.fromPartial({})
  };
}
/**
 * QueryDenomMetadataByQueryStringResponse is the response type for the Query/DenomMetadata RPC
 * method. Identical with QueryDenomMetadataResponse but receives denom as query string in request.
 * @name QueryDenomMetadataByQueryStringResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringResponse
 */
export const QueryDenomMetadataByQueryStringResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringResponse",
  aminoType: "cosmos-sdk/QueryDenomMetadataByQueryStringResponse",
  is(o: any): o is QueryDenomMetadataByQueryStringResponse {
    return o && (o.$typeUrl === QueryDenomMetadataByQueryStringResponse.typeUrl || Metadata.is(o.metadata));
  },
  isSDK(o: any): o is QueryDenomMetadataByQueryStringResponseSDKType {
    return o && (o.$typeUrl === QueryDenomMetadataByQueryStringResponse.typeUrl || Metadata.isSDK(o.metadata));
  },
  isAmino(o: any): o is QueryDenomMetadataByQueryStringResponseAmino {
    return o && (o.$typeUrl === QueryDenomMetadataByQueryStringResponse.typeUrl || Metadata.isAmino(o.metadata));
  },
  encode(message: QueryDenomMetadataByQueryStringResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.metadata !== undefined) {
      Metadata.encode(message.metadata, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomMetadataByQueryStringResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.metadata = Metadata.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryDenomMetadataByQueryStringResponse>): QueryDenomMetadataByQueryStringResponse {
    const message = createBaseQueryDenomMetadataByQueryStringResponse();
    message.metadata = object.metadata !== undefined && object.metadata !== null ? Metadata.fromPartial(object.metadata) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomMetadataByQueryStringResponseAmino): QueryDenomMetadataByQueryStringResponse {
    const message = createBaseQueryDenomMetadataByQueryStringResponse();
    if (object.metadata !== undefined && object.metadata !== null) {
      message.metadata = Metadata.fromAmino(object.metadata);
    }
    return message;
  },
  toAmino(message: QueryDenomMetadataByQueryStringResponse, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringResponseAmino {
    const obj: any = {};
    obj.metadata = message.metadata ? Metadata.toAmino(message.metadata, useInterfaces) : Metadata.toAmino(Metadata.fromPartial({}));
    return obj;
  },
  fromAminoMsg(object: QueryDenomMetadataByQueryStringResponseAminoMsg): QueryDenomMetadataByQueryStringResponse {
    return QueryDenomMetadataByQueryStringResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomMetadataByQueryStringResponse, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomMetadataByQueryStringResponse",
      value: QueryDenomMetadataByQueryStringResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomMetadataByQueryStringResponseProtoMsg, useInterfaces: boolean = false): QueryDenomMetadataByQueryStringResponse {
    return QueryDenomMetadataByQueryStringResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomMetadataByQueryStringResponse): Uint8Array {
    return QueryDenomMetadataByQueryStringResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomMetadataByQueryStringResponse): QueryDenomMetadataByQueryStringResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomMetadataByQueryStringResponse",
      value: QueryDenomMetadataByQueryStringResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomMetadataByQueryStringResponse.typeUrl)) {
      return;
    }
    Metadata.registerTypeUrl();
  }
};
function createBaseQueryDenomOwnersRequest(): QueryDenomOwnersRequest {
  return {
    denom: "",
    pagination: undefined
  };
}
/**
 * QueryDenomOwnersRequest defines the request type for the DenomOwners RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * @name QueryDenomOwnersRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersRequest
 */
export const QueryDenomOwnersRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersRequest",
  aminoType: "cosmos-sdk/QueryDenomOwnersRequest",
  is(o: any): o is QueryDenomOwnersRequest {
    return o && (o.$typeUrl === QueryDenomOwnersRequest.typeUrl || typeof o.denom === "string");
  },
  isSDK(o: any): o is QueryDenomOwnersRequestSDKType {
    return o && (o.$typeUrl === QueryDenomOwnersRequest.typeUrl || typeof o.denom === "string");
  },
  isAmino(o: any): o is QueryDenomOwnersRequestAmino {
    return o && (o.$typeUrl === QueryDenomOwnersRequest.typeUrl || typeof o.denom === "string");
  },
  encode(message: QueryDenomOwnersRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.denom !== "") {
      writer.uint32(10).string(message.denom);
    }
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomOwnersRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomOwnersRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denom = reader.string();
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
  fromPartial(object: Partial<QueryDenomOwnersRequest>): QueryDenomOwnersRequest {
    const message = createBaseQueryDenomOwnersRequest();
    message.denom = object.denom ?? "";
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomOwnersRequestAmino): QueryDenomOwnersRequest {
    const message = createBaseQueryDenomOwnersRequest();
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryDenomOwnersRequest, useInterfaces: boolean = false): QueryDenomOwnersRequestAmino {
    const obj: any = {};
    obj.denom = message.denom === "" ? undefined : message.denom;
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryDenomOwnersRequestAminoMsg): QueryDenomOwnersRequest {
    return QueryDenomOwnersRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomOwnersRequest, useInterfaces: boolean = false): QueryDenomOwnersRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomOwnersRequest",
      value: QueryDenomOwnersRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomOwnersRequestProtoMsg, useInterfaces: boolean = false): QueryDenomOwnersRequest {
    return QueryDenomOwnersRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomOwnersRequest): Uint8Array {
    return QueryDenomOwnersRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomOwnersRequest): QueryDenomOwnersRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersRequest",
      value: QueryDenomOwnersRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomOwnersRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseDenomOwner(): DenomOwner {
  return {
    address: "",
    balance: Coin.fromPartial({})
  };
}
/**
 * DenomOwner defines structure representing an account that owns or holds a
 * particular denominated token. It contains the account address and account
 * balance of the denominated token.
 * 
 * Since: cosmos-sdk 0.46
 * @name DenomOwner
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.DenomOwner
 */
export const DenomOwner = {
  typeUrl: "/cosmos.bank.v1beta1.DenomOwner",
  aminoType: "cosmos-sdk/DenomOwner",
  is(o: any): o is DenomOwner {
    return o && (o.$typeUrl === DenomOwner.typeUrl || typeof o.address === "string" && Coin.is(o.balance));
  },
  isSDK(o: any): o is DenomOwnerSDKType {
    return o && (o.$typeUrl === DenomOwner.typeUrl || typeof o.address === "string" && Coin.isSDK(o.balance));
  },
  isAmino(o: any): o is DenomOwnerAmino {
    return o && (o.$typeUrl === DenomOwner.typeUrl || typeof o.address === "string" && Coin.isAmino(o.balance));
  },
  encode(message: DenomOwner, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.balance !== undefined) {
      Coin.encode(message.balance, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): DenomOwner {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDenomOwner();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        case 2:
          message.balance = Coin.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<DenomOwner>): DenomOwner {
    const message = createBaseDenomOwner();
    message.address = object.address ?? "";
    message.balance = object.balance !== undefined && object.balance !== null ? Coin.fromPartial(object.balance) : undefined;
    return message;
  },
  fromAmino(object: DenomOwnerAmino): DenomOwner {
    const message = createBaseDenomOwner();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.balance !== undefined && object.balance !== null) {
      message.balance = Coin.fromAmino(object.balance);
    }
    return message;
  },
  toAmino(message: DenomOwner, useInterfaces: boolean = false): DenomOwnerAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.balance = message.balance ? Coin.toAmino(message.balance, useInterfaces) : Coin.toAmino(Coin.fromPartial({}));
    return obj;
  },
  fromAminoMsg(object: DenomOwnerAminoMsg): DenomOwner {
    return DenomOwner.fromAmino(object.value);
  },
  toAminoMsg(message: DenomOwner, useInterfaces: boolean = false): DenomOwnerAminoMsg {
    return {
      type: "cosmos-sdk/DenomOwner",
      value: DenomOwner.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: DenomOwnerProtoMsg, useInterfaces: boolean = false): DenomOwner {
    return DenomOwner.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: DenomOwner): Uint8Array {
    return DenomOwner.encode(message).finish();
  },
  toProtoMsg(message: DenomOwner): DenomOwnerProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.DenomOwner",
      value: DenomOwner.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(DenomOwner.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
  }
};
function createBaseQueryDenomOwnersResponse(): QueryDenomOwnersResponse {
  return {
    denomOwners: [],
    pagination: undefined
  };
}
/**
 * QueryDenomOwnersResponse defines the RPC response of a DenomOwners RPC query.
 * 
 * Since: cosmos-sdk 0.46
 * @name QueryDenomOwnersResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersResponse
 */
export const QueryDenomOwnersResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersResponse",
  aminoType: "cosmos-sdk/QueryDenomOwnersResponse",
  is(o: any): o is QueryDenomOwnersResponse {
    return o && (o.$typeUrl === QueryDenomOwnersResponse.typeUrl || Array.isArray(o.denomOwners) && (!o.denomOwners.length || DenomOwner.is(o.denomOwners[0])));
  },
  isSDK(o: any): o is QueryDenomOwnersResponseSDKType {
    return o && (o.$typeUrl === QueryDenomOwnersResponse.typeUrl || Array.isArray(o.denom_owners) && (!o.denom_owners.length || DenomOwner.isSDK(o.denom_owners[0])));
  },
  isAmino(o: any): o is QueryDenomOwnersResponseAmino {
    return o && (o.$typeUrl === QueryDenomOwnersResponse.typeUrl || Array.isArray(o.denom_owners) && (!o.denom_owners.length || DenomOwner.isAmino(o.denom_owners[0])));
  },
  encode(message: QueryDenomOwnersResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.denomOwners) {
      DenomOwner.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomOwnersResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomOwnersResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denomOwners.push(DenomOwner.decode(reader, reader.uint32(), useInterfaces));
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
  fromPartial(object: Partial<QueryDenomOwnersResponse>): QueryDenomOwnersResponse {
    const message = createBaseQueryDenomOwnersResponse();
    message.denomOwners = object.denomOwners?.map(e => DenomOwner.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomOwnersResponseAmino): QueryDenomOwnersResponse {
    const message = createBaseQueryDenomOwnersResponse();
    message.denomOwners = object.denom_owners?.map(e => DenomOwner.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryDenomOwnersResponse, useInterfaces: boolean = false): QueryDenomOwnersResponseAmino {
    const obj: any = {};
    if (message.denomOwners) {
      obj.denom_owners = message.denomOwners.map(e => e ? DenomOwner.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.denom_owners = message.denomOwners;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryDenomOwnersResponseAminoMsg): QueryDenomOwnersResponse {
    return QueryDenomOwnersResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomOwnersResponse, useInterfaces: boolean = false): QueryDenomOwnersResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomOwnersResponse",
      value: QueryDenomOwnersResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomOwnersResponseProtoMsg, useInterfaces: boolean = false): QueryDenomOwnersResponse {
    return QueryDenomOwnersResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomOwnersResponse): Uint8Array {
    return QueryDenomOwnersResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomOwnersResponse): QueryDenomOwnersResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersResponse",
      value: QueryDenomOwnersResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomOwnersResponse.typeUrl)) {
      return;
    }
    DenomOwner.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};
function createBaseQueryDenomOwnersByQueryRequest(): QueryDenomOwnersByQueryRequest {
  return {
    denom: "",
    pagination: undefined
  };
}
/**
 * QueryDenomOwnersByQueryRequest defines the request type for the DenomOwnersByQuery RPC query,
 * which queries for a paginated set of all account holders of a particular
 * denomination.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryRequest
 */
export const QueryDenomOwnersByQueryRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersByQueryRequest",
  aminoType: "cosmos-sdk/QueryDenomOwnersByQueryRequest",
  is(o: any): o is QueryDenomOwnersByQueryRequest {
    return o && (o.$typeUrl === QueryDenomOwnersByQueryRequest.typeUrl || typeof o.denom === "string");
  },
  isSDK(o: any): o is QueryDenomOwnersByQueryRequestSDKType {
    return o && (o.$typeUrl === QueryDenomOwnersByQueryRequest.typeUrl || typeof o.denom === "string");
  },
  isAmino(o: any): o is QueryDenomOwnersByQueryRequestAmino {
    return o && (o.$typeUrl === QueryDenomOwnersByQueryRequest.typeUrl || typeof o.denom === "string");
  },
  encode(message: QueryDenomOwnersByQueryRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.denom !== "") {
      writer.uint32(10).string(message.denom);
    }
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomOwnersByQueryRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomOwnersByQueryRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denom = reader.string();
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
  fromPartial(object: Partial<QueryDenomOwnersByQueryRequest>): QueryDenomOwnersByQueryRequest {
    const message = createBaseQueryDenomOwnersByQueryRequest();
    message.denom = object.denom ?? "";
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomOwnersByQueryRequestAmino): QueryDenomOwnersByQueryRequest {
    const message = createBaseQueryDenomOwnersByQueryRequest();
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryDenomOwnersByQueryRequest, useInterfaces: boolean = false): QueryDenomOwnersByQueryRequestAmino {
    const obj: any = {};
    obj.denom = message.denom === "" ? undefined : message.denom;
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryDenomOwnersByQueryRequestAminoMsg): QueryDenomOwnersByQueryRequest {
    return QueryDenomOwnersByQueryRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomOwnersByQueryRequest, useInterfaces: boolean = false): QueryDenomOwnersByQueryRequestAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomOwnersByQueryRequest",
      value: QueryDenomOwnersByQueryRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomOwnersByQueryRequestProtoMsg, useInterfaces: boolean = false): QueryDenomOwnersByQueryRequest {
    return QueryDenomOwnersByQueryRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomOwnersByQueryRequest): Uint8Array {
    return QueryDenomOwnersByQueryRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomOwnersByQueryRequest): QueryDenomOwnersByQueryRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersByQueryRequest",
      value: QueryDenomOwnersByQueryRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomOwnersByQueryRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseQueryDenomOwnersByQueryResponse(): QueryDenomOwnersByQueryResponse {
  return {
    denomOwners: [],
    pagination: undefined
  };
}
/**
 * QueryDenomOwnersByQueryResponse defines the RPC response of a DenomOwnersByQuery RPC query.
 * 
 * Since: cosmos-sdk 0.50.3
 * @name QueryDenomOwnersByQueryResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QueryDenomOwnersByQueryResponse
 */
export const QueryDenomOwnersByQueryResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersByQueryResponse",
  aminoType: "cosmos-sdk/QueryDenomOwnersByQueryResponse",
  is(o: any): o is QueryDenomOwnersByQueryResponse {
    return o && (o.$typeUrl === QueryDenomOwnersByQueryResponse.typeUrl || Array.isArray(o.denomOwners) && (!o.denomOwners.length || DenomOwner.is(o.denomOwners[0])));
  },
  isSDK(o: any): o is QueryDenomOwnersByQueryResponseSDKType {
    return o && (o.$typeUrl === QueryDenomOwnersByQueryResponse.typeUrl || Array.isArray(o.denom_owners) && (!o.denom_owners.length || DenomOwner.isSDK(o.denom_owners[0])));
  },
  isAmino(o: any): o is QueryDenomOwnersByQueryResponseAmino {
    return o && (o.$typeUrl === QueryDenomOwnersByQueryResponse.typeUrl || Array.isArray(o.denom_owners) && (!o.denom_owners.length || DenomOwner.isAmino(o.denom_owners[0])));
  },
  encode(message: QueryDenomOwnersByQueryResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.denomOwners) {
      DenomOwner.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryDenomOwnersByQueryResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryDenomOwnersByQueryResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denomOwners.push(DenomOwner.decode(reader, reader.uint32(), useInterfaces));
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
  fromPartial(object: Partial<QueryDenomOwnersByQueryResponse>): QueryDenomOwnersByQueryResponse {
    const message = createBaseQueryDenomOwnersByQueryResponse();
    message.denomOwners = object.denomOwners?.map(e => DenomOwner.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QueryDenomOwnersByQueryResponseAmino): QueryDenomOwnersByQueryResponse {
    const message = createBaseQueryDenomOwnersByQueryResponse();
    message.denomOwners = object.denom_owners?.map(e => DenomOwner.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QueryDenomOwnersByQueryResponse, useInterfaces: boolean = false): QueryDenomOwnersByQueryResponseAmino {
    const obj: any = {};
    if (message.denomOwners) {
      obj.denom_owners = message.denomOwners.map(e => e ? DenomOwner.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.denom_owners = message.denomOwners;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QueryDenomOwnersByQueryResponseAminoMsg): QueryDenomOwnersByQueryResponse {
    return QueryDenomOwnersByQueryResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QueryDenomOwnersByQueryResponse, useInterfaces: boolean = false): QueryDenomOwnersByQueryResponseAminoMsg {
    return {
      type: "cosmos-sdk/QueryDenomOwnersByQueryResponse",
      value: QueryDenomOwnersByQueryResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QueryDenomOwnersByQueryResponseProtoMsg, useInterfaces: boolean = false): QueryDenomOwnersByQueryResponse {
    return QueryDenomOwnersByQueryResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryDenomOwnersByQueryResponse): Uint8Array {
    return QueryDenomOwnersByQueryResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryDenomOwnersByQueryResponse): QueryDenomOwnersByQueryResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QueryDenomOwnersByQueryResponse",
      value: QueryDenomOwnersByQueryResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QueryDenomOwnersByQueryResponse.typeUrl)) {
      return;
    }
    DenomOwner.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};
function createBaseQuerySendEnabledRequest(): QuerySendEnabledRequest {
  return {
    denoms: [],
    pagination: undefined
  };
}
/**
 * QuerySendEnabledRequest defines the RPC request for looking up SendEnabled entries.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledRequest
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledRequest
 */
export const QuerySendEnabledRequest = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySendEnabledRequest",
  aminoType: "cosmos-sdk/QuerySendEnabledRequest",
  is(o: any): o is QuerySendEnabledRequest {
    return o && (o.$typeUrl === QuerySendEnabledRequest.typeUrl || Array.isArray(o.denoms) && (!o.denoms.length || typeof o.denoms[0] === "string"));
  },
  isSDK(o: any): o is QuerySendEnabledRequestSDKType {
    return o && (o.$typeUrl === QuerySendEnabledRequest.typeUrl || Array.isArray(o.denoms) && (!o.denoms.length || typeof o.denoms[0] === "string"));
  },
  isAmino(o: any): o is QuerySendEnabledRequestAmino {
    return o && (o.$typeUrl === QuerySendEnabledRequest.typeUrl || Array.isArray(o.denoms) && (!o.denoms.length || typeof o.denoms[0] === "string"));
  },
  encode(message: QuerySendEnabledRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.denoms) {
      writer.uint32(10).string(v!);
    }
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(794).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySendEnabledRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySendEnabledRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denoms.push(reader.string());
          break;
        case 99:
          message.pagination = PageRequest.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QuerySendEnabledRequest>): QuerySendEnabledRequest {
    const message = createBaseQuerySendEnabledRequest();
    message.denoms = object.denoms?.map(e => e) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageRequest.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QuerySendEnabledRequestAmino): QuerySendEnabledRequest {
    const message = createBaseQuerySendEnabledRequest();
    message.denoms = object.denoms?.map(e => e) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QuerySendEnabledRequest, useInterfaces: boolean = false): QuerySendEnabledRequestAmino {
    const obj: any = {};
    if (message.denoms) {
      obj.denoms = message.denoms.map(e => e);
    } else {
      obj.denoms = message.denoms;
    }
    obj.pagination = message.pagination ? PageRequest.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QuerySendEnabledRequestAminoMsg): QuerySendEnabledRequest {
    return QuerySendEnabledRequest.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySendEnabledRequest, useInterfaces: boolean = false): QuerySendEnabledRequestAminoMsg {
    return {
      type: "cosmos-sdk/QuerySendEnabledRequest",
      value: QuerySendEnabledRequest.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySendEnabledRequestProtoMsg, useInterfaces: boolean = false): QuerySendEnabledRequest {
    return QuerySendEnabledRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySendEnabledRequest): Uint8Array {
    return QuerySendEnabledRequest.encode(message).finish();
  },
  toProtoMsg(message: QuerySendEnabledRequest): QuerySendEnabledRequestProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySendEnabledRequest",
      value: QuerySendEnabledRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QuerySendEnabledRequest.typeUrl)) {
      return;
    }
    PageRequest.registerTypeUrl();
  }
};
function createBaseQuerySendEnabledResponse(): QuerySendEnabledResponse {
  return {
    sendEnabled: [],
    pagination: undefined
  };
}
/**
 * QuerySendEnabledResponse defines the RPC response of a SendEnable query.
 * 
 * Since: cosmos-sdk 0.47
 * @name QuerySendEnabledResponse
 * @package cosmos.bank.v1beta1
 * @see proto type: cosmos.bank.v1beta1.QuerySendEnabledResponse
 */
export const QuerySendEnabledResponse = {
  typeUrl: "/cosmos.bank.v1beta1.QuerySendEnabledResponse",
  aminoType: "cosmos-sdk/QuerySendEnabledResponse",
  is(o: any): o is QuerySendEnabledResponse {
    return o && (o.$typeUrl === QuerySendEnabledResponse.typeUrl || Array.isArray(o.sendEnabled) && (!o.sendEnabled.length || SendEnabled.is(o.sendEnabled[0])));
  },
  isSDK(o: any): o is QuerySendEnabledResponseSDKType {
    return o && (o.$typeUrl === QuerySendEnabledResponse.typeUrl || Array.isArray(o.send_enabled) && (!o.send_enabled.length || SendEnabled.isSDK(o.send_enabled[0])));
  },
  isAmino(o: any): o is QuerySendEnabledResponseAmino {
    return o && (o.$typeUrl === QuerySendEnabledResponse.typeUrl || Array.isArray(o.send_enabled) && (!o.send_enabled.length || SendEnabled.isAmino(o.send_enabled[0])));
  },
  encode(message: QuerySendEnabledResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.sendEnabled) {
      SendEnabled.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(794).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QuerySendEnabledResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQuerySendEnabledResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sendEnabled.push(SendEnabled.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 99:
          message.pagination = PageResponse.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QuerySendEnabledResponse>): QuerySendEnabledResponse {
    const message = createBaseQuerySendEnabledResponse();
    message.sendEnabled = object.sendEnabled?.map(e => SendEnabled.fromPartial(e)) || [];
    message.pagination = object.pagination !== undefined && object.pagination !== null ? PageResponse.fromPartial(object.pagination) : undefined;
    return message;
  },
  fromAmino(object: QuerySendEnabledResponseAmino): QuerySendEnabledResponse {
    const message = createBaseQuerySendEnabledResponse();
    message.sendEnabled = object.send_enabled?.map(e => SendEnabled.fromAmino(e)) || [];
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromAmino(object.pagination);
    }
    return message;
  },
  toAmino(message: QuerySendEnabledResponse, useInterfaces: boolean = false): QuerySendEnabledResponseAmino {
    const obj: any = {};
    if (message.sendEnabled) {
      obj.send_enabled = message.sendEnabled.map(e => e ? SendEnabled.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.send_enabled = message.sendEnabled;
    }
    obj.pagination = message.pagination ? PageResponse.toAmino(message.pagination, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: QuerySendEnabledResponseAminoMsg): QuerySendEnabledResponse {
    return QuerySendEnabledResponse.fromAmino(object.value);
  },
  toAminoMsg(message: QuerySendEnabledResponse, useInterfaces: boolean = false): QuerySendEnabledResponseAminoMsg {
    return {
      type: "cosmos-sdk/QuerySendEnabledResponse",
      value: QuerySendEnabledResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: QuerySendEnabledResponseProtoMsg, useInterfaces: boolean = false): QuerySendEnabledResponse {
    return QuerySendEnabledResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QuerySendEnabledResponse): Uint8Array {
    return QuerySendEnabledResponse.encode(message).finish();
  },
  toProtoMsg(message: QuerySendEnabledResponse): QuerySendEnabledResponseProtoMsg {
    return {
      typeUrl: "/cosmos.bank.v1beta1.QuerySendEnabledResponse",
      value: QuerySendEnabledResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(QuerySendEnabledResponse.typeUrl)) {
      return;
    }
    SendEnabled.registerTypeUrl();
    PageResponse.registerTypeUrl();
  }
};