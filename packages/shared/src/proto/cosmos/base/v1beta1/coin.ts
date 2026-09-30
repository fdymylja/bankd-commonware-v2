import { BinaryReader, BinaryWriter } from "../../../binary";
import { Decimal } from "@interchainjs/math";
/**
 * Coin defines a token with a denomination and an amount.
 * 
 * NOTE: The amount field is an Int which implements the custom method
 * signatures required by gogoproto.
 * @name Coin
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.Coin
 */
export interface Coin {
  denom: string;
  amount: string;
}
export interface CoinProtoMsg {
  typeUrl: "/cosmos.base.v1beta1.Coin";
  value: Uint8Array;
}
/**
 * Coin defines a token with a denomination and an amount.
 * 
 * NOTE: The amount field is an Int which implements the custom method
 * signatures required by gogoproto.
 * @name CoinAmino
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.Coin
 */
export interface CoinAmino {
  denom?: string;
  amount: string;
}
export interface CoinAminoMsg {
  type: "cosmos-sdk/Coin";
  value: CoinAmino;
}
/**
 * Coin defines a token with a denomination and an amount.
 * 
 * NOTE: The amount field is an Int which implements the custom method
 * signatures required by gogoproto.
 * @name CoinSDKType
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.Coin
 */
export interface CoinSDKType {
  denom: string;
  amount: string;
}
/**
 * DecCoin defines a token with a denomination and a decimal amount.
 * 
 * NOTE: The amount field is an Dec which implements the custom method
 * signatures required by gogoproto.
 * @name DecCoin
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.DecCoin
 */
export interface DecCoin {
  denom: string;
  amount: string;
}
export interface DecCoinProtoMsg {
  typeUrl: "/cosmos.base.v1beta1.DecCoin";
  value: Uint8Array;
}
/**
 * DecCoin defines a token with a denomination and a decimal amount.
 * 
 * NOTE: The amount field is an Dec which implements the custom method
 * signatures required by gogoproto.
 * @name DecCoinAmino
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.DecCoin
 */
export interface DecCoinAmino {
  denom?: string;
  amount?: string;
}
export interface DecCoinAminoMsg {
  type: "cosmos-sdk/DecCoin";
  value: DecCoinAmino;
}
/**
 * DecCoin defines a token with a denomination and a decimal amount.
 * 
 * NOTE: The amount field is an Dec which implements the custom method
 * signatures required by gogoproto.
 * @name DecCoinSDKType
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.DecCoin
 */
export interface DecCoinSDKType {
  denom: string;
  amount: string;
}
function createBaseCoin(): Coin {
  return {
    denom: "",
    amount: ""
  };
}
/**
 * Coin defines a token with a denomination and an amount.
 * 
 * NOTE: The amount field is an Int which implements the custom method
 * signatures required by gogoproto.
 * @name Coin
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.Coin
 */
