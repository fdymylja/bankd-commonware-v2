//@ts-nocheck
import { BinaryReader, BinaryWriter } from "../../../binary";
/**
 * Placeholder - no tx messages for eem module
 * @name Placeholder
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Placeholder
 */
export interface Placeholder {}
export interface PlaceholderProtoMsg {
  typeUrl: "/mizufinance.eem.v1.Placeholder";
  value: Uint8Array;
}
/**
 * Placeholder - no tx messages for eem module
 * @name PlaceholderAmino
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Placeholder
 */
export interface PlaceholderAmino {}
export interface PlaceholderAminoMsg {
  type: "/mizufinance.eem.v1.Placeholder";
  value: PlaceholderAmino;
}
/**
 * Placeholder - no tx messages for eem module
 * @name PlaceholderSDKType
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Placeholder
 */
export interface PlaceholderSDKType {}
function createBasePlaceholder(): Placeholder {
  return {};
}
/**
 * Placeholder - no tx messages for eem module
 * @name Placeholder
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Placeholder
 */
export const Placeholder = {
  typeUrl: "/mizufinance.eem.v1.Placeholder",
  is(o: any): o is Placeholder {
    return o && o.$typeUrl === Placeholder.typeUrl;
  },
  isSDK(o: any): o is PlaceholderSDKType {
    return o && o.$typeUrl === Placeholder.typeUrl;
  },
  isAmino(o: any): o is PlaceholderAmino {
    return o && o.$typeUrl === Placeholder.typeUrl;
  },
  encode(_: Placeholder, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): Placeholder {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePlaceholder();
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
  fromPartial(_: Partial<Placeholder>): Placeholder {
    const message = createBasePlaceholder();
    return message;
  },
  fromAmino(_: PlaceholderAmino): Placeholder {
    const message = createBasePlaceholder();
    return message;
  },
  toAmino(_: Placeholder, useInterfaces: boolean = false): PlaceholderAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: PlaceholderAminoMsg): Placeholder {
    return Placeholder.fromAmino(object.value);
  },
  fromProtoMsg(message: PlaceholderProtoMsg, useInterfaces: boolean = false): Placeholder {
    return Placeholder.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: Placeholder): Uint8Array {
    return Placeholder.encode(message).finish();
  },
  toProtoMsg(message: Placeholder): PlaceholderProtoMsg {
    return {
      typeUrl: "/mizufinance.eem.v1.Placeholder",
      value: Placeholder.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};