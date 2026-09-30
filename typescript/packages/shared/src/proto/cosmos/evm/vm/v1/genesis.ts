//@ts-nocheck
import { Params, ParamsAmino, ParamsSDKType, Preinstall, PreinstallAmino, PreinstallSDKType, State, StateAmino, StateSDKType } from "./evm";
import { BinaryReader, BinaryWriter } from "../../../../binary";
import { GlobalDecoderRegistry } from "../../../../registry";
/**
 * GenesisState defines the evm module's genesis state.
 * @name GenesisState
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisState
 */
export interface GenesisState {
  /**
   * accounts is an array containing the ethereum genesis accounts.
   */
  accounts: GenesisAccount[];
  /**
   * params defines all the parameters of the module.
   */
  params: Params | undefined;
  /**
   * preinstalls defines a set of predefined contracts
   */
  preinstalls: Preinstall[];
}
export interface GenesisStateProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.GenesisState";
  value: Uint8Array;
}
/**
 * GenesisState defines the evm module's genesis state.
 * @name GenesisStateAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisState
 */
export interface GenesisStateAmino {
  /**
   * accounts is an array containing the ethereum genesis accounts.
   */
  accounts: GenesisAccountAmino[];
  /**
   * params defines all the parameters of the module.
   */
  params: ParamsAmino | undefined;
  /**
   * preinstalls defines a set of predefined contracts
   */
  preinstalls: PreinstallAmino[];
}
export interface GenesisStateAminoMsg {
  type: "cosmos-sdk/GenesisState";
  value: GenesisStateAmino;
}
/**
 * GenesisState defines the evm module's genesis state.
 * @name GenesisStateSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisState
 */
export interface GenesisStateSDKType {
  accounts: GenesisAccountSDKType[];
  params: ParamsSDKType | undefined;
  preinstalls: PreinstallSDKType[];
}
/**
 * GenesisAccount defines an account to be initialized in the genesis state.
 * Its main difference between with Geth's GenesisAccount is that it uses a
 * custom storage type and that it doesn't contain the private key field.
 * @name GenesisAccount
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisAccount
 */
export interface GenesisAccount {
  /**
   * address defines an ethereum hex formated address of an account
   */
  address: string;
  /**
   * code defines the hex bytes of the account code.
   */
  code: string;
  /**
   * storage defines the set of state key values for the account.
   */
  storage: State[];
}
export interface GenesisAccountProtoMsg {
  typeUrl: "/cosmos.evm.vm.v1.GenesisAccount";
  value: Uint8Array;
}
/**
 * GenesisAccount defines an account to be initialized in the genesis state.
 * Its main difference between with Geth's GenesisAccount is that it uses a
 * custom storage type and that it doesn't contain the private key field.
 * @name GenesisAccountAmino
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisAccount
 */
export interface GenesisAccountAmino {
  /**
   * address defines an ethereum hex formated address of an account
   */
  address?: string;
  /**
   * code defines the hex bytes of the account code.
   */
  code?: string;
  /**
   * storage defines the set of state key values for the account.
   */
  storage: StateAmino[];
}
export interface GenesisAccountAminoMsg {
  type: "cosmos-sdk/GenesisAccount";
  value: GenesisAccountAmino;
}
/**
 * GenesisAccount defines an account to be initialized in the genesis state.
 * Its main difference between with Geth's GenesisAccount is that it uses a
 * custom storage type and that it doesn't contain the private key field.
 * @name GenesisAccountSDKType
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisAccount
 */
export interface GenesisAccountSDKType {
  address: string;
  code: string;
  storage: StateSDKType[];
}
function createBaseGenesisState(): GenesisState {
  return {
    accounts: [],
    params: Params.fromPartial({}),
    preinstalls: []
  };
}
/**
 * GenesisState defines the evm module's genesis state.
 * @name GenesisState
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisState
 */
