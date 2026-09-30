import { TxRpc } from "../../../types";
import { BinaryReader } from "../../../binary";
import { QueryClient, createProtobufRpcClient } from "@cosmjs/stargate";
import { QueryParamsRequest, QueryParamsResponse, QueryWhitelistRequest, QueryWhitelistResponse, QueryAccessStatusRequest, QueryAccessStatusResponse, QueryAuthorityRequest, QueryAuthorityResponse } from "./query";
/** Query defines the gRPC querier service. */
export interface Query {
  /** Params queries the parameters of the module. */
  params(request?: QueryParamsRequest): Promise<QueryParamsResponse>;
  /** Whitelist queries all whitelisted addresses. */
  whitelist(request?: QueryWhitelistRequest): Promise<QueryWhitelistResponse>;
  /** AccessStatus returns the access status of a validator address. */
  accessStatus(request: QueryAccessStatusRequest): Promise<QueryAccessStatusResponse>;
  /** Authority queries the module authority. */
  authority(request?: QueryAuthorityRequest): Promise<QueryAuthorityResponse>;
}
export class QueryClientImpl implements Query {
  private readonly rpc: TxRpc;
  constructor(rpc: TxRpc) {
    this.rpc = rpc;
    this.params = this.params.bind(this);
    this.whitelist = this.whitelist.bind(this);
    this.accessStatus = this.accessStatus.bind(this);
    this.authority = this.authority.bind(this);
  }
  params(request: QueryParamsRequest = {}, useInterfaces: boolean = true): Promise<QueryParamsResponse> {
    const data = QueryParamsRequest.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Query", "Params", data);
    return promise.then(data => QueryParamsResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  whitelist(request: QueryWhitelistRequest = {}, useInterfaces: boolean = true): Promise<QueryWhitelistResponse> {
    const data = QueryWhitelistRequest.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Query", "Whitelist", data);
    return promise.then(data => QueryWhitelistResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  accessStatus(request: QueryAccessStatusRequest, useInterfaces: boolean = true): Promise<QueryAccessStatusResponse> {
    const data = QueryAccessStatusRequest.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Query", "AccessStatus", data);
    return promise.then(data => QueryAccessStatusResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  authority(request: QueryAuthorityRequest = {}, useInterfaces: boolean = true): Promise<QueryAuthorityResponse> {
    const data = QueryAuthorityRequest.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Query", "Authority", data);
    return promise.then(data => QueryAuthorityResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
}
export const createRpcQueryExtension = (base: QueryClient) => {
  const rpc = createProtobufRpcClient(base);
  const queryService = new QueryClientImpl(rpc);
  return {
    params(request?: QueryParamsRequest, useInterfaces: boolean = true): Promise<QueryParamsResponse> {
      return queryService.params(request, useInterfaces);
    },
    whitelist(request?: QueryWhitelistRequest, useInterfaces: boolean = true): Promise<QueryWhitelistResponse> {
      return queryService.whitelist(request, useInterfaces);
    },
    accessStatus(request: QueryAccessStatusRequest, useInterfaces: boolean = true): Promise<QueryAccessStatusResponse> {
      return queryService.accessStatus(request, useInterfaces);
    },
    authority(request?: QueryAuthorityRequest, useInterfaces: boolean = true): Promise<QueryAuthorityResponse> {
      return queryService.authority(request, useInterfaces);
    }
  };
};