import { evmAddress, getPublicClient } from '@bankd/shared/chain/client'
import { createWalletClient, http } from 'viem'

import { chainConfig , chainDefinition } from '@/lib/config'
import { getEVMAccount } from '@/lib/native-wallet/evm'

export interface FundInput { toAddress: string; amount: string }
/** Fund an existing Safe with native BRL from the unlocked personal EVM account. */
export async function fundFromPersonal(input: FundInput) {
  if (BigInt(input.amount) <= 0n) throw new Error('Funding amount must be positive')
  const wallet = createWalletClient({ account: getEVMAccount(), chain: chainDefinition, transport: http(chainConfig.evmRpc) })
  const hash = await wallet.sendTransaction({ chain: chainDefinition, to: evmAddress(input.toAddress), value: BigInt(input.amount) })
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash, confirmations: 1 })
  return { code: receipt.status === 'success' ? 0 : 1, transactionHash: hash, rawLog: receipt.status === 'success' ? '' : 'Funding transaction reverted', gasUsed: receipt.gasUsed, gasWanted: receipt.gasUsed }
}
