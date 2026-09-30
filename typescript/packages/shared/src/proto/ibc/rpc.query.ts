import { connectComet, HttpEndpoint } from "@cosmjs/tendermint-rpc";
import { QueryClient } from "@cosmjs/stargate";
export const createRPCQueryClient = async ({
  rpcEndpoint
}: {
  rpcEndpoint: string | HttpEndpoint;
}) => {
  const tmClient = await connectComet(rpcEndpoint);
  const client = new QueryClient(tmClient);
  return {
    cosmos: {
      bank: {
        v1beta1: (await import("../cosmos/bank/v1beta1/query.rpc.Query")).createRpcQueryExtension(client)
      },
      evm: {
        erc20: {
          v1: (await import("../cosmos/evm/erc20/v1/query.rpc.Query")).createRpcQueryExtension(client)
        },
        vm: {
          v1: (await import("../cosmos/evm/vm/v1/query.rpc.Query")).createRpcQueryExtension(client)
        }
      },
      staking: {
        v1beta1: (await import("../cosmos/staking/v1beta1/query.rpc.Query")).createRpcQueryExtension(client)
      }
    },
    ibc: {
      applications: {
        transfer: {
          v1: (await import("./applications/transfer/v1/query.rpc.Query")).createRpcQueryExtension(client)
        }
      },
      core: {
        channel: {
          v1: (await import("./core/channel/v1/query.rpc.Query")).createRpcQueryExtension(client)
        }
      }
    }
  };
};