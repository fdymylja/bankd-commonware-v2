import { Rpc } from "../helpers";
export const createRPCMsgClient = async ({
  rpc
}: {
  rpc: Rpc;
}) => ({
  cosmos: {
    bank: {
      v1beta1: new (await import("../cosmos/bank/v1beta1/tx.rpc.msg")).MsgClientImpl(rpc)
    },
    evm: {
      erc20: {
        v1: new (await import("../cosmos/evm/erc20/v1/tx.rpc.msg")).MsgClientImpl(rpc)
      },
      vm: {
        v1: new (await import("../cosmos/evm/vm/v1/tx.rpc.msg")).MsgClientImpl(rpc)
      }
    },
    staking: {
      v1beta1: new (await import("../cosmos/staking/v1beta1/tx.rpc.msg")).MsgClientImpl(rpc)
    }
  },
  mizufinance: {
    native: {
      v1: new (await import("./native/v1/tx.rpc.msg")).MsgClientImpl(rpc)
    },
    poa: {
      v1: new (await import("./poa/v1/tx.rpc.msg")).MsgClientImpl(rpc)
    }
  }
});