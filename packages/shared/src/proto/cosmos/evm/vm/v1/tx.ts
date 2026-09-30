//@ts-nocheck
import { Params, ParamsAmino, ParamsSDKType, Preinstall, PreinstallAmino, PreinstallSDKType, Log, LogAmino, LogSDKType } from "./evm";
import { BinaryReader, BinaryWriter } from "../../../../binary";
import { bytesFromBase64, base64FromBytes } from "../../../../helpers";
import { GlobalDecoderRegistry } from "../../../../registry";
/**
 * MsgEthereumTx encapsulates an Ethereum transaction as an SDK message.
 * @name MsgEthereumTx
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTx
 */
export interface MsgEthereumTx {
  /**
   * from is the bytes of ethereum signer address. This address value is checked
   * against the address derived from the signature (V, R, S) using the
   * secp256k1 elliptic curve
   */
  from: Uint8Array;
  /**
   * raw is the raw ethereum transaction
   */
  raw: Uint8Array;
}
export interface MsgEthereumTxProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTx";
  value: Uint8Array;
}
/**
 * MsgEthereumTx encapsulates an Ethereum transaction as an SDK message.
 * @name MsgEthereumTxAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTx
 */
export interface MsgEthereumTxAmino {
  /**
   * from is the bytes of ethereum signer address. This address value is checked
   * against the address derived from the signature (V, R, S) using the
   * secp256k1 elliptic curve
   */
  from?: string;
  /**
   * raw is the raw ethereum transaction
   */
  raw?: string;
}
export interface MsgEthereumTxAminoMsg {
  type: "cosmos/evm/MsgEthereumTx";
  value: MsgEthereumTxAmino;
}
/**
 * MsgEthereumTx encapsulates an Ethereum transaction as an SDK message.
 * @name MsgEthereumTxSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTx
 */
export interface MsgEthereumTxSDKType {
  from: Uint8Array;
  raw: Uint8Array;
}
/**
 * ExtensionOptionsEthereumTx is an extension option for ethereum transactions
 * @name ExtensionOptionsEthereumTx
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.ExtensionOptionsEthereumTx
 */
export interface ExtensionOptionsEthereumTx {}
export interface ExtensionOptionsEthereumTxProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.ExtensionOptionsEthereumTx";
  value: Uint8Array;
}
/**
 * ExtensionOptionsEthereumTx is an extension option for ethereum transactions
 * @name ExtensionOptionsEthereumTxAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.ExtensionOptionsEthereumTx
 */
export interface ExtensionOptionsEthereumTxAmino {}
export interface ExtensionOptionsEthereumTxAminoMsg {
  type: "cosmos-sdk/ExtensionOptionsEthereumTx";
  value: ExtensionOptionsEthereumTxAmino;
}
/**
 * ExtensionOptionsEthereumTx is an extension option for ethereum transactions
 * @name ExtensionOptionsEthereumTxSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.ExtensionOptionsEthereumTx
 */
export interface ExtensionOptionsEthereumTxSDKType {}
/**
 * MsgEthereumTxResponse defines the Msg/EthereumTx response type.
 * @name MsgEthereumTxResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTxResponse
 */
export interface MsgEthereumTxResponse {
  /**
   * hash of the ethereum transaction in hex format. This hash differs from the
   * CometBFT sha256 hash of the transaction bytes. See
   * https://github.com/tendermint/tendermint/issues/6539 for reference
   */
  hash: string;
  /**
   * logs contains the transaction hash and the proto-compatible ethereum
   * logs.
   */
  logs: Log[];
  /**
   * ret is the returned data from evm function (result or data supplied with
   * revert opcode)
   */
  ret: Uint8Array;
  /**
   * vm_error is the error returned by vm execution
   */
  vmError: string;
  /**
   * gas_used specifies how much gas was consumed by the transaction
   */
  gasUsed: bigint;
  /**
   * max_used_gas specifies the gas consumed by the transaction, not including refunds
   */
  maxUsedGas: bigint;
  /**
   * include the block hash for json-rpc to use
   */
  blockHash: Uint8Array;
  /**
   * include the block timestamp for json-rpc to use
   */
  blockTimestamp: bigint;
}
export interface MsgEthereumTxResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTxResponse";
  value: Uint8Array;
}
/**
 * MsgEthereumTxResponse defines the Msg/EthereumTx response type.
 * @name MsgEthereumTxResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTxResponse
 */
