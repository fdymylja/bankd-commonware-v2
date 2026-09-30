//@ts-nocheck
import { Params, ParamsAmino, ParamsSDKType } from "./params";
import { BinaryReader, BinaryWriter } from "../../../binary";
import { GlobalDecoderRegistry } from "../../../registry";
/**
 * GenesisState defines the poa module's genesis state.
 * @name GenesisState
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.GenesisState
 */
export interface GenesisState {
  /**
   * params defines all the parameters of the module.
   */
  params: Params | undefined;
  /**
   * validator_access is the merged whitelist/blacklist map.
   * true = whitelisted (can create validators, can unjail)
   * false = blacklisted (can't create validators, can't unjail)
   * absent = normal (can't create validators, can unjail)
   */
  validatorAccess: ValidatorAccess[];
}
export interface GenesisStateProtoMsg {
  typeUrl: "/mizufinance.poa.v1.GenesisState";
  value: Uint8Array;
}
/**
 * GenesisState defines the poa module's genesis state.
 * @name GenesisStateAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.GenesisState
 */
export interface GenesisStateAmino {
  /**
   * params defines all the parameters of the module.
   */
  params: ParamsAmino | undefined;
  /**
   * validator_access is the merged whitelist/blacklist map.
   * true = whitelisted (can create validators, can unjail)
   * false = blacklisted (can't create validators, can't unjail)
   * absent = normal (can't create validators, can unjail)
   */
  validator_access?: ValidatorAccessAmino[];
}
export interface GenesisStateAminoMsg {
  type: "/mizufinance.poa.v1.GenesisState";
  value: GenesisStateAmino;
}
/**
 * GenesisState defines the poa module's genesis state.
 * @name GenesisStateSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.GenesisState
 */
export interface GenesisStateSDKType {
  params: ParamsSDKType | undefined;
  validator_access: ValidatorAccessSDKType[];
}
/**
 * ValidatorAccess represents an entry in the validator access map.
 * @name ValidatorAccess
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.ValidatorAccess
 */
export interface ValidatorAccess {
  address: string;
  isWhitelisted: boolean;
}
export interface ValidatorAccessProtoMsg {
  typeUrl: "/mizufinance.poa.v1.ValidatorAccess";
  value: Uint8Array;
}
/**
 * ValidatorAccess represents an entry in the validator access map.
 * @name ValidatorAccessAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.ValidatorAccess
 */
export interface ValidatorAccessAmino {
  address?: string;
  is_whitelisted?: boolean;
}
export interface ValidatorAccessAminoMsg {
  type: "/mizufinance.poa.v1.ValidatorAccess";
  value: ValidatorAccessAmino;
}
/**
 * ValidatorAccess represents an entry in the validator access map.
 * @name ValidatorAccessSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.ValidatorAccess
 */
export interface ValidatorAccessSDKType {
  address: string;
  is_whitelisted: boolean;
}
function createBaseGenesisState(): GenesisState {
  return {
    params: Params.fromPartial({}),
    validatorAccess: []
  };
}
/**
 * GenesisState defines the poa module's genesis state.
 * @name GenesisState
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.GenesisState
 */
