//@ts-nocheck
import { Any, AnyProtoMsg, AnyAmino, AnySDKType } from "../../../google/protobuf/any";
import { Params, ParamsAmino, ParamsSDKType } from "./params";
import { BinaryReader, BinaryWriter } from "../../../binary";
import { GlobalDecoderRegistry } from "../../../registry";
import { encodePubkey, decodePubkey } from "@interchainjs/pubkey";
/**
 * MsgAddValidator creates a new validator with authority-minted tokens.
 * @name MsgAddValidator
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidator
 */
export interface MsgAddValidator {
  authority: string;
  pubKey?: Any | undefined;
  moniker: string;
  weight: bigint;
}
export interface MsgAddValidatorProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgAddValidator";
  value: Uint8Array;
}
export type MsgAddValidatorEncoded = Omit<MsgAddValidator, "pubKey"> & {
  pubKey?: AnyProtoMsg | undefined;
};
/**
 * MsgAddValidator creates a new validator with authority-minted tokens.
 * @name MsgAddValidatorAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidator
 */
export interface MsgAddValidatorAmino {
  authority?: string;
  pub_key?: AnyAmino | undefined;
  moniker?: string;
  weight?: string;
}
export interface MsgAddValidatorAminoMsg {
  type: "x/poa/MsgAddValidator";
  value: MsgAddValidatorAmino;
}
/**
 * MsgAddValidator creates a new validator with authority-minted tokens.
 * @name MsgAddValidatorSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidator
 */
export interface MsgAddValidatorSDKType {
  authority: string;
  pub_key?: AnySDKType | undefined;
  moniker: string;
  weight: bigint;
}
/**
 * MsgAddValidatorResponse is the response type for MsgAddValidator.
 * @name MsgAddValidatorResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidatorResponse
 */
export interface MsgAddValidatorResponse {}
export interface MsgAddValidatorResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgAddValidatorResponse";
  value: Uint8Array;
}
/**
 * MsgAddValidatorResponse is the response type for MsgAddValidator.
 * @name MsgAddValidatorResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidatorResponse
 */
export interface MsgAddValidatorResponseAmino {}
export interface MsgAddValidatorResponseAminoMsg {
  type: "/mizufinance.poa.v1.MsgAddValidatorResponse";
  value: MsgAddValidatorResponseAmino;
}
/**
 * MsgAddValidatorResponse is the response type for MsgAddValidator.
 * @name MsgAddValidatorResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidatorResponse
 */
export interface MsgAddValidatorResponseSDKType {}
/**
 * MsgAddWhitelist adds a validator address to the whitelist.
 * @name MsgAddWhitelist
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelist
 */
export interface MsgAddWhitelist {
  authority: string;
  validatorAddress: string;
}
export interface MsgAddWhitelistProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgAddWhitelist";
  value: Uint8Array;
}
/**
 * MsgAddWhitelist adds a validator address to the whitelist.
 * @name MsgAddWhitelistAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelist
 */
export interface MsgAddWhitelistAmino {
  authority?: string;
  validator_address?: string;
}
export interface MsgAddWhitelistAminoMsg {
  type: "x/poa/MsgAddWhitelist";
  value: MsgAddWhitelistAmino;
}
/**
 * MsgAddWhitelist adds a validator address to the whitelist.
 * @name MsgAddWhitelistSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelist
 */
export interface MsgAddWhitelistSDKType {
  authority: string;
  validator_address: string;
}
/**
 * MsgAddWhitelistResponse is the response type for MsgAddWhitelist.
 * @name MsgAddWhitelistResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelistResponse
 */
export interface MsgAddWhitelistResponse {}
export interface MsgAddWhitelistResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgAddWhitelistResponse";
  value: Uint8Array;
}
/**
 * MsgAddWhitelistResponse is the response type for MsgAddWhitelist.
 * @name MsgAddWhitelistResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelistResponse
 */
export interface MsgAddWhitelistResponseAmino {}
export interface MsgAddWhitelistResponseAminoMsg {
  type: "/mizufinance.poa.v1.MsgAddWhitelistResponse";
  value: MsgAddWhitelistResponseAmino;
}
/**
 * MsgAddWhitelistResponse is the response type for MsgAddWhitelist.
 * @name MsgAddWhitelistResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelistResponse
 */
export interface MsgAddWhitelistResponseSDKType {}
/**
 * MsgRemoveWhitelist removes a validator address from the whitelist.
 * @name MsgRemoveWhitelist
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelist
 */
export interface MsgRemoveWhitelist {
  authority: string;
  validatorAddress: string;
}
export interface MsgRemoveWhitelistProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelist";
  value: Uint8Array;
}
/**
 * MsgRemoveWhitelist removes a validator address from the whitelist.
 * @name MsgRemoveWhitelistAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelist
 */
export interface MsgRemoveWhitelistAmino {
  authority?: string;
  validator_address?: string;
}
export interface MsgRemoveWhitelistAminoMsg {
  type: "x/poa/MsgRemoveWhitelist";
  value: MsgRemoveWhitelistAmino;
}
/**
 * MsgRemoveWhitelist removes a validator address from the whitelist.
 * @name MsgRemoveWhitelistSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelist
 */
