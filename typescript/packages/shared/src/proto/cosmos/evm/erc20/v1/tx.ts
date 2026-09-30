//@ts-nocheck
import { Coin, CoinAmino, CoinSDKType } from "../../../base/v1beta1/coin";
import { Params, ParamsAmino, ParamsSDKType } from "./genesis";
import { BinaryReader, BinaryWriter } from "../../../../binary";
import { GlobalDecoderRegistry } from "../../../../registry";
/**
 * MsgConvertERC20 defines a Msg to convert a ERC20 token to a native Cosmos
 * coin.
 * @name MsgConvertERC20
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20
 */
export interface MsgConvertERC20 {
  /**
   * contract_address of an ERC20 token contract, that is registered in a token
   * pair
   */
  contractAddress: string;
  /**
   * amount of ERC20 tokens to convert
   */
  amount: string;
  /**
   * receiver is the bech32 address to receive native Cosmos coins
   */
  receiver: string;
  /**
   * sender is the hex address from the owner of the given ERC20 tokens
   */
  sender: string;
}
export interface MsgConvertERC20ProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertERC20";
  value: Uint8Array;
}
/**
 * MsgConvertERC20 defines a Msg to convert a ERC20 token to a native Cosmos
 * coin.
 * @name MsgConvertERC20Amino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20
 */
export interface MsgConvertERC20Amino {
  /**
   * contract_address of an ERC20 token contract, that is registered in a token
   * pair
   */
  contract_address?: string;
  /**
   * amount of ERC20 tokens to convert
   */
  amount: string;
  /**
   * receiver is the bech32 address to receive native Cosmos coins
   */
  receiver?: string;
  /**
   * sender is the hex address from the owner of the given ERC20 tokens
   */
  sender?: string;
}
export interface MsgConvertERC20AminoMsg {
  type: "cosmos/evm/MsgConvertERC20";
  value: MsgConvertERC20Amino;
}
/**
 * MsgConvertERC20 defines a Msg to convert a ERC20 token to a native Cosmos
 * coin.
 * @name MsgConvertERC20SDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20
 */
export interface MsgConvertERC20SDKType {
  contract_address: string;
  amount: string;
  receiver: string;
  sender: string;
}
/**
 * MsgConvertERC20Response returns no fields
 * @name MsgConvertERC20Response
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20Response
 */
export interface MsgConvertERC20Response {}
export interface MsgConvertERC20ResponseProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertERC20Response";
  value: Uint8Array;
}
/**
 * MsgConvertERC20Response returns no fields
 * @name MsgConvertERC20ResponseAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20Response
 */
export interface MsgConvertERC20ResponseAmino {}
export interface MsgConvertERC20ResponseAminoMsg {
  type: "cosmos-sdk/MsgConvertERC20Response";
  value: MsgConvertERC20ResponseAmino;
}
/**
 * MsgConvertERC20Response returns no fields
 * @name MsgConvertERC20ResponseSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20Response
 */
export interface MsgConvertERC20ResponseSDKType {}
/**
 * MsgConvertCoin defines a Msg to convert a native Cosmos coin to a ERC20 token
 * @name MsgConvertCoin
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoin
 */
export interface MsgConvertCoin {
  /**
   * coin is a Cosmos coin whose denomination is registered in a token pair. The
   * coin amount defines the amount of coins to convert.
   */
  coin: Coin | undefined;
  /**
   * receiver is the hex address to receive ERC20 token
   */
  receiver: string;
  /**
   * sender is the cosmos bech32 address from the owner of the given Cosmos
   * coins
   */
  sender: string;
}
export interface MsgConvertCoinProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertCoin";
  value: Uint8Array;
}
/**
 * MsgConvertCoin defines a Msg to convert a native Cosmos coin to a ERC20 token
 * @name MsgConvertCoinAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoin
 */
export interface MsgConvertCoinAmino {
  /**
   * coin is a Cosmos coin whose denomination is registered in a token pair. The
   * coin amount defines the amount of coins to convert.
   */
  coin?: CoinAmino | undefined;
  /**
   * receiver is the hex address to receive ERC20 token
   */
  receiver?: string;
  /**
   * sender is the cosmos bech32 address from the owner of the given Cosmos
   * coins
   */
  sender?: string;
}
export interface MsgConvertCoinAminoMsg {
  type: "cosmos/evm/x/erc20/MsgConvertCoin";
  value: MsgConvertCoinAmino;
}
/**
 * MsgConvertCoin defines a Msg to convert a native Cosmos coin to a ERC20 token
 * @name MsgConvertCoinSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoin
 */
