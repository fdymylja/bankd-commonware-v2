import { ATOMIC_SWAP_ABI, ERC20_ABI, ZERO_ADDRESS } from '@bankd/shared/evm/atomicSwap'
import {
  getBlock,
  getPublicClient,
  getTransactionReceipt,
  readContract,
} from '@wagmi/core'
import {
  type Hex,
  type Log,
  decodeEventLog,
  encodeEventTopics,
  getAddress,
  numberToHex,
  padHex,
} from 'viem'

import { makeWagmiConfig } from './wagmi'

// ============================================================================
// Types
// ============================================================================

export interface AvPTransferInfo {
  from: Hex
  to: Hex
  amount: bigint
  token: Hex
}

export interface AvPOrderTimeline {
  creationBlock: bigint
  creationTimestamp: number
  executionBlock: bigint
  executionTimestamp: number
  intentToExecutionSeconds: number
  seller: Hex
  buyer: Hex
  whitelistedBuyer: Hex
  isRestricted: boolean
}

export interface AvPPreSettlement {
  partyAApprovalValid: boolean
  partyBApprovalValid: boolean
  partyASufficientFunds: boolean
  partyBSufficientFunds: boolean
  approvalAmountA: bigint
  approvalAmountB: bigint
  balanceA: bigint
  balanceB: bigint
}

export interface AvPVerificationResult {
  // Core verdict
  compliant: boolean
  atomic: boolean
  success: boolean
  bidirectionalTransfer: boolean
  participantsIdentified: boolean
  authorizationCheck: boolean
  risksEliminated: boolean

  // Transaction info
  txHash: Hex
  blockNumber: bigint
  gasUsed: bigint
  timestamp: number

  // Parties
  partyA: Hex
  partyB: Hex
  tokenA: Hex
  tokenB: Hex
  amountA: bigint
  amountB: bigint
  transfersA2B: AvPTransferInfo[]
  transfersB2A: AvPTransferInfo[]

  // Order info (from events)
  orderTimeline: AvPOrderTimeline | null

  // Pre-settlement (null if historical state unavailable)
  preSettlement: AvPPreSettlement | null

  // Contract
  contractAddress: Hex
}

// ============================================================================
// Core Verification
// ============================================================================

/**
 * Verify AvP compliance of an atomic swap order.
 * Ports the EVM verification path from cmd/bankd/avp_verify.go.
 */