export const GenesisState = {
  typeUrl: "/mizufinance.poa.v1.GenesisState",
  is(o: any): o is GenesisState {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.is(o.params) && Array.isArray(o.validatorAccess) && (!o.validatorAccess.length || ValidatorAccess.is(o.validatorAccess[0])));
  },
  isSDK(o: any): o is GenesisStateSDKType {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.isSDK(o.params) && Array.isArray(o.validator_access) && (!o.validator_access.length || ValidatorAccess.isSDK(o.validator_access[0])));
  },
  isAmino(o: any): o is GenesisStateAmino {
    return o && (o.$typeUrl === GenesisState.typeUrl || Params.isAmino(o.params) && Array.isArray(o.validator_access) && (!o.validator_access.length || ValidatorAccess.isAmino(o.validator_access[0])));
  },
  encode(message: GenesisState, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.validatorAccess) {
      ValidatorAccess.encode(v!, writer.uint32(18).fork()).ldelim();
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
          message.validatorAccess.push(ValidatorAccess.decode(reader, reader.uint32(), useInterfaces));
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
    message.validatorAccess = object.validatorAccess?.map(e => ValidatorAccess.fromPartial(e)) || [];
    return message;
  },
  fromAmino(object: GenesisStateAmino): GenesisState {
    const message = createBaseGenesisState();
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromAmino(object.params);
    }
    message.validatorAccess = object.validator_access?.map(e => ValidatorAccess.fromAmino(e)) || [];
    return message;
  },
  toAmino(message: GenesisState, useInterfaces: boolean = false): GenesisStateAmino {
    const obj: any = {};
    obj.params = message.params ? Params.toAmino(message.params, useInterfaces) : Params.toAmino(Params.fromPartial({}));
    if (message.validatorAccess) {
      obj.validator_access = message.validatorAccess.map(e => e ? ValidatorAccess.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.validator_access = message.validatorAccess;
    }
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
      typeUrl: "/mizufinance.poa.v1.GenesisState",
      value: GenesisState.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(GenesisState.typeUrl)) {
      return;
    }
    Params.registerTypeUrl();
    ValidatorAccess.registerTypeUrl();
  }
};
function createBaseValidatorAccess(): ValidatorAccess {
  return {
    address: "",
    isWhitelisted: false
  };
}
/**
 * ValidatorAccess represents an entry in the validator access map.
 * @name ValidatorAccess
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.ValidatorAccess
 */
export const ValidatorAccess = {
  typeUrl: "/mizufinance.poa.v1.ValidatorAccess",
  is(o: any): o is ValidatorAccess {
    return o && (o.$typeUrl === ValidatorAccess.typeUrl || typeof o.address === "string" && typeof o.isWhitelisted === "boolean");
  },
  isSDK(o: any): o is ValidatorAccessSDKType {
    return o && (o.$typeUrl === ValidatorAccess.typeUrl || typeof o.address === "string" && typeof o.is_whitelisted === "boolean");
  },
  isAmino(o: any): o is ValidatorAccessAmino {
    return o && (o.$typeUrl === ValidatorAccess.typeUrl || typeof o.address === "string" && typeof o.is_whitelisted === "boolean");
  },
  encode(message: ValidatorAccess, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.isWhitelisted === true) {
      writer.uint32(16).bool(message.isWhitelisted);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): ValidatorAccess {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseValidatorAccess();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        case 2:
          message.isWhitelisted = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<ValidatorAccess>): ValidatorAccess {
    const message = createBaseValidatorAccess();
    message.address = object.address ?? "";
    message.isWhitelisted = object.isWhitelisted ?? false;
    return message;
  },
  fromAmino(object: ValidatorAccessAmino): ValidatorAccess {
    const message = createBaseValidatorAccess();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.is_whitelisted !== undefined && object.is_whitelisted !== null) {
      message.isWhitelisted = object.is_whitelisted;
    }
    return message;
  },
  toAmino(message: ValidatorAccess, useInterfaces: boolean = false): ValidatorAccessAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.is_whitelisted = message.isWhitelisted === false ? undefined : message.isWhitelisted;
    return obj;
  },
  fromAminoMsg(object: ValidatorAccessAminoMsg): ValidatorAccess {
    return ValidatorAccess.fromAmino(object.value);
  },
  fromProtoMsg(message: ValidatorAccessProtoMsg, useInterfaces: boolean = false): ValidatorAccess {
    return ValidatorAccess.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: ValidatorAccess): Uint8Array {
    return ValidatorAccess.encode(message).finish();
  },
  toProtoMsg(message: ValidatorAccess): ValidatorAccessProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.ValidatorAccess",
      value: ValidatorAccess.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};