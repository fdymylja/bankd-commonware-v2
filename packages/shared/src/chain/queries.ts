import { decodeAbiParameters, parseAbiParameters, type Hex } from 'viem'
import {
  AUTHORITY_ABI,
  AUTHORITY_ADDRESS,
  IBC_ADAPTER_ADDRESS,
  IBC_ROUTER_ADDRESS,
  IBC_ROUTER_ABI,
  IBC_LIGHT_CLIENT_ABI,
  IBC_ADAPTER_ABI,
  NATIVE_ABI,
  NATIVE_ADDRESS,
  VALIDATOR_ABI,
  VALIDATOR_ADDRESS,
} from '../evm/bankd'
import { chainConfig } from '../config'
import { evmAddress, getPublicClient } from './client'
export type TokenBalance = {
  name: string
  symbol: string
  decimals: number
  denom: string
  amount: string
  erc20Address?: string | null
}
export async function getBalances(address: string): Promise<TokenBalance[]> {
  const amount = await getPublicClient().getBalance({
    address: evmAddress(address),
  })
  return [
    {
      name: 'Brazilian Real',
      symbol: 'BRL',
      decimals: 18,
      denom: 'abrl',
      amount: amount.toString(),
      erc20Address: null,
    },
  ]
}
export async function getLatestBlockHeight() {
  return Number(await getPublicClient().getBlockNumber())
}
export async function isChainReachable() {
  try {
    return (await getPublicClient().getChainId()) === chainConfig.evmChainId
  } catch {
    return false
  }
}
export async function getValidators() {
  return getPublicClient().readContract({
    address: VALIDATOR_ADDRESS,
    abi: VALIDATOR_ABI,
    functionName: 'getActiveValidators',
  })
}
export async function getNativeParams() {
  const client = getPublicClient()
  const adminAddress = await client.readContract({
    address: AUTHORITY_ADDRESS,
    abi: AUTHORITY_ABI,
    functionName: 'owner',
  })
  const logs = await client.getContractEvents({
    address: NATIVE_ADDRESS,
    abi: NATIVE_ABI,
    eventName: 'NativeSetMinter',
    fromBlock: 0n,
    toBlock: 'latest',
  })
  const candidates = new Set<string>([
    IBC_ADAPTER_ADDRESS,
    ...logs.map((log) => log.args.minter!).filter(Boolean),
  ])
  const whitelistedMinters = (
    await Promise.all(
      [...candidates].map(async (address) =>
        (await client.readContract({
          address: NATIVE_ADDRESS,
          abi: NATIVE_ABI,
          functionName: 'isMinter',
          args: [evmAddress(address)],
        }))
          ? address
          : null
      )
    )
  ).filter((address): address is string => address !== null)
  return { adminAddress, whitelistedMinters }
}
export async function getPoaParams() {
  // ValidatorConfigV2 has its own owner in this base; Authority rotation does not update it.
  const admin = await getPublicClient().readContract({
    address: VALIDATOR_ADDRESS,
    abi: VALIDATOR_ABI,
    functionName: 'owner',
  })
  return { admin }
}
export async function getTotalSupply(): Promise<
  { denom: string; amount: string }[]
> {
  throw new Error(
    'Native supply requires a genesis allocation baseline; eth_getBalance only returns account balances.'
  )
}
export async function getTxByEthereumHash(hash: Hex) {
  return getPublicClient().getTransactionReceipt({ hash })
}
export const getTxByCosmosHash = (hash: string) =>
  getTxByEthereumHash(hash as Hex)

export type IBCClient = {
  clientId: string
  counterpartyClientId: string
  address: Hex
  status: 'Active' | 'Frozen' | 'Unknown'
  height: bigint | null
  escrowed: bigint
}
export async function getIBCClients(): Promise<IBCClient[]> {
  const client = getPublicClient()
  const code = await client.getCode({ address: IBC_ROUTER_ADDRESS })
  if (!code || code === '0x') return []
  const logs = await client.getContractEvents({
    address: IBC_ROUTER_ADDRESS,
    abi: IBC_ROUTER_ABI,
    eventName: 'ICS02ClientAdded',
    fromBlock: 0n,
    toBlock: 'latest',
  })
  return Promise.all(
    [...new Set(logs.map((log) => log.args.clientId!).filter(Boolean))].map(
      async (clientId) => {
        const [address, counterparty, escrowed] = await Promise.all([
          client.readContract({
            address: IBC_ROUTER_ADDRESS,
            abi: IBC_ROUTER_ABI,
            functionName: 'getClient',
            args: [clientId],
          }),
          client.readContract({
            address: IBC_ROUTER_ADDRESS,
            abi: IBC_ROUTER_ABI,
            functionName: 'getCounterparty',
            args: [clientId],
          }),
          client.readContract({
            address: IBC_ADAPTER_ADDRESS,
            abi: IBC_ADAPTER_ABI,
            functionName: 'escrowed',
            args: [clientId],
          }),
        ])
        let status: IBCClient['status'] = 'Unknown'
        let height: bigint | null = null
        try {
          const encoded = await client.readContract({
            address,
            abi: IBC_LIGHT_CLIENT_ABI,
            functionName: 'getClientState',
          })
          const [state] = decodeAbiParameters(
            parseAbiParameters(
              '(address ibcRouter, (uint64 revisionNumber, uint64 revisionHeight) latestHeight, uint64 epochLength, bool frozen)'
            ),
            encoded
          )
          status = state.frozen ? 'Frozen' : 'Active'
          height = state.latestHeight.revisionHeight
        } catch {
          /* Non-Commonware client state formats are displayed as unknown. */
        }
        return {
          clientId,
          counterpartyClientId: counterparty.clientId,
          address,
          status,
          height,
          escrowed,
        }
      }
    )
  )
}
// Retained row shape for existing route selectors; the identifiers are IBC v2 clients.
export type ChannelWithClientStatus = {
  channelId: string
  portId: string
  clientId: string
  clientStatus: IBCClient['status']
  state: number
  counterparty: { channelId: string; portId: string }
  connectionHops: string[]
  version: string
}
export async function getIBCChannels(): Promise<ChannelWithClientStatus[]> {
  return (await getIBCClients()).map((route) => ({
    channelId: route.clientId,
    clientId: route.clientId,
    portId: 'transfer',
    clientStatus: route.status,
    state: route.status === 'Active' ? 3 : 1,
    counterparty: { channelId: route.counterpartyClientId, portId: 'transfer' },
    connectionHops: [],
    version: 'ics20-1',
  }))
}