export async function verifyAvPCompliance(
  contractAddress: Hex,
  orderId: bigint
): Promise<AvPVerificationResult> {
  const config = makeWagmiConfig()
  const client = getPublicClient(config)
  if (!client) {
    throw new Error('No public client available')
  }

  // 1. Find the OrderExecuted event to get the execution tx hash
  const executedLog = await findOrderExecutedLog(
    client,
    contractAddress,
    orderId
  )
  if (!executedLog) {
    throw new Error(
      `OrderExecuted event not found for order #${orderId.toString()}`
    )
  }

  if (!executedLog.transactionHash) {
    throw new Error(
      `OrderExecuted log for order #${orderId.toString()} has no transaction hash`
    )
  }
  const txHash = executedLog.transactionHash

  // Decode the OrderExecuted event to get the buyer address.
  // buyer is the 2nd indexed param (topic[2]). Fall back to raw topic
  // extraction if decodeEventLog doesn't populate args.buyer.
  let buyer: Hex
  const executedEvent = decodeEventLog({
    abi: ATOMIC_SWAP_ABI,
    eventName: 'OrderExecuted',
    data: executedLog.data,
    topics: executedLog.topics,
  })
  if (executedEvent.args.buyer) {
    buyer = getAddress(executedEvent.args.buyer) as Hex
  } else if (executedLog.topics.length >= 3 && executedLog.topics[2]) {
    buyer = getAddress(('0x' + executedLog.topics[2].slice(26)) as Hex) as Hex
  } else {
    throw new Error(
      `OrderExecuted event for order #${orderId.toString()} missing buyer address`
    )
  }

  // 2. Get seller from contract state (authoritative source)
  const order = await readContract(config, {
    address: contractAddress,
    abi: ATOMIC_SWAP_ABI,
    functionName: 'getOrder',
    args: [orderId],
  })
  const seller = getAddress(order.seller) as Hex

  // 3. Get transaction receipt and block
  const receipt = await getTransactionReceipt(config, { hash: txHash })
  const block = await getBlock(config, { blockNumber: receipt.blockNumber })

  const success = receipt.status === 'success'
  const timestamp = Number(block.timestamp)

  // 4. Parse Transfer events and classify by known parties
  const transfers = parseTransferEvents(receipt.logs)
  const { transfersA2B, transfersB2A } = classifyTransfers(
    transfers,
    seller,
    buyer,
    contractAddress
  )

  const participantsIdentified =
    seller !== ZERO_ADDRESS && buyer !== ZERO_ADDRESS
  // The contract pulls from both sides in executeOrder (safeTransferFrom for
  // each party). If the tx succeeded, transfers were bidirectional. We can't
  // rely on Transfer events alone since native tokens may not emit them.
  const bidirectionalTransfer = success

  // Atomicity: the contract executes both sides in one tx. If the tx
  // succeeded, the swap was atomic regardless of whether we can observe
  // all Transfer events (native tokens may not emit ERC20 events).
  const atomic = success

  // Token/amount info from the order itself (more reliable than Transfer events
  // which may be missing for precompile-backed native tokens)
  const tokenA = order.sellToken as Hex
  const amountA = order.sellAmount
  const tokenB = order.buyToken as Hex
  const amountB = order.buyAmount

  // 5. Find OrderPlaced event for order creation details
  const orderTimeline = await findOrderTimeline(
    client,
    contractAddress,
    orderId,
    receipt.blockNumber,
    timestamp,
    buyer
  )

  // 6. Authorization check
  let authorizationCheck = true
  if (orderTimeline?.isRestricted) {
    authorizationCheck =
      orderTimeline.whitelistedBuyer.toLowerCase() === buyer.toLowerCase()
  }

  // 7. Pre-settlement validation (best-effort, may fail on pruned nodes)
  const sellerIsIBC = executedEvent.args.sellerIsIBC ?? false
  const buyerIsIBC = executedEvent.args.buyerIsIBC ?? false
  let preSettlement: AvPPreSettlement | null = null
  if (participantsIdentified && tokenA !== ZERO_ADDRESS && tokenB !== ZERO_ADDRESS) {
    preSettlement = await validatePreSettlement(
      config,
      seller,
      buyer,
      tokenA,
      tokenB,
      amountA,
      amountB,
      contractAddress,
      receipt.blockNumber,
      sellerIsIBC,
      buyerIsIBC,
      success
    )
  }

  // 8. Compute overall compliance verdict
  const risksEliminated = atomic && success
  const compliant =
    atomic && success && participantsIdentified && authorizationCheck

  return {
    compliant,
    atomic,
    success,
    bidirectionalTransfer,
    participantsIdentified,
    authorizationCheck,
    risksEliminated,
    txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    timestamp,
    partyA: seller,
    partyB: buyer,
    tokenA,
    tokenB,
    amountA,
    amountB,
    transfersA2B,
    transfersB2A,
    orderTimeline,
    preSettlement,
    contractAddress,
  }
}

// ============================================================================
// Event Search
// ============================================================================

const LOG_BLOCK_RANGE = 9_999n

/**
 * Paginated getLogs that respects RPC block range limits.
 * Searches from `fromBlock` to `toBlock` in chunks.
 * Returns the first matching log found (earliest block first).
 */
async function paginatedGetLogs(
  client: NonNullable<ReturnType<typeof getPublicClient>>,
  params: {
    address: Hex
    topics: (Hex | Hex[] | null)[]
    fromBlock: bigint
    toBlock: bigint
  }
): Promise<Log[]> {
  const { address, topics, fromBlock, toBlock } = params
  const allLogs: Log[] = []

  for (let start = fromBlock; start <= toBlock; start += LOG_BLOCK_RANGE + 1n) {
    const end = start + LOG_BLOCK_RANGE > toBlock ? toBlock : start + LOG_BLOCK_RANGE
    // Raw eth_getLogs, NOT client.getLogs. viem's getLogs takes an `event` plus
    // `args` and has no `topics` parameter at all, so passing topics to it does
    // not narrow anything: it silently drops them and answers with every log the
    // contract emitted in the range. The callers here then took logs[0], which is
    // the earliest log at that address rather than the event they asked for, and
    // every order's compliance report rendered the FIRST order's placeOrder as its
    // settlement. Found 2026-09-17 on viem 2.47.4.
    const raw = (await client.request({
      method: 'eth_getLogs',
      params: [
        {
          address,
          topics,
          fromBlock: numberToHex(start),
          toBlock: numberToHex(end),
        },
      ],
    } as never)) as RawLog[]
    allLogs.push(...raw.map(toLog))
    if (allLogs.length > 0) return allLogs
  }

  return allLogs
}

