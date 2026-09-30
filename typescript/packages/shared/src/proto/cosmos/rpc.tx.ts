import { Rpc } from "../helpers";
export const createRPCMsgClient = async ({
  rpc
}: {
  rpc: Rpc;
}) => ({
  cosmos: {
    bank: {
      v1beta1: new (await import("./bank/v1beta1/tx.rpc.msg")).MsgClientImpl(rpc)
    },
    evm: {
      erc20: {
        v1: new (await import("./evm/erc20/v1/tx.rpc.msg")).MsgClientImpl(rpc)
      },
      vm: {
        v1: new (await import("./evm/vm/v1/tx.rpc.msg")).MsgClientImpl(rpc)
      }
    },
    staking: {
      v1beta1: new (await import("./staking/v1beta1/tx.rpc.msg")).MsgClientImpl(rpc)
    }
  }
});