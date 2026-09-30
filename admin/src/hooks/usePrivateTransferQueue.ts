'use client'

import { SpendableNoteRecord as SpendableNoteRecordProto } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback,useEffect,useRef,useState } from 'react'
import toast from 'react-hot-toast'
import { bytesToHex,hexToBytes } from 'viem'

import {
  type PrivateTransferJobRecord,
  enqueuePrivateTransferJob,
  getDB,
  getPrivateTransferJobs,
  updatePrivateTransferJob,
} from '@/lib/native-wallet'
import { hostWithdraw } from '@/lib/penumbra'
import { formatTokenAmount } from '@/lib/utils'

export interface PrivateTransferQueueInput {
  amount: string
  amountBaseUnits: bigint
  asset: {
    id: string
    symbol: string
    denom: string
    decimals: number
    /** Penumbra account to spend from (one tx spends a single account). */
    sourceAccount?: number
  }
  recipient: string
  recipientLabel?: string
}

export interface UsePrivateTransferQueueParams {
  fullViewingKey: any | null
  addresses: any | null
}

async function getSpendableBalanceForAssetId(
  assetId: string,
  account?: number
): Promise<bigint> {
  // Token ids are `private:<assetIdHex>` — drop the prefix to recover the hex.
  const assetIdHex = assetId
    .replace(/^private:/, '')
    .split(':')[0]
    .toLowerCase()
  const db = await getDB()
  const allNotes = await db.getAll('SPENDABLE_NOTES')
  let balance = 0n

  for (const noteJson of allNotes) {
    const noteRecord = noteJson as { heightSpent?: unknown }
    if (noteRecord.heightSpent) continue

    try {
      const note = SpendableNoteRecordProto.fromJson(noteJson as any)
      const inner = note.note?.value?.assetId?.inner
      if (!inner || bytesToHex(inner).toLowerCase() !== assetIdHex) continue

      // A transfer spends a single account, so scope the balance to it.
      if (account !== undefined && note.addressIndex?.account !== account) {
        continue
      }

      const amount = note.note?.value?.amount
      if (!amount) continue
      balance += (BigInt(amount.hi ?? 0n) << 64n) + BigInt(amount.lo ?? 0n)
    } catch {
      // Ignore malformed rows.
    }
  }

  return balance
}