export interface MsgEthereumTxResponseAmino {
  /**
   * hash of the ethereum transaction in hex format. This hash differs from the
   * CometBFT sha256 hash of the transaction bytes. See
   * https://github.com/tendermint/tendermint/issues/6539 for reference
   */
  hash?: string;
  /**
   * logs contains the transaction hash and the proto-compatible ethereum
   * logs.
   */
  logs?: LogAmino[];
  /**
   * ret is the returned data from evm function (result or data supplied with
   * revert opcode)
   */
  ret?: string;
  /**
   * vm_error is the error returned by vm execution
   */
  vm_error?: string;
  /**
   * gas_used specifies how much gas was consumed by the transaction
   */
  gas_used?: string;
  /**
   * max_used_gas specifies the gas consumed by the transaction, not including refunds
   */
  max_used_gas?: string;
  /**
   * include the block hash for json-rpc to use
   */
  block_hash?: string;
  /**
   * include the block timestamp for json-rpc to use
   */
  block_timestamp?: string;
}
export interface MsgEthereumTxResponseAminoMsg {
  type: "cosmos-sdk/MsgEthereumTxResponse";
  value: MsgEthereumTxResponseAmino;
}
/**
 * MsgEthereumTxResponse defines the Msg/EthereumTx response type.
 * @name MsgEthereumTxResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTxResponse
 */
export interface MsgEthereumTxResponseSDKType {
  hash: string;
  logs: LogSDKType[];
  ret: Uint8Array;
  vm_error: string;
  gas_used: bigint;
  max_used_gas: bigint;
  block_hash: Uint8Array;
  block_timestamp: bigint;
}
/**
 * MsgUpdateParams defines a Msg for updating the x/vm module parameters.
 * @name MsgUpdateParams
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParams
 */
export interface MsgUpdateParams {
  /**
   * authority is the address of the governance account.
   */
  authority: string;
  /**
   * params defines the x/vm parameters to update.
   * NOTE: All parameters must be supplied.
   */
  params: Params | undefined;
}
export interface MsgUpdateParamsProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParams";
  value: Uint8Array;
}
/**
 * MsgUpdateParams defines a Msg for updating the x/vm module parameters.
 * @name MsgUpdateParamsAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParams
 */
export interface MsgUpdateParamsAmino {
  /**
   * authority is the address of the governance account.
   */
  authority?: string;
  /**
   * params defines the x/vm parameters to update.
   * NOTE: All parameters must be supplied.
   */
  params: ParamsAmino | undefined;
}
export interface MsgUpdateParamsAminoMsg {
  type: "cosmos/evm/x/vm/MsgUpdateParams";
  value: MsgUpdateParamsAmino;
}
/**
 * MsgUpdateParams defines a Msg for updating the x/vm module parameters.
 * @name MsgUpdateParamsSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParams
 */
export interface MsgUpdateParamsSDKType {
  authority: string;
  params: ParamsSDKType | undefined;
}
/**
 * MsgUpdateParamsResponse defines the response structure for executing a
 * MsgUpdateParams message.
 * @name MsgUpdateParamsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponse {}
export interface MsgUpdateParamsResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParamsResponse";
  value: Uint8Array;
}
/**
 * MsgUpdateParamsResponse defines the response structure for executing a
 * MsgUpdateParams message.
 * @name MsgUpdateParamsResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponseAmino {}
export interface MsgUpdateParamsResponseAminoMsg {
  type: "cosmos-sdk/MsgUpdateParamsResponse";
  value: MsgUpdateParamsResponseAmino;
}
/**
 * MsgUpdateParamsResponse defines the response structure for executing a
 * MsgUpdateParams message.
 * @name MsgUpdateParamsResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponseSDKType {}
/**
 * MsgRegisterPreinstalls defines a Msg for creating preinstalls in evm state.
 * @name MsgRegisterPreinstalls
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstalls
 */