export interface MsgConvertCoinSDKType {
  coin: CoinSDKType | undefined;
  receiver: string;
  sender: string;
}
/**
 * MsgConvertCoinResponse returns no fields
 * @name MsgConvertCoinResponse
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoinResponse
 */
export interface MsgConvertCoinResponse {}
export interface MsgConvertCoinResponseProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertCoinResponse";
  value: Uint8Array;
}
/**
 * MsgConvertCoinResponse returns no fields
 * @name MsgConvertCoinResponseAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoinResponse
 */
export interface MsgConvertCoinResponseAmino {}
export interface MsgConvertCoinResponseAminoMsg {
  type: "cosmos-sdk/MsgConvertCoinResponse";
  value: MsgConvertCoinResponseAmino;
}
/**
 * MsgConvertCoinResponse returns no fields
 * @name MsgConvertCoinResponseSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoinResponse
 */
export interface MsgConvertCoinResponseSDKType {}
/**
 * MsgUpdateParams is the Msg/UpdateParams request type for Erc20 parameters.
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParams
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParams
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
  typeUrl: "/cosmos.evm.erc20.v1.MsgUpdateParams";
  value: Uint8Array;
}
/**
 * MsgUpdateParams is the Msg/UpdateParams request type for Erc20 parameters.
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParamsAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParams
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
  type: "cosmos/evm/x/erc20/MsgUpdateParams";
  value: MsgUpdateParamsAmino;
}
/**
 * MsgUpdateParams is the Msg/UpdateParams request type for Erc20 parameters.
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParamsSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParams
 */
export interface MsgUpdateParamsSDKType {
  authority: string;
  params: ParamsSDKType | undefined;
}
/**
 * MsgUpdateParamsResponse defines the response structure for executing a
 * MsgUpdateParams message.
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParamsResponse
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponse {}
export interface MsgUpdateParamsResponseProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgUpdateParamsResponse";
  value: Uint8Array;
}
/**
 * MsgUpdateParamsResponse defines the response structure for executing a
 * MsgUpdateParams message.
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParamsResponseAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponseAmino {}
export interface MsgUpdateParamsResponseAminoMsg {
  type: "cosmos-sdk/MsgUpdateParamsResponse";
  value: MsgUpdateParamsResponseAmino;
}
/**
 * MsgUpdateParamsResponse defines the response structure for executing a
 * MsgUpdateParams message.
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParamsResponseSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParamsResponse
 */
export interface MsgUpdateParamsResponseSDKType {}
/**
 * MsgRegisterERC20 is the Msg/RegisterERC20 request type for registering
 * an Erc20 contract token pair.
 * @name MsgRegisterERC20
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20
 */
export interface MsgRegisterERC20 {
  /**
   * signer is the address registering the erc20 pairs
   */
  signer: string;
  /**
   * erc20addresses is a slice of ERC20 token contract hex addresses
   */
  erc20addresses: string[];
}
export interface MsgRegisterERC20ProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgRegisterERC20";
  value: Uint8Array;
}
/**
 * MsgRegisterERC20 is the Msg/RegisterERC20 request type for registering
 * an Erc20 contract token pair.
 * @name MsgRegisterERC20Amino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20
 */
export interface MsgRegisterERC20Amino {
  /**
   * signer is the address registering the erc20 pairs
   */
  signer?: string;
  /**
   * erc20addresses is a slice of ERC20 token contract hex addresses
   */
  erc20addresses?: string[];
}
export interface MsgRegisterERC20AminoMsg {
  type: "cosmos/evm/x/erc20/MsgRegisterERC20";
  value: MsgRegisterERC20Amino;
}
/**
 * MsgRegisterERC20 is the Msg/RegisterERC20 request type for registering
 * an Erc20 contract token pair.
 * @name MsgRegisterERC20SDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20
 */
export interface MsgRegisterERC20SDKType {
  signer: string;
  erc20addresses: string[];
}
/**
 * MsgRegisterERC20Response defines the response structure for executing a
 * MsgRegisterERC20 message.
 * @name MsgRegisterERC20Response
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20Response
 */
export interface MsgRegisterERC20Response {}
export interface MsgRegisterERC20ResponseProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgRegisterERC20Response";
  value: Uint8Array;
}
/**
 * MsgRegisterERC20Response defines the response structure for executing a
 * MsgRegisterERC20 message.
 * @name MsgRegisterERC20ResponseAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20Response
 */
