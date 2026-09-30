import { BinaryReader, BinaryWriter } from "../../../binary";
import { Decimal } from "@interchainjs/math";
/**
 * Params defines the set of module parameters.
 * 
 * There are two mutually exclusive execution modes:
 * 1. Free mode: max_free_gas_limit > 0 - execution is free up to this gas limit
 * 2. Charged mode: max_free_gas_limit = 0 - charge gas_fee_per_gas per gas unit
 * @name Params
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Params
 */
export interface Params {
  /**
   * max_free_gas_limit is the maximum gas that can be used for free during
   * private execution. If set to a non-zero value, execution is free up to
   * this limit and gas_fee_per_gas is ignored. Default is 5,000,000.
   */
  maxFreeGasLimit: bigint;
  /**
   * gas_fee_per_gas is the fee charged per gas unit when max_free_gas_limit is 0.
   * This is charged to the user's intermediate account.
   * Example: "0.0000001" means 0.0000001 tokens per gas unit.
   */
  gasFeePerGas: string;
}
export interface ParamsProtoMsg {
  typeUrl: "/mizufinance.eem.v1.Params";
  value: Uint8Array;
}
/**
 * Params defines the set of module parameters.
 * 
 * There are two mutually exclusive execution modes:
 * 1. Free mode: max_free_gas_limit > 0 - execution is free up to this gas limit
 * 2. Charged mode: max_free_gas_limit = 0 - charge gas_fee_per_gas per gas unit
 * @name ParamsAmino
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Params
 */
export interface ParamsAmino {
  /**
   * max_free_gas_limit is the maximum gas that can be used for free during
   * private execution. If set to a non-zero value, execution is free up to
   * this limit and gas_fee_per_gas is ignored. Default is 5,000,000.
   */
  max_free_gas_limit?: string;
  /**
   * gas_fee_per_gas is the fee charged per gas unit when max_free_gas_limit is 0.
   * This is charged to the user's intermediate account.
   * Example: "0.0000001" means 0.0000001 tokens per gas unit.
   */
  gas_fee_per_gas?: string;
}
export interface ParamsAminoMsg {
  type: "eem/params";
  value: ParamsAmino;
}
/**
 * Params defines the set of module parameters.
 * 
 * There are two mutually exclusive execution modes:
 * 1. Free mode: max_free_gas_limit > 0 - execution is free up to this gas limit
 * 2. Charged mode: max_free_gas_limit = 0 - charge gas_fee_per_gas per gas unit
 * @name ParamsSDKType
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Params
 */
export interface ParamsSDKType {
  max_free_gas_limit: bigint;
  gas_fee_per_gas: string;
}
function createBaseParams(): Params {
  return {
    maxFreeGasLimit: BigInt(0),
    gasFeePerGas: ""
  };
}
/**
 * Params defines the set of module parameters.
 * 
 * There are two mutually exclusive execution modes:
 * 1. Free mode: max_free_gas_limit > 0 - execution is free up to this gas limit
 * 2. Charged mode: max_free_gas_limit = 0 - charge gas_fee_per_gas per gas unit
 * @name Params
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.Params
 */
export const Params = {
  typeUrl: "/mizufinance.eem.v1.Params",
  aminoType: "eem/params",
  is(o: any): o is Params {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.maxFreeGasLimit === "bigint" && typeof o.gasFeePerGas === "string");
  },
  isSDK(o: any): o is ParamsSDKType {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.max_free_gas_limit === "bigint" && typeof o.gas_fee_per_gas === "string");
  },
  isAmino(o: any): o is ParamsAmino {
    return o && (o.$typeUrl === Params.typeUrl || typeof o.max_free_gas_limit === "bigint" && typeof o.gas_fee_per_gas === "string");
  },
  encode(message: Params, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.maxFreeGasLimit !== BigInt(0)) {
      writer.uint32(8).uint64(message.maxFreeGasLimit);
    }
    if (message.gasFeePerGas !== "") {
      writer.uint32(18).string(Decimal.fromUserInput(message.gasFeePerGas, 18).atomics);
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
          message.maxFreeGasLimit = reader.uint64();
          break;
        case 2:
          message.gasFeePerGas = Decimal.fromAtomics(reader.string(), 18).toString();
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
    message.maxFreeGasLimit = object.maxFreeGasLimit !== undefined && object.maxFreeGasLimit !== null ? BigInt(object.maxFreeGasLimit.toString()) : BigInt(0);
    message.gasFeePerGas = object.gasFeePerGas ?? "";
    return message;
  },
  fromAmino(object: ParamsAmino): Params {
    const message = createBaseParams();
    if (object.max_free_gas_limit !== undefined && object.max_free_gas_limit !== null) {
      message.maxFreeGasLimit = BigInt(object.max_free_gas_limit);
    }
    if (object.gas_fee_per_gas !== undefined && object.gas_fee_per_gas !== null) {
      message.gasFeePerGas = object.gas_fee_per_gas;
    }
    return message;
  },
  toAmino(message: Params, useInterfaces: boolean = false): ParamsAmino {
    const obj: any = {};
    obj.max_free_gas_limit = message.maxFreeGasLimit !== BigInt(0) ? message.maxFreeGasLimit?.toString() : undefined;
    obj.gas_fee_per_gas = message.gasFeePerGas === "" ? undefined : Decimal.fromUserInput(message.gasFeePerGas, 18).atomics;
    return obj;
  },
  fromAminoMsg(object: ParamsAminoMsg): Params {
    return Params.fromAmino(object.value);
  },
  toAminoMsg(message: Params, useInterfaces: boolean = false): ParamsAminoMsg {
    return {
      type: "eem/params",
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
      typeUrl: "/mizufinance.eem.v1.Params",
      value: Params.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};