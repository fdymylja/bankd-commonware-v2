//@ts-nocheck
import { Params, ParamsAmino, ParamsSDKType } from "./params";
import { BinaryReader, BinaryWriter } from "../../../binary";
import { GlobalDecoderRegistry } from "../../../registry";
/**
 * QueryParamsRequest is request type for the Query/Params RPC method.
 * @name QueryParamsRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsRequest
 */
export interface QueryParamsRequest {}
export interface QueryParamsRequestProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryParamsRequest";
  value: Uint8Array;
}
/**
 * QueryParamsRequest is request type for the Query/Params RPC method.
 * @name QueryParamsRequestAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsRequest
 */
export interface QueryParamsRequestAmino {}
export interface QueryParamsRequestAminoMsg {
  type: "/mizufinance.poa.v1.QueryParamsRequest";
  value: QueryParamsRequestAmino;
}
/**
 * QueryParamsRequest is request type for the Query/Params RPC method.
 * @name QueryParamsRequestSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsRequest
 */
export interface QueryParamsRequestSDKType {}
/**
 * QueryParamsResponse is response type for the Query/Params RPC method.
 * @name QueryParamsResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsResponse
 */
export interface QueryParamsResponse {
  params: Params | undefined;
}
export interface QueryParamsResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryParamsResponse";
  value: Uint8Array;
}
/**
 * QueryParamsResponse is response type for the Query/Params RPC method.
 * @name QueryParamsResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsResponse
 */
export interface QueryParamsResponseAmino {
  params: ParamsAmino | undefined;
}
export interface QueryParamsResponseAminoMsg {
  type: "/mizufinance.poa.v1.QueryParamsResponse";
  value: QueryParamsResponseAmino;
}
/**
 * QueryParamsResponse is response type for the Query/Params RPC method.
 * @name QueryParamsResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsResponse
 */
export interface QueryParamsResponseSDKType {
  params: ParamsSDKType | undefined;
}
/**
 * QueryWhitelistRequest is request type for the Query/Whitelist RPC method.
 * @name QueryWhitelistRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistRequest
 */
export interface QueryWhitelistRequest {}
export interface QueryWhitelistRequestProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryWhitelistRequest";
  value: Uint8Array;
}
/**
 * QueryWhitelistRequest is request type for the Query/Whitelist RPC method.
 * @name QueryWhitelistRequestAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistRequest
 */
export interface QueryWhitelistRequestAmino {}
export interface QueryWhitelistRequestAminoMsg {
  type: "/mizufinance.poa.v1.QueryWhitelistRequest";
  value: QueryWhitelistRequestAmino;
}
/**
 * QueryWhitelistRequest is request type for the Query/Whitelist RPC method.
 * @name QueryWhitelistRequestSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistRequest
 */
export interface QueryWhitelistRequestSDKType {}
/**
 * QueryWhitelistResponse is response type for the Query/Whitelist RPC method.
 * @name QueryWhitelistResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistResponse
 */
export interface QueryWhitelistResponse {
  addresses: string[];
}
export interface QueryWhitelistResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryWhitelistResponse";
  value: Uint8Array;
}
/**
 * QueryWhitelistResponse is response type for the Query/Whitelist RPC method.
 * @name QueryWhitelistResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistResponse
 */
export interface QueryWhitelistResponseAmino {
  addresses?: string[];
}
export interface QueryWhitelistResponseAminoMsg {
  type: "/mizufinance.poa.v1.QueryWhitelistResponse";
  value: QueryWhitelistResponseAmino;
}
/**
 * QueryWhitelistResponse is response type for the Query/Whitelist RPC method.
 * @name QueryWhitelistResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistResponse
 */
export interface QueryWhitelistResponseSDKType {
  addresses: string[];
}
/**
 * QueryAccessStatusRequest is request type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusRequest
 */
export interface QueryAccessStatusRequest {
  address: string;
}
export interface QueryAccessStatusRequestProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryAccessStatusRequest";
  value: Uint8Array;
}
/**
 * QueryAccessStatusRequest is request type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusRequestAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusRequest
 */
