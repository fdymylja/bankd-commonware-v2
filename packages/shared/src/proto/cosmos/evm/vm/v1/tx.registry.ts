//@ts-nocheck
import { TelescopeGeneratedType } from "../../../../types";
import { MsgEthereumTx, MsgUpdateParams, MsgRegisterPreinstalls } from "./tx";
export const registry: ReadonlyArray<[string, TelescopeGeneratedType<any, any, any>]> = [["/cosmos.evm.vm.v1.MsgEthereumTx", MsgEthereumTx], ["/cosmos.evm.vm.v1.MsgUpdateParams", MsgUpdateParams], ["/cosmos.evm.vm.v1.MsgRegisterPreinstalls", MsgRegisterPreinstalls]];
export const MessageComposer = {
  encoded: {
    ethereumTx(value: MsgEthereumTx) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTx",
        value: MsgEthereumTx.encode(value).finish()
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParams",
        value: MsgUpdateParams.encode(value).finish()
      };
    },
    registerPreinstalls(value: MsgRegisterPreinstalls) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstalls",
        value: MsgRegisterPreinstalls.encode(value).finish()
      };
    }
  },
  withTypeUrl: {
    ethereumTx(value: MsgEthereumTx) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTx",
        value
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParams",
        value
      };
    },
    registerPreinstalls(value: MsgRegisterPreinstalls) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstalls",
        value
      };
    }
  },
  fromPartial: {
    ethereumTx(value: MsgEthereumTx) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgEthereumTx",
        value: MsgEthereumTx.fromPartial(value)
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgUpdateParams",
        value: MsgUpdateParams.fromPartial(value)
      };
    },
    registerPreinstalls(value: MsgRegisterPreinstalls) {
      return {
        typeUrl: "/cosmos.evm.vm.v1.MsgRegisterPreinstalls",
        value: MsgRegisterPreinstalls.fromPartial(value)
      };
    }
  }
};