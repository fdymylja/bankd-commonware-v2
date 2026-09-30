import { TxRpc } from "../../../types";
import { BinaryReader } from "../../../binary";
import { MsgAddValidator, MsgAddValidatorResponse, MsgAddWhitelist, MsgAddWhitelistResponse, MsgRemoveWhitelist, MsgRemoveWhitelistResponse, MsgRemoveValidator, MsgRemoveValidatorResponse, MsgUpdateValidatorWeight, MsgUpdateValidatorWeightResponse, MsgUpdateParams, MsgUpdateParamsResponse } from "./tx";
/** Msg defines the poa Msg service. */
export interface Msg {
  /** AddValidator creates a new validator with authority-minted tokens. */
  addValidator(request: MsgAddValidator): Promise<MsgAddValidatorResponse>;
  /** AddWhitelist adds an address to the validator whitelist. */
  addWhitelist(request: MsgAddWhitelist): Promise<MsgAddWhitelistResponse>;
  /** RemoveWhitelist removes an address from the validator whitelist. */
  removeWhitelist(request: MsgRemoveWhitelist): Promise<MsgRemoveWhitelistResponse>;
  /** RemoveValidator evicts a validator from the active set. */
  removeValidator(request: MsgRemoveValidator): Promise<MsgRemoveValidatorResponse>;
  /** UpdateValidatorWeight sets a validator's power to an exact value. */
  updateValidatorWeight(request: MsgUpdateValidatorWeight): Promise<MsgUpdateValidatorWeightResponse>;
  /** UpdateParams updates the module parameters. */
  updateParams(request: MsgUpdateParams): Promise<MsgUpdateParamsResponse>;
}
export class MsgClientImpl implements Msg {
  private readonly rpc: TxRpc;
  constructor(rpc: TxRpc) {
    this.rpc = rpc;
    this.addValidator = this.addValidator.bind(this);
    this.addWhitelist = this.addWhitelist.bind(this);
    this.removeWhitelist = this.removeWhitelist.bind(this);
    this.removeValidator = this.removeValidator.bind(this);
    this.updateValidatorWeight = this.updateValidatorWeight.bind(this);
    this.updateParams = this.updateParams.bind(this);
  }
  addValidator(request: MsgAddValidator, useInterfaces: boolean = true): Promise<MsgAddValidatorResponse> {
    const data = MsgAddValidator.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Msg", "AddValidator", data);
    return promise.then(data => MsgAddValidatorResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  addWhitelist(request: MsgAddWhitelist, useInterfaces: boolean = true): Promise<MsgAddWhitelistResponse> {
    const data = MsgAddWhitelist.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Msg", "AddWhitelist", data);
    return promise.then(data => MsgAddWhitelistResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  removeWhitelist(request: MsgRemoveWhitelist, useInterfaces: boolean = true): Promise<MsgRemoveWhitelistResponse> {
    const data = MsgRemoveWhitelist.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Msg", "RemoveWhitelist", data);
    return promise.then(data => MsgRemoveWhitelistResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  removeValidator(request: MsgRemoveValidator, useInterfaces: boolean = true): Promise<MsgRemoveValidatorResponse> {
    const data = MsgRemoveValidator.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Msg", "RemoveValidator", data);
    return promise.then(data => MsgRemoveValidatorResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  updateValidatorWeight(request: MsgUpdateValidatorWeight, useInterfaces: boolean = true): Promise<MsgUpdateValidatorWeightResponse> {
    const data = MsgUpdateValidatorWeight.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Msg", "UpdateValidatorWeight", data);
    return promise.then(data => MsgUpdateValidatorWeightResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
  updateParams(request: MsgUpdateParams, useInterfaces: boolean = true): Promise<MsgUpdateParamsResponse> {
    const data = MsgUpdateParams.encode(request).finish();
    const promise = this.rpc.request("mizufinance.poa.v1.Msg", "UpdateParams", data);
    return promise.then(data => MsgUpdateParamsResponse.decode(new BinaryReader(data), undefined, useInterfaces));
  }
}
export const createClientImpl = (rpc: TxRpc) => {
  return new MsgClientImpl(rpc);
};