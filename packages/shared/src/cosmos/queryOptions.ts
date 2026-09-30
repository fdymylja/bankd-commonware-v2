import { queryOptions } from '@tanstack/react-query'
import { Hex } from 'viem'

import {
  getBalances,
  getIBCChannels,
  getLatestBlockHeight,
  getNativeParams,
  getPoaParams,
  getTotalSupply,
  getTxByCosmosHash,
  getTxByEthereumHash,
  getValidators,
  isChainReachable,
} from './queries'
import { queryKeys } from './queryKeys'

// Query options factories
export const queries = {
  network: {
    status: () =>
      queryOptions({
        queryKey: queryKeys.network.status(),
        queryFn: isChainReachable,
        staleTime: 5 * 1000,
        refetchInterval: 10 * 1000,
      }),
    blockHeight: () =>
      queryOptions({
        queryKey: queryKeys.network.blockHeight(),
        queryFn: getLatestBlockHeight,
        staleTime: 2 * 1000,
        refetchInterval: 5 * 1000,
      }),
  },

  balances: {
    byAddress: (address: string) =>
      queryOptions({
        queryKey: queryKeys.balances.byAddress(address),
        queryFn: () => getBalances(address),
        staleTime: 10 * 1000,
        enabled: !!address,
      }),
  },

  supply: {
    total: () =>
      queryOptions({
        queryKey: queryKeys.supply.total(),
        queryFn: getTotalSupply,
        staleTime: 30 * 1000,
      }),
  },

  validators: {
    list: () =>
      queryOptions({
        queryKey: queryKeys.validators.list(),
        queryFn: getValidators,
        staleTime: 30 * 1000,
      }),
  },

  params: {
    native: () =>
      queryOptions({
        queryKey: queryKeys.params.native(),
        queryFn: getNativeParams,
        staleTime: 60 * 1000,
      }),
    poa: () =>
      queryOptions({
        queryKey: queryKeys.params.poa(),
        queryFn: getPoaParams,
        staleTime: 60 * 1000,
      }),
  },

  ibc: {
    channels: () =>
      queryOptions({
        queryKey: queryKeys.ibc.channels(),
        queryFn: getIBCChannels,
        staleTime: 30 * 1000,
      }),
  },

  tx: {
    byEthereumHash: (hash: Hex) =>
      queryOptions({
        queryKey: queryKeys.tx.byEthereumHash(hash),
        queryFn: () => getTxByEthereumHash(hash),
        staleTime: 30 * 1000,
      }),
    byCosmosHash: (hash: string) =>
      queryOptions({
        queryKey: queryKeys.tx.byCosmosHash(hash),
        queryFn: () => getTxByCosmosHash(hash),
        staleTime: 30 * 1000,
      }),
  },
} as const