export interface MsgRegisterERC20ResponseAmino {}
export interface MsgRegisterERC20ResponseAminoMsg {
  type: "cosmos-sdk/MsgRegisterERC20Response";
  value: MsgRegisterERC20ResponseAmino;
}
/**
 * MsgRegisterERC20Response defines the response structure for executing a
 * MsgRegisterERC20 message.
 * @name MsgRegisterERC20ResponseSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20Response
 */
export interface MsgRegisterERC20ResponseSDKType {}
/**
 * MsgToggleConversion is the Msg/MsgToggleConversion request type for toggling
 * an Erc20 contract conversion capability.
 * @name MsgToggleConversion
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversion
 */
export interface MsgToggleConversion {
  /**
   * authority is the address of the governance account.
   */
  authority: string;
  /**
   * token identifier can be either the hex contract address of the ERC20 or the
   * Cosmos base denomination
   */
  token: string;
}
export interface MsgToggleConversionProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgToggleConversion";
  value: Uint8Array;
}
/**
 * MsgToggleConversion is the Msg/MsgToggleConversion request type for toggling
 * an Erc20 contract conversion capability.
 * @name MsgToggleConversionAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversion
 */
export interface MsgToggleConversionAmino {
  /**
   * authority is the address of the governance account.
   */
  authority?: string;
  /**
   * token identifier can be either the hex contract address of the ERC20 or the
   * Cosmos base denomination
   */
  token?: string;
}
export interface MsgToggleConversionAminoMsg {
  type: "cosmos/evm/x/erc20/MsgToggleConversion";
  value: MsgToggleConversionAmino;
}
/**
 * MsgToggleConversion is the Msg/MsgToggleConversion request type for toggling
 * an Erc20 contract conversion capability.
 * @name MsgToggleConversionSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversion
 */
export interface MsgToggleConversionSDKType {
  authority: string;
  token: string;
}
/**
 * MsgToggleConversionResponse defines the response structure for executing a
 * ToggleConversion message.
 * @name MsgToggleConversionResponse
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversionResponse
 */
export interface MsgToggleConversionResponse {}
export interface MsgToggleConversionResponseProtoMsg {
  typeUrl: "/cosmos.evm.erc20.v1.MsgToggleConversionResponse";
  value: Uint8Array;
}
/**
 * MsgToggleConversionResponse defines the response structure for executing a
 * ToggleConversion message.
 * @name MsgToggleConversionResponseAmino
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversionResponse
 */
export interface MsgToggleConversionResponseAmino {}
export interface MsgToggleConversionResponseAminoMsg {
  type: "cosmos-sdk/MsgToggleConversionResponse";
  value: MsgToggleConversionResponseAmino;
}
/**
 * MsgToggleConversionResponse defines the response structure for executing a
 * ToggleConversion message.
 * @name MsgToggleConversionResponseSDKType
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversionResponse
 */
export interface MsgToggleConversionResponseSDKType {}
function createBaseMsgConvertERC20(): MsgConvertERC20 {
  return {
    contractAddress: "",
    amount: "",
    receiver: "",
    sender: ""
  };
}
/**
 * MsgConvertERC20 defines a Msg to convert a ERC20 token to a native Cosmos
 * coin.
 * @name MsgConvertERC20
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20
 */
