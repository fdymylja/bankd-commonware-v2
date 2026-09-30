import { EncodeObject, Registry } from '@cosmjs/proto-signing'
import {
  AminoTypes,
  DeliverTxResponse,
  StargateClient,
  createDefaultAminoConverters,
  defaultRegistryTypes,
} from '@cosmjs/stargate'

import { chainConfig } from '../config'
import { cosmos } from '../proto/cosmos/bundle'
import { ibc } from '../proto/ibc/bundle'
import { mizufinance } from '../proto/mizufinance/bundle'

import { AminoConverter as ibcTransferAminoConverter } from '../proto/ibc/applications/transfer/v1/tx.amino'
import { registry as ibcTransferRegistry } from '../proto/ibc/applications/transfer/v1/tx.registry'
import { AminoConverter as mizufinanceNativeAminoConverter } from '../proto/mizufinance/native/v1/tx.amino'
import { registry as mizufinanceNativeRegistry } from '../proto/mizufinance/native/v1/tx.registry'
import { AminoConverter as mizufinancePoaAminoConverter } from '../proto/mizufinance/poa/v1/tx.amino'
import { registry as mizufinancePoaRegistry } from '../proto/mizufinance/poa/v1/tx.registry'

const makeCachedClientConnector = <T>(
  connect: (rpc?: string) => Promise<T>
) => {
  const cache = new Map<string, T>()
  return async (rpc: string = chainConfig.rpc) => {
    const cached = cache.get(rpc)
    if (cached) {
      return cached
    }
    const client = await connect(rpc)
    cache.set(rpc, client)
    return client
  }
}

const makeProtoRpcClientRouter = <T, K extends keyof T>(
  protoBundle: {
    ClientFactory: {
    createRPCQueryClient: ({
        rpcEndpoint,
      }: {
        rpcEndpoint: string
      }) => Promise<T>
    }
  },
  key: K
) =>
  makeCachedClientConnector(
    async (rpcEndpoint: string = chainConfig.rpc) =>
      (
        await protoBundle.ClientFactory.createRPCQueryClient({
          rpcEndpoint,
        })
      )[key]
  )

export const getStargateClient = makeCachedClientConnector(
  (rpc: string = chainConfig.rpc) => StargateClient.connect(rpc)
)

export const getCosmosClient = makeProtoRpcClientRouter(
  cosmos,
  'cosmos'
)

export const getIbcClient = makeProtoRpcClientRouter(
  ibc,
  'ibc'
)

export const getMizufinanceClient = makeProtoRpcClientRouter(
  mizufinance,
  'mizufinance'
)

export const getRegistry = () => new Registry([
  ...defaultRegistryTypes,
  ...mizufinanceNativeRegistry,
  ...mizufinancePoaRegistry,
  ...ibcTransferRegistry
])

export const getAminoTypes = () => new AminoTypes({
  ...createDefaultAminoConverters(),
  ...mizufinanceNativeAminoConverter,
  ...mizufinancePoaAminoConverter,
  ...ibcTransferAminoConverter
})

// Convenience function to sign and broadcast with current wallet
// @deprecated Use EVM precompile functions instead
export async function executeTransaction(
  _messages: EncodeObject[],
  _memo: string = ''
): Promise<DeliverTxResponse> {
  throw new Error("Don't use this anymore. Switch to EVM TXs.")
}
