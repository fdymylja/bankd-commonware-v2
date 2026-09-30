import { createHash } from 'node:crypto'

import { fromHex, toBech32 } from '@cosmjs/encoding'

const DEFAULT_CHAIN_REST_URL = 'http://localhost:11317'
const DEFAULT_NATIVE_DENOM = 'ubrl'
const DEFAULT_BECH32_PREFIX = 'wallet'

type Coin = {
  denom: string
  amount: string
}

type IBCChannel = {
  state?: string
  ordering?: string
  counterparty?: {
    port_id?: string
    channel_id?: string
  }
  connection_hops?: string[]
  version?: string
  port_id?: string
  channel_id?: string
}

type ChannelsResponse = {
  channels?: IBCChannel[]
  height?: {
    revision_height?: string
  }
}

type SupplyResponse = {
  supply?: Coin[]
}

type BalancesResponse = {
  balances?: Coin[]
}

type CommitmentsResponse = {
  commitments?: unknown[]
}

type Bank = {
  bank_id: string
  bridge_address: string
  paused: boolean
}

type BankEntry = {
  bank: Bank
  bank_account: string
}

type BanksResponse = {
  banks?: BankEntry[]
}

type MinterAccount = {
  address: string
  minted_total: string
  burned_total: string
}

type MinterAccountsResponse = {
  minter_accounts?: MinterAccount[]
}

type BankView = {
  bankId: string
  bankAccount: string
  bridgeAddress: string
  paused: boolean
  balances: Coin[]
  nativeBalance: string
}