export const Coin = {
  typeUrl: "/cosmos.base.v1beta1.Coin",
  aminoType: "cosmos-sdk/Coin",
  is(o: any): o is Coin {
    return o && (o.$typeUrl === Coin.typeUrl || typeof o.denom === "string" && typeof o.amount === "string");
  },
  isSDK(o: any): o is CoinSDKType {
    return o && (o.$typeUrl === Coin.typeUrl || typeof o.denom === "string" && typeof o.amount === "string");
  },
  isAmino(o: any): o is CoinAmino {
    return o && (o.$typeUrl === Coin.typeUrl || typeof o.denom === "string" && typeof o.amount === "string");
  },
  encode(message: Coin, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.denom !== "") {
      writer.uint32(10).string(message.denom);
    }
    if (message.amount !== "") {
      writer.uint32(18).string(message.amount);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): Coin {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCoin();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denom = reader.string();
          break;
        case 2:
          message.amount = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<Coin>): Coin {
    const message = createBaseCoin();
    message.denom = object.denom ?? "";
    message.amount = object.amount ?? "";
    return message;
  },
  fromAmino(object: CoinAmino): Coin {
    const message = createBaseCoin();
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    if (object.amount !== undefined && object.amount !== null) {
      message.amount = object.amount;
    }
    return message;
  },
  toAmino(message: Coin, useInterfaces: boolean = false): CoinAmino {
    const obj: any = {};
    obj.denom = message.denom === "" ? undefined : message.denom;
    obj.amount = message.amount ?? "";
    return obj;
  },
  fromAminoMsg(object: CoinAminoMsg): Coin {
    return Coin.fromAmino(object.value);
  },
  toAminoMsg(message: Coin, useInterfaces: boolean = false): CoinAminoMsg {
    return {
      type: "cosmos-sdk/Coin",
      value: Coin.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: CoinProtoMsg, useInterfaces: boolean = false): Coin {
    return Coin.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: Coin): Uint8Array {
    return Coin.encode(message).finish();
  },
  toProtoMsg(message: Coin): CoinProtoMsg {
    return {
      typeUrl: "/cosmos.base.v1beta1.Coin",
      value: Coin.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseDecCoin(): DecCoin {
  return {
    denom: "",
    amount: ""
  };
}
/**
 * DecCoin defines a token with a denomination and a decimal amount.
 * 
 * NOTE: The amount field is an Dec which implements the custom method
 * signatures required by gogoproto.
 * @name DecCoin
 * @package cosmos.base.v1beta1
 * @see proto type: cosmos.base.v1beta1.DecCoin
 */
export const DecCoin = {
  typeUrl: "/cosmos.base.v1beta1.DecCoin",
  aminoType: "cosmos-sdk/DecCoin",
  is(o: any): o is DecCoin {
    return o && (o.$typeUrl === DecCoin.typeUrl || typeof o.denom === "string" && typeof o.amount === "string");
  },
  isSDK(o: any): o is DecCoinSDKType {
    return o && (o.$typeUrl === DecCoin.typeUrl || typeof o.denom === "string" && typeof o.amount === "string");
  },
  isAmino(o: any): o is DecCoinAmino {
    return o && (o.$typeUrl === DecCoin.typeUrl || typeof o.denom === "string" && typeof o.amount === "string");
  },
  encode(message: DecCoin, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.denom !== "") {
      writer.uint32(10).string(message.denom);
    }
    if (message.amount !== "") {
      writer.uint32(18).string(Decimal.fromUserInput(message.amount, 18).atomics);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): DecCoin {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecCoin();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.denom = reader.string();
          break;
        case 2:
          message.amount = Decimal.fromAtomics(reader.string(), 18).toString();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<DecCoin>): DecCoin {
    const message = createBaseDecCoin();
    message.denom = object.denom ?? "";
    message.amount = object.amount ?? "";
    return message;
  },
  fromAmino(object: DecCoinAmino): DecCoin {
    const message = createBaseDecCoin();
    if (object.denom !== undefined && object.denom !== null) {
      message.denom = object.denom;
    }
    if (object.amount !== undefined && object.amount !== null) {
      message.amount = object.amount;
    }
    return message;
  },
  toAmino(message: DecCoin, useInterfaces: boolean = false): DecCoinAmino {
    const obj: any = {};
    obj.denom = message.denom === "" ? undefined : message.denom;
    obj.amount = message.amount === "" ? undefined : Decimal.fromUserInput(message.amount, 18).atomics;
    return obj;
  },
  fromAminoMsg(object: DecCoinAminoMsg): DecCoin {
    return DecCoin.fromAmino(object.value);
  },
  toAminoMsg(message: DecCoin, useInterfaces: boolean = false): DecCoinAminoMsg {
    return {
      type: "cosmos-sdk/DecCoin",
      value: DecCoin.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: DecCoinProtoMsg, useInterfaces: boolean = false): DecCoin {
    return DecCoin.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: DecCoin): Uint8Array {
    return DecCoin.encode(message).finish();
  },
  toProtoMsg(message: DecCoin): DecCoinProtoMsg {
    return {
      typeUrl: "/cosmos.base.v1beta1.DecCoin",
      value: DecCoin.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};