/** eth_getLogs answers in hex strings; the callers want viem's Log shape. */
type RawLog = {
  address: Hex
  topics: Hex[]
  data: Hex
  blockNumber: Hex | null
  blockHash: Hex | null
  transactionHash: Hex | null
  transactionIndex: Hex | null
  logIndex: Hex | null
  removed?: boolean
}

const toLog = (l: RawLog): Log =>
  ({
    address: l.address,
    topics: l.topics,
    data: l.data,
    blockNumber: l.blockNumber === null ? null : BigInt(l.blockNumber),
    blockHash: l.blockHash,
    transactionHash: l.transactionHash,
    transactionIndex: l.transactionIndex === null ? null : Number(l.transactionIndex),
    logIndex: l.logIndex === null ? null : Number(l.logIndex),
    removed: l.removed ?? false,
  }) as Log

/**
 * Find the OrderExecuted event for a given orderId.
 * Paginates through all blocks to handle RPC range limits.
 */
async function findOrderExecutedLog(
  client: NonNullable<ReturnType<typeof getPublicClient>>,
  contractAddress: Hex,
  orderId: bigint
) {
  const latestBlock = await client.getBlockNumber()
  const orderIdTopic = padHex(numberToHex(orderId), { size: 32 })

  const [topic0] = encodeEventTopics({
    abi: ATOMIC_SWAP_ABI,
    eventName: 'OrderExecuted',
  })

  const logs = await paginatedGetLogs(client, {
    address: contractAddress,
    topics: [topic0, orderIdTopic],
    fromBlock: 0n,
    toBlock: latestBlock,
  })

  return logs.length > 0 ? logs[0] : null
}

/**
 * Find the OrderPlaced event and build the order timeline.
 * Paginates through all blocks from 0 to the execution block.
 */
async function findOrderTimeline(
  client: NonNullable<ReturnType<typeof getPublicClient>>,
  contractAddress: Hex,
  orderId: bigint,
  executionBlock: bigint,
  executionTimestamp: number,
  buyer: Hex
): Promise<AvPOrderTimeline | null> {
  try {
    const orderIdTopic = padHex(numberToHex(orderId), { size: 32 })

    const [topic0] = encodeEventTopics({
      abi: ATOMIC_SWAP_ABI,
      eventName: 'OrderPlaced',
    })

    const logs = await paginatedGetLogs(client, {
      address: contractAddress,
      topics: [topic0, orderIdTopic],
      fromBlock: 0n,
      toBlock: executionBlock,
    })

    if (logs.length === 0) return null

    const log = logs[0]
    if (log.blockNumber === null) return null

    const placedEvent = decodeEventLog({
      abi: ATOMIC_SWAP_ABI,
      eventName: 'OrderPlaced',
      data: log.data,
      topics: log.topics,
    })

    const creationBlock = await client.getBlock({
      blockNumber: log.blockNumber,
    })
    const creationTimestamp = Number(creationBlock.timestamp)

    let seller: Hex
    if (placedEvent.args.seller) {
      seller = getAddress(placedEvent.args.seller) as Hex
    } else if (log.topics.length >= 3 && log.topics[2]) {
      seller = getAddress(('0x' + log.topics[2].slice(26)) as Hex) as Hex
    } else {
      return null
    }

    let whitelistedBuyer: Hex
    if (placedEvent.args.whitelistedBuyer) {
      whitelistedBuyer = getAddress(placedEvent.args.whitelistedBuyer) as Hex
    } else {
      whitelistedBuyer = ZERO_ADDRESS
    }
    const isRestricted = whitelistedBuyer !== ZERO_ADDRESS

    return {
      creationBlock: log.blockNumber,
      creationTimestamp,
      executionBlock,
      executionTimestamp,
      intentToExecutionSeconds: executionTimestamp - creationTimestamp,
      seller,
      buyer,
      whitelistedBuyer,
      isRestricted,
    }
  } catch {
    return null
  }
}

// ============================================================================
// Transfer Parsing & Classification
// ============================================================================

