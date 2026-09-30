//@ts-nocheck
import { BinaryReader, BinaryWriter } from "../../../binary";
import { GlobalDecoderRegistry } from "../../../registry";
/**
 * GenesisState defines the module genesis state
 * @name GenesisState
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.GenesisState
 */
export interface GenesisState {
  /**
   * Params defines all the parameters of the module.
   */
  params: Params | undefined;
}
export interface GenesisStateProtoMsg {
  typeUrl: "/mizufinance.unwrap.v1.GenesisState";
  value: Uint8Array;
}
/**
 * GenesisState defines the module genesis state
 * @name GenesisStateAmino
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.GenesisState
 */
export interface GenesisStateAmino {
  /**
   * Params defines all the parameters of the module.
   */
  params?: ParamsAmino | undefined;
}
export interface GenesisStateAminoMsg {
  type: "/mizufinance.unwrap.v1.GenesisState";
  value: GenesisStateAmino;
}
/**
 * GenesisState defines the module genesis state
 * @name GenesisStateSDKType
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.GenesisState
 */
export interface GenesisStateSDKType {
  params: ParamsSDKType | undefined;
}
/**
 * Params defines the set of module parameters.
 * @name Params
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.Params
 */
export interface Params {
  /**
   * bank_type is either: regional or central.
   */
  bankType: string;
  /**
   * ibc_channel is the central bank's IBC channel (typically channel-0 if you connect to it first)
   */
  ibcChannel: string;
  /**
   * ibc_channel_denom is the denomination used for IBC transfers on the central bank's channel (i.e. ubrl)
   */
  ibcChannelDenom: string;
}
export interface ParamsProtoMsg {
  typeUrl: "/mizufinance.unwrap.v1.Params";
  value: Uint8Array;
}
/**
 * Params defines the set of module parameters.
 * @name ParamsAmino
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.Params
 */
export interface ParamsAmino {
  /**
   * bank_type is either: regional or central.
   */
  bank_type?: string;
  /**
   * ibc_channel is the central bank's IBC channel (typically channel-0 if you connect to it first)
   */
  ibc_channel?: string;
  /**
   * ibc_channel_denom is the denomination used for IBC transfers on the central bank's channel (i.e. ubrl)
   */
  ibc_channel_denom?: string;
}
export interface ParamsAminoMsg {
  type: "unwrap/params";
  value: ParamsAmino;
}
/**
 * Params defines the set of module parameters.
 * @name ParamsSDKType
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.Params
 */
export interface ParamsSDKType {
  bank_type: string;
  ibc_channel: string;
  ibc_channel_denom: string;
}
function createBaseGenesisState(): GenesisState {
  return {
    params: Params.fromPartial({})
  };
}
/**
 * GenesisState defines the module genesis state
 * @name GenesisState
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.GenesisState
 */
export const GenesisState = {
  typeUrl: "/mizufinance.unwrap.v1.GenesisState",
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
      typeUrl: "/mizufinance.unwrap.v1.GenesisState",
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
    bankType: "",
    ibcChannel: "",
    ibcChannelDenom: ""
  };
}
/**
 * Params defines the set of module parameters.
 * @name Params
 * @package mizufinance.unwrap.v1
 * @see proto type: mizufinance.unwrap.v1.Params
 */
export const Params = {
  typeUrl: "/mizufinance.unwrap.v1.Params",
  aminoType: "unwrap/params",
  is(o: any): o is Params {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.bankType === "string" && typeof o.ibcChannel === "string" && typeof o.ibcChannelDenom === "string");
  },
  isSDK(o: any): o is ParamsSDKType {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.bank_type === "string" && typeof o.ibc_channel === "string" && typeof o.ibc_channel_denom === "string");
  },
  isAmino(o: any): o is ParamsAmino {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.bank_type === "string" && typeof o.ibc_channel === "string" && typeof o.ibc_channel_denom === "string");
  },
  encode(message: Params, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.bankType !== "") {
      writer.uint32(10).string(message.bankType);
    }
    if (message.ibcChannel !== "") {
      writer.uint32(18).string(message.ibcChannel);
    }
    if (message.ibcChannelDenom !== "") {
      writer.uint32(26).string(message.ibcChannelDenom);
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
          message.bankType = reader.string();
          break;
        case 2:
          message.ibcChannel = reader.string();
          break;
        case 3:
          message.ibcChannelDenom = reader.string();
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
    message.bankType = object.bankType ?? "";
    message.ibcChannel = object.ibcChannel ?? "";
    message.ibcChannelDenom = object.ibcChannelDenom ?? "";
    return message;
  },
  fromAmino(object: ParamsAmino): Params {
    const message = createBaseParams();
    if (object.bank_type !== undefined && object.bank_type !== null) {
      message.bankType = object.bank_type;
    }
    if (object.ibc_channel !== undefined && object.ibc_channel !== null) {
      message.ibcChannel = object.ibc_channel;
    }
    if (object.ibc_channel_denom !== undefined && object.ibc_channel_denom !== null) {
      message.ibcChannelDenom = object.ibc_channel_denom;
    }
    return message;
  },
  toAmino(message: Params, useInterfaces: boolean = false): ParamsAmino {
    const obj: any = {};
    obj.bank_type = message.bankType === "" ? undefined : message.bankType;
    obj.ibc_channel = message.ibcChannel === "" ? undefined : message.ibcChannel;
    obj.ibc_channel_denom = message.ibcChannelDenom === "" ? undefined : message.ibcChannelDenom;
    return obj;
  },
  fromAminoMsg(object: ParamsAminoMsg): Params {
    return Params.fromAmino(object.value);
  },
  toAminoMsg(message: Params, useInterfaces: boolean = false): ParamsAminoMsg {
    return {
      type: "unwrap/params",
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
      typeUrl: "/mizufinance.unwrap.v1.Params",
      value: Params.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};