export interface MsgRemoveWhitelistSDKType {
  authority: string;
  validator_address: string;
}
/**
 * MsgRemoveWhitelistResponse is the response type for MsgRemoveWhitelist.
 * @name MsgRemoveWhitelistResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelistResponse
 */
export interface MsgRemoveWhitelistResponse {}
export interface MsgRemoveWhitelistResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelistResponse";
  value: Uint8Array;
}
/**
 * MsgRemoveWhitelistResponse is the response type for MsgRemoveWhitelist.
 * @name MsgRemoveWhitelistResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelistResponse
 */
export interface MsgRemoveWhitelistResponseAmino {}
export interface MsgRemoveWhitelistResponseAminoMsg {
  type: "/mizufinance.poa.v1.MsgRemoveWhitelistResponse";
  value: MsgRemoveWhitelistResponseAmino;
}
/**
 * MsgRemoveWhitelistResponse is the response type for MsgRemoveWhitelist.
 * @name MsgRemoveWhitelistResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelistResponse
 */
export interface MsgRemoveWhitelistResponseSDKType {}
/**
 * MsgRemoveValidator evicts a validator from the active set.
 * @name MsgRemoveValidator
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidator
 */
export interface MsgRemoveValidator {
  authority: string;
  validatorAddress: string;
}
export interface MsgRemoveValidatorProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveValidator";
  value: Uint8Array;
}
/**
 * MsgRemoveValidator evicts a validator from the active set.
 * @name MsgRemoveValidatorAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidator
 */
export interface MsgRemoveValidatorAmino {
  authority?: string;
  validator_address?: string;
}
export interface MsgRemoveValidatorAminoMsg {
  type: "x/poa/MsgRemoveValidator";
  value: MsgRemoveValidatorAmino;
}
/**
 * MsgRemoveValidator evicts a validator from the active set.
 * @name MsgRemoveValidatorSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidator
 */
export interface MsgRemoveValidatorSDKType {
  authority: string;
  validator_address: string;
}
/**
 * MsgRemoveValidatorResponse is the response type for MsgRemoveValidator.
 * @name MsgRemoveValidatorResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidatorResponse
 */
export interface MsgRemoveValidatorResponse {}
export interface MsgRemoveValidatorResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveValidatorResponse";
  value: Uint8Array;
}
/**
 * MsgRemoveValidatorResponse is the response type for MsgRemoveValidator.
 * @name MsgRemoveValidatorResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidatorResponse
 */
export interface MsgRemoveValidatorResponseAmino {}
export interface MsgRemoveValidatorResponseAminoMsg {
  type: "/mizufinance.poa.v1.MsgRemoveValidatorResponse";
  value: MsgRemoveValidatorResponseAmino;
}
/**
 * MsgRemoveValidatorResponse is the response type for MsgRemoveValidator.
 * @name MsgRemoveValidatorResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidatorResponse
 */
export interface MsgRemoveValidatorResponseSDKType {}
/**
 * MsgUpdateValidatorWeight sets a validator's consensus power to an exact value.
 * @name MsgUpdateValidatorWeight
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeight
 */
export interface MsgUpdateValidatorWeight {
  authority: string;
  validatorAddress: string;
  weight: bigint;
}
export interface MsgUpdateValidatorWeightProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeight";
  value: Uint8Array;
}
/**
 * MsgUpdateValidatorWeight sets a validator's consensus power to an exact value.
 * @name MsgUpdateValidatorWeightAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeight
 */
export interface MsgUpdateValidatorWeightAmino {
  authority?: string;
  validator_address?: string;
  weight?: string;
}
export interface MsgUpdateValidatorWeightAminoMsg {
  type: "x/poa/MsgUpdateValidatorWeight";
  value: MsgUpdateValidatorWeightAmino;
}
/**
 * MsgUpdateValidatorWeight sets a validator's consensus power to an exact value.
 * @name MsgUpdateValidatorWeightSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeight
 */
export interface MsgUpdateValidatorWeightSDKType {
  authority: string;
  validator_address: string;
  weight: bigint;
}
/**
 * MsgUpdateValidatorWeightResponse is the response type for MsgUpdateValidatorWeight.
 * @name MsgUpdateValidatorWeightResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeightResponse
 */
export interface MsgUpdateValidatorWeightResponse {}
export interface MsgUpdateValidatorWeightResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeightResponse";
  value: Uint8Array;
}
/**
 * MsgUpdateValidatorWeightResponse is the response type for MsgUpdateValidatorWeight.
 * @name MsgUpdateValidatorWeightResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeightResponse
 */
export interface MsgUpdateValidatorWeightResponseAmino {}
export interface MsgUpdateValidatorWeightResponseAminoMsg {
  type: "/mizufinance.poa.v1.MsgUpdateValidatorWeightResponse";
  value: MsgUpdateValidatorWeightResponseAmino;
}
/**
 * MsgUpdateValidatorWeightResponse is the response type for MsgUpdateValidatorWeight.
 * @name MsgUpdateValidatorWeightResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeightResponse
 */
export interface MsgUpdateValidatorWeightResponseSDKType {}
/**
 * MsgUpdateParams is the Msg/UpdateParams request type.
 * @name MsgUpdateParams
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParams
 */