export interface QueryAccessStatusRequestAmino {
  address?: string;
}
export interface QueryAccessStatusRequestAminoMsg {
  type: "/mizufinance.poa.v1.QueryAccessStatusRequest";
  value: QueryAccessStatusRequestAmino;
}
/**
 * QueryAccessStatusRequest is request type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusRequestSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusRequest
 */
export interface QueryAccessStatusRequestSDKType {
  address: string;
}
/**
 * QueryAccessStatusResponse is response type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusResponse
 */
export interface QueryAccessStatusResponse {
  status: string;
}
export interface QueryAccessStatusResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryAccessStatusResponse";
  value: Uint8Array;
}
/**
 * QueryAccessStatusResponse is response type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusResponse
 */
export interface QueryAccessStatusResponseAmino {
  status?: string;
}
export interface QueryAccessStatusResponseAminoMsg {
  type: "/mizufinance.poa.v1.QueryAccessStatusResponse";
  value: QueryAccessStatusResponseAmino;
}
/**
 * QueryAccessStatusResponse is response type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusResponse
 */
export interface QueryAccessStatusResponseSDKType {
  status: string;
}
/**
 * QueryAuthorityRequest is request type for the Query/Authority RPC method.
 * @name QueryAuthorityRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityRequest
 */
export interface QueryAuthorityRequest {}
export interface QueryAuthorityRequestProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryAuthorityRequest";
  value: Uint8Array;
}
/**
 * QueryAuthorityRequest is request type for the Query/Authority RPC method.
 * @name QueryAuthorityRequestAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityRequest
 */
export interface QueryAuthorityRequestAmino {}
export interface QueryAuthorityRequestAminoMsg {
  type: "/mizufinance.poa.v1.QueryAuthorityRequest";
  value: QueryAuthorityRequestAmino;
}
/**
 * QueryAuthorityRequest is request type for the Query/Authority RPC method.
 * @name QueryAuthorityRequestSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityRequest
 */
export interface QueryAuthorityRequestSDKType {}
/**
 * QueryAuthorityResponse is response type for the Query/Authority RPC method.
 * @name QueryAuthorityResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityResponse
 */
export interface QueryAuthorityResponse {
  authority: string;
}
export interface QueryAuthorityResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.QueryAuthorityResponse";
  value: Uint8Array;
}
/**
 * QueryAuthorityResponse is response type for the Query/Authority RPC method.
 * @name QueryAuthorityResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityResponse
 */
export interface QueryAuthorityResponseAmino {
  authority?: string;
}
export interface QueryAuthorityResponseAminoMsg {
  type: "/mizufinance.poa.v1.QueryAuthorityResponse";
  value: QueryAuthorityResponseAmino;
}
/**
 * QueryAuthorityResponse is response type for the Query/Authority RPC method.
 * @name QueryAuthorityResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityResponse
 */
export interface QueryAuthorityResponseSDKType {
  authority: string;
}
function createBaseQueryParamsRequest(): QueryParamsRequest {
  return {};
}
/**
 * QueryParamsRequest is request type for the Query/Params RPC method.
 * @name QueryParamsRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsRequest
 */
