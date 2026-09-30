import { BinaryReader, BinaryWriter } from "../../../binary";
/**
 * Params defines the parameters for the poa module.
 * @name Params
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.Params
 */
export interface Params {
  /**
   * admin is the bech32 address authorized to manage the validator set.
   */
  admin: string;
}
export interface ParamsProtoMsg {
  typeUrl: "/mizufinance.poa.v1.Params";
  value: Uint8Array;
}
/**
 * Params defines the parameters for the poa module.
 * @name ParamsAmino
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.Params
 */
export interface ParamsAmino {
  /**
   * admin is the bech32 address authorized to manage the validator set.
   */
  admin?: string;
}
export interface ParamsAminoMsg {
  type: "bankd/x/poa/Params";
  value: ParamsAmino;
}
/**
 * Params defines the parameters for the poa module.
 * @name ParamsSDKType
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.Params
 */
export interface ParamsSDKType {
  admin: string;
}
function createBaseParams(): Params {
  return {
    admin: ""
  };
}
/**
 * Params defines the parameters for the poa module.
 * @name Params
 * @package mizufinance.poa.v1
 * @see proto type: mizufinance.poa.v1.Params
 */
export const Params = {
  typeUrl: "/mizufinance.poa.v1.Params",
  aminoType: "bankd/x/poa/Params",
  is(o: any): o is Params {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.admin === "string");
  },
  isSDK(o: any): o is ParamsSDKType {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.admin === "string");
  },
  isAmino(o: any): o is ParamsAmino {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.admin === "string");
  },
  encode(message: Params, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.admin !== "") {
      writer.uint32(10).string(message.admin);
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
          message.admin = reader.string();
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
    message.admin = object.admin ?? "";
    return message;
  },
  fromAmino(object: ParamsAmino): Params {
    const message = createBaseParams();
    if (object.admin !== undefined && object.admin !== null) {
      message.admin = object.admin;
    }
    return message;
  },
  toAmino(message: Params, useInterfaces: boolean = false): ParamsAmino {
    const obj: any = {};
    obj.admin = message.admin === "" ? undefined : message.admin;
    return obj;
  },
  fromAminoMsg(object: ParamsAminoMsg): Params {
    return Params.fromAmino(object.value);
  },
  toAminoMsg(message: Params, useInterfaces: boolean = false): ParamsAminoMsg {
    return {
      type: "bankd/x/poa/Params",
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
      typeUrl: "/mizufinance.poa.v1.Params",
      value: Params.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};