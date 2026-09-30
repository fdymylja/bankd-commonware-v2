import { buildTx } from "../../../../helper-func-types";
import { MsgEthereumTx, MsgUpdateParams, MsgRegisterPreinstalls } from "./tx";
/**
 * EthereumTx defines a method submitting Ethereum transactions.
 * @name ethereumTx
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.EthereumTx
 */
export const ethereumTx = buildTx<MsgEthereumTx>({
  msg: MsgEthereumTx
});
/**
 * UpdateParams defined a governance operation for updating the x/vm module
 * parameters. The authority is hard-coded to the Cosmos SDK x/gov module
 * account
 * @name updateParams
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.UpdateParams
 */
export const updateParams = buildTx<MsgUpdateParams>({
  msg: MsgUpdateParams
});
/**
 * RegisterPreinstalls defines a governance operation for directly registering
 * preinstalled contracts in the EVM. The authority is the same as is used for
 * Params updates.
 * @name registerPreinstalls
 * @package cosmos.evm.vm.v1
 * @see proto service: cosmos.evm.vm.v1.RegisterPreinstalls
 */
export const registerPreinstalls = buildTx<MsgRegisterPreinstalls>({
  msg: MsgRegisterPreinstalls
});