export interface MsgRegisterPreinstalls {
  /**
   * authority is the address of the governance account.
   */
  authority: string;
  /**
   * preinstalls defines the preinstalls to create.
   */
  preinstalls: Preinstall[];
}
export interface MsgRegisterPreinstallsProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstalls";
  value: Uint8Array;
}
/**
 * MsgRegisterPreinstalls defines a Msg for creating preinstalls in evm state.
 * @name MsgRegisterPreinstallsAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstalls
 */
export interface MsgRegisterPreinstallsAmino {
  /**
   * authority is the address of the governance account.
   */
  authority?: string;
  /**
   * preinstalls defines the preinstalls to create.
   */
  preinstalls: PreinstallAmino[];
}
export interface MsgRegisterPreinstallsAminoMsg {
  type: "cosmos/evm/x/vm/MsgRegisterPreinstalls";
  value: MsgRegisterPreinstallsAmino;
}
/**
 * MsgRegisterPreinstalls defines a Msg for creating preinstalls in evm state.
 * @name MsgRegisterPreinstallsSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstalls
 */
export interface MsgRegisterPreinstallsSDKType {
  authority: string;
  preinstalls: PreinstallSDKType[];
}
/**
 * MsgRegisterPreinstallsResponse defines the response structure for executing a
 * MsgRegisterPreinstalls message.
 * @name MsgRegisterPreinstallsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstallsResponse
 */
export interface MsgRegisterPreinstallsResponse {}
export interface MsgRegisterPreinstallsResponseProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstallsResponse";
  value: Uint8Array;
}
/**
 * MsgRegisterPreinstallsResponse defines the response structure for executing a
 * MsgRegisterPreinstalls message.
 * @name MsgRegisterPreinstallsResponseAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstallsResponse
 */
export interface MsgRegisterPreinstallsResponseAmino {}
export interface MsgRegisterPreinstallsResponseAminoMsg {
  type: "cosmos-sdk/MsgRegisterPreinstallsResponse";
  value: MsgRegisterPreinstallsResponseAmino;
}
/**
 * MsgRegisterPreinstallsResponse defines the response structure for executing a
 * MsgRegisterPreinstalls message.
 * @name MsgRegisterPreinstallsResponseSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstallsResponse
 */
export interface MsgRegisterPreinstallsResponseSDKType {}
function createBaseMsgEthereumTx(): MsgEthereumTx {
  return {
    from: new Uint8Array(),
    raw: new Uint8Array()
  };
}
/**
 * MsgEthereumTx encapsulates an Ethereum transaction as an SDK message.
 * @name MsgEthereumTx
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTx
 */
