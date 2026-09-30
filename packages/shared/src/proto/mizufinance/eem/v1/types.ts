import { BinaryReader, BinaryWriter } from "../../../binary";
/**
 * IBCSenderInfo stores information about the original IBC sender for cross-chain execution.
 * This allows any IBC-connected chain to trigger smart contract execution.
 * @name IBCSenderInfo
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.IBCSenderInfo
 */
export interface IBCSenderInfo {
  /**
   * sender_address is the bech32 address of the original sender on the source chain
   * (e.g., "cosmos1...", "osmo1...", "penumbra1...")
   */
  senderAddress: string;
  /**
   * ibc_destination_channel is the channel on this chain where the packet was received
   * (e.g., "channel-0")
   */
  ibcDestinationChannel: string;
  /**
   * contract_address is the EVM contract being executed
   */
  contractAddress: string;
  /**
   * source_denom is the denom as it appeared in the IBC packet from the source chain
   * (e.g., "uatom" for native sends, "transfer/channel-X/utoken" for forwarded tokens)
   */
  sourceDenom: string;
  /**
   * local_denom is the denom as it exists on THIS chain after IBC processing
   * For native tokens being received: "ibc/HASH" format
   * For returning tokens (unwinding): original base denom (e.g., "uatom")
   * This is computed using GetDenomForThisChain()
   */
  localDenom: string;
}
export interface IBCSenderInfoProtoMsg {
  typeUrl: "/mizufinance.eem.v1.IBCSenderInfo";
  value: Uint8Array;
}
/**
 * IBCSenderInfo stores information about the original IBC sender for cross-chain execution.
 * This allows any IBC-connected chain to trigger smart contract execution.
 * @name IBCSenderInfoAmino
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.IBCSenderInfo
 */
export interface IBCSenderInfoAmino {
  /**
   * sender_address is the bech32 address of the original sender on the source chain
   * (e.g., "cosmos1...", "osmo1...", "penumbra1...")
   */
  sender_address?: string;
  /**
   * ibc_destination_channel is the channel on this chain where the packet was received
   * (e.g., "channel-0")
   */
  ibc_destination_channel?: string;
  /**
   * contract_address is the EVM contract being executed
   */
  contract_address?: string;
  /**
   * source_denom is the denom as it appeared in the IBC packet from the source chain
   * (e.g., "uatom" for native sends, "transfer/channel-X/utoken" for forwarded tokens)
   */
  source_denom?: string;
  /**
   * local_denom is the denom as it exists on THIS chain after IBC processing
   * For native tokens being received: "ibc/HASH" format
   * For returning tokens (unwinding): original base denom (e.g., "uatom")
   * This is computed using GetDenomForThisChain()
   */
  local_denom?: string;
}
export interface IBCSenderInfoAminoMsg {
  type: "/mizufinance.eem.v1.IBCSenderInfo";
  value: IBCSenderInfoAmino;
}
/**
 * IBCSenderInfo stores information about the original IBC sender for cross-chain execution.
 * This allows any IBC-connected chain to trigger smart contract execution.
 * @name IBCSenderInfoSDKType
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.IBCSenderInfo
 */
export interface IBCSenderInfoSDKType {
  sender_address: string;
  ibc_destination_channel: string;
  contract_address: string;
  source_denom: string;
  local_denom: string;
}
function createBaseIBCSenderInfo(): IBCSenderInfo {
  return {
    senderAddress: "",
    ibcDestinationChannel: "",
    contractAddress: "",
    sourceDenom: "",
    localDenom: ""
  };
}
/**
 * IBCSenderInfo stores information about the original IBC sender for cross-chain execution.
 * This allows any IBC-connected chain to trigger smart contract execution.
 * @name IBCSenderInfo
 * @package mizufinance.eem.v1
 * @see proto type: mizufinance.eem.v1.IBCSenderInfo
 */
