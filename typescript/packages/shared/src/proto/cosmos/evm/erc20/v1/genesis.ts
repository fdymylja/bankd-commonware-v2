//@ts-nocheck
import { TokenPair, TokenPairAmino, TokenPairSDKType, Allowance, AllowanceAmino, AllowanceSDKType } from "./erc20";
import { BinaryReader, BinaryWriter } from "../../../../binary";
import { GlobalDecoderRegistry } from "../../../../registry";
/**
 * GenesisState defines the module's genesis state.
 * @name GenesisState
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.GenesisState
 */
export interface GenesisState {
  /**
   * params are the erc20 module parameters at genesis
   */
  params: Params | undefined;
  /**
   * token_pairs is a slice of the registered token pairs (mappings) at genesis
   */
  tokenPairs: TokenPair[];
  /**
   * allowances is a slice of the registered allowances at genesis
   */
  allowances: Allowance[];
  /**
   * native_precompiles is a slice of registered native precompiles at genesis
   */
  nativePrecompiles?: string[];
  /**
   * dynamic_precompiles is a slice of registered dynamic precompiles at genesis
   */
  dynamicPrecompiles?: string[];
}
export interface GenesisStateProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.GenesisState";
  value: Uint8Array;
}
/**
 * GenesisState defines the module's genesis state.
 * @name GenesisStateAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.GenesisState
 */
export interface GenesisStateAmino {
  /**
   * params are the erc20 module parameters at genesis
   */
  params: ParamsAmino | undefined;
  /**
   * token_pairs is a slice of the registered token pairs (mappings) at genesis
   */
  token_pairs: TokenPairAmino[];
  /**
   * allowances is a slice of the registered allowances at genesis
   */
  allowances: AllowanceAmino[];
  /**
   * native_precompiles is a slice of registered native precompiles at genesis
   */
  native_precompiles: string[];
  /**
   * dynamic_precompiles is a slice of registered dynamic precompiles at genesis
   */
  dynamic_precompiles: string[];
}
export interface GenesisStateAminoMsg {
  type: "cosmos-sdk/GenesisState";
  value: GenesisStateAmino;
}
/**
 * GenesisState defines the module's genesis state.
 * @name GenesisStateSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.GenesisState
 */
export interface GenesisStateSDKType {
  params: ParamsSDKType | undefined;
  token_pairs: TokenPairSDKType[];
  allowances: AllowanceSDKType[];
  native_precompiles?: string[];
  dynamic_precompiles?: string[];
}
/**
 * Params defines the erc20 module params
 * @name Params
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.Params
 */
export interface Params {
  /**
   * enable_erc20 is the parameter to enable the conversion of Cosmos coins <-->
   * ERC20 tokens.
   */
  enableErc20: boolean;
  /**
   * permissionless_registration is the parameter that allows ERC20s to be
   * permissionlessly registered to be converted to bank tokens and vice versa
   */
  permissionlessRegistration: boolean;
}
export interface ParamsProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.Params";
  value: Uint8Array;
}
/**
 * Params defines the erc20 module params
 * @name ParamsAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.Params
 */
export interface ParamsAmino {
  /**
   * enable_erc20 is the parameter to enable the conversion of Cosmos coins <-->
   * ERC20 tokens.
   */
  enable_erc20?: boolean;
  /**
   * permissionless_registration is the parameter that allows ERC20s to be
   * permissionlessly registered to be converted to bank tokens and vice versa
   */
  permissionless_registration?: boolean;
}
export interface ParamsAminoMsg {
  type: "cosmos-sdk/Params";
  value: ParamsAmino;
}
/**
 * Params defines the erc20 module params
 * @name ParamsSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.Params
 */
export interface ParamsSDKType {
  enable_erc20: boolean;
  permissionless_registration: boolean;
}
function createBaseGenesisState(): GenesisState {
  return {
    params: Params.fromPartial({}),
    tokenPairs: [],
    allowances: [],
    nativePrecompiles: [],
    dynamicPrecompiles: []
  };
}
/**
 * GenesisState defines the module's genesis state.
 * @name GenesisState
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.GenesisState
 */
