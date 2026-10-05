import { executeCosmosTx } from '../lib/cosmos/execute'
import {
  getEVMAccount,
  getEVMAddressInfo,
  initializeEVMKeys,
} from '../lib/native-wallet/evm-keys'
import { MsgDeposit } from '@bankd/shared/shieldd/msg-deposit'

async function main() {
  const mnemonic =
    process.env.MOBILE_E2E_BANKD_MNEMONIC ??
    'decorate bright ozone fork gallery riot bus exhaust worth way bone indoor calm squirrel merry zero scheme cotton until shop any excess stage laundry'
  const amount = process.env.MOBILE_E2E_DEPOSIT_AMOUNT ?? '23456'
  const denom = process.env.MOBILE_E2E_DEPOSIT_DENOM ?? 'ubrl'
  const recipient =
    process.env.MOBILE_E2E_SHIELDD_RECIPIENT ??
    'shieldd1u29dhz4vxgnek6a3vzxlejg0l83wegpu7hgs3yphdvljcnnnh89dvs6lc9hxxw94w464t7lh5x36cxnxyx0'

  initializeEVMKeys(mnemonic)
  const account = getEVMAccount()
  const { bech32: sender } = getEVMAddressInfo()
  const result = await executeCosmosTx(
    account,
    sender,
    [{
      msg: MsgDeposit,
      values: {
        sender,
        amount: { denom, amount },
        recipient,
      },
    }],
    ({ step, message, txHash }) => {
      console.error(`[mobile-deposit] ${step}: ${message}${txHash ? ` (${txHash})` : ''}`)
    },
  )

  console.log(JSON.stringify({
    txHash: result.txHash,
    sender,
    recipient,
    amount,
    denom,
  }))
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
