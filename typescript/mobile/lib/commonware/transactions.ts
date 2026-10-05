import { parseScannedPenumbraAddress } from '../penumbra-address'
import { erc20Abi, getAddress, parseUnits } from 'viem'
import { evmAddress } from '@bankd/shared/chain/client'
import { BANK_SEND_ABI, BANK_SEND_ADDRESS, IBC_ADAPTER_ABI, IBC_ADAPTER_ADDRESS, SHIELD_ABI, SHIELD_ADDRESS } from '@bankd/shared/evm/bankd'

export function amountInBaseUnits(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid token decimals')
  if (!/^\d+(\.\d+)?$/.test(amount) || (amount.split('.')[1]?.length ?? 0) > decimals) {
    throw new Error(`Enter a positive amount with at most ${decimals} decimal places`)
  }
  const value = parseUnits(amount, decimals)
  if (value <= 0n) throw new Error('Enter a positive amount')
  return value
}

function nativeAmount(amount: string, denom: string, decimals: number) {
  if (denom !== 'abrl' || decimals !== 18) throw new Error('This operation supports native BRL (abrl, 18 decimals)')
  return amountInBaseUnits(amount, decimals)
}

export function publicTransferCall(recipient: string, amount: string, denom: string, decimals: number) {
  const value = amountInBaseUnits(amount, decimals)
  const to = evmAddress(recipient)
  if (denom === 'abrl') {
    nativeAmount(amount, denom, decimals)
    return { address: BANK_SEND_ADDRESS, abi: BANK_SEND_ABI, functionName: 'send' as const, args: [to, value] as const }
  }
  if (denom.startsWith('erc20:')) {
    return { address: getAddress(denom.slice(6)), abi: erc20Abi, functionName: 'transfer' as const, args: [to, value] as const }
  }
  throw new Error('Unsupported public token')
}

export function shieldDepositCall(recipient: string, amount: string, denom: string, decimals: number) {
  const address = parseScannedPenumbraAddress(recipient)
  if (!address) throw new Error('Enter a Shieldd receive address')
  return { address: SHIELD_ADDRESS, abi: SHIELD_ABI, functionName: 'deposit' as const, args: [address] as const, value: nativeAmount(amount, denom, decimals) }
}

export function ibcTransferCall(clientId: string, recipient: string, amount: string, denom: string, decimals: number, memo = '', now = Date.now()) {
  if (!clientId || !recipient.trim()) throw new Error('An active IBC client and recipient are required')
  return { address: IBC_ADAPTER_ADDRESS, abi: IBC_ADAPTER_ABI, functionName: 'sendTransfer' as const, args: [clientId, recipient, BigInt(Math.floor(now / 1000) + 600), memo] as const, value: nativeAmount(amount, denom, decimals) }
}