/**
 * Parse Transfer events from transaction receipt logs.
 */
function parseTransferEvents(logs: Log[]): AvPTransferInfo[] {
  const transfers: AvPTransferInfo[] = []

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ERC20_ABI,
        eventName: 'Transfer',
        data: log.data,
        topics: log.topics,
      })

      transfers.push({
        from: getAddress(decoded.args.from) as Hex,
        to: getAddress(decoded.args.to) as Hex,
        amount: decoded.args.value,
        token: getAddress(log.address) as Hex,
      })
    } catch {
      // Not a Transfer event, skip
    }
  }

  return transfers
}

/**
 * Classify transfers into seller->buyer and buyer->seller directions
 * using the known party addresses from contract events.
 *
 * In executeOrder, the contract pulls from both sides then distributes:
 *   seller -> contract (sellToken)
 *   buyer  -> contract (buyToken)
 *   contract -> buyer  (sellToken)  [or IBC return]
 *   contract -> seller (buyToken)   [or IBC return]
 *
 * seller->buyer: seller's sellToken deposited to contract, destined for buyer
 * buyer->seller: buyer's buyToken deposited to contract, destined for seller
 */
function classifyTransfers(
  transfers: AvPTransferInfo[],
  seller: Hex,
  buyer: Hex,
  contractAddress: Hex
): {
  transfersA2B: AvPTransferInfo[]
  transfersB2A: AvPTransferInfo[]
} {
  const contractLower = contractAddress.toLowerCase()
  const sellerLower = seller.toLowerCase()
  const buyerLower = buyer.toLowerCase()

  // seller -> buyer: seller deposited to contract
  const transfersA2B: AvPTransferInfo[] = transfers
    .filter(
      (t) =>
        t.from.toLowerCase() === sellerLower &&
        t.to.toLowerCase() === contractLower
    )
    .map((t) => ({ from: seller, to: buyer, amount: t.amount, token: t.token }))

  // buyer -> seller: buyer deposited to contract
  const transfersB2A: AvPTransferInfo[] = transfers
    .filter(
      (t) =>
        t.from.toLowerCase() === buyerLower &&
        t.to.toLowerCase() === contractLower
    )
    .map((t) => ({ from: buyer, to: seller, amount: t.amount, token: t.token }))

  return { transfersA2B, transfersB2A }
}

// ============================================================================
// Pre-Settlement Validation
// ============================================================================

/**
 * Validate pre-settlement conditions at the block before execution.
 * Queries allowances and balances at blockNumber - 1.
 * Returns null if historical state is unavailable (pruned node).
 */
async function validatePreSettlement(
  config: ReturnType<typeof makeWagmiConfig>,
  partyA: Hex,
  partyB: Hex,
  tokenA: Hex,
  tokenB: Hex,
  amountA: bigint,
  amountB: bigint,
  contractAddress: Hex,
  executionBlock: bigint,
  partyAIsIBC: boolean,
  partyBIsIBC: boolean,
  txSuccess: boolean
): Promise<AvPPreSettlement | null> {
  const blockNumber = executionBlock - 1n
  if (blockNumber < 0n) return null

  try {
    const [approvalA, balanceA, approvalB, balanceB] = await Promise.all([
      readContract(config, {
        address: tokenA,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [partyA, contractAddress],
        blockNumber,
      }),
      readContract(config, {
        address: tokenA,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [partyA],
        blockNumber,
      }),
      readContract(config, {
        address: tokenB,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [partyB, contractAddress],
        blockNumber,
      }),
      readContract(config, {
        address: tokenB,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [partyB],
        blockNumber,
      }),
    ])

    // IBC parties don't use ERC20 approvals. For same-chain parties,
    // approval may have happened in the same block as execution so it
    // won't appear at blockNumber-1. The contract enforces approvals
    // on-chain, so if the tx succeeded the approval was valid.
    return {
      partyAApprovalValid: partyAIsIBC || txSuccess || approvalA >= amountA,
      partyBApprovalValid: partyBIsIBC || txSuccess || approvalB >= amountB,
      partyASufficientFunds: balanceA >= amountA,
      partyBSufficientFunds: balanceB >= amountB,
      approvalAmountA: approvalA,
      approvalAmountB: approvalB,
      balanceA,
      balanceB,
    }
  } catch {
    // Historical state not available (pruned node)
    return null
  }
}