export const QueryParamsRequest = {
  typeUrl: "/mizufinance.poa.v1.QueryParamsRequest",
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
  fromProtoMsg(message: QueryParamsRequestProtoMsg, useInterfaces: boolean = false): QueryParamsRequest {
    return QueryParamsRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryParamsRequest): Uint8Array {
    return QueryParamsRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryParamsRequest): QueryParamsRequestProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryParamsRequest",
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
 * QueryParamsResponse is response type for the Query/Params RPC method.
 * @name QueryParamsResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryParamsResponse
 */
export const QueryParamsResponse = {
  typeUrl: "/mizufinance.poa.v1.QueryParamsResponse",
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
  fromProtoMsg(message: QueryParamsResponseProtoMsg, useInterfaces: boolean = false): QueryParamsResponse {
    return QueryParamsResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryParamsResponse): Uint8Array {
    return QueryParamsResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryParamsResponse): QueryParamsResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryParamsResponse",
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
function createBaseQueryWhitelistRequest(): QueryWhitelistRequest {
  return {};
}
/**
 * QueryWhitelistRequest is request type for the Query/Whitelist RPC method.
 * @name QueryWhitelistRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistRequest
 */
export const QueryWhitelistRequest = {
  typeUrl: "/mizufinance.poa.v1.QueryWhitelistRequest",
  is(o: any): o is QueryWhitelistRequest {
    return o && o.$typeUrl === QueryWhitelistRequest.typeUrl;
  },
  isSDK(o: any): o is QueryWhitelistRequestSDKType {
    return o && o.$typeUrl === QueryWhitelistRequest.typeUrl;
  },
  isAmino(o: any): o is QueryWhitelistRequestAmino {
    return o && o.$typeUrl === QueryWhitelistRequest.typeUrl;
  },
  encode(_: QueryWhitelistRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryWhitelistRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryWhitelistRequest();
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
  fromPartial(_: Partial<QueryWhitelistRequest>): QueryWhitelistRequest {
    const message = createBaseQueryWhitelistRequest();
    return message;
  },
  fromAmino(_: QueryWhitelistRequestAmino): QueryWhitelistRequest {
    const message = createBaseQueryWhitelistRequest();
    return message;
  },
  toAmino(_: QueryWhitelistRequest, useInterfaces: boolean = false): QueryWhitelistRequestAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: QueryWhitelistRequestAminoMsg): QueryWhitelistRequest {
    return QueryWhitelistRequest.fromAmino(object.value);
  },
  fromProtoMsg(message: QueryWhitelistRequestProtoMsg, useInterfaces: boolean = false): QueryWhitelistRequest {
    return QueryWhitelistRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryWhitelistRequest): Uint8Array {
    return QueryWhitelistRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryWhitelistRequest): QueryWhitelistRequestProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryWhitelistRequest",
      value: QueryWhitelistRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryWhitelistResponse(): QueryWhitelistResponse {
  return {
    addresses: []
  };
}
/**
 * QueryWhitelistResponse is response type for the Query/Whitelist RPC method.
 * @name QueryWhitelistResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryWhitelistResponse
 */
export const QueryWhitelistResponse = {
  typeUrl: "/mizufinance.poa.v1.QueryWhitelistResponse",
  is(o: any): o is QueryWhitelistResponse {
    return o && (o.$typeUrl === QueryWhitelistResponse.typeUrl || Array.isArray(o.addresses) && (!o.addresses.length || typeof o.addresses[0] === "string"));
  },
  isSDK(o: any): o is QueryWhitelistResponseSDKType {
    return o && (o.$typeUrl === QueryWhitelistResponse.typeUrl || Array.isArray(o.addresses) && (!o.addresses.length || typeof o.addresses[0] === "string"));
  },
  isAmino(o: any): o is QueryWhitelistResponseAmino {
    return o && (o.$typeUrl === QueryWhitelistResponse.typeUrl || Array.isArray(o.addresses) && (!o.addresses.length || typeof o.addresses[0] === "string"));
  },
  encode(message: QueryWhitelistResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.addresses) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryWhitelistResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryWhitelistResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.addresses.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryWhitelistResponse>): QueryWhitelistResponse {
    const message = createBaseQueryWhitelistResponse();
    message.addresses = object.addresses?.map(e => e) || [];
    return message;
  },
  fromAmino(object: QueryWhitelistResponseAmino): QueryWhitelistResponse {
    const message = createBaseQueryWhitelistResponse();
    message.addresses = object.addresses?.map(e => e) || [];
    return message;
  },
  toAmino(message: QueryWhitelistResponse, useInterfaces: boolean = false): QueryWhitelistResponseAmino {
    const obj: any = {};
    if (message.addresses) {
      obj.addresses = message.addresses.map(e => e);
    } else {
      obj.addresses = message.addresses;
    }
    return obj;
  },
  fromAminoMsg(object: QueryWhitelistResponseAminoMsg): QueryWhitelistResponse {
    return QueryWhitelistResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: QueryWhitelistResponseProtoMsg, useInterfaces: boolean = false): QueryWhitelistResponse {
    return QueryWhitelistResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryWhitelistResponse): Uint8Array {
    return QueryWhitelistResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryWhitelistResponse): QueryWhitelistResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryWhitelistResponse",
      value: QueryWhitelistResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryAccessStatusRequest(): QueryAccessStatusRequest {
  return {
    address: ""
  };
}
/**
 * QueryAccessStatusRequest is request type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusRequest
 */
export const QueryAccessStatusRequest = {
  typeUrl: "/mizufinance.poa.v1.QueryAccessStatusRequest",
  is(o: any): o is QueryAccessStatusRequest {
    return o && (o.$typeUrl === QueryAccessStatusRequest.typeUrl || typeof o.address === "string");
  },
  isSDK(o: any): o is QueryAccessStatusRequestSDKType {
    return o && (o.$typeUrl === QueryAccessStatusRequest.typeUrl || typeof o.address === "string");
  },
  isAmino(o: any): o is QueryAccessStatusRequestAmino {
    return o && (o.$typeUrl === QueryAccessStatusRequest.typeUrl || typeof o.address === "string");
  },
  encode(message: QueryAccessStatusRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAccessStatusRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAccessStatusRequest();
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
  fromPartial(object: Partial<QueryAccessStatusRequest>): QueryAccessStatusRequest {
    const message = createBaseQueryAccessStatusRequest();
    message.address = object.address ?? "";
    return message;
  },
  fromAmino(object: QueryAccessStatusRequestAmino): QueryAccessStatusRequest {
    const message = createBaseQueryAccessStatusRequest();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    return message;
  },
  toAmino(message: QueryAccessStatusRequest, useInterfaces: boolean = false): QueryAccessStatusRequestAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    return obj;
  },
  fromAminoMsg(object: QueryAccessStatusRequestAminoMsg): QueryAccessStatusRequest {
    return QueryAccessStatusRequest.fromAmino(object.value);
  },
  fromProtoMsg(message: QueryAccessStatusRequestProtoMsg, useInterfaces: boolean = false): QueryAccessStatusRequest {
    return QueryAccessStatusRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAccessStatusRequest): Uint8Array {
    return QueryAccessStatusRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryAccessStatusRequest): QueryAccessStatusRequestProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryAccessStatusRequest",
      value: QueryAccessStatusRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryAccessStatusResponse(): QueryAccessStatusResponse {
  return {
    status: ""
  };
}
/**
 * QueryAccessStatusResponse is response type for the Query/AccessStatus RPC method.
 * @name QueryAccessStatusResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAccessStatusResponse
 */
export const QueryAccessStatusResponse = {
  typeUrl: "/mizufinance.poa.v1.QueryAccessStatusResponse",
  is(o: any): o is QueryAccessStatusResponse {
    return o && (o.$typeUrl === QueryAccessStatusResponse.typeUrl || typeof o.status === "string");
  },
  isSDK(o: any): o is QueryAccessStatusResponseSDKType {
    return o && (o.$typeUrl === QueryAccessStatusResponse.typeUrl || typeof o.status === "string");
  },
  isAmino(o: any): o is QueryAccessStatusResponseAmino {
    return o && (o.$typeUrl === QueryAccessStatusResponse.typeUrl || typeof o.status === "string");
  },
  encode(message: QueryAccessStatusResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.status !== "") {
      writer.uint32(10).string(message.status);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAccessStatusResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAccessStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.status = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryAccessStatusResponse>): QueryAccessStatusResponse {
    const message = createBaseQueryAccessStatusResponse();
    message.status = object.status ?? "";
    return message;
  },
  fromAmino(object: QueryAccessStatusResponseAmino): QueryAccessStatusResponse {
    const message = createBaseQueryAccessStatusResponse();
    if (object.status !== undefined && object.status !== null) {
      message.status = object.status;
    }
    return message;
  },
  toAmino(message: QueryAccessStatusResponse, useInterfaces: boolean = false): QueryAccessStatusResponseAmino {
    const obj: any = {};
    obj.status = message.status === "" ? undefined : message.status;
    return obj;
  },
  fromAminoMsg(object: QueryAccessStatusResponseAminoMsg): QueryAccessStatusResponse {
    return QueryAccessStatusResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: QueryAccessStatusResponseProtoMsg, useInterfaces: boolean = false): QueryAccessStatusResponse {
    return QueryAccessStatusResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAccessStatusResponse): Uint8Array {
    return QueryAccessStatusResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryAccessStatusResponse): QueryAccessStatusResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryAccessStatusResponse",
      value: QueryAccessStatusResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryAuthorityRequest(): QueryAuthorityRequest {
  return {};
}
/**
 * QueryAuthorityRequest is request type for the Query/Authority RPC method.
 * @name QueryAuthorityRequest
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityRequest
 */
export const QueryAuthorityRequest = {
  typeUrl: "/mizufinance.poa.v1.QueryAuthorityRequest",
  is(o: any): o is QueryAuthorityRequest {
    return o && o.$typeUrl === QueryAuthorityRequest.typeUrl;
  },
  isSDK(o: any): o is QueryAuthorityRequestSDKType {
    return o && o.$typeUrl === QueryAuthorityRequest.typeUrl;
  },
  isAmino(o: any): o is QueryAuthorityRequestAmino {
    return o && o.$typeUrl === QueryAuthorityRequest.typeUrl;
  },
  encode(_: QueryAuthorityRequest, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAuthorityRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAuthorityRequest();
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
  fromPartial(_: Partial<QueryAuthorityRequest>): QueryAuthorityRequest {
    const message = createBaseQueryAuthorityRequest();
    return message;
  },
  fromAmino(_: QueryAuthorityRequestAmino): QueryAuthorityRequest {
    const message = createBaseQueryAuthorityRequest();
    return message;
  },
  toAmino(_: QueryAuthorityRequest, useInterfaces: boolean = false): QueryAuthorityRequestAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: QueryAuthorityRequestAminoMsg): QueryAuthorityRequest {
    return QueryAuthorityRequest.fromAmino(object.value);
  },
  fromProtoMsg(message: QueryAuthorityRequestProtoMsg, useInterfaces: boolean = false): QueryAuthorityRequest {
    return QueryAuthorityRequest.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAuthorityRequest): Uint8Array {
    return QueryAuthorityRequest.encode(message).finish();
  },
  toProtoMsg(message: QueryAuthorityRequest): QueryAuthorityRequestProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryAuthorityRequest",
      value: QueryAuthorityRequest.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseQueryAuthorityResponse(): QueryAuthorityResponse {
  return {
    authority: ""
  };
}
/**
 * QueryAuthorityResponse is response type for the Query/Authority RPC method.
 * @name QueryAuthorityResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.QueryAuthorityResponse
 */
export const QueryAuthorityResponse = {
  typeUrl: "/mizufinance.poa.v1.QueryAuthorityResponse",
  is(o: any): o is QueryAuthorityResponse {
    return o && (o.$typeUrl === QueryAuthorityResponse.typeUrl || typeof o.authority === "string");
  },
  isSDK(o: any): o is QueryAuthorityResponseSDKType {
    return o && (o.$typeUrl === QueryAuthorityResponse.typeUrl || typeof o.authority === "string");
  },
  isAmino(o: any): o is QueryAuthorityResponseAmino {
    return o && (o.$typeUrl === QueryAuthorityResponse.typeUrl || typeof o.authority === "string");
  },
  encode(message: QueryAuthorityResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): QueryAuthorityResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAuthorityResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<QueryAuthorityResponse>): QueryAuthorityResponse {
    const message = createBaseQueryAuthorityResponse();
    message.authority = object.authority ?? "";
    return message;
  },
  fromAmino(object: QueryAuthorityResponseAmino): QueryAuthorityResponse {
    const message = createBaseQueryAuthorityResponse();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    return message;
  },
  toAmino(message: QueryAuthorityResponse, useInterfaces: boolean = false): QueryAuthorityResponseAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    return obj;
  },
  fromAminoMsg(object: QueryAuthorityResponseAminoMsg): QueryAuthorityResponse {
    return QueryAuthorityResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: QueryAuthorityResponseProtoMsg, useInterfaces: boolean = false): QueryAuthorityResponse {
    return QueryAuthorityResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: QueryAuthorityResponse): Uint8Array {
    return QueryAuthorityResponse.encode(message).finish();
  },
  toProtoMsg(message: QueryAuthorityResponse): QueryAuthorityResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.QueryAuthorityResponse",
      value: QueryAuthorityResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};