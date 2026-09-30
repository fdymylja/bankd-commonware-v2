import { TxRpc } from "../../../../types";
import { BinaryReader } from "../../../../binary";
import { MsgConvertERC20, MsgConvertERC20Response, MsgConvertCoin, MsgConvertCoinResponse, MsgUpdateParams, MsgUpdateParamsResponse, MsgRegisterERC20, MsgRegisterERC20Response, MsgToggleConversion, MsgToggleConversionResponse } from "./tx";
/** Msg defines the erc20 Msg service. */
export interface Msg {
  /**
   * ConvertERC20 mints a native Cosmos coin representation of the ERC20 token
   * contract that is registered on the token mapping.
   */
  convertERC20(request: MsgConvertERC20): Promise<MsgConvertERC20Response>;
  /**
   * ConvertCoin mints a ERC20 token representation of the native Cosmos coin
   * that is registered on the token mapping.
   */
  convertCoin(request: MsgConvertCoin): Promise<MsgConvertCoinResponse>;
  /**
   * UpdateParams defines a governance operation for updating the x/erc20 module
   * parameters. The authority is hard-coded to the Cosmos SDK x/gov module
   * account
   */
  updateParams(request: MsgUpdateParams): Promise<MsgUpdateParamsResponse>;
  /**
   * RegisterERC20 defines a governance operation for registering a token pair
   * for the specified erc20 contract. The authority is hard-coded to the Cosmos
   * SDK x/gov module account
   */
  registerERC20(request: MsgRegisterERC20): Promise<MsgRegisterERC20Response>;
  /**
   * ToggleConversion defines a governance operation for enabling/disabling a
   * token pair conversion. The authority is hard-coded to the Cosmos SDK x/gov
   * module account
   */
  toggleConversion(request: MsgToggleConversion): Promise<MsgToggleConversionResponse>;
}
export class MsgClientImpl implements Msg {
  private readonly rpc: TxRpc;
  constructor(rpc: TxRpc) {
    this.rpc = rpc;
    this.convertERC20 = this.convertERC20.bind(this);
    this.convertCoin = this.convertCoin.bind(this);
    this.updateParams = this.updateParams.bind(this);
    this.registerERC20 = this.registerERC20.bind(this);
    this.toggleConversion = this.toggleConversion.bind(this);
  }
  convertERC20(request: MsgConvertERC20, useInterfaces: boolean = true): Promise<MsgConvertERC20Response> {
    const data = MsgConvertERC20.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.erc20.v1.Msg", "ConvertERC20", data);
    return promise.then(data => MsgConvertERC20Response.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  convertCoin(request: MsgConvertCoin, useInterfaces: boolean = true): Promise<MsgConvertCoinResponse> {
    const data = MsgConvertCoin.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.erc20.v1.Msg", "ConvertCoin", data);
    return promise.then(data => MsgConvertCoinResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  updateParams(request: MsgUpdateParams, useInterfaces: boolean = true): Promise<MsgUpdateParamsResponse> {
    const data = MsgUpdateParams.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.erc20.v1.Msg", "UpdateParams", data);
    return promise.then(data => MsgUpdateParamsResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  registerERC20(request: MsgRegisterERC20, useInterfaces: boolean = true): Promise<MsgRegisterERC20Response> {
    const data = MsgRegisterERC20.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.erc20.v1.Msg", "RegisterERC20", data);
    return promise.then(data => MsgRegisterERC20Response.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  toggleConversion(request: MsgToggleConversion, useInterfaces: boolean = true): Promise<MsgToggleConversionResponse> {
    const data = MsgToggleConversion.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.erc20.v1.Msg", "ToggleConversion", data);
    return promise.then(data => MsgToggleConversionResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
}
export const createClientImpl = (rpc: TxRpc) => {
  return new MsgClientImpl(rpc);
};