export const IBCSenderInfo = {
  typeUrl: "/mizufinance.eem.v1.IBCSenderInfo",
  is(o: any): o is IBCSenderInfo {
    return o && (o.$typeUrl === IBCSenderInfo.typeUrl || typeof o.senderAddress === "string" && typeof o.ibcDestinationChannel === "string" && typeof o.contractAddress === "string" && typeof o.sourceDenom === "string" && typeof o.localDenom === "string");
  },
  isSDK(o: any): o is IBCSenderInfoSDKType {
    return o && (o.$typeUrl === IBCSenderInfo.typeUrl || typeof o.sender_address === "string" && typeof o.ibc_destination_channel === "string" && typeof o.contract_address === "string" && typeof o.source_denom === "string" && typeof o.local_denom === "string");
  },
  isAmino(o: any): o is IBCSenderInfoAmino {
    return o && (o.$typeUrl === IBCSenderInfo.typeUrl || typeof o.sender_address === "string" && typeof o.ibc_destination_channel === "string" && typeof o.contract_address === "string" && typeof o.source_denom === "string" && typeof o.local_denom === "string");
  },
  encode(message: IBCSenderInfo, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.senderAddress !== "") {
      writer.uint32(10).string(message.senderAddress);
    }
    if (message.ibcDestinationChannel !== "") {
      writer.uint32(18).string(message.ibcDestinationChannel);
    }
    if (message.contractAddress !== "") {
      writer.uint32(26).string(message.contractAddress);
    }
    if (message.sourceDenom !== "") {
      writer.uint32(34).string(message.sourceDenom);
    }
    if (message.localDenom !== "") {
      writer.uint32(42).string(message.localDenom);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): IBCSenderInfo {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseIBCSenderInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.senderAddress = reader.string();
          break;
        case 2:
          message.ibcDestinationChannel = reader.string();
          break;
        case 3:
          message.contractAddress = reader.string();
          break;
        case 4:
          message.sourceDenom = reader.string();
          break;
        case 5:
          message.localDenom = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<IBCSenderInfo>): IBCSenderInfo {
    const message = createBaseIBCSenderInfo();
    message.senderAddress = object.senderAddress ?? "";
    message.ibcDestinationChannel = object.ibcDestinationChannel ?? "";
    message.contractAddress = object.contractAddress ?? "";
    message.sourceDenom = object.sourceDenom ?? "";
    message.localDenom = object.localDenom ?? "";
    return message;
  },
  fromAmino(object: IBCSenderInfoAmino): IBCSenderInfo {
    const message = createBaseIBCSenderInfo();
    if (object.sender_address !== undefined && object.sender_address !== null) {
      message.senderAddress = object.sender_address;
    }
    if (object.ibc_destination_channel !== undefined && object.ibc_destination_channel !== null) {
      message.ibcDestinationChannel = object.ibc_destination_channel;
    }
    if (object.contract_address !== undefined && object.contract_address !== null) {
      message.contractAddress = object.contract_address;
    }
    if (object.source_denom !== undefined && object.source_denom !== null) {
      message.sourceDenom = object.source_denom;
    }
    if (object.local_denom !== undefined && object.local_denom !== null) {
      message.localDenom = object.local_denom;
    }
    return message;
  },
  toAmino(message: IBCSenderInfo, useInterfaces: boolean = false): IBCSenderInfoAmino {
    const obj: any = {};
    obj.sender_address = message.senderAddress === "" ? undefined : message.senderAddress;
    obj.ibc_destination_channel = message.ibcDestinationChannel === "" ? undefined : message.ibcDestinationChannel;
    obj.contract_address = message.contractAddress === "" ? undefined : message.contractAddress;
    obj.source_denom = message.sourceDenom === "" ? undefined : message.sourceDenom;
    obj.local_denom = message.localDenom === "" ? undefined : message.localDenom;
    return obj;
  },
  fromAminoMsg(object: IBCSenderInfoAminoMsg): IBCSenderInfo {
    return IBCSenderInfo.fromAmino(object.value);
  },
  fromProtoMsg(message: IBCSenderInfoProtoMsg, useInterfaces: boolean = false): IBCSenderInfo {
    return IBCSenderInfo.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: IBCSenderInfo): Uint8Array {
    return IBCSenderInfo.encode(message).finish();
  },
  toProtoMsg(message: IBCSenderInfo): IBCSenderInfoProtoMsg {
    return {
      typeUrl: "/mizufinance.eem.v1.IBCSenderInfo",
      value: IBCSenderInfo.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};