export const MsgConvertERC20 = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertERC20",
  aminoType: "cosmos/evm/MsgConvertERC20",
  is(o: any): o is MsgConvertERC20 {
    return o && (o.$typeUrl === MsgConvertERC20.typeUrl || typeof o.contractAddress === "string" && typeof o.amount === "string" && typeof o.receiver === "string" && typeof o.sender === "string");
  },
  isSDK(o: any): o is MsgConvertERC20SDKType {
    return o && (o.$typeUrl === MsgConvertERC20.typeUrl || typeof o.contract_address === "string" && typeof o.amount === "string" && typeof o.receiver === "string" && typeof o.sender === "string");
  },
  isAmino(o: any): o is MsgConvertERC20Amino {
    return o && (o.$typeUrl === MsgConvertERC20.typeUrl || typeof o.contract_address === "string" && typeof o.amount === "string" && typeof o.receiver === "string" && typeof o.sender === "string");
  },
  encode(message: MsgConvertERC20, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.contractAddress !== "") {
      writer.uint32(10).string(message.contractAddress);
    }
    if (message.amount !== "") {
      writer.uint32(18).string(message.amount);
    }
    if (message.receiver !== "") {
      writer.uint32(26).string(message.receiver);
    }
    if (message.sender !== "") {
      writer.uint32(34).string(message.sender);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgConvertERC20 {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgConvertERC20();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.contractAddress = reader.string();
          break;
        case 2:
          message.amount = reader.string();
          break;
        case 3:
          message.receiver = reader.string();
          break;
        case 4:
          message.sender = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgConvertERC20>): MsgConvertERC20 {
    const message = createBaseMsgConvertERC20();
    message.contractAddress = object.contractAddress ?? "";
    message.amount = object.amount ?? "";
    message.receiver = object.receiver ?? "";
    message.sender = object.sender ?? "";
    return message;
  },
  fromAmino(object: MsgConvertERC20Amino): MsgConvertERC20 {
    const message = createBaseMsgConvertERC20();
    if (object.contract_address !== undefined && object.contract_address !== null) {
      message.contractAddress = object.contract_address;
    }
    if (object.amount !== undefined && object.amount !== null) {
      message.amount = object.amount;
    }
    if (object.receiver !== undefined && object.receiver !== null) {
      message.receiver = object.receiver;
    }
    if (object.sender !== undefined && object.sender !== null) {
      message.sender = object.sender;
    }
    return message;
  },
  toAmino(message: MsgConvertERC20, useInterfaces: boolean = false): MsgConvertERC20Amino {
    const obj: any = {};
    obj.contract_address = message.contractAddress === "" ? undefined : message.contractAddress;
    obj.amount = message.amount ?? "";
    obj.receiver = message.receiver === "" ? undefined : message.receiver;
    obj.sender = message.sender === "" ? undefined : message.sender;
    return obj;
  },
  fromAminoMsg(object: MsgConvertERC20AminoMsg): MsgConvertERC20 {
    return MsgConvertERC20.fromAmino(object.value);
  },
  toAminoMsg(message: MsgConvertERC20, useInterfaces: boolean = false): MsgConvertERC20AminoMsg {
    return {
      type: "cosmos/evm/MsgConvertERC20",
      value: MsgConvertERC20.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgConvertERC20ProtoMsg, useInterfaces: boolean = false): MsgConvertERC20 {
    return MsgConvertERC20.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgConvertERC20): Uint8Array {
    return MsgConvertERC20.encode(message).finish();
  },
  toProtoMsg(message: MsgConvertERC20): MsgConvertERC20ProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgConvertERC20",
      value: MsgConvertERC20.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgConvertERC20Response(): MsgConvertERC20Response {
  return {};
}
/**
 * MsgConvertERC20Response returns no fields
 * @name MsgConvertERC20Response
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertERC20Response
 */
export const MsgConvertERC20Response = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertERC20Response",
  aminoType: "cosmos-sdk/MsgConvertERC20Response",
  is(o: any): o is MsgConvertERC20Response {
    return o && o.$typeUrl === MsgConvertERC20Response.typeUrl;
  },
  isSDK(o: any): o is MsgConvertERC20ResponseSDKType {
    return o && o.$typeUrl === MsgConvertERC20Response.typeUrl;
  },
  isAmino(o: any): o is MsgConvertERC20ResponseAmino {
    return o && o.$typeUrl === MsgConvertERC20Response.typeUrl;
  },
  encode(_: MsgConvertERC20Response, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgConvertERC20Response {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgConvertERC20Response();
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
  fromPartial(_: Partial<MsgConvertERC20Response>): MsgConvertERC20Response {
    const message = createBaseMsgConvertERC20Response();
    return message;
  },
  fromAmino(_: MsgConvertERC20ResponseAmino): MsgConvertERC20Response {
    const message = createBaseMsgConvertERC20Response();
    return message;
  },
  toAmino(_: MsgConvertERC20Response, useInterfaces: boolean = false): MsgConvertERC20ResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgConvertERC20ResponseAminoMsg): MsgConvertERC20Response {
    return MsgConvertERC20Response.fromAmino(object.value);
  },
  toAminoMsg(message: MsgConvertERC20Response, useInterfaces: boolean = false): MsgConvertERC20ResponseAminoMsg {
    return {
      type: "cosmos-sdk/MsgConvertERC20Response",
      value: MsgConvertERC20Response.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgConvertERC20ResponseProtoMsg, useInterfaces: boolean = false): MsgConvertERC20Response {
    return MsgConvertERC20Response.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgConvertERC20Response): Uint8Array {
    return MsgConvertERC20Response.encode(message).finish();
  },
  toProtoMsg(message: MsgConvertERC20Response): MsgConvertERC20ResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgConvertERC20Response",
      value: MsgConvertERC20Response.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgConvertCoin(): MsgConvertCoin {
  return {
    coin: Coin.fromPartial({}),
    receiver: "",
    sender: ""
  };
}
/**
 * MsgConvertCoin defines a Msg to convert a native Cosmos coin to a ERC20 token
 * @name MsgConvertCoin
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoin
 */
export const MsgConvertCoin = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertCoin",
  aminoType: "cosmos/evm/x/erc20/MsgConvertCoin",
  is(o: any): o is MsgConvertCoin {
    return o && (o.$typeUrl === MsgConvertCoin.typeUrl || Coin.is(o.coin) && typeof o.receiver === "string" && typeof o.sender === "string");
  },
  isSDK(o: any): o is MsgConvertCoinSDKType {
    return o && (o.$typeUrl === MsgConvertCoin.typeUrl || Coin.isSDK(o.coin) && typeof o.receiver === "string" && typeof o.sender === "string");
  },
  isAmino(o: any): o is MsgConvertCoinAmino {
    return o && (o.$typeUrl === MsgConvertCoin.typeUrl || Coin.isAmino(o.coin) && typeof o.receiver === "string" && typeof o.sender === "string");
  },
  encode(message: MsgConvertCoin, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.coin !== undefined) {
      Coin.encode(message.coin, writer.uint32(10).fork()).ldelim();
    }
    if (message.receiver !== "") {
      writer.uint32(18).string(message.receiver);
    }
    if (message.sender !== "") {
      writer.uint32(26).string(message.sender);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgConvertCoin {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgConvertCoin();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.coin = Coin.decode(reader, reader.uint32(), useInterfaces);
          break;
        case 2:
          message.receiver = reader.string();
          break;
        case 3:
          message.sender = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgConvertCoin>): MsgConvertCoin {
    const message = createBaseMsgConvertCoin();
    message.coin = object.coin !== undefined && object.coin !== null ? Coin.fromPartial(object.coin) : undefined;
    message.receiver = object.receiver ?? "";
    message.sender = object.sender ?? "";
    return message;
  },
  fromAmino(object: MsgConvertCoinAmino): MsgConvertCoin {
    const message = createBaseMsgConvertCoin();
    if (object.coin !== undefined && object.coin !== null) {
      message.coin = Coin.fromAmino(object.coin);
    }
    if (object.receiver !== undefined && object.receiver !== null) {
      message.receiver = object.receiver;
    }
    if (object.sender !== undefined && object.sender !== null) {
      message.sender = object.sender;
    }
    return message;
  },
  toAmino(message: MsgConvertCoin, useInterfaces: boolean = false): MsgConvertCoinAmino {
    const obj: any = {};
    obj.coin = message.coin ? Coin.toAmino(message.coin, useInterfaces) : undefined;
    obj.receiver = message.receiver === "" ? undefined : message.receiver;
    obj.sender = message.sender === "" ? undefined : message.sender;
    return obj;
  },
  fromAminoMsg(object: MsgConvertCoinAminoMsg): MsgConvertCoin {
    return MsgConvertCoin.fromAmino(object.value);
  },
  toAminoMsg(message: MsgConvertCoin, useInterfaces: boolean = false): MsgConvertCoinAminoMsg {
    return {
      type: "cosmos/evm/x/erc20/MsgConvertCoin",
      value: MsgConvertCoin.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgConvertCoinProtoMsg, useInterfaces: boolean = false): MsgConvertCoin {
    return MsgConvertCoin.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgConvertCoin): Uint8Array {
    return MsgConvertCoin.encode(message).finish();
  },
  toProtoMsg(message: MsgConvertCoin): MsgConvertCoinProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgConvertCoin",
      value: MsgConvertCoin.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(MsgConvertCoin.typeUrl)) {
      return;
    }
    Coin.registerTypeUrl();
  }
};
function createBaseMsgConvertCoinResponse(): MsgConvertCoinResponse {
  return {};
}
/**
 * MsgConvertCoinResponse returns no fields
 * @name MsgConvertCoinResponse
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgConvertCoinResponse
 */
export const MsgConvertCoinResponse = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgConvertCoinResponse",
  aminoType: "cosmos-sdk/MsgConvertCoinResponse",
  is(o: any): o is MsgConvertCoinResponse {
    return o && o.$typeUrl === MsgConvertCoinResponse.typeUrl;
  },
  isSDK(o: any): o is MsgConvertCoinResponseSDKType {
    return o && o.$typeUrl === MsgConvertCoinResponse.typeUrl;
  },
  isAmino(o: any): o is MsgConvertCoinResponseAmino {
    return o && o.$typeUrl === MsgConvertCoinResponse.typeUrl;
  },
  encode(_: MsgConvertCoinResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgConvertCoinResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgConvertCoinResponse();
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
  fromPartial(_: Partial<MsgConvertCoinResponse>): MsgConvertCoinResponse {
    const message = createBaseMsgConvertCoinResponse();
    return message;
  },
  fromAmino(_: MsgConvertCoinResponseAmino): MsgConvertCoinResponse {
    const message = createBaseMsgConvertCoinResponse();
    return message;
  },
  toAmino(_: MsgConvertCoinResponse, useInterfaces: boolean = false): MsgConvertCoinResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgConvertCoinResponseAminoMsg): MsgConvertCoinResponse {
    return MsgConvertCoinResponse.fromAmino(object.value);
  },
  toAminoMsg(message: MsgConvertCoinResponse, useInterfaces: boolean = false): MsgConvertCoinResponseAminoMsg {
    return {
      type: "cosmos-sdk/MsgConvertCoinResponse",
      value: MsgConvertCoinResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgConvertCoinResponseProtoMsg, useInterfaces: boolean = false): MsgConvertCoinResponse {
    return MsgConvertCoinResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgConvertCoinResponse): Uint8Array {
    return MsgConvertCoinResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgConvertCoinResponse): MsgConvertCoinResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgConvertCoinResponse",
      value: MsgConvertCoinResponse.encode(message).finish()
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
 * MsgUpdateParams is the Msg/UpdateParams request type for Erc20 parameters.
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParams
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParams
 */
export const MsgUpdateParams = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgUpdateParams",
  aminoType: "cosmos/evm/x/erc20/MsgUpdateParams",
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
      type: "cosmos/evm/x/erc20/MsgUpdateParams",
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
      typeUrl: "/cosmos.evm.erc20.v1.MsgUpdateParams",
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
 * Since: cosmos-sdk 0.47
 * @name MsgUpdateParamsResponse
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgUpdateParamsResponse
 */
export const MsgUpdateParamsResponse = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgUpdateParamsResponse",
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
      typeUrl: "/cosmos.evm.erc20.v1.MsgUpdateParamsResponse",
      value: MsgUpdateParamsResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgRegisterERC20(): MsgRegisterERC20 {
  return {
    signer: "",
    erc20addresses: []
  };
}
/**
 * MsgRegisterERC20 is the Msg/RegisterERC20 request type for registering
 * an Erc20 contract token pair.
 * @name MsgRegisterERC20
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20
 */
export const MsgRegisterERC20 = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgRegisterERC20",
  aminoType: "cosmos/evm/x/erc20/MsgRegisterERC20",
  is(o: any): o is MsgRegisterERC20 {
    return o && (o.$typeUrl === MsgRegisterERC20.typeUrl || typeof o.signer === "string" && Array.isArray(o.erc20addresses) && (!o.erc20addresses.length || typeof o.erc20addresses[0] === "string"));
  },
  isSDK(o: any): o is MsgRegisterERC20SDKType {
    return o && (o.$typeUrl === MsgRegisterERC20.typeUrl || typeof o.signer === "string" && Array.isArray(o.erc20addresses) && (!o.erc20addresses.length || typeof o.erc20addresses[0] === "string"));
  },
  isAmino(o: any): o is MsgRegisterERC20Amino {
    return o && (o.$typeUrl === MsgRegisterERC20.typeUrl || typeof o.signer === "string" && Array.isArray(o.erc20addresses) && (!o.erc20addresses.length || typeof o.erc20addresses[0] === "string"));
  },
  encode(message: MsgRegisterERC20, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.signer !== "") {
      writer.uint32(10).string(message.signer);
    }
    for (const v of message.erc20addresses) {
      writer.uint32(18).string(v!);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRegisterERC20 {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRegisterERC20();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.signer = reader.string();
          break;
        case 2:
          message.erc20addresses.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgRegisterERC20>): MsgRegisterERC20 {
    const message = createBaseMsgRegisterERC20();
    message.signer = object.signer ?? "";
    message.erc20addresses = object.erc20addresses?.map(e => e) || [];
    return message;
  },
  fromAmino(object: MsgRegisterERC20Amino): MsgRegisterERC20 {
    const message = createBaseMsgRegisterERC20();
    if (object.signer !== undefined && object.signer !== null) {
      message.signer = object.signer;
    }
    message.erc20addresses = object.erc20addresses?.map(e => e) || [];
    return message;
  },
  toAmino(message: MsgRegisterERC20, useInterfaces: boolean = false): MsgRegisterERC20Amino {
    const obj: any = {};
    obj.signer = message.signer === "" ? undefined : message.signer;
    if (message.erc20addresses) {
      obj.erc20addresses = message.erc20addresses.map(e => e);
    } else {
      obj.erc20addresses = message.erc20addresses;
    }
    return obj;
  },
  fromAminoMsg(object: MsgRegisterERC20AminoMsg): MsgRegisterERC20 {
    return MsgRegisterERC20.fromAmino(object.value);
  },
  toAminoMsg(message: MsgRegisterERC20, useInterfaces: boolean = false): MsgRegisterERC20AminoMsg {
    return {
      type: "cosmos/evm/x/erc20/MsgRegisterERC20",
      value: MsgRegisterERC20.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgRegisterERC20ProtoMsg, useInterfaces: boolean = false): MsgRegisterERC20 {
    return MsgRegisterERC20.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRegisterERC20): Uint8Array {
    return MsgRegisterERC20.encode(message).finish();
  },
  toProtoMsg(message: MsgRegisterERC20): MsgRegisterERC20ProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgRegisterERC20",
      value: MsgRegisterERC20.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgRegisterERC20Response(): MsgRegisterERC20Response {
  return {};
}
/**
 * MsgRegisterERC20Response defines the response structure for executing a
 * MsgRegisterERC20 message.
 * @name MsgRegisterERC20Response
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgRegisterERC20Response
 */
export const MsgRegisterERC20Response = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgRegisterERC20Response",
  aminoType: "cosmos-sdk/MsgRegisterERC20Response",
  is(o: any): o is MsgRegisterERC20Response {
    return o && o.$typeUrl === MsgRegisterERC20Response.typeUrl;
  },
  isSDK(o: any): o is MsgRegisterERC20ResponseSDKType {
    return o && o.$typeUrl === MsgRegisterERC20Response.typeUrl;
  },
  isAmino(o: any): o is MsgRegisterERC20ResponseAmino {
    return o && o.$typeUrl === MsgRegisterERC20Response.typeUrl;
  },
  encode(_: MsgRegisterERC20Response, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgRegisterERC20Response {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgRegisterERC20Response();
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
  fromPartial(_: Partial<MsgRegisterERC20Response>): MsgRegisterERC20Response {
    const message = createBaseMsgRegisterERC20Response();
    return message;
  },
  fromAmino(_: MsgRegisterERC20ResponseAmino): MsgRegisterERC20Response {
    const message = createBaseMsgRegisterERC20Response();
    return message;
  },
  toAmino(_: MsgRegisterERC20Response, useInterfaces: boolean = false): MsgRegisterERC20ResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgRegisterERC20ResponseAminoMsg): MsgRegisterERC20Response {
    return MsgRegisterERC20Response.fromAmino(object.value);
  },
  toAminoMsg(message: MsgRegisterERC20Response, useInterfaces: boolean = false): MsgRegisterERC20ResponseAminoMsg {
    return {
      type: "cosmos-sdk/MsgRegisterERC20Response",
      value: MsgRegisterERC20Response.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgRegisterERC20ResponseProtoMsg, useInterfaces: boolean = false): MsgRegisterERC20Response {
    return MsgRegisterERC20Response.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgRegisterERC20Response): Uint8Array {
    return MsgRegisterERC20Response.encode(message).finish();
  },
  toProtoMsg(message: MsgRegisterERC20Response): MsgRegisterERC20ResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgRegisterERC20Response",
      value: MsgRegisterERC20Response.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgToggleConversion(): MsgToggleConversion {
  return {
    authority: "",
    token: ""
  };
}
/**
 * MsgToggleConversion is the Msg/MsgToggleConversion request type for toggling
 * an Erc20 contract conversion capability.
 * @name MsgToggleConversion
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversion
 */
export const MsgToggleConversion = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgToggleConversion",
  aminoType: "cosmos/evm/x/erc20/MsgToggleConversion",
  is(o: any): o is MsgToggleConversion {
    return o && (o.$typeUrl === MsgToggleConversion.typeUrl || typeof o.authority === "string" && typeof o.token === "string");
  },
  isSDK(o: any): o is MsgToggleConversionSDKType {
    return o && (o.$typeUrl === MsgToggleConversion.typeUrl || typeof o.authority === "string" && typeof o.token === "string");
  },
  isAmino(o: any): o is MsgToggleConversionAmino {
    return o && (o.$typeUrl === MsgToggleConversion.typeUrl || typeof o.authority === "string" && typeof o.token === "string");
  },
  encode(message: MsgToggleConversion, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.token !== "") {
      writer.uint32(18).string(message.token);
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgToggleConversion {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgToggleConversion();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.authority = reader.string();
          break;
        case 2:
          message.token = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgToggleConversion>): MsgToggleConversion {
    const message = createBaseMsgToggleConversion();
    message.authority = object.authority ?? "";
    message.token = object.token ?? "";
    return message;
  },
  fromAmino(object: MsgToggleConversionAmino): MsgToggleConversion {
    const message = createBaseMsgToggleConversion();
    if (object.authority !== undefined && object.authority !== null) {
      message.authority = object.authority;
    }
    if (object.token !== undefined && object.token !== null) {
      message.token = object.token;
    }
    return message;
  },
  toAmino(message: MsgToggleConversion, useInterfaces: boolean = false): MsgToggleConversionAmino {
    const obj: any = {};
    obj.authority = message.authority === "" ? undefined : message.authority;
    obj.token = message.token === "" ? undefined : message.token;
    return obj;
  },
  fromAminoMsg(object: MsgToggleConversionAminoMsg): MsgToggleConversion {
    return MsgToggleConversion.fromAmino(object.value);
  },
  toAminoMsg(message: MsgToggleConversion, useInterfaces: boolean = false): MsgToggleConversionAminoMsg {
    return {
      type: "cosmos/evm/x/erc20/MsgToggleConversion",
      value: MsgToggleConversion.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgToggleConversionProtoMsg, useInterfaces: boolean = false): MsgToggleConversion {
    return MsgToggleConversion.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgToggleConversion): Uint8Array {
    return MsgToggleConversion.encode(message).finish();
  },
  toProtoMsg(message: MsgToggleConversion): MsgToggleConversionProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgToggleConversion",
      value: MsgToggleConversion.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};
function createBaseMsgToggleConversionResponse(): MsgToggleConversionResponse {
  return {};
}
/**
 * MsgToggleConversionResponse defines the response structure for executing a
 * ToggleConversion message.
 * @name MsgToggleConversionResponse
 * @package cosmos.evm.erc20.v1
 * @see proto type: cosmos.evm.erc20.v1.MsgToggleConversionResponse
 */
export const MsgToggleConversionResponse = {
  typeUrl: "/cosmos.evm.erc20.v1.MsgToggleConversionResponse",
  aminoType: "cosmos-sdk/MsgToggleConversionResponse",
  is(o: any): o is MsgToggleConversionResponse {
    return o && o.$typeUrl === MsgToggleConversionResponse.typeUrl;
  },
  isSDK(o: any): o is MsgToggleConversionResponseSDKType {
    return o && o.$typeUrl === MsgToggleConversionResponse.typeUrl;
  },
  isAmino(o: any): o is MsgToggleConversionResponseAmino {
    return o && o.$typeUrl === MsgToggleConversionResponse.typeUrl;
  },
  encode(_: MsgToggleConversionResponse, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): MsgToggleConversionResponse {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgToggleConversionResponse();
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
  fromPartial(_: Partial<MsgToggleConversionResponse>): MsgToggleConversionResponse {
    const message = createBaseMsgToggleConversionResponse();
    return message;
  },
  fromAmino(_: MsgToggleConversionResponseAmino): MsgToggleConversionResponse {
    const message = createBaseMsgToggleConversionResponse();
    return message;
  },
  toAmino(_: MsgToggleConversionResponse, useInterfaces: boolean = false): MsgToggleConversionResponseAmino {
    const obj: any = {};
    return obj;
  },
  fromAminoMsg(object: MsgToggleConversionResponseAminoMsg): MsgToggleConversionResponse {
    return MsgToggleConversionResponse.fromAmino(object.value);
  },
  toAminoMsg(message: MsgToggleConversionResponse, useInterfaces: boolean = false): MsgToggleConversionResponseAminoMsg {
    return {
      type: "cosmos-sdk/MsgToggleConversionResponse",
      value: MsgToggleConversionResponse.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: MsgToggleConversionResponseProtoMsg, useInterfaces: boolean = false): MsgToggleConversionResponse {
    return MsgToggleConversionResponse.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: MsgToggleConversionResponse): Uint8Array {
    return MsgToggleConversionResponse.encode(message).finish();
  },
  toProtoMsg(message: MsgToggleConversionResponse): MsgToggleConversionResponseProtoMsg {
    return {
      typeUrl: "/cosmos.evm.erc20.v1.MsgToggleConversionResponse",
      value: MsgToggleConversionResponse.encode(message).finish()
    };
  },
  registerTypeUrl() {}
};