export const GenesisState = {
  typeUrl: "/cosmos.evm.erc20.v1.GenesisState",
  aminoType: "cosmos-sdk/GenesisState",
  is(o: any): o is GenesisState {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.is(o.params) && Array.isArray(o.tokenPairs) && (!o.tokenPairs.length || TokenPair.is(o.tokenPairs[0])) && Array.isArray(o.allowances) && (!o.allowances.length || Allowance.is(o.allowances[0])));
  },
  isSDK(o: any): o is GenesisStateSDKType {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.isSDK(o.params) && Array.isArray(o.token_pairs) && (!o.token_pairs.length || TokenPair.isSDK(o.token_pairs[0])) && Array.isArray(o.allowances) && (!o.allowances.length || Allowance.isSDK(o.allowances[0])));
  },
  isAmino(o: any): o is GenesisStateAmino {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.isAmino(o.params) && Array.isArray(o.token_pairs) && (!o.token_pairs.length || TokenPair.isAmino(o.token_pairs[0])) && Array.isArray(o.allowances) && (!o.allowances.length || Allowance.isAmino(o.allowances[0])));
  },
  encode(message: GenesisState, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.tokenPairs) {
      TokenPair.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    for (const v of message.allowances) {
      Allowance.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    for (const v of message.nativePrecompiles) {
      writer.uint32(34).string(v!);
    }
    for (const v of message.dynamicPrecompiles) {
      writer.uint32(42).string(v!);
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
        case 2:
          message.tokenPairs.push(TokenPair.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 3:
          message.allowances.push(Allowance.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 4:
          message.nativePrecompiles.push(reader.string());
          break;
        case 5:
          message.dynamicPrecompiles.push(reader.string());
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
    message.tokenPairs = object.tokenPairs?.map(e => TokenPair.fromPartial(e)) || [];
    message.allowances = object.allowances?.map(e => Allowance.fromPartial(e)) || [];
    message.nativePrecompiles = object.nativePrecompiles?.map(e => e) || [];
    message.dynamicPrecompiles = object.dynamicPrecompiles?.map(e => e) || [];
    return message;
  },
  fromAmino(object: GenesisStateAmino): GenesisState {
    const message = createBaseGenesisState();
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromAmino(object.params);
    }
    message.tokenPairs = object.token_pairs?.map(e => TokenPair.fromAmino(e)) || [];
    message.allowances = object.allowances?.map(e => Allowance.fromAmino(e)) || [];
    message.nativePrecompiles = object.native_precompiles?.map(e => e) || [];
    message.dynamicPrecompiles = object.dynamic_precompiles?.map(e => e) || [];
    return message;
  },
  toAmino(message: GenesisState, useInterfaces: boolean = false): GenesisStateAmino {
    const obj: any = {};
    obj.params = message.params ? Params.toAmino(message.params, useInterfaces) : Params.toAmino(Params.fromPartial({}));
    if (message.tokenPairs) {
      obj.token_pairs = message.tokenPairs.map(e => e ? TokenPair.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.token_pairs = message.tokenPairs;
    }
    if (message.allowances) {
      obj.allowances = message.allowances.map(e => e ? Allowance.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.allowances = message.allowances;
    }
    if (message.nativePrecompiles) {
      obj.native_precompiles = message.nativePrecompiles.map(e => e);
    } else {
      obj.native_precompiles = message.nativePrecompiles;
    }
    if (message.dynamicPrecompiles) {
      obj.dynamic_precompiles = message.dynamicPrecompiles.map(e => e);
    } else {
      obj.dynamic_precompiles = message.dynamicPrecompiles;
    }
    return obj;
  },
  fromAminoMsg(object: GenesisStateAminoMsg): GenesisState {
    return GenesisState.fromAmino(object.value);
  },
  toAminoMsg(message: GenesisState, useInterfaces: boolean = false): GenesisStateAminoMsg {
    return {
      type: "cosmos-sdk/GenesisState",
      value: GenesisState.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: GenesisStateProtoMsg, useInterfaces: boolean = false): GenesisState {
    return GenesisState.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: GenesisState): Uint8Array {
    return GenesisState.encode(message).finish();
  },
  toProtoMsg(message: GenesisState): GenesisStateProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.GenesisState",
      value: GenesisState.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(GenesisState.typeUrl)) {
      return;
    }
    Params.registerTypeUrl();
    TokenPair.registerTypeUrl();
    Allowance.registerTypeUrl();
  }
};
function createBaseParams(): Params {
  return {
    enableErc20: false,
    permissionlessRegistration: false
  };
}
/**
 * Params defines the erc20 module params
 * @name Params
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.Params
 */
export const Params = {
  typeUrl: "/cosmos.evm.erc20.v1.Params",
  aminoType: "cosmos-sdk/Params",
  is(o: any): o is Params {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.enableErc20 === "boolean" && typeof o.permissionlessRegistration === "boolean");
  },
  isSDK(o: any): o is ParamsSDKType {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.enable_erc20 === "boolean" && typeof o.permissionless_registration === "boolean");
  },
  isAmino(o: any): o is ParamsAmino {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.enable_erc20 === "boolean" && typeof o.permissionless_registration === "boolean");
  },
  encode(message: Params, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.enableErc20 === true) {
      writer.uint32(8).bool(message.enableErc20);
    }
    if (message.permissionlessRegistration === true) {
      writer.uint32(40).bool(message.permissionlessRegistration);
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
          message.enableErc20 = reader.bool();
          break;
        case 5:
          message.permissionlessRegistration = reader.bool();
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
    message.enableErc20 = object.enableErc20 ?? false;
    message.permissionlessRegistration = object.permissionlessRegistration ?? false;
    return message;
  },
  fromAmino(object: ParamsAmino): Params {
    const message = createBaseParams();
    if (object.enable_erc20 !== undefined && object.enable_erc20 !== null) {
      message.enableErc20 = object.enable_erc20;
    }
    if (object.permissionless_registration !== undefined && object.permissionless_registration !== null) {
      message.permissionlessRegistration = object.permissionless_registration;
    }
    return message;
  },
  toAmino(message: Params, useInterfaces: boolean = false): ParamsAmino {
    const obj: any = {};
    obj.enable_erc20 = message.enableErc20 === false ? undefined : message.enableErc20;
    obj.permissionless_registration = message.permissionlessRegistration === false ? undefined : message.permissionlessRegistration;
    return obj;
  },
  fromAminoMsg(object: ParamsAminoMsg): Params {
    return Params.fromAmino(object.value);
  },
  toAminoMsg(message: Params, useInterfaces: boolean = false): ParamsAminoMsg {
    return {
      type: "cosmos-sdk/Params",
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
      typeUrl: "/cosmos.evm.erc20.v1.Params",
      value: Params.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};