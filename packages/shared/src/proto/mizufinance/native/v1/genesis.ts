//@ts-nocheck
import { BinaryReader, BinaryWriter } from "../../../binary";
import { GlobalDecoderRegistry } from "../../../registry";
/**
 * GenesisState defines the module genesis state
 * @name GenesisState
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.GenesisState
 */
export interface GenesisState {
  /**
   * Params defines all the parameters of the module.
   */
  params: Params | undefined;
}
export interface GenesisStateProtoMsg {
  typeUrl: "/mizufinance.native.v1.GenesisState";
  value: Uint8Array;
}
/**
 * GenesisState defines the module genesis state
 * @name GenesisStateAmino
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.GenesisState
 */
export interface GenesisStateAmino {
  /**
   * Params defines all the parameters of the module.
   */
  params?: ParamsAmino | undefined;
}
export interface GenesisStateAminoMsg {
  type: "/mizufinance.native.v1.GenesisState";
  value: GenesisStateAmino;
}
/**
 * GenesisState defines the module genesis state
 * @name GenesisStateSDKType
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.GenesisState
 */
export interface GenesisStateSDKType {
  params: ParamsSDKType | undefined;
}
/**
 * Params defines the set of module parameters.
 * @name Params
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.Params
 */
export interface Params {
  /**
   * admin_address is the address that can perform actions
   */
  adminAddress: string;
  /**
   * whitelisted_minters is a list of hex user addresses or hex smart contract addresses that can mint new tokens
   */
  whitelistedMinters: string[];
}
export interface ParamsProtoMsg {
  typeUrl: "/mizufinance.native.v1.Params";
  value: Uint8Array;
}
/**
 * Params defines the set of module parameters.
 * @name ParamsAmino
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.Params
 */
export interface ParamsAmino {
  /**
   * admin_address is the address that can perform actions
   */
  admin_address?: string;
  /**
   * whitelisted_minters is a list of hex user addresses or hex smart contract addresses that can mint new tokens
   */
  whitelisted_minters?: string[];
}
export interface ParamsAminoMsg {
  type: "native/params";
  value: ParamsAmino;
}
/**
 * Params defines the set of module parameters.
 * @name ParamsSDKType
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.Params
 */
export interface ParamsSDKType {
  admin_address: string;
  whitelisted_minters: string[];
}
function createBaseGenesisState(): GenesisState {
  return {
    params: Params.fromPartial({})
  };
}
/**
 * GenesisState defines the module genesis state
 * @name GenesisState
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.GenesisState
 */
export const GenesisState = {
  typeUrl: "/mizufinance.native.v1.GenesisState",
  is(o: any): o is GenesisState {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.is(o.params));
  },
  isSDK(o: any): o is GenesisStateSDKType {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.isSDK(o.params));
  },
  isAmino(o: any): o is GenesisStateAmino {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.isAmino(o.params));
  },
  encode(message: GenesisState, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): GenesisState {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGenesisState();
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
  fromPartial(object: Partial<GenesisState>): GenesisState {
    const message = createBaseGenesisState();
    message.params = object.params !== undefined && object.params !== null ? Params.fromPartial(object.params) : undefined;
    return message;
  },
  fromAmino(object: GenesisStateAmino): GenesisState {
    const message = createBaseGenesisState();
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromAmino(object.params);
    }
    return message;
  },
  toAmino(message: GenesisState, useInterfaces: boolean = false): GenesisStateAmino {
    const obj: any = {};
    obj.params = message.params ? Params.toAmino(message.params, useInterfaces) : undefined;
    return obj;
  },
  fromAminoMsg(object: GenesisStateAminoMsg): GenesisState {
    return GenesisState.fromAmino(object.value);
  },
  fromProtoMsg(message: GenesisStateProtoMsg, useInterfaces: boolean = false): GenesisState {
    return GenesisState.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: GenesisState): Uint8Array {
    return GenesisState.encode(message).finish();
  },
  toProtoMsg(message: GenesisState): GenesisStateProtoMsg {
    return {
      typeUrl: "/mizufinance.native.v1.GenesisState",
      value: GenesisState.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(GenesisState.typeUrl)) {
      return;
    }
    Params.registerTypeUrl();
  }
};
function createBaseParams(): Params {
  return {
    adminAddress: "",
    whitelistedMinters: []
  };
}
/**
 * Params defines the set of module parameters.
 * @name Params
 * @package mizufinance.native.v1
 * @see proto type: mizufinance.native.v1.Params
 */
export const Params = {
  typeUrl: "/mizufinance.native.v1.Params",
  aminoType: "native/params",
  is(o: any): o is Params {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.adminAddress === "string" && Array.isArray(o.whitelistedMinters) && (!o.whitelistedMinters.length || typeof o.whitelistedMinters[0] === "string"));
  },
  isSDK(o: any): o is ParamsSDKType {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.admin_address === "string" && Array.isArray(o.whitelisted_minters) && (!o.whitelisted_minters.length || typeof o.whitelisted_minters[0] === "string"));
  },
  isAmino(o: any): o is ParamsAmino {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.admin_address === "string" && Array.isArray(o.whitelisted_minters) && (!o.whitelisted_minters.length || typeof o.whitelisted_minters[0] === "string"));
  },
  encode(message: Params, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.adminAddress !== "") {
      writer.uint32(10).string(message.adminAddress);
    }
    for (const v of message.whitelistedMinters) {
      writer.uint32(18).string(v!);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): Params {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseParams();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.adminAddress = reader.string();
          break;
        case 2:
          message.whitelistedMinters.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<Params>): Params {
    const message = createBaseParams();
    message.adminAddress = object.adminAddress ?? "";
    message.whitelistedMinters = object.whitelistedMinters?.map(e => e) || [];
    return message;
  },
  fromAmino(object: ParamsAmino): Params {
    const message = createBaseParams();
    if (object.admin_address !== undefined && object.admin_address !== null) {
      message.adminAddress = object.admin_address;
    }
    message.whitelistedMinters = object.whitelisted_minters?.map(e => e) || [];
    return message;
  },
  toAmino(message: Params, useInterfaces: boolean = false): ParamsAmino {
    const obj: any = {};
    obj.admin_address = message.adminAddress === "" ? undefined : message.adminAddress;
    if (message.whitelistedMinters) {
      obj.whitelisted_minters = message.whitelistedMinters.map(e => e);
    } else {
      obj.whitelisted_minters = message.whitelistedMinters;
    }
    return obj;
  },
  fromAminoMsg(object: ParamsAminoMsg): Params {
    return Params.fromAmino(object.value);
  },
  toAminoMsg(message: Params, useInterfaces: boolean = false): ParamsAminoMsg {
    return {
      type: "native/params",
      value: Params.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: ParamsProtoMsg, useInterfaces: boolean = false): Params {
    return Params.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: Params): Uint8Array {
    return Params.encode(message).finish();
  },
  toProtoMsg(message: Params): ParamsProtoMsg {
    return {
      typeUrl: "/mizufinance.native.v1.Params",
      value: Params.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};