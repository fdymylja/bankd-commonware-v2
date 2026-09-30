'use client'

import dynamic from 'next/dynamic'

export const BankNetworkGraphClient = dynamic(
  () =>
    import('./BankNetworkGraph').then(
      (mod) => mod.BankNetworkGraph
    ),
  {
    ssr: false,
    loading: () => <div>Loading network graph...</div>,
  }
)