async function chainJSON<T>(path: string): Promise<T> {
  const restURL =
    process.env.BANKD_REST_URL ??
    process.env.NEXT_PUBLIC_REST_URL ??
    DEFAULT_CHAIN_REST_URL
  const response = await fetch(`${restURL}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
  })
  if (!response.ok) {
    throw new Error(`Bankd REST ${path} returned HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

function bech32Prefix() {
  return process.env.BANKD_BECH32_PREFIX ?? DEFAULT_BECH32_PREFIX
}

function escrowAddress(portID: string, channelID: string) {
  const preimage = Buffer.concat([
    Buffer.from('ics20-1', 'utf8'),
    Buffer.from([0]),
    Buffer.from(`${portID}/${channelID}`, 'utf8'),
  ])
  const address = createHash('sha256').update(preimage).digest().subarray(0, 20)
  return toBech32(bech32Prefix(), address)
}

// bankAccountBech32 converts a bank's 0x hex account (from the native registry)
// into the chain's bech32 form. Same raw 20 bytes as escrowAddress, just a
// different source. Accepts a leading 0x or a bare hex string.
export function bankAccountBech32(hex: string) {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  return toBech32(bech32Prefix(), fromHex(stripped))
}

type ReconcileInput = {
  minterAccounts: MinterAccount[]
  nativeSupplyAmount: string
  genesisBaseline: string | undefined
}

// reconcileReserves is the on-chain slice of RES-9's unbacked_supply_delta. It
// sums the tracked minter accounting (genesis-independent - AddMinted/AddBurned
// only fire on native precompile mint/burn) and adds a recorded genesis
// baseline. If every ubrl movement since genesis is explained by genesis + the
// native precompile, unbackedDelta is zero. This assumes ubrl supply only moves
// via genesis + the native precompile (PoA chain, no inflation mint); full RES-9
// backing-ratio still needs RES-5 attestations (deferred).
export function reconcileReserves({
  minterAccounts,
  nativeSupplyAmount,
  genesisBaseline,
}: ReconcileInput) {
  const mintedTotal = minterAccounts.reduce(
    (total, account) => total + BigInt(account.minted_total),
    0n
  )
  const burnedTotal = minterAccounts.reduce(
    (total, account) => total + BigInt(account.burned_total),
    0n
  )
  const netMinted = mintedTotal - burnedTotal
  const baselineConfigured = genesisBaseline !== undefined
  const baseline = baselineConfigured ? BigInt(genesisBaseline) : 0n
  const nativeSupply = BigInt(nativeSupplyAmount)
  const accountedSupply = baseline + netMinted
  const unbackedDelta = nativeSupply - accountedSupply
  return {
    mintedTotal: mintedTotal.toString(),
    burnedTotal: burnedTotal.toString(),
    netMinted: netMinted.toString(),
    genesisBaseline: baseline.toString(),
    baselineConfigured,
    accountedSupply: accountedSupply.toString(),
    nativeSupply: nativeSupply.toString(),
    unbackedDelta: unbackedDelta.toString(),
    consistent: baselineConfigured ? unbackedDelta === 0n : null,
  }
}

export async function queryChainMetrics(
  channelID?: string,
  includeReserveAccounting = false
) {
  const nativeDenom = process.env.BANKD_NATIVE_DENOM ?? DEFAULT_NATIVE_DENOM
  const [channelResult, supplyResult, banksResult, minterResult] =
    await Promise.all([
      chainJSON<ChannelsResponse>(
        '/ibc/core/channel/v1/channels?pagination.limit=100'
      ),
      chainJSON<SupplyResponse>(
        '/cosmos/bank/v1beta1/supply?pagination.limit=500'
      ),
      includeReserveAccounting
        ? chainJSON<BanksResponse>('/native/v1/banks?pagination.limit=100')
        : Promise.resolve<BanksResponse>({}),
      includeReserveAccounting
        ? chainJSON<MinterAccountsResponse>('/native/v1/minter_accounts')
        : Promise.resolve<MinterAccountsResponse>({}),
    ])
  const transferChannels = (channelResult.channels ?? []).filter(
    (channel) =>
      channel.port_id === 'transfer' &&
      (!channelID || channel.channel_id === channelID)
  )
  const positions = await Promise.all(
    transferChannels.map(async (channel) => {
      const port = channel.port_id ?? 'transfer'
      const id = channel.channel_id ?? ''
      const address = escrowAddress(port, id)
      const [balances, commitments] = await Promise.all([
        chainJSON<BalancesResponse>(
          `/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}?pagination.limit=100`
        ),
        chainJSON<CommitmentsResponse>(
          `/ibc/core/channel/v1/channels/${encodeURIComponent(id)}/ports/${encodeURIComponent(port)}/packet_commitments?pagination.limit=100`
        ),
      ])
      return {
        channelId: id,
        portId: port,
        state: channel.state ?? 'STATE_UNINITIALIZED_UNSPECIFIED',
        counterpartyChannelId: channel.counterparty?.channel_id ?? '',
        connectionId: channel.connection_hops?.[0] ?? '',
        escrowAddress: address,
        balances: balances.balances ?? [],
        pendingPacketCount: commitments.commitments?.length ?? 0,
      }
    })
  )
  const supply = supplyResult.supply ?? []
  const nativeSupply = supply.find((coin) => coin.denom === nativeDenom) ?? {
    denom: nativeDenom,
    amount: '0',
  }
  const voucherSupply = supply.filter((coin) => coin.denom.startsWith('ibc/'))
  const escrowedNativeAmount = positions
    .flatMap((position) => position.balances)
    .filter((coin) => coin.denom === nativeDenom)
    .reduce((total, coin) => total + BigInt(coin.amount), 0n)
    .toString()

  let banks: BankView[] | undefined
  let reconciliation: ReturnType<typeof reconcileReserves> | undefined
  if (includeReserveAccounting) {
    const minterAccounts = minterResult.minter_accounts ?? []
    banks = await Promise.all(
      (banksResult.banks ?? []).map(async (entry) => {
        const bankAccount = entry.bank_account
        // Per-bank resilience: a single balance fetch failure yields an empty
        // view instead of rejecting the whole reserve report.
        let balances: Coin[] = []
        try {
          const bech32 = bankAccountBech32(bankAccount)
          const result = await chainJSON<BalancesResponse>(
            `/cosmos/bank/v1beta1/balances/${encodeURIComponent(bech32)}?pagination.limit=100`
          )
          balances = result.balances ?? []
        } catch {
          balances = []
        }
        // nativeBalance is ubrl held at rest by the bank account. Banks
        // legitimately hold minted funds pre-forward and returned vouchers
        // awaiting redeemAndBurn, so this is a neutral view - NOT residue.
        const nativeBalance =
          balances.find((coin) => coin.denom === nativeDenom)?.amount ?? '0'
        return {
          bankId: entry.bank.bank_id,
          bankAccount,
          bridgeAddress: entry.bank.bridge_address,
          paused: entry.bank.paused,
          balances,
          nativeBalance,
        }
      })
    )
    reconciliation = reconcileReserves({
      minterAccounts,
      nativeSupplyAmount: nativeSupply.amount,
      genesisBaseline: process.env.BANKD_GENESIS_NATIVE_SUPPLY,
    })
  }

  return {
    asOfHeight: Number(channelResult.height?.revision_height ?? 0),
    nativeSupply,
    voucherSupply,
    escrowedNative: {
      denom: nativeDenom,
      amount: escrowedNativeAmount,
    },
    banks,
    reconciliation,
    ibc: {
      channelCount: positions.length,
      openChannelCount: positions.filter(
        (position) => position.state === 'STATE_OPEN'
      ).length,
      pendingPacketCount: positions.reduce(
        (total, position) => total + position.pendingPacketCount,
        0
      ),
      channels: positions,
    },
  }
}