export interface MsgUpdateParams {
  authority: string;
  params: Params | undefined;
}
export interface MsgUpdateParamsProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateParams";
  value: Uint8Array;
}
/**
 * MsgUpdateParams is the Msg/UpdateParams request type.
 * @name MsgUpdateParamsAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParams
 */
export interface MsgUpdateParamsAmino {
  authority?: string;
  params: ParamsAmino | undefined;
}
export interface MsgUpdateParamsAminoMsg {
  type: "x/poa/MsgUpdateParams";
  value: MsgUpdateParamsAmino;
}
/**
 * MsgUpdateParams is the Msg/UpdateParams request type.
 * @name MsgUpdateParamsSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParams
 */
export interface MsgUpdateParamsSDKType {
  authority: string;
  params: ParamsSDKType | undefined;
}
/**
 * MsgUpdateParamsResponse is the response type for MsgUpdateParams.
 * @name MsgUpdateParamsResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponse {}
export interface MsgUpdateParamsResponseProtoMsg {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateParamsResponse";
  value: Uint8Array;
}
/**
 * MsgUpdateParamsResponse is the response type for MsgUpdateParams.
 * @name MsgUpdateParamsResponseAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponseAmino {}
export interface MsgUpdateParamsResponseAminoMsg {
  type: "/mizufinance.poa.v1.MsgUpdateParamsResponse";
  value: MsgUpdateParamsResponseAmino;
}
/**
 * MsgUpdateParamsResponse is the response type for MsgUpdateParams.
 * @name MsgUpdateParamsResponseSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponseSDKType {}
function createBaseMsgAddValidator(): MsgAddValidator {
  return {
    authority: "",
    pubKey: undefined,
    moniker: "",
    weight: BigInt(0)
  };
}
/**
 * MsgAddValidator creates a new validator with authority-minted tokens.
 * @name MsgAddValidator
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidator
 */