export const GenesisState = {
  typeUrl: "/cosmos.evm.vm.v1.GenesisState",
  aminoType: "cosmos-sdk/GenesisState",
  is(o: any): o is GenesisState {
    return o && (o.$typeUrl === GenesisState.typeUrl || Array.isArray(o.accounts) && (!o.accounts.length || GenesisAccount.is(o.accounts[0])) && Params.is(o.params) && Array.isArray(o.preinstalls) && (!o.preinstalls.length || Preinstall.is(o.preinstalls[0])));
  },
  isSDK(o: any): o is GenesisStateSDKType {
    return o && (o.$typeUrl === GenesisState.typeUrl || Array.isArray(o.accounts) && (!o.accounts.length || GenesisAccount.isSDK(o.accounts[0])) && Params.isSDK(o.params) && Array.isArray(o.preinstalls) && (!o.preinstalls.length || Preinstall.isSDK(o.preinstalls[0])));
  },
  isAmino(o: any): o is GenesisStateAmino {
    return o && (o.$typeUrl === GenesisState.typeUrl || Array.isArray(o.accounts) && (!o.accounts.length || GenesisAccount.isAmino(o.accounts[0])) && Params.isAmino(o.params) && Array.isArray(o.preinstalls) && (!o.preinstalls.length || Preinstall.isAmino(o.preinstalls[0])));
  },
  encode(message: GenesisState, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    for (const v of message.accounts) {
      GenesisAccount.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(18).fork()).ldelim();
    }
    for (const v of message.preinstalls) {
      Preinstall.encode(v!, writer.uint32(26).fork()).ldelim();
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
          message.accounts.push(GenesisAccount.decode(reader, reader.uint32(), useInterfaces));
          break;
        case 2:
          message.params = Params.decode(reader, reader.uint32(), useInterfaces);
          break;
        case 3:
          message.preinstalls.push(Preinstall.decode(reader, reader.uint32(), useInterfaces));
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
    message.accounts = object.accounts?.map(e => GenesisAccount.fromPartial(e)) || [];
    message.params = object.params !== undefined && object.params !== null ? Params.fromPartial(object.params) : undefined;
    message.preinstalls = object.preinstalls?.map(e => Preinstall.fromPartial(e)) || [];
    return message;
  },
  fromAmino(object: GenesisStateAmino): GenesisState {
    const message = createBaseGenesisState();
    message.accounts = object.accounts?.map(e => GenesisAccount.fromAmino(e)) || [];
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromAmino(object.params);
    }
    message.preinstalls = object.preinstalls?.map(e => Preinstall.fromAmino(e)) || [];
    return message;
  },
  toAmino(message: GenesisState, useInterfaces: boolean = false): GenesisStateAmino {
    const obj: any = {};
    if (message.accounts) {
      obj.accounts = message.accounts.map(e => e ? GenesisAccount.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.accounts = message.accounts;
    }
    obj.params = message.params ? Params.toAmino(message.params, useInterfaces) : Params.toAmino(Params.fromPartial({}));
    if (message.preinstalls) {
      obj.preinstalls = message.preinstalls.map(e => e ? Preinstall.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.preinstalls = message.preinstalls;
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
      typeUrl: "/cosmos.evm.vm.v1.GenesisState",
      value: GenesisState.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(GenesisState.typeUrl)) {
      return;
    }
    GenesisAccount.registerTypeUrl();
    Params.registerTypeUrl();
    Preinstall.registerTypeUrl();
  }
};
function createBaseGenesisAccount(): GenesisAccount {
  return {
    address: "",
    code: "",
    storage: []
  };
}
/**
 * GenesisAccount defines an account to be initialized in the genesis state.
 * Its main difference between with Geth's GenesisAccount is that it uses a
 * custom storage type and that it doesn't contain the private key field.
 * @name GenesisAccount
 * @package cosmos.evm.vm.v1
 * @see proto type: cosmos.evm.vm.v1.GenesisAccount
 */
export const GenesisAccount = {
  typeUrl: "/cosmos.evm.vm.v1.GenesisAccount",
  aminoType: "cosmos-sdk/GenesisAccount",
  is(o: any): o is GenesisAccount {
    return o && (o.$typeUrl === GenesisAccount.typeUrl || typeof o.address === "string" && typeof o.code === "string" && Array.isArray(o.storage) && (!o.storage.length || State.is(o.storage[0])));
  },
  isSDK(o: any): o is GenesisAccountSDKType {
    return o && (o.$typeUrl === GenesisAccount.typeUrl || typeof o.address === "string" && typeof o.code === "string" && Array.isArray(o.storage) && (!o.storage.length || State.isSDK(o.storage[0])));
  },
  isAmino(o: any): o is GenesisAccountAmino {
    return o && (o.$typeUrl === GenesisAccount.typeUrl || typeof o.address === "string" && typeof o.code === "string" && Array.isArray(o.storage) && (!o.storage.length || State.isAmino(o.storage[0])));
  },
  encode(message: GenesisAccount, writer: BinaryWriter = BinaryWriter.create()): BinaryWriter {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.code !== "") {
      writer.uint32(18).string(message.code);
    }
    for (const v of message.storage) {
      State.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },
  decode(input: BinaryReader | Uint8Array, length?: number, useInterfaces: boolean = false): GenesisAccount {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGenesisAccount();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        case 2:
          message.code = reader.string();
          break;
        case 3:
          message.storage.push(State.decode(reader, reader.uint32(), useInterfaces));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<GenesisAccount>): GenesisAccount {
    const message = createBaseGenesisAccount();
    message.address = object.address ?? "";
    message.code = object.code ?? "";
    message.storage = object.storage?.map(e => State.fromPartial(e)) || [];
    return message;
  },
  fromAmino(object: GenesisAccountAmino): GenesisAccount {
    const message = createBaseGenesisAccount();
    if (object.address !== undefined && object.address !== null) {
      message.address = object.address;
    }
    if (object.code !== undefined && object.code !== null) {
      message.code = object.code;
    }
    message.storage = object.storage?.map(e => State.fromAmino(e)) || [];
    return message;
  },
  toAmino(message: GenesisAccount, useInterfaces: boolean = false): GenesisAccountAmino {
    const obj: any = {};
    obj.address = message.address === "" ? undefined : message.address;
    obj.code = message.code === "" ? undefined : message.code;
    if (message.storage) {
      obj.storage = message.storage.map(e => e ? State.toAmino(e, useInterfaces) : undefined);
    } else {
      obj.storage = message.storage;
    }
    return obj;
  },
  fromAminoMsg(object: GenesisAccountAminoMsg): GenesisAccount {
    return GenesisAccount.fromAmino(object.value);
  },
  toAminoMsg(message: GenesisAccount, useInterfaces: boolean = false): GenesisAccountAminoMsg {
    return {
      type: "cosmos-sdk/GenesisAccount",
      value: GenesisAccount.toAmino(message, useInterfaces)
    };
  },
  fromProtoMsg(message: GenesisAccountProtoMsg, useInterfaces: boolean = false): GenesisAccount {
    return GenesisAccount.decode(message.value, undefined, useInterfaces);
  },
  toProto(message: GenesisAccount): Uint8Array {
    return GenesisAccount.encode(message).finish();
  },
  toProtoMsg(message: GenesisAccount): GenesisAccountProtoMsg {
    return {
      typeUrl: "/cosmos.evm.vm.v1.GenesisAccount",
      value: GenesisAccount.encode(message).finish()
    };
  },
  registerTypeUrl() {
    if (!GlobalDecoderRegistry.registerExistingTypeUrl(GenesisAccount.typeUrl)) {
      return;
    }
    State.registerTypeUrl();
  }
};