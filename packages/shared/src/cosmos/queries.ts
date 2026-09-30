import { IndexedTx } from '@cosmjs/stargate'
import { Contract } from 'ethers'
import { Hex } from 'viem'

import {
  getCosmosClient,
  getIbcClient,
  getMizufinanceClient,
  getStargateClient,
} from './client'
import { chainConfig } from '../config'
import { MOCK_ERC20_ABI, getProvider } from '../evm'
import { IdentifiedChannel } from '../proto/ibc/core/channel/v1/channel'

export type TokenBalance = {
  /* The name of the token */
  name: string
  /* The symbol of the token */
  symbol: string
  /* The number of decimals of the token */
  decimals: number
  /* The chain denom of the token */
  denom: string
  /* The amount of the token */
  amount: string
  /* If the denom is an ERC20 token, this will be the address of the token */
  erc20Address?: string | null
}

// Query functions using StargateClient
export async function getBalances(address: string): Promise<TokenBalance[]> {
  const [client, sdkClient] = await Promise.all([
    getStargateClient(),
    getCosmosClient(),
  ])
  const balances = await client.getAllBalances(address)
  const balanceMetadata = await Promise.all(
    balances.map(async (balance) => {
      const metadata = await sdkClient.bank.v1beta1
        .denomMetadata({ denom: balance.denom })
        .then((res) => res.metadata)
        .catch(() => null)
      return {
        ...balance,
        metadata,
      }
    })
  )

  const tokenBalances: TokenBalance[] = []
  for (const { denom, amount, metadata } of balanceMetadata) {
    if (denom.startsWith('erc20:')) {
      const erc20Address = denom.slice(6)
      const erc20Contract = new Contract(
        erc20Address,
        MOCK_ERC20_ABI,
        getProvider()
      )
      const [name, symbol, decimals] = await Promise.all([
        erc20Contract.name(),
        erc20Contract.symbol(),
        erc20Contract.decimals(),
      ])
      tokenBalances.push({
        denom,
        amount,
        name,
        symbol,
        decimals: Number(decimals),
        erc20Address,
      })
    } else {
      const decimals =
        metadata?.denomUnits?.find((unit) => unit.exponent !== 0)
          ?.exponent || chainConfig.decimals
      tokenBalances.push({
        denom,
        amount,
        name: metadata?.name || denom,
        symbol: metadata?.symbol || denom,
        decimals,
        erc20Address: null,
      })
    }
  }
  return tokenBalances
}

export async function getTotalSupply() {
  const client = await getCosmosClient()
  const { supply } = await client.bank.v1beta1.totalSupply()
  return supply
}

export async function getLatestBlockHeight(): Promise<number> {
  const client = await getStargateClient()
  return client.getHeight()
}

export async function isChainReachable(): Promise<boolean> {
  try {
    const client = await getStargateClient()
    await client.getHeight()
    return true
  } catch {
    return false
  }
}

// Queries that require REST (not available in StargateClient)
export async function getValidators() {
  const client = await getCosmosClient()
  const { validators } = await client.staking.v1beta1.validators({
    status: 'BOND_STATUS_BONDED',
  })
  return validators
}

export async function getNativeParams() {
  const client = await getMizufinanceClient()
  const { params } = await client.native.v1.params()
  return params
}

export async function getPoaParams() {
  const client = await getMizufinanceClient()
  const { params } = await client.poa.v1.params()
  return params
}

export type ChannelWithClientStatus = IdentifiedChannel & {
  clientId?: string
  clientStatus?: 'Active' | 'Expired' | 'Frozen' | 'Unknown'
}

async function getClientStatus(
  clientId: string
): Promise<'Active' | 'Expired' | 'Frozen' | 'Unknown'> {
  try {
    const response = await fetch(
      `${chainConfig.rest}/ibc/core/client/v1/client_status/${clientId}`
    )
    if (!response.ok) {
      return 'Unknown'
    }
    const data = (await response.json()) as { status?: 'Active' | 'Expired' | 'Frozen' | 'Unknown' }
    return data.status || 'Unknown'
  } catch {
    return 'Unknown'
  }
}

export async function getIBCChannels(): Promise<ChannelWithClientStatus[]> {
  const client = await getIbcClient()
  const { channels } = await client.core.channel.v1.channels()

  // Fetch client status for each channel
  const channelsWithStatus = await Promise.all(
    channels.map(async (channel): Promise<ChannelWithClientStatus> => {
      try {
        // Get the client state for this channel
        const clientStateResponse =
          await client.core.channel.v1.channelClientState({
            portId: channel.portId,
            channelId: channel.channelId,
          })
        const clientId = clientStateResponse.identifiedClientState?.clientId
        if (clientId) {
          const clientStatus = await getClientStatus(clientId)
          return { ...channel, clientId, clientStatus }
        }
      } catch {
        // If we can't get client state, just return the channel without status
      }
      return { ...channel, clientStatus: 'Unknown' }
    })
  )

  return channelsWithStatus
}

export async function getTxByEthereumHash(
  hash: Hex
): Promise<IndexedTx | null> {
  const client = await getStargateClient()
  return (
    (await client.searchTx(`ethereum_tx.ethereumTxHash='${hash}'`))[0] ?? null
  )
}

export async function getTxByCosmosHash(
  hash: string
): Promise<IndexedTx | null> {
  const client = await getStargateClient()
  return await client.getTx(hash)
}