export const MsgAddValidator = {
  typeUrl: "/mizufinance.poa.v1.MsgAddValidator",
  aminoType: "x/poa/MsgAddValidator",
  is(o: any): o is MsgAddValidator {
    return o && (o.$typeUrl === MsgAddValidator.typeUrl || typeof o.authority === "string" && typeof o.moniker === "string" && typeof o.weight === "bigint");
  },
  isSDK(o: any): o is MsgAddValidatorSDKType {
    return o && (o.$typeUrl === MsgAddValidator.typeUrl || typeof o.authority === "string" && typeof o.moniker === "string" && typeof o.weight === "bigint");
  },
  isAmino(o: any): o is MsgAddValidatorAmino {
    return o && (o.$typeUrl === MsgAddValidator.typeUrl || typeof o.authority === "string" && typeof o.moniker === "string" && typeof o.weight === "bigint");
  },
  encode(message: MsgAddValidator, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.pubKey !== undefined) {
      Any.encode(GlobalDecoderRegistry.wrapAny(message.pubKey), writer.uint32(18).fork()).ldelim();
    }
    if (message.moniker !== "") {
      writer.uint32(26).string(message.moniker);
    }
    if (message.weight !== BigInt(0)) {
      writer.uint32(32).uint64(message.weight);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgAddValidator {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgAddValidator();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.pubKey = GlobalDecoderRegistry.unwrapAny(reader);
          break;
        case 3:
          message.moniker = reader.string();
          break;
        case 4:
          message.weight = reader.uint64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgAddValidator>): MsgAddValidator {
    const message = createBaseMsgAddValidator();
    message.authority = object.authority ?? "";
    message.pubKey = object.pubKey !== undefined && object.pubKey !== null ? GlobalDecoderRegistry.fromPartial(object.pubKey) : undefined;
    message.moniker = object.moniker ?? "";
    message.weight = object.weight !== undefined && object.weight !== null ? BigInt(object.weight.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: MsgAddValidatorAmino): MsgAddValidator {
    const message = createBaseMsgAddValidator();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    if (object.pub_key !== undefined && object.pub_key !== null) {
      message.pubKey = encodePubkey(object.pub_key);
    }
    if (object.moniker !== undefined && object.moniker !== null) {
      message.moniker = object.moniker;
    }
    if (object.weight !== undefined && object.weight !== null) {
      message.weight = BigInt(object.weight);
    }
    return message;
  },
  toAmino(message: MsgAddValidator, useInterfaces: boolean = false): MsgAddValidatorAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    obj.pub_key = message.pubKey ? decodePubkey(message.pubKey) : undefined;
    obj.moniker = message.moniker === "" ? undefined : message.moniker;
    obj.weight = message.weight !== BigInt(0) ? message.weight?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: MsgAddValidatorAminoMsg): MsgAddValidator {
    return MsgAddValidator.fromAmino(object.value);
  },
  toAminoMsg(message: MsgAddValidator, useInterfaces: boolean = false): MsgAddValidatorAminoMsg {
    return {
      type: "x/poa/MsgAddValidator",
      value: MsgAddValidator.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgAddValidatorProtoMsg, useInterfaces: boolean = false): MsgAddValidator {
    return MsgAddValidator.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgAddValidator): Uint8Array {
    return MsgAddValidator.encode(message).finish();
  },
  toProtoMsg(message: MsgAddValidator): MsgAddValidatorProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgAddValidator",
      value: MsgAddValidator.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgAddValidatorResponse(): MsgAddValidatorResponse {
  return {};
}
/**
 * MsgAddValidatorResponse is the response type for MsgAddValidator.
 * @name MsgAddValidatorResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddValidatorResponse
 */
export const MsgAddValidatorResponse = {
  typeUrl: "/mizufinance.poa.v1.MsgAddValidatorResponse",
  is(o: any): o is MsgAddValidatorResponse {
    return o && o.$typeUrl === MsgAddValidatorResponse.typeUrl;
  },
  isSDK(o: any): o is MsgAddValidatorResponseSDKType {
    return o && o.$typeUrl === MsgAddValidatorResponse.typeUrl;
  },
  isAmino(o: any): o is MsgAddValidatorResponseAmino {
    return o && o.$typeUrl === MsgAddValidatorResponse.typeUrl;
  },
  encode(_: MsgAddValidatorResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgAddValidatorResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgAddValidatorResponse();
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
  fromPartial(_: Partial<MsgAddValidatorResponse>): MsgAddValidatorResponse {
    const message = createBaseMsgAddValidatorResponse();
    return message;
  },
  fromAmino(_: MsgAddValidatorResponseAmino): MsgAddValidatorResponse {
    const message = createBaseMsgAddValidatorResponse();
    return message;
  },
  toAmino(_: MsgAddValidatorResponse, useInterfaces: boolean = false): MsgAddValidatorResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgAddValidatorResponseAminoMsg): MsgAddValidatorResponse {
    return MsgAddValidatorResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: MsgAddValidatorResponseProtoMsg, useInterfaces: boolean = false): MsgAddValidatorResponse {
    return MsgAddValidatorResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgAddValidatorResponse): Uint8Array {
    return MsgAddValidatorResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgAddValidatorResponse): MsgAddValidatorResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgAddValidatorResponse",
      value: MsgAddValidatorResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgAddWhitelist(): MsgAddWhitelist {
  return {
    authority: "",
    validatorAddress: ""
  };
}
/**
 * MsgAddWhitelist adds a validator address to the whitelist.
 * @name MsgAddWhitelist
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelist
 */
export const MsgAddWhitelist = {
  typeUrl: "/mizufinance.poa.v1.MsgAddWhitelist",
  aminoType: "x/poa/MsgAddWhitelist",
  is(o: any): o is MsgAddWhitelist {
    return o && (o.$typeUrl === MsgAddWhitelist.typeUrl || typeof o.authority === "string" && typeof o.validatorAddress === "string");
  },
  isSDK(o: any): o is MsgAddWhitelistSDKType {
    return o && (o.$typeUrl === MsgAddWhitelist.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string");
  },
  isAmino(o: any): o is MsgAddWhitelistAmino {
    return o && (o.$typeUrl === MsgAddWhitelist.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string");
  },
  encode(message: MsgAddWhitelist, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.validatorAddress !== "") {
      writer.uint32(18).string(message.validatorAddress);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgAddWhitelist {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgAddWhitelist();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.validatorAddress = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgAddWhitelist>): MsgAddWhitelist {
    const message = createBaseMsgAddWhitelist();
    message.authority = object.authority ?? "";
    message.validatorAddress = object.validatorAddress ?? "";
    return message;
  },
  fromAmino(object: MsgAddWhitelistAmino): MsgAddWhitelist {
    const message = createBaseMsgAddWhitelist();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    if (object.validator_address !== undefined && object.validator_address !== null) {
      message.validatorAddress = object.validator_address;
    }
    return message;
  },
  toAmino(message: MsgAddWhitelist, useInterfaces: boolean = false): MsgAddWhitelistAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    obj.validator_address = message.validatorAddress === "" ? undefined : message.validatorAddress;
    return obj;
  },
  fromAminoMsg(object: MsgAddWhitelistAminoMsg): MsgAddWhitelist {
    return MsgAddWhitelist.fromAmino(object.value);
  },
  toAminoMsg(message: MsgAddWhitelist, useInterfaces: boolean = false): MsgAddWhitelistAminoMsg {
    return {
      type: "x/poa/MsgAddWhitelist",
      value: MsgAddWhitelist.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgAddWhitelistProtoMsg, useInterfaces: boolean = false): MsgAddWhitelist {
    return MsgAddWhitelist.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgAddWhitelist): Uint8Array {
    return MsgAddWhitelist.encode(message).finish();
  },
  toProtoMsg(message: MsgAddWhitelist): MsgAddWhitelistProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgAddWhitelist",
      value: MsgAddWhitelist.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgAddWhitelistResponse(): MsgAddWhitelistResponse {
  return {};
}
/**
 * MsgAddWhitelistResponse is the response type for MsgAddWhitelist.
 * @name MsgAddWhitelistResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgAddWhitelistResponse
 */
export const MsgAddWhitelistResponse = {
  typeUrl: "/mizufinance.poa.v1.MsgAddWhitelistResponse",
  is(o: any): o is MsgAddWhitelistResponse {
    return o && o.$typeUrl === MsgAddWhitelistResponse.typeUrl;
  },
  isSDK(o: any): o is MsgAddWhitelistResponseSDKType {
    return o && o.$typeUrl === MsgAddWhitelistResponse.typeUrl;
  },
  isAmino(o: any): o is MsgAddWhitelistResponseAmino {
    return o && o.$typeUrl === MsgAddWhitelistResponse.typeUrl;
  },
  encode(_: MsgAddWhitelistResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgAddWhitelistResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgAddWhitelistResponse();
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
  fromPartial(_: Partial<MsgAddWhitelistResponse>): MsgAddWhitelistResponse {
    const message = createBaseMsgAddWhitelistResponse();
    return message;
  },
  fromAmino(_: MsgAddWhitelistResponseAmino): MsgAddWhitelistResponse {
    const message = createBaseMsgAddWhitelistResponse();
    return message;
  },
  toAmino(_: MsgAddWhitelistResponse, useInterfaces: boolean = false): MsgAddWhitelistResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgAddWhitelistResponseAminoMsg): MsgAddWhitelistResponse {
    return MsgAddWhitelistResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: MsgAddWhitelistResponseProtoMsg, useInterfaces: boolean = false): MsgAddWhitelistResponse {
    return MsgAddWhitelistResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgAddWhitelistResponse): Uint8Array {
    return MsgAddWhitelistResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgAddWhitelistResponse): MsgAddWhitelistResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgAddWhitelistResponse",
      value: MsgAddWhitelistResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgRemoveWhitelist(): MsgRemoveWhitelist {
  return {
    authority: "",
    validatorAddress: ""
  };
}
/**
 * MsgRemoveWhitelist removes a validator address from the whitelist.
 * @name MsgRemoveWhitelist
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelist
 */
export const MsgRemoveWhitelist = {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelist",
  aminoType: "x/poa/MsgRemoveWhitelist",
  is(o: any): o is MsgRemoveWhitelist {
    return o && (o.$typeUrl === MsgRemoveWhitelist.typeUrl || typeof o.authority === "string" && typeof o.validatorAddress === "string");
  },
  isSDK(o: any): o is MsgRemoveWhitelistSDKType {
    return o && (o.$typeUrl === MsgRemoveWhitelist.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string");
  },
  isAmino(o: any): o is MsgRemoveWhitelistAmino {
    return o && (o.$typeUrl === MsgRemoveWhitelist.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string");
  },
  encode(message: MsgRemoveWhitelist, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.validatorAddress !== "") {
      writer.uint32(18).string(message.validatorAddress);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRemoveWhitelist {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRemoveWhitelist();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.validatorAddress = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgRemoveWhitelist>): MsgRemoveWhitelist {
    const message = createBaseMsgRemoveWhitelist();
    message.authority = object.authority ?? "";
    message.validatorAddress = object.validatorAddress ?? "";
    return message;
  },
  fromAmino(object: MsgRemoveWhitelistAmino): MsgRemoveWhitelist {
    const message = createBaseMsgRemoveWhitelist();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    if (object.validator_address !== undefined && object.validator_address !== null) {
      message.validatorAddress = object.validator_address;
    }
    return message;
  },
  toAmino(message: MsgRemoveWhitelist, useInterfaces: boolean = false): MsgRemoveWhitelistAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    obj.validator_address = message.validatorAddress === "" ? undefined : message.validatorAddress;
    return obj;
  },
  fromAminoMsg(object: MsgRemoveWhitelistAminoMsg): MsgRemoveWhitelist {
    return MsgRemoveWhitelist.fromAmino(object.value);
  },
  toAminoMsg(message: MsgRemoveWhitelist, useInterfaces: boolean = false): MsgRemoveWhitelistAminoMsg {
    return {
      type: "x/poa/MsgRemoveWhitelist",
      value: MsgRemoveWhitelist.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgRemoveWhitelistProtoMsg, useInterfaces: boolean = false): MsgRemoveWhitelist {
    return MsgRemoveWhitelist.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRemoveWhitelist): Uint8Array {
    return MsgRemoveWhitelist.encode(message).finish();
  },
  toProtoMsg(message: MsgRemoveWhitelist): MsgRemoveWhitelistProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelist",
      value: MsgRemoveWhitelist.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgRemoveWhitelistResponse(): MsgRemoveWhitelistResponse {
  return {};
}
/**
 * MsgRemoveWhitelistResponse is the response type for MsgRemoveWhitelist.
 * @name MsgRemoveWhitelistResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveWhitelistResponse
 */
export const MsgRemoveWhitelistResponse = {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelistResponse",
  is(o: any): o is MsgRemoveWhitelistResponse {
    return o && o.$typeUrl === MsgRemoveWhitelistResponse.typeUrl;
  },
  isSDK(o: any): o is MsgRemoveWhitelistResponseSDKType {
    return o && o.$typeUrl === MsgRemoveWhitelistResponse.typeUrl;
  },
  isAmino(o: any): o is MsgRemoveWhitelistResponseAmino {
    return o && o.$typeUrl === MsgRemoveWhitelistResponse.typeUrl;
  },
  encode(_: MsgRemoveWhitelistResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRemoveWhitelistResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRemoveWhitelistResponse();
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
  fromPartial(_: Partial<MsgRemoveWhitelistResponse>): MsgRemoveWhitelistResponse {
    const message = createBaseMsgRemoveWhitelistResponse();
    return message;
  },
  fromAmino(_: MsgRemoveWhitelistResponseAmino): MsgRemoveWhitelistResponse {
    const message = createBaseMsgRemoveWhitelistResponse();
    return message;
  },
  toAmino(_: MsgRemoveWhitelistResponse, useInterfaces: boolean = false): MsgRemoveWhitelistResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgRemoveWhitelistResponseAminoMsg): MsgRemoveWhitelistResponse {
    return MsgRemoveWhitelistResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: MsgRemoveWhitelistResponseProtoMsg, useInterfaces: boolean = false): MsgRemoveWhitelistResponse {
    return MsgRemoveWhitelistResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRemoveWhitelistResponse): Uint8Array {
    return MsgRemoveWhitelistResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgRemoveWhitelistResponse): MsgRemoveWhitelistResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelistResponse",
      value: MsgRemoveWhitelistResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgRemoveValidator(): MsgRemoveValidator {
  return {
    authority: "",
    validatorAddress: ""
  };
}
/**
 * MsgRemoveValidator evicts a validator from the active set.
 * @name MsgRemoveValidator
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidator
 */
export const MsgRemoveValidator = {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveValidator",
  aminoType: "x/poa/MsgRemoveValidator",
  is(o: any): o is MsgRemoveValidator {
    return o && (o.$typeUrl === MsgRemoveValidator.typeUrl || typeof o.authority === "string" && typeof o.validatorAddress === "string");
  },
  isSDK(o: any): o is MsgRemoveValidatorSDKType {
    return o && (o.$typeUrl === MsgRemoveValidator.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string");
  },
  isAmino(o: any): o is MsgRemoveValidatorAmino {
    return o && (o.$typeUrl === MsgRemoveValidator.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string");
  },
  encode(message: MsgRemoveValidator, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.validatorAddress !== "") {
      writer.uint32(18).string(message.validatorAddress);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRemoveValidator {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRemoveValidator();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.validatorAddress = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgRemoveValidator>): MsgRemoveValidator {
    const message = createBaseMsgRemoveValidator();
    message.authority = object.authority ?? "";
    message.validatorAddress = object.validatorAddress ?? "";
    return message;
  },
  fromAmino(object: MsgRemoveValidatorAmino): MsgRemoveValidator {
    const message = createBaseMsgRemoveValidator();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    if (object.validator_address !== undefined && object.validator_address !== null) {
      message.validatorAddress = object.validator_address;
    }
    return message;
  },
  toAmino(message: MsgRemoveValidator, useInterfaces: boolean = false): MsgRemoveValidatorAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    obj.validator_address = message.validatorAddress === "" ? undefined : message.validatorAddress;
    return obj;
  },
  fromAminoMsg(object: MsgRemoveValidatorAminoMsg): MsgRemoveValidator {
    return MsgRemoveValidator.fromAmino(object.value);
  },
  toAminoMsg(message: MsgRemoveValidator, useInterfaces: boolean = false): MsgRemoveValidatorAminoMsg {
    return {
      type: "x/poa/MsgRemoveValidator",
      value: MsgRemoveValidator.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgRemoveValidatorProtoMsg, useInterfaces: boolean = false): MsgRemoveValidator {
    return MsgRemoveValidator.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRemoveValidator): Uint8Array {
    return MsgRemoveValidator.encode(message).finish();
  },
  toProtoMsg(message: MsgRemoveValidator): MsgRemoveValidatorProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgRemoveValidator",
      value: MsgRemoveValidator.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgRemoveValidatorResponse(): MsgRemoveValidatorResponse {
  return {};
}
/**
 * MsgRemoveValidatorResponse is the response type for MsgRemoveValidator.
 * @name MsgRemoveValidatorResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgRemoveValidatorResponse
 */
export const MsgRemoveValidatorResponse = {
  typeUrl: "/mizufinance.poa.v1.MsgRemoveValidatorResponse",
  is(o: any): o is MsgRemoveValidatorResponse {
    return o && o.$typeUrl === MsgRemoveValidatorResponse.typeUrl;
  },
  isSDK(o: any): o is MsgRemoveValidatorResponseSDKType {
    return o && o.$typeUrl === MsgRemoveValidatorResponse.typeUrl;
  },
  isAmino(o: any): o is MsgRemoveValidatorResponseAmino {
    return o && o.$typeUrl === MsgRemoveValidatorResponse.typeUrl;
  },
  encode(_: MsgRemoveValidatorResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRemoveValidatorResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRemoveValidatorResponse();
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
  fromPartial(_: Partial<MsgRemoveValidatorResponse>): MsgRemoveValidatorResponse {
    const message = createBaseMsgRemoveValidatorResponse();
    return message;
  },
  fromAmino(_: MsgRemoveValidatorResponseAmino): MsgRemoveValidatorResponse {
    const message = createBaseMsgRemoveValidatorResponse();
    return message;
  },
  toAmino(_: MsgRemoveValidatorResponse, useInterfaces: boolean = false): MsgRemoveValidatorResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgRemoveValidatorResponseAminoMsg): MsgRemoveValidatorResponse {
    return MsgRemoveValidatorResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: MsgRemoveValidatorResponseProtoMsg, useInterfaces: boolean = false): MsgRemoveValidatorResponse {
    return MsgRemoveValidatorResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRemoveValidatorResponse): Uint8Array {
    return MsgRemoveValidatorResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgRemoveValidatorResponse): MsgRemoveValidatorResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgRemoveValidatorResponse",
      value: MsgRemoveValidatorResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgUpdateValidatorWeight(): MsgUpdateValidatorWeight {
  return {
    authority: "",
    validatorAddress: "",
    weight: BigInt(0)
  };
}
/**
 * MsgUpdateValidatorWeight sets a validator's consensus power to an exact value.
 * @name MsgUpdateValidatorWeight
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeight
 */
export const MsgUpdateValidatorWeight = {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeight",
  aminoType: "x/poa/MsgUpdateValidatorWeight",
  is(o: any): o is MsgUpdateValidatorWeight {
    return o && (o.$typeUrl === MsgUpdateValidatorWeight.typeUrl || typeof o.authority === "string" && typeof o.validatorAddress === "string" && typeof o.weight === "bigint");
  },
  isSDK(o: any): o is MsgUpdateValidatorWeightSDKType {
    return o && (o.$typeUrl === MsgUpdateValidatorWeight.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string" && typeof o.weight === "bigint");
  },
  isAmino(o: any): o is MsgUpdateValidatorWeightAmino {
    return o && (o.$typeUrl === MsgUpdateValidatorWeight.typeUrl || typeof o.authority === "string" && typeof o.validator_address === "string" && typeof o.weight === "bigint");
  },
  encode(message: MsgUpdateValidatorWeight, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.validatorAddress !== "") {
      writer.uint32(18).string(message.validatorAddress);
    }
    if (message.weight !== BigInt(0)) {
      writer.uint32(24).uint64(message.weight);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgUpdateValidatorWeight {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateValidatorWeight();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.validatorAddress = reader.string();
          break;
        case 3:
          message.weight = reader.uint64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgUpdateValidatorWeight>): MsgUpdateValidatorWeight {
    const message = createBaseMsgUpdateValidatorWeight();
    message.authority = object.authority ?? "";
    message.validatorAddress = object.validatorAddress ?? "";
    message.weight = object.weight !== undefined && object.weight !== null ? BigInt(object.weight.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: MsgUpdateValidatorWeightAmino): MsgUpdateValidatorWeight {
    const message = createBaseMsgUpdateValidatorWeight();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    if (object.validator_address !== undefined && object.validator_address !== null) {
      message.validatorAddress = object.validator_address;
    }
    if (object.weight !== undefined && object.weight !== null) {
      message.weight = BigInt(object.weight);
    }
    return message;
  },
  toAmino(message: MsgUpdateValidatorWeight, useInterfaces: boolean = false): MsgUpdateValidatorWeightAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    obj.validator_address = message.validatorAddress === "" ? undefined : message.validatorAddress;
    obj.weight = message.weight !== BigInt(0) ? message.weight?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: MsgUpdateValidatorWeightAminoMsg): MsgUpdateValidatorWeight {
    return MsgUpdateValidatorWeight.fromAmino(object.value);
  },
  toAminoMsg(message: MsgUpdateValidatorWeight, useInterfaces: boolean = false): MsgUpdateValidatorWeightAminoMsg {
    return {
      type: "x/poa/MsgUpdateValidatorWeight",
      value: MsgUpdateValidatorWeight.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgUpdateValidatorWeightProtoMsg, useInterfaces: boolean = false): MsgUpdateValidatorWeight {
    return MsgUpdateValidatorWeight.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgUpdateValidatorWeight): Uint8Array {
    return MsgUpdateValidatorWeight.encode(message).finish();
  },
  toProtoMsg(message: MsgUpdateValidatorWeight): MsgUpdateValidatorWeightProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeight",
      value: MsgUpdateValidatorWeight.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgUpdateValidatorWeightResponse(): MsgUpdateValidatorWeightResponse {
  return {};
}
/**
 * MsgUpdateValidatorWeightResponse is the response type for MsgUpdateValidatorWeight.
 * @name MsgUpdateValidatorWeightResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateValidatorWeightResponse
 */
export const MsgUpdateValidatorWeightResponse = {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeightResponse",
  is(o: any): o is MsgUpdateValidatorWeightResponse {
    return o && o.$typeUrl === MsgUpdateValidatorWeightResponse.typeUrl;
  },
  isSDK(o: any): o is MsgUpdateValidatorWeightResponseSDKType {
    return o && o.$typeUrl === MsgUpdateValidatorWeightResponse.typeUrl;
  },
  isAmino(o: any): o is MsgUpdateValidatorWeightResponseAmino {
    return o && o.$typeUrl === MsgUpdateValidatorWeightResponse.typeUrl;
  },
  encode(_: MsgUpdateValidatorWeightResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgUpdateValidatorWeightResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateValidatorWeightResponse();
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
  fromPartial(_: Partial<MsgUpdateValidatorWeightResponse>): MsgUpdateValidatorWeightResponse {
    const message = createBaseMsgUpdateValidatorWeightResponse();
    return message;
  },
  fromAmino(_: MsgUpdateValidatorWeightResponseAmino): MsgUpdateValidatorWeightResponse {
    const message = createBaseMsgUpdateValidatorWeightResponse();
    return message;
  },
  toAmino(_: MsgUpdateValidatorWeightResponse, useInterfaces: boolean = false): MsgUpdateValidatorWeightResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgUpdateValidatorWeightResponseAminoMsg): MsgUpdateValidatorWeightResponse {
    return MsgUpdateValidatorWeightResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: MsgUpdateValidatorWeightResponseProtoMsg, useInterfaces: boolean = false): MsgUpdateValidatorWeightResponse {
    return MsgUpdateValidatorWeightResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgUpdateValidatorWeightResponse): Uint8Array {
    return MsgUpdateValidatorWeightResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgUpdateValidatorWeightResponse): MsgUpdateValidatorWeightResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeightResponse",
      value: MsgUpdateValidatorWeightResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgUpdateParams(): MsgUpdateParams {
  return {
    authority: "",
    params: Params.fromPartial({})
  };
}
/**
 * MsgUpdateParams is the Msg/UpdateParams request type.
 * @name MsgUpdateParams
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParams
 */
export const MsgUpdateParams = {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateParams",
  aminoType: "x/poa/MsgUpdateParams",
  is(o: any): o is MsgUpdateParams {
    return o && (o.$typeUrl === MsgUpdateParams.typeUrl || typeof o.authority === "string" && Params.is(o.params));
  },
  isSDK(o: any): o is MsgUpdateParamsSDKType {
    return o && (o.$typeUrl === MsgUpdateParams.typeUrl || typeof o.authority === "string" && Params.isSDK(o.params));
  },
  isAmino(o: any): o is MsgUpdateParamsAmino {
    return o && (o.$typeUrl === MsgUpdateParams.typeUrl || typeof o.authority === "string" && Params.isAmino(o.params));
  },
  encode(message: MsgUpdateParams, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgUpdateParams {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateParams();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.params = Params.decode(reader, reader.uint32(), useInterfaces);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgUpdateParams>): MsgUpdateParams {
    const message = createBaseMsgUpdateParams();
    message.authority = object.authority ?? "";
    message.params = object.params !== undefined && object.params !== null ? Params.fromPartial(object.params) : undefined;
    return message;
  },
  fromAmino(object: MsgUpdateParamsAmino): MsgUpdateParams {
    const message = createBaseMsgUpdateParams();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromAmino(object.params);
    }
    return message;
  },
  toAmino(message: MsgUpdateParams, useInterfaces: boolean = false): MsgUpdateParamsAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    obj.params = message.params ? Params.toAmino(message.params, useInterfaces) : Params.toAmino(Params.fromPartial({}));
    return obj;
  },
  fromAminoMsg(object: MsgUpdateParamsAminoMsg): MsgUpdateParams {
    return MsgUpdateParams.fromAmino(object.value);
  },
  toAminoMsg(message: MsgUpdateParams, useInterfaces: boolean = false): MsgUpdateParamsAminoMsg {
    return {
      type: "x/poa/MsgUpdateParams",
      value: MsgUpdateParams.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgUpdateParamsProtoMsg, useInterfaces: boolean = false): MsgUpdateParams {
    return MsgUpdateParams.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgUpdateParams): Uint8Array {
    return MsgUpdateParams.encode(message).finish();
  },
  toProtoMsg(message: MsgUpdateParams): MsgUpdateParamsProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgUpdateParams",
      value: MsgUpdateParams.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(MsgUpdateParams.typeUrl)) {
      return;
    }
    Params.registerTypeUrl();
  }
};
function createBaseMsgUpdateParamsResponse(): MsgUpdateParamsResponse {
  return {};
}
/**
 * MsgUpdateParamsResponse is the response type for MsgUpdateParams.
 * @name MsgUpdateParamsResponse
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.MsgUpdateParamsResponse
 */
export const MsgUpdateParamsResponse = {
  typeUrl: "/mizufinance.poa.v1.MsgUpdateParamsResponse",
  is(o: any): o is MsgUpdateParamsResponse {
    return o && o.$typeUrl === MsgUpdateParamsResponse.typeUrl;
  },
  isSDK(o: any): o is MsgUpdateParamsResponseSDKType {
    return o && o.$typeUrl === MsgUpdateParamsResponse.typeUrl;
  },
  isAmino(o: any): o is MsgUpdateParamsResponseAmino {
    return o && o.$typeUrl === MsgUpdateParamsResponse.typeUrl;
  },
  encode(_: MsgUpdateParamsResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgUpdateParamsResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateParamsResponse();
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
  fromPartial(_: Partial<MsgUpdateParamsResponse>): MsgUpdateParamsResponse {
    const message = createBaseMsgUpdateParamsResponse();
    return message;
  },
  fromAmino(_: MsgUpdateParamsResponseAmino): MsgUpdateParamsResponse {
    const message = createBaseMsgUpdateParamsResponse();
    return message;
  },
  toAmino(_: MsgUpdateParamsResponse, useInterfaces: boolean = false): MsgUpdateParamsResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgUpdateParamsResponseAminoMsg): MsgUpdateParamsResponse {
    return MsgUpdateParamsResponse.fromAmino(object.value);
  },
  fromProtoMsg(message: MsgUpdateParamsResponseProtoMsg, useInterfaces: boolean = false): MsgUpdateParamsResponse {
    return MsgUpdateParamsResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgUpdateParamsResponse): Uint8Array {
    return MsgUpdateParamsResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgUpdateParamsResponse): MsgUpdateParamsResponseProtoMsg {
    return {
      typeUrl: "/mizufinance.poa.v1.MsgUpdateParamsResponse",
      value: MsgUpdateParamsResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};