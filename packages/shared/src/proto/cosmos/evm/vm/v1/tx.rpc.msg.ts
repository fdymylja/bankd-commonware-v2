import { TxRpc } from "../../../../types";
import { BinaryReader } from "../../../../binary";
import { MsgEthereumTx, MsgEthereumTxResponse, MsgUpdateParams, MsgUpdateParamsResponse, MsgRegisterPreinstalls, MsgRegisterPreinstallsResponse } from "./tx";
/** Msg defines the evm Msg service. */
export interface Msg {
  /** EthereumTx defines a method submitting Ethereum transactions. */
  ethereumTx(request: MsgEthereumTx): Promise<MsgEthereumTxResponse>;
  /**
   * UpdateParams defined a governance operation for updating the x/vm module
   * parameters. The authority is hard-coded to the Cosmos SDK x/gov module
   * account
   */
  updateParams(request: MsgUpdateParams): Promise<MsgUpdateParamsResponse>;
  /**
   * RegisterPreinstalls defines a governance operation for directly registering
   * preinstalled contracts in the EVM. The authority is the same as is used for
   * Params updates.
   */
  registerPreinstalls(request: MsgRegisterPreinstalls): Promise<MsgRegisterPreinstallsResponse>;
}
export class MsgClientImpl implements Msg {
  private readonly rpc: TxRpc;
  constructor(rpc: TxRpc) {
    this.rpc = rpc;
    this.ethereumTx = this.ethereumTx.bind(this);
    this.updateParams = this.updateParams.bind(this);
    this.registerPreinstalls = this.registerPreinstalls.bind(this);
  }
  ethereumTx(request: MsgEthereumTx, useInterfaces: boolean = true): Promise<MsgEthereumTxResponse> {
    const data = MsgEthereumTx.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Msg", "EthereumTx", data);
    return promise.then(data => MsgEthereumTxResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  updateParams(request: MsgUpdateParams, useInterfaces: boolean = true): Promise<MsgUpdateParamsResponse> {
    const data = MsgUpdateParams.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Msg", "UpdateParams", data);
    return promise.then(data => MsgUpdateParamsResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  registerPreinstalls(request: MsgRegisterPreinstalls, useInterfaces: boolean = true): Promise<MsgRegisterPreinstallsResponse> {
    const data = MsgRegisterPreinstalls.encode(request).finish();
    const promise = this.rpc.request("cosmos.evm.vm.v1.Msg", "RegisterPreinstalls", data);
    return promise.then(data => MsgRegisterPreinstallsResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
}
export const createClientImpl = (rpc: TxRpc) => {
  return new MsgClientImpl(rpc);
};