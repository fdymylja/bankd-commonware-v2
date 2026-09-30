import { MsgEthereumTxResponse } from "./tx";
import { TxRpc } from "../../../../types";
import { BinaryReader } from "../../../../binary";
import { QueryClient, createProtobufRpcClient } from "@cosmjs/stargate";
import { QueryAccountRequest, QueryAccountResponse, QueryCosmosAccountRequest, QueryCosmosAccountResponse, QueryValidatorAccountRequest, QueryValidatorAccountResponse, QueryBalanceRequest, QueryBalanceResponse, QueryStorageRequest, QueryStorageResponse, QueryCodeRequest, QueryCodeResponse, QueryParamsRequest, QueryParamsResponse, EthCallRequest, EstimateGasResponse, QueryTraceTxRequest, QueryTraceTxResponse, QueryTraceBlockRequest, QueryTraceBlockResponse, QueryTraceCallRequest, QueryTraceCallResponse, QueryBaseFeeRequest, QueryBaseFeeResponse, QueryConfigRequest, QueryConfigResponse, QueryGlobalMinGasPriceRequest, QueryGlobalMinGasPriceResponse } from "./query";
/** Query defines the gRPC querier service. */
export interface Query {
  /** Account queries an Ethereum account. */
  account(request: QueryAccountRequest): Promise<QueryAccountResponse>;
  /** CosmosAccount queries an Ethereum account's Cosmos Address. */
  cosmosAccount(request: QueryCosmosAccountRequest): Promise<QueryCosmosAccountResponse>;
  /**
   * ValidatorAccount queries an Ethereum account's from a validator consensus
   * Address.
   */
  validatorAccount(request: QueryValidatorAccountRequest): Promise<QueryValidatorAccountResponse>;
  /**
   * Balance queries the balance of a the EVM denomination for a single
   * account.
   */
  balance(request: QueryBalanceRequest): Promise<QueryBalanceResponse>;
  /** Storage queries the balance of all coins for a single account. */
  storage(request: QueryStorageRequest): Promise<QueryStorageResponse>;
  /** Code queries the balance of all coins for a single account. */
  code(request: QueryCodeRequest): Promise<QueryCodeResponse>;
  /** Params queries the parameters of x/vm module. */
  params(request?: QueryParamsRequest): Promise<QueryParamsResponse>;
  /** EthCall implements the `eth_call` rpc api */
  ethCall(request: EthCallRequest): Promise<MsgEthereumTxResponse>;
  /** EstimateGas implements the `eth_estimateGas` rpc api */
  estimateGas(request: EthCallRequest): Promise<EstimateGasResponse>;
  /** TraceTx implements the `debug_traceTransaction` rpc api */
  traceTx(request: QueryTraceTxRequest): Promise<QueryTraceTxResponse>;
  /**
   * TraceBlock implements the `debug_traceBlockByNumber` and
   * `debug_traceBlockByHash` rpc api
   */
  traceBlock(request: QueryTraceBlockRequest): Promise<QueryTraceBlockResponse>;
  /** TraceCall implements the `debug_traceCall` rpc api */
  traceCall(request: QueryTraceCallRequest): Promise<QueryTraceCallResponse>;
  /**
   * BaseFee queries the base fee of the parent block of the current block,
   * it's similar to feemarket module's method, but also checks london hardfork
   * status.
   */
  baseFee(request?: QueryBaseFeeRequest): Promise<QueryBaseFeeResponse>;
  /** Config queries the EVM configuration */
  config(request?: QueryConfigRequest): Promise<QueryConfigResponse>;
  /**
   * GlobalMinGasPrice queries the MinGasPrice
   * it's similar to feemarket module's method,
   * but makes the conversion to 18 decimals
   * when the evm denom is represented with a different precision.
   */
  globalMinGasPrice(request?: QueryGlobalMinGasPriceRequest): Promise<QueryGlobalMinGasPriceResponse>;
}
export class QueryClientImpl implements Query {
  private readonly rpc: TxRpc;
  constructor(rpc: TxRpc) {
    this.rpc = rpc;
    this.account = this.account.bind(this);
    this.cosmosAccount = this.cosmosAccount.bind(this);
    this.validatorAccount = this.validatorAccount.bind(this);
    this.balance = this.balance.bind(this);
    this.storage = this.storage.bind(this);
    this.code = this.code.bind(this);
    this.params = this.params.bind(this);
    this.ethCall = this.ethCall.bind(this);
    this.estimateGas = this.estimateGas.bind(this);
    this.traceTx = this.traceTx.bind(this);
    this.traceBlock = this.traceBlock.bind(this);
    this.traceCall = this.traceCall.bind(this);
    this.baseFee = this.baseFee.bind(this);
    this.config = this.config.bind(this);
    this.globalMinGasPrice = this.globalMinGasPrice.bind(this);
  }
  account(request: QueryAccountRequest, useInterfaces: boolean = true): Promise<QueryAccountResponse> {
    const data = QueryAccountRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "Account", data);
    return promise.then(data => QueryAccountResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  cosmosAccount(request: QueryCosmosAccountRequest, useInterfaces: boolean = true): Promise<QueryCosmosAccountResponse> {
    const data = QueryCosmosAccountRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "CosmosAccount", data);
    return promise.then(data => QueryCosmosAccountResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  validatorAccount(request: QueryValidatorAccountRequest, useInterfaces: boolean = true): Promise<QueryValidatorAccountResponse> {
    const data = QueryValidatorAccountRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "ValidatorAccount", data);
    return promise.then(data => QueryValidatorAccountResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  balance(request: QueryBalanceRequest, useInterfaces: boolean = true): Promise<QueryBalanceResponse> {
    const data = QueryBalanceRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "Balance", data);
    return promise.then(data => QueryBalanceResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  storage(request: QueryStorageRequest, useInterfaces: boolean = true): Promise<QueryStorageResponse> {
    const data = QueryStorageRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "Storage", data);
    return promise.then(data => QueryStorageResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  code(request: QueryCodeRequest, useInterfaces: boolean = true): Promise<QueryCodeResponse> {
    const data = QueryCodeRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "Code", data);
    return promise.then(data => QueryCodeResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  params(request: QueryParamsRequest = {}, useInterfaces: boolean = true): Promise<QueryParamsResponse> {
    const data = QueryParamsRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "Params", data);
    return promise.then(data => QueryParamsResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  ethCall(request: EthCallRequest, useInterfaces: boolean = true): Promise<MsgEthereumTxResponse> {
    const data = EthCallRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "EthCall", data);
    return promise.then(data => MsgEthereumTxResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  estimateGas(request: EthCallRequest, useInterfaces: boolean = true): Promise<EstimateGasResponse> {
    const data = EthCallRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "EstimateGas", data);
    return promise.then(data => EstimateGasResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  traceTx(request: QueryTraceTxRequest, useInterfaces: boolean = true): Promise<QueryTraceTxResponse> {
    const data = QueryTraceTxRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "TraceTx", data);
    return promise.then(data => QueryTraceTxResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  traceBlock(request: QueryTraceBlockRequest, useInterfaces: boolean = true): Promise<QueryTraceBlockResponse> {
    const data = QueryTraceBlockRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "TraceBlock", data);
    return promise.then(data => QueryTraceBlockResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  traceCall(request: QueryTraceCallRequest, useInterfaces: boolean = true): Promise<QueryTraceCallResponse> {
    const data = QueryTraceCallRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "TraceCall", data);
    return promise.then(data => QueryTraceCallResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  baseFee(request: QueryBaseFeeRequest = {}, useInterfaces: boolean = true): Promise<QueryBaseFeeResponse> {
    const data = QueryBaseFeeRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "BaseFee", data);
    return promise.then(data => QueryBaseFeeResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  config(request: QueryConfigRequest = {}, useInterfaces: boolean = true): Promise<QueryConfigResponse> {
    const data = QueryConfigRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "Config", data);
    return promise.then(data => QueryConfigResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  globalMinGasPrice(request: QueryGlobalMinGasPriceRequest = {}, useInterfaces: boolean = true): Promise<QueryGlobalMinGasPriceResponse> {
    const data = QueryGlobalMinGasPriceRequest.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Query", "GlobalMinGasPrice", data);
    return promise.then(data => QueryGlobalMinGasPriceResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
}
export const createRpcQueryExtension = (base: QueryClient) => {
  const rpc = createProtobufRpcClient(base);
  const queryService = new QueryClientImpl(rpc);
  return {
    account(request: QueryAccountRequest, useInterfaces: boolean = true): Promise<QueryAccountResponse> {
      return queryService.account(request, useInterfaces);
    },
    cosmosAccount(request: QueryCosmosAccountRequest, useInterfaces: boolean = true): Promise<QueryCosmosAccountResponse> {
      return queryService.cosmosAccount(request, useInterfaces);
    },
    validatorAccount(request: QueryValidatorAccountRequest, useInterfaces: boolean = true): Promise<QueryValidatorAccountResponse> {
      return queryService.validatorAccount(request, useInterfaces);
    },
    balance(request: QueryBalanceRequest, useInterfaces: boolean = true): Promise<QueryBalanceResponse> {
      return queryService.balance(request, useInterfaces);
    },
    storage(request: QueryStorageRequest, useInterfaces: boolean = true): Promise<QueryStorageResponse> {
      return queryService.storage(request, useInterfaces);
    },
    code(request: QueryCodeRequest, useInterfaces: boolean = true): Promise<QueryCodeResponse> {
      return queryService.code(request, useInterfaces);
    },
    params(request?: QueryParamsRequest, useInterfaces: boolean = true): Promise<QueryParamsResponse> {
      return queryService.params(request, useInterfaces);
    },
    ethCall(request: EthCallRequest, useInterfaces: boolean = true): Promise<MsgEthereumTxResponse> {
      return queryService.ethCall(request, useInterfaces);
    },
    estimateGas(request: EthCallRequest, useInterfaces: boolean = true): Promise<EstimateGasResponse> {
      return queryService.estimateGas(request, useInterfaces);
    },
    traceTx(request: QueryTraceTxRequest, useInterfaces: boolean = true): Promise<QueryTraceTxResponse> {
      return queryService.traceTx(request, useInterfaces);
    },
    traceBlock(request: QueryTraceBlockRequest, useInterfaces: boolean = true): Promise<QueryTraceBlockResponse> {
      return queryService.traceBlock(request, useInterfaces);
    },
    traceCall(request: QueryTraceCallRequest, useInterfaces: boolean = true): Promise<QueryTraceCallResponse> {
      return queryService.traceCall(request, useInterfaces);
    },
    baseFee(request?: QueryBaseFeeRequest, useInterfaces: boolean = true): Promise<QueryBaseFeeResponse> {
      return queryService.baseFee(request, useInterfaces);
    },
    config(request?: QueryConfigRequest, useInterfaces: boolean = true): Promise<QueryConfigResponse> {
      return queryService.config(request, useInterfaces);
    },
    globalMinGasPrice(request?: QueryGlobalMinGasPriceRequest, useInterfaces: boolean = true): Promise<QueryGlobalMinGasPriceResponse> {
      return queryService.globalMinGasPrice(request, useInterfaces);
    }
  };
};