async function waitForSpendableBalance(job: PrivateTransferJobRecord): Promise<void> {
  const required = BigInt(job.amountBaseUnits)
  const account = job.asset.sourceAccount
  const deadline = Date.now() + 5 * 60_000

  while (Date.now() < deadline) {
    const balance = await getSpendableBalanceForAssetId(job.asset.id, account)
    if (balance >= required) return
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  const balance = await getSpendableBalanceForAssetId(job.asset.id, account)
  throw new Error(
    `Insufficient private ${job.asset.symbol} balance. Available: ${formatTokenAmount(balance.toString(), job.asset.decimals)} ${job.asset.symbol}`
  )
}

async function waitForPrivateWalletSync(minHeight?: bigint) {
  const { assertPenumbraWalletSynced } = await import('@/lib/native-wallet/penumbra/services/view-server-sync')
  await assertPenumbraWalletSynced(minHeight)
}

async function runPrivateSend(job: PrivateTransferJobRecord): Promise<bigint | undefined> {
  const { AddressIndex, Address } = await import('@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb')
  const { AssetId, Value } = await import('@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb')
  const { Amount } = await import('@mizufinance/protobuf/shieldd/core/num/v1/num_pb')
  const { TransactionPlannerRequest } = await import('@mizufinance/protobuf/shieldd/view/v1/view_pb')
  const { addressFromBech32m } = await import(
    '@/lib/native-wallet/penumbra/shieldd-address'
  )
  const { createTransactionService } = await import('@/lib/native-wallet')
  const { penumbraConfig } = await import('@/lib/config')
  const { assetIdFromBaseDenom } = await import('@/lib/native-wallet/penumbra/wasm-loader')

  const txService = createTransactionService({
    grpcUrl: penumbraConfig.grpcUrl,
    chainId: penumbraConfig.chainId,
  })

  if (!txService.isReady()) {
    throw new Error('Wallet is locked')
  }

  const amountBigInt = BigInt(job.amountBaseUnits)
  const assetId = await assetIdFromBaseDenom(job.asset.denom)
  const decoded = addressFromBech32m(job.recipient)

  const plannerRequest = new TransactionPlannerRequest({
    source: new AddressIndex({ account: job.asset.sourceAccount ?? 0 }),
    outputs: [
      {
        value: new Value({
          assetId: new AssetId({ inner: assetId.inner }),
          amount: new Amount({
            lo: amountBigInt & ((1n << 64n) - 1n),
            hi: amountBigInt >> 64n,
          }),
        }),
        address: new Address({ inner: new Uint8Array(decoded.inner) }),
      },
    ],
  })

  const { transaction } = await txService.planAndBuild(plannerRequest)
  const result = await txService.broadcast(transaction, true)
  if (!result.success) {
    throw new Error(result.error || 'Transaction failed')
  }
  return result.height
}

async function runPrivateWithdraw(job: PrivateTransferJobRecord): Promise<bigint | undefined> {
  const assetId = job.asset.id.replace(/^private:/, '').split(':')[0]
  const result = await hostWithdraw({
    amount: BigInt(job.amountBaseUnits),
    assetId: hexToBytes(assetId as `0x${string}`),
    destinationAddress: job.recipient,
    sourceAddressIndex: job.asset.sourceAccount ?? 0,
  })

  if (!result.confirmed) {
    throw new Error(result.error || 'Withdrawal failed')
  }
  return result.height
}

/**
 * Translate raw planner/prover errors into actionable guidance. The raw
 * message is still logged to the console for debugging.
 *
 * For the compliance-leaf rejection, the chain is queried to identify WHICH
 * party is unregistered (sender wallet, recipient, or — when both are
 * registered — notes stranded on an unregistered ephemeral address). Every
 * variant keeps the phrase "not registered", which the transfer e2e keys on.
 */
async function friendlyTransferError(
  message: string,
  job: PrivateTransferJobRecord,
  fullViewingKey: any
): Promise<string> {
  if (!/user is not registered in compliance tree for asset/i.test(message)) {
    return message
  }

  const setupHint = `Register it for ${job.asset.denom} under Assets → Regulated Asset Setup`

  try {
    const { isComplianceUserRegistered } = await import('@/lib/native-wallet')
    const { getAddressByIndex } = await import('@/lib/native-wallet/penumbra/wasm-loader')

    const senderAddress = await getAddressByIndex(fullViewingKey, 0)
    const senderRegistered = await isComplianceUserRegistered(senderAddress, job.asset.denom)

    // Only private sends have a penumbra recipient with its own leaf.
    let recipientRegistered: boolean | null = null
    if (job.type === 'private-send') {
      const { Address } = await import('@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb')
      const { addressFromBech32m } = await import(
        '@/lib/native-wallet/penumbra/shieldd-address'
      )
      const decoded = addressFromBech32m(job.recipient)
      recipientRegistered = await isComplianceUserRegistered(
        new Address({ inner: new Uint8Array(decoded.inner) }),
        job.asset.denom,
      )
    }

    if (recipientRegistered === false) {
      return (
        `The recipient is not registered as a compliance user for ` +
        `${job.asset.symbol} (a regulated asset). ${setupHint} ` +
        `("Register this wallet" from the recipient's wallet, or with their ` +
        `address index) before sending.`
      )
    }
    if (senderRegistered === false) {
      return (
        `Your wallet is not registered as a compliance user for ` +
        `${job.asset.symbol} (a regulated asset). ${setupHint} ` +
        `("Register this wallet"), then retry.`
      )
    }
    if (senderRegistered && (job.type !== 'private-send' || recipientRegistered)) {
      return (
        `The ${job.asset.symbol} notes being spent are on an address that is ` +
        `not registered in the compliance tree — typically an ephemeral ` +
        `deposit address. Regulated funds must be held on your registered ` +
        `default private address: shield a fresh amount to it (recipient ` +
        `"Private Address" on the transfers page) and retry.`
      )
    }
  } catch (error) {
    console.warn('[PrivateTransferQueue] compliance status lookup failed:', error)
  }

  return (
    `${job.asset.symbol} is a regulated asset, and an address involved in ` +
    `this transfer is not registered as a compliance user for it. Register ` +
    `your wallet and the recipient for ${job.asset.denom} under Assets → ` +
    `Regulated Asset Setup, and make sure the funds were shielded to your ` +
    `default private address — notes on ephemeral deposit addresses cannot ` +
    `be spent.`
  )
}

export function usePrivateTransferQueue({
  fullViewingKey,
  addresses,
}: UsePrivateTransferQueueParams) {
  const queryClient = useQueryClient()
  const [jobs, setJobs] = useState<PrivateTransferJobRecord[]>([])
  const processingRef = useRef(false)

  const refreshJobs = useCallback(async () => {
    setJobs(await getPrivateTransferJobs())
  }, [])

  const enqueue = useCallback(async (
    type: PrivateTransferJobRecord['type'],
    input: PrivateTransferQueueInput,
  ) => {
    const job = await enqueuePrivateTransferJob({
      type,
      amount: input.amount,
      amountBaseUnits: input.amountBaseUnits.toString(),
      asset: input.asset,
      recipient: input.recipient,
      recipientLabel: input.recipientLabel,
    })
    await refreshJobs()
    return job
  }, [refreshJobs])

  const processJob = useCallback(async (job: PrivateTransferJobRecord) => {
    if (!fullViewingKey || !addresses) return

    const updateJob = async (patch: Partial<PrivateTransferJobRecord>) => {
      await updatePrivateTransferJob(job.id, patch)
      await refreshJobs()
    }

    // One persistent toast per job, keyed by job id so the enqueue-time toast
    // (see the transfers page) is updated in place through every phase.
    const toastId = `private-job-${job.id}`
    const verb = job.type === 'private-send' ? 'Sending privately' : 'Unshielding'

    try {
      let height = job.height ? BigInt(job.height) : undefined
      if (height === undefined) {
        await updateJob({
          status: 'waiting-balance',
          statusMessage: 'Waiting for private balance',
          error: undefined,
        })
        toast.loading(`${verb} — waiting for private balance...`, { id: toastId })
        await waitForSpendableBalance(job)

        await updateJob({
          status: 'waiting-sync',
          statusMessage: 'Waiting for wallet sync',
        })
        toast.loading(`${verb} — waiting for wallet sync...`, { id: toastId })
        await waitForPrivateWalletSync()

        await updateJob({
          status: 'building-proof',
          statusMessage: 'Building proof',
        })
        toast.loading(`${verb}...`, { id: toastId })

        height = job.type === 'private-send'
          ? await runPrivateSend(job)
          : await runPrivateWithdraw(job)

        if (height === undefined) throw new Error('Confirmed transfer height unavailable')

        await updateJob({
          status: 'broadcasting',
          statusMessage: 'Refreshing private wallet',
          height: height.toString(),
        })
      }
      toast.loading(`${verb} — waiting for confirmation...`, { id: toastId })
      await waitForPrivateWalletSync(height)

      await updateJob({
        status: 'confirmed',
        statusMessage: 'Confirmed',
        height: height?.toString(),
      })
      toast.success(job.type === 'private-send' ? 'Private send confirmed' : 'Unshield confirmed', { id: toastId })
      queryClient.invalidateQueries({ queryKey: ['penumbra', 'balances'] })
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Private transfer failed'
      console.error('[PrivateTransferQueue] job failed:', raw)
      const message = await friendlyTransferError(raw, job, fullViewingKey)
      await updateJob({
        status: 'failed',
        statusMessage: 'Failed',
        error: message,
      })
      toast.error(message, { id: toastId })
    } finally {
      await refreshJobs()
    }
  }, [addresses, fullViewingKey, queryClient, refreshJobs])

  useEffect(() => {
    refreshJobs()
    const timer = window.setInterval(refreshJobs, 2_000)
    return () => window.clearInterval(timer)
  }, [refreshJobs])

  useEffect(() => {
    if (!fullViewingKey || processingRef.current) return
    if (!jobs.some((item) => !['confirmed', 'failed'].includes(item.status))) return
    processingRef.current = true
    // The worker outlives the Transfers page and is shared across wallet tabs.
    void navigator.locks.request('private-transfer-queue', { ifAvailable: true }, async lock => {
      if (!lock) return
      const current = await getPrivateTransferJobs()
      const job = current.find((item) => !['confirmed', 'failed'].includes(item.status))
      if (job) await processJob(job)
    }).catch(console.error).finally(() => { processingRef.current = false })
  }, [fullViewingKey, jobs, processJob])

  return {
    jobs,
    enqueue,
    refreshJobs,
    getSpendableBalanceForAssetId,
  }
}