export const MsgEthereumTx = {
  typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTx",
  aminoType: "cosmos/evm/MsgEthereumTx",
  is(o: any): o is MsgEthereumTx {
    return o && (o.$typeUrl === MsgEthereumTx.typeUrl || (o.from instanceof Uint8Array || typeof o.from === "string") && (o.raw instanceof Uint8Array || typeof o.raw === "string"));
  },
  isSDK(o: any): o is MsgEthereumTxSDKType {
    return o && (o.$typeUrl === MsgEthereumTx.typeUrl || (o.from instanceof Uint8Array || typeof o.from === "string") && (o.raw instanceof Uint8Array || typeof o.raw === "string"));
  },
  isAmino(o: any): o is MsgEthereumTxAmino {
    return o && (o.$typeUrl === MsgEthereumTx.typeUrl || (o.from instanceof Uint8Array || typeof o.from === "string") && (o.raw instanceof Uint8Array || typeof o.raw === "string"));
  },
  encode(message: MsgEthereumTx, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.from.length !== 0) {
      writer.uint32(42).bytes(message.from);
    }
    if (message.raw.length !== 0) {
      writer.uint32(50).bytes(message.raw);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgEthereumTx {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgEthereumTx();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 5:
          message.from = reader.bytes();
          break;
        case 6:
          message.raw = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgEthereumTx>): MsgEthereumTx {
    const message = createBaseMsgEthereumTx();
    message.from = object.from ?? new Uint8Array();
    message.raw = object.raw ?? new Uint8Array();
    return message;
  },
  fromAmino(object: MsgEthereumTxAmino): MsgEthereumTx {
    const message = createBaseMsgEthereumTx();
    if (object.from !== undefined && object.from !== null) {
      message.from = bytesFromBase64(object.from);
    }
    if (object.raw !== undefined && object.raw !== null) {
      message.raw = bytesFromBase64(object.raw);
    }
    return message;
  },
  toAmino(message: MsgEthereumTx, useInterfaces: boolean = false): MsgEthereumTxAmino {
    const obj: any = {};
    obj.from = message.from ? base64FromBytes(message.from) : undefined;
    obj.raw = message.raw ? base64FromBytes(message.raw) : undefined;
    return obj;
  },
  fromAminoMsg(object: MsgEthereumTxAminoMsg): MsgEthereumTx {
    return MsgEthereumTx.fromAmino(object.value);
  },
  toAminoMsg(message: MsgEthereumTx, useInterfaces: boolean = false): MsgEthereumTxAminoMsg {
    return {
      type: "cosmos/evm/MsgEthereumTx",
      value: MsgEthereumTx.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgEthereumTxProtoMsg, useInterfaces: boolean = false): MsgEthereumTx {
    return MsgEthereumTx.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgEthereumTx): Uint8Array {
    return MsgEthereumTx.encode(message).finish();
  },
  toProtoMsg(message: MsgEthereumTx): MsgEthereumTxProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTx",
      value: MsgEthereumTx.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseExtensionOptionsEthereumTx(): ExtensionOptionsEthereumTx {
  return {};
}
/**
 * ExtensionOptionsEthereumTx is an extension option for ethereum transactions
 * @name ExtensionOptionsEthereumTx
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.ExtensionOptionsEthereumTx
 */
export const ExtensionOptionsEthereumTx = {
  typeUrl: "/cosmos.evm.vm.v1.ExtensionOptionsEthereumTx",
  aminoType: "cosmos-sdk/ExtensionOptionsEthereumTx",
  is(o: any): o is ExtensionOptionsEthereumTx {
    return o && o.$typeUrl === ExtensionOptionsEthereumTx.typeUrl;
  },
  isSDK(o: any): o is ExtensionOptionsEthereumTxSDKType {
    return o && o.$typeUrl === ExtensionOptionsEthereumTx.typeUrl;
  },
  isAmino(o: any): o is ExtensionOptionsEthereumTxAmino {
    return o && o.$typeUrl === ExtensionOptionsEthereumTx.typeUrl;
  },
  encode(_: ExtensionOptionsEthereumTx, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): ExtensionOptionsEthereumTx {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseExtensionOptionsEthereumTx();
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
  fromPartial(_: Partial<ExtensionOptionsEthereumTx>): ExtensionOptionsEthereumTx {
    const message = createBaseExtensionOptionsEthereumTx();
    return message;
  },
  fromAmino(_: ExtensionOptionsEthereumTxAmino): ExtensionOptionsEthereumTx {
    const message = createBaseExtensionOptionsEthereumTx();
    return message;
  },
  toAmino(_: ExtensionOptionsEthereumTx, useInterfaces: boolean = false): ExtensionOptionsEthereumTxAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: ExtensionOptionsEthereumTxAminoMsg): ExtensionOptionsEthereumTx {
    return ExtensionOptionsEthereumTx.fromAmino(object.value);
  },
  toAminoMsg(message: ExtensionOptionsEthereumTx, useInterfaces: boolean = false): ExtensionOptionsEthereumTxAminoMsg {
    return {
      type: "cosmos-sdk/ExtensionOptionsEthereumTx",
      value: ExtensionOptionsEthereumTx.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: ExtensionOptionsEthereumTxProtoMsg, useInterfaces: boolean = false): ExtensionOptionsEthereumTx {
    return ExtensionOptionsEthereumTx.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: ExtensionOptionsEthereumTx): Uint8Array {
    return ExtensionOptionsEthereumTx.encode(message).finish();
  },
  toProtoMsg(message: ExtensionOptionsEthereumTx): ExtensionOptionsEthereumTxProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.ExtensionOptionsEthereumTx",
      value: ExtensionOptionsEthereumTx.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgEthereumTxResponse(): MsgEthereumTxResponse {
  return {
    hash: "",
    logs: [],
    ret: new Uint8Array(),
    vmError: "",
    gasUsed: BigInt(0),
    maxUsedGas: BigInt(0),
    blockHash: new Uint8Array(),
    blockTimestamp: BigInt(0)
  };
}
/**
 * MsgEthereumTxResponse defines the Msg/EthereumTx response type.
 * @name MsgEthereumTxResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgEthereumTxResponse
 */
export const MsgEthereumTxResponse = {
  typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTxResponse",
  aminoType: "cosmos-sdk/MsgEthereumTxResponse",
  is(o: any): o is MsgEthereumTxResponse {
    return o && (o.$typeUrl === MsgEthereumTxResponse.typeUrl || typeof o.hash === "string" && Array.isArray(o.logs) && (!o.logs.length || Log.is(o.logs[0])) && (o.ret instanceof Uint8Array || typeof o.ret === "string") && typeof o.vmError === "string" && typeof o.gasUsed === "bigint" && typeof o.maxUsedGas === "bigint" && (o.blockHash instanceof Uint8Array || typeof o.blockHash === "string") && typeof o.blockTimestamp === "bigint");
  },
  isSDK(o: any): o is MsgEthereumTxResponseSDKType {
    return o && (o.$typeUrl === MsgEthereumTxResponse.typeUrl || typeof o.hash === "string" && Array.isArray(o.logs) && (!o.logs.length || Log.isSDK(o.logs[0])) && (o.ret instanceof Uint8Array || typeof o.ret === "string") && typeof o.vm_error === "string" && typeof o.gas_used === "bigint" && typeof o.max_used_gas === "bigint" && (o.block_hash instanceof Uint8Array || typeof o.block_hash === "string") && typeof o.block_timestamp === "bigint");
  },
  isAmino(o: any): o is MsgEthereumTxResponseAmino {
    return o && (o.$typeUrl === MsgEthereumTxResponse.typeUrl || typeof o.hash === "string" && Array.isArray(o.logs) && (!o.logs.length || Log.isAmino(o.logs[0])) && (o.ret instanceof Uint8Array || typeof o.ret === "string") && typeof o.vm_error === "string" && typeof o.gas_used === "bigint" && typeof o.max_used_gas === "bigint" && (o.block_hash instanceof Uint8Array || typeof o.block_hash === "string") && typeof o.block_timestamp === "bigint");
  },
  encode(message: MsgEthereumTxResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.hash !== "") {
      writer.uint32(10).string(message.hash);
    }
    for (const v of message.logs) {
      Log.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.ret.length !== 0) {
      writer.uint32(26).bytes(message.ret);
    }
    if (message.vmError !== "") {
      writer.uint32(34).string(message.vmError);
    }
    if (message.gasUsed !== BigInt(0)) {
      writer.uint32(40).uint64(message.gasUsed);
    }
    if (message.maxUsedGas !== BigInt(0)) {
      writer.uint32(48).uint64(message.maxUsedGas);
    }
    if (message.blockHash.length !== 0) {
      writer.uint32(58).bytes(message.blockHash);
    }
    if (message.blockTimestamp !== BigInt(0)) {
      writer.uint32(64).uint64(message.blockTimestamp);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgEthereumTxResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgEthereumTxResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.hash = reader.string();
          break;
        case 2:
          message.logs.push(Log.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 3:
          message.ret = reader.bytes();
          break;
        case 4:
          message.vmError = reader.string();
          break;
        case 5:
          message.gasUsed = reader.uint64();
          break;
        case 6:
          message.maxUsedGas = reader.uint64();
          break;
        case 7:
          message.blockHash = reader.bytes();
          break;
        case 8:
          message.blockTimestamp = reader.uint64();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgEthereumTxResponse>): MsgEthereumTxResponse {
    const message = createBaseMsgEthereumTxResponse();
    message.hash = object.hash ?? "";
    message.logs = object.logs?.map(e => Log.fromPartial(e)) || [];
    message.ret = object.ret ?? new Uint8Array();
    message.vmError = object.vmError ?? "";
    message.gasUsed = object.gasUsed !== undefined && object.gasUsed !== null ? BigInt(object.gasUsed.toString()) : BigInt(0);
    message.maxUsedGas = object.maxUsedGas !== undefined && object.maxUsedGas !== null ? BigInt(object.maxUsedGas.toString()) : BigInt(0);
    message.blockHash = object.blockHash ?? new Uint8Array();
    message.blockTimestamp = object.blockTimestamp !== undefined && object.blockTimestamp !== null ? BigInt(object.blockTimestamp.toString()) : BigInt(0);
    return message;
  },
  fromAmino(object: MsgEthereumTxResponseAmino): MsgEthereumTxResponse {
    const message = createBaseMsgEthereumTxResponse();
    if (object.hash !== undefined && object.hash !== null) {
      message.hash = object.hash;
    }
    message.logs = object.logs?.map(e => Log.fromAmino(e)) || [];
    if (object.ret !== undefined && object.ret !== null) {
      message.ret = bytesFromBase64(object.ret);
    }
    if (object.vm_error !== undefined && object.vm_error !== null) {
      message.vmError = object.vm_error;
    }
    if (object.gas_used !== undefined && object.gas_used !== null) {
      message.gasUsed = BigInt(object.gas_used);
    }
    if (object.max_used_gas !== undefined && object.max_used_gas !== null) {
      message.maxUsedGas = BigInt(object.max_used_gas);
    }
    if (object.block_hash !== undefined && object.block_hash !== null) {
      message.blockHash = bytesFromBase64(object.block_hash);
    }
    if (object.block_timestamp !== undefined && object.block_timestamp !== null) {
      message.blockTimestamp = BigInt(object.block_timestamp);
    }
    return message;
  },
  toAmino(message: MsgEthereumTxResponse, useInterfaces: boolean = false): MsgEthereumTxResponseAmino {
    const obj: any = {};
    obj.hash = message.hash === "" ? undefined : message.hash;
    if (message.logs) {
      obj.logs = message.logs.map(e => e ? Log.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.logs = message.logs;
    }
    obj.ret = message.ret ? base64FromBytes(message.ret) : undefined;
    obj.vm_error = message.vmError === "" ? undefined : message.vmError;
    obj.gas_used = message.gasUsed !== BigInt(0) ? message.gasUsed?.toString() : undefined;
    obj.max_used_gas = message.maxUsedGas !== BigInt(0) ? message.maxUsedGas?.toString() : undefined;
    obj.block_hash = message.blockHash ? base64FromBytes(message.blockHash) : undefined;
    obj.block_timestamp = message.blockTimestamp !== BigInt(0) ? message.blockTimestamp?.toString() : undefined;
    return obj;
  },
  fromAminoMsg(object: MsgEthereumTxResponseAminoMsg): MsgEthereumTxResponse {
    return MsgEthereumTxResponse.fromAmino(object.value);
  },
  toAminoMsg(message: MsgEthereumTxResponse, useInterfaces: boolean = false): MsgEthereumTxResponseAminoMsg {
    return {
      type: "cosmos-sdk/MsgEthereumTxResponse",
      value: MsgEthereumTxResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgEthereumTxResponseProtoMsg, useInterfaces: boolean = false): MsgEthereumTxResponse {
    return MsgEthereumTxResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgEthereumTxResponse): Uint8Array {
    return MsgEthereumTxResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgEthereumTxResponse): MsgEthereumTxResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTxResponse",
      value: MsgEthereumTxResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(MsgEthereumTxResponse.typeUrl)) {
      return;
    }
    Log.registerTypeUrl();
  }
};
function createBaseMsgUpdateParams(): MsgUpdateParams {
  return {
    authority: "",
    params: Params.fromPartial({})
  };
}
/**
 * MsgUpdateParams defines a Msg for updating the x/vm module parameters.
 * @name MsgUpdateParams
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParams
 */
export const MsgUpdateParams = {
  typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParams",
  aminoType: "cosmos/evm/x/vm/MsgUpdateParams",
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
      type: "cosmos/evm/x/vm/MsgUpdateParams",
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
      typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParams",
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
 * MsgUpdateParamsResponse defines the response structure for executing a
 * MsgUpdateParams message.
 * @name MsgUpdateParamsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgUpdateParamsResponse
 */
export const MsgUpdateParamsResponse = {
  typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParamsResponse",
  aminoType: "cosmos-sdk/MsgUpdateParamsResponse",
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
  toAminoMsg(message: MsgUpdateParamsResponse, useInterfaces: boolean = false): MsgUpdateParamsResponseAminoMsg {
    return {
      type: "cosmos-sdk/MsgUpdateParamsResponse",
      value: MsgUpdateParamsResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgUpdateParamsResponseProtoMsg, useInterfaces: boolean = false): MsgUpdateParamsResponse {
    return MsgUpdateParamsResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgUpdateParamsResponse): Uint8Array {
    return MsgUpdateParamsResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgUpdateParamsResponse): MsgUpdateParamsResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParamsResponse",
      value: MsgUpdateParamsResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgRegisterPreinstalls(): MsgRegisterPreinstalls {
  return {
    authority: "",
    preinstalls: []
  };
}
/**
 * MsgRegisterPreinstalls defines a Msg for creating preinstalls in evm state.
 * @name MsgRegisterPreinstalls
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstalls
 */
export const MsgRegisterPreinstalls = {
  typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstalls",
  aminoType: "cosmos/evm/x/vm/MsgRegisterPreinstalls",
  is(o: any): o is MsgRegisterPreinstalls {
    return o && (o.$typeUrl === MsgRegisterPreinstalls.typeUrl || typeof o.authority === "string" && Array.isArray(o.preinstalls) && (!o.preinstalls.length || Preinstall.is(o.preinstalls[0])));
  },
  isSDK(o: any): o is MsgRegisterPreinstallsSDKType {
    return o && (o.$typeUrl === MsgRegisterPreinstalls.typeUrl || typeof o.authority === "string" && Array.isArray(o.preinstalls) && (!o.preinstalls.length || Preinstall.isSDK(o.preinstalls[0])));
  },
  isAmino(o: any): o is MsgRegisterPreinstallsAmino {
    return o && (o.$typeUrl === MsgRegisterPreinstalls.typeUrl || typeof o.authority === "string" && Array.isArray(o.preinstalls) && (!o.preinstalls.length || Preinstall.isAmino(o.preinstalls[0])));
  },
  encode(message: MsgRegisterPreinstalls, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    for (const v of message.preinstalls) {
      Preinstall.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRegisterPreinstalls {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRegisterPreinstalls();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.preinstalls.push(Preinstall.decode(reader, reader.uint32(), useInterfaces));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgRegisterPreinstalls>): MsgRegisterPreinstalls {
    const message = createBaseMsgRegisterPreinstalls();
    message.authority = object.authority ?? "";
    message.preinstalls = object.preinstalls?.map(e => Preinstall.fromPartial(e)) || [];
    return message;
  },
  fromAmino(object: MsgRegisterPreinstallsAmino): MsgRegisterPreinstalls {
    const message = createBaseMsgRegisterPreinstalls();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    message.preinstalls = object.preinstalls?.map(e => Preinstall.fromAmino(e)) || [];
    return message;
  },
  toAmino(message: MsgRegisterPreinstalls, useInterfaces: boolean = false): MsgRegisterPreinstallsAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    if (message.preinstalls) {
      obj.preinstalls = message.preinstalls.map(e => e ? Preinstall.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.preinstalls = message.preinstalls;
    }
    return obj;
  },
  fromAminoMsg(object: MsgRegisterPreinstallsAminoMsg): MsgRegisterPreinstalls {
    return MsgRegisterPreinstalls.fromAmino(object.value);
  },
  toAminoMsg(message: MsgRegisterPreinstalls, useInterfaces: boolean = false): MsgRegisterPreinstallsAminoMsg {
    return {
      type: "cosmos/evm/x/vm/MsgRegisterPreinstalls",
      value: MsgRegisterPreinstalls.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgRegisterPreinstallsProtoMsg, useInterfaces: boolean = false): MsgRegisterPreinstalls {
    return MsgRegisterPreinstalls.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRegisterPreinstalls): Uint8Array {
    return MsgRegisterPreinstalls.encode(message).finish();
  },
  toProtoMsg(message: MsgRegisterPreinstalls): MsgRegisterPreinstallsProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstalls",
      value: MsgRegisterPreinstalls.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(MsgRegisterPreinstalls.typeUrl)) {
      return;
    }
    Preinstall.registerTypeUrl();
  }
};
function createBaseMsgRegisterPreinstallsResponse(): MsgRegisterPreinstallsResponse {
  return {};
}
/**
 * MsgRegisterPreinstallsResponse defines the response structure for executing a
 * MsgRegisterPreinstalls message.
 * @name MsgRegisterPreinstallsResponse
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.MsgRegisterPreinstallsResponse
 */
export const MsgRegisterPreinstallsResponse = {
  typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstallsResponse",
  aminoType: "cosmos-sdk/MsgRegisterPreinstallsResponse",
  is(o: any): o is MsgRegisterPreinstallsResponse {
    return o && o.$typeUrl === MsgRegisterPreinstallsResponse.typeUrl;
  },
  isSDK(o: any): o is MsgRegisterPreinstallsResponseSDKType {
    return o && o.$typeUrl === MsgRegisterPreinstallsResponse.typeUrl;
  },
  isAmino(o: any): o is MsgRegisterPreinstallsResponseAmino {
    return o && o.$typeUrl === MsgRegisterPreinstallsResponse.typeUrl;
  },
  encode(_: MsgRegisterPreinstallsResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRegisterPreinstallsResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRegisterPreinstallsResponse();
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
  fromPartial(_: Partial<MsgRegisterPreinstallsResponse>): MsgRegisterPreinstallsResponse {
    const message = createBaseMsgRegisterPreinstallsResponse();
    return message;
  },
  fromAmino(_: MsgRegisterPreinstallsResponseAmino): MsgRegisterPreinstallsResponse {
    const message = createBaseMsgRegisterPreinstallsResponse();
    return message;
  },
  toAmino(_: MsgRegisterPreinstallsResponse, useInterfaces: boolean = false): MsgRegisterPreinstallsResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgRegisterPreinstallsResponseAminoMsg): MsgRegisterPreinstallsResponse {
    return MsgRegisterPreinstallsResponse.fromAmino(object.value);
  },
  toAminoMsg(message: MsgRegisterPreinstallsResponse, useInterfaces: boolean = false): MsgRegisterPreinstallsResponseAminoMsg {
    return {
      type: "cosmos-sdk/MsgRegisterPreinstallsResponse",
      value: MsgRegisterPreinstallsResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgRegisterPreinstallsResponseProtoMsg, useInterfaces: boolean = false): MsgRegisterPreinstallsResponse {
    return MsgRegisterPreinstallsResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRegisterPreinstallsResponse): Uint8Array {
    return MsgRegisterPreinstallsResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgRegisterPreinstallsResponse): MsgRegisterPreinstallsResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstallsResponse",
      value: MsgRegisterPreinstallsResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};