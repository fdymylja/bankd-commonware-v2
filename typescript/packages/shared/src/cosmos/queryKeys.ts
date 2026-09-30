// Query key factory for type-safe, consistent query keys
export const queryKeys = {
  // Network queries
  network: {
    all: ['network'] as const,
    status: () => [...queryKeys.network.all, 'status'] as const,
    blockHeight: () => [...queryKeys.network.all, 'blockHeight'] as const,
  },

  // Balance queries
  balances: {
    all: ['balances'] as const,
    byAddress: (address: string) =>
      [...queryKeys.balances.all, address] as const,
  },

  // Supply queries
  supply: {
    all: ['supply'] as const,
    total: () => [...queryKeys.supply.all, 'total'] as const,
  },

  // Validator queries
  validators: {
    all: ['validators'] as const,
    list: () => [...queryKeys.validators.all, 'list'] as const,
  },

  // Module params queries
  params: {
    all: ['params'] as const,
    native: () => [...queryKeys.params.all, 'native'] as const,
    poa: () => [...queryKeys.params.all, 'poa'] as const,
  },

  // IBC queries
  ibc: {
    all: ['ibc'] as const,
    channels: () => [...queryKeys.ibc.all, 'channels'] as const,
  },

  // TX queries
  tx: {
    all: ['tx'] as const,
    byEthereumHash: (hash: string) => [...queryKeys.tx.all, 'ethereum', hash] as const,
    byCosmosHash: (hash: string) => [...queryKeys.tx.all, 'cosmos', hash] as const,
  },
} as const
