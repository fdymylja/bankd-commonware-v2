'use client'

import { evmAddress } from '@bankd/shared/chain/client'
import { AssetId,Value } from '@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb'
import { HostTransfer,HostWithdrawal } from '@mizufinance/protobuf/shieldd/core/component/shielded_pool/v1/shielded_pool_pb'
import { AddressIndex } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import { Amount } from '@mizufinance/protobuf/shieldd/core/num/v1/num_pb'
import { TransactionPlannerRequest } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'

export interface HostWithdrawParams {
  amount: bigint
  assetId: Uint8Array
  destinationAddress: string
  sourceAddressIndex: number
}

export interface WithdrawResult {
  transactionId: string
  confirmed: boolean
  height?: bigint
  error?: string
}

/** Withdraw private funds to a public Bankd account. */
export async function hostWithdraw(params: HostWithdrawParams): Promise<WithdrawResult> {
  const { createTransactionService } = await import('@/lib/native-wallet')
  const { penumbraConfig } = await import('@/lib/config')
  const txService = createTransactionService({
    grpcUrl: penumbraConfig.grpcUrl,
    chainId: penumbraConfig.chainId,
  })
  if (!txService.isReady()) {
    return { transactionId: '', confirmed: false, error: 'Wallet is locked - please unlock to make transactions' }
  }
  try {
    const withdrawal = new HostWithdrawal({
      value: new Value({
        amount: new Amount({ lo: params.amount & ((1n << 64n) - 1n), hi: params.amount >> 64n }),
        assetId: new AssetId({ inner: params.assetId }),
      }),
      destination: { case: 'transfer', value: new HostTransfer({ recipient: evmAddress(params.destinationAddress) }) },
    })
    const request = new TransactionPlannerRequest({
      source: new AddressIndex({ account: params.sourceAddressIndex }),
      hostWithdrawals: [withdrawal],
    })
    const { transaction, transactionId } = await txService.planAndBuild(request)
    const result = await txService.broadcast(transaction, true)
    return {
      transactionId: result.hash || transactionId,
      confirmed: result.success,
      height: result.height,
      error: result.error,
    }
  } catch (error) {
    return { transactionId: '', confirmed: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
