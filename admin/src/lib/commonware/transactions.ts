import { evmAddress } from '@bankd/shared/chain/client'
import {
  BANK_SEND_ABI,
  BANK_SEND_ADDRESS,
  COMPLIANCE_ABI,
  COMPLIANCE_ADDRESS,
  SHIELD_ABI,
  SHIELD_ADDRESS,
} from '@bankd/shared/evm/bankd'
import { BinaryReader } from '@bankd/shared/proto/binary'

/** Translate retained form intents to the v2 precompile ABI. No protobuf is sent on chain. */
export function bankdMessageCall(typeUrl: string, values: any): any {
  if (typeUrl === '/cosmos.bank.v1beta1.MsgSend') {
    const coin = nativeCoin(values.amount)
    return {
      address: BANK_SEND_ADDRESS,
      abi: BANK_SEND_ABI,
      functionName: 'send',
      args: [evmAddress(values.toAddress), BigInt(coin.amount)],
    }
  }
  if (typeUrl === '/mizufinance.shieldd.v1.MsgDeposit') {
    nativeCoin([values.amount])
    return {
      address: SHIELD_ADDRESS,
      abi: SHIELD_ABI,
      functionName: 'deposit',
      args: [values.recipient],
      value: BigInt(values.amount.amount),
    }
  }
  if (typeUrl === '/mizufinance.authority.v1.MsgExec')
    return bankdMessageCall(
      values.msg.typeUrl,
      readComplianceIntent(values.msg.value)
    )
  const name = typeUrl.split('.').at(-1)
  const functions: Record<string, string> = {
    MsgFreeze: 'freeze',
    MsgUnfreeze: 'unfreeze',
    MsgAddSanctioned: 'addSanctioned',
    MsgRemoveSanctioned: 'removeSanctioned',
    MsgSeize: 'seize',
  }
  const functionName = functions[name || '']
  if (functionName) {
    let args
    if (name === 'MsgSeize')
      args = [
        evmAddress(values.from),
        evmAddress(values.to),
        BigInt(nativeCoin(values.amount).amount),
      ]
    else {
      if (values.addresses && values.addresses.length !== 1)
        throw new Error('Submit one sanction address per transaction')
      args = [evmAddress(values.address || values.addresses[0])]
    }
    return {
      address: COMPLIANCE_ADDRESS,
      abi: COMPLIANCE_ABI,
      functionName,
      args,
    }
  }
  throw new Error(`This action is unavailable on the Commonware base: ${name}.`)
}
function nativeCoin(coins: { denom: string; amount: string }[]) {
  if (
    coins?.length !== 1 ||
    coins[0].denom !== 'abrl' ||
    BigInt(coins[0].amount) <= 0n
  )
    throw new Error(
      'This operation requires a positive amount of native BRL (abrl).'
    )
  return coins[0]
}
function readComplianceIntent(bytes: Uint8Array): any {
  const reader = new BinaryReader(bytes)
  const fields: Record<number, string[]> = {}
  const coins: any[] = []
  while (reader.pos < reader.len) {
    const tag = reader.uint32()
    const field = tag >>> 3
    if ((tag & 7) === 2) {
      if (field === 4) {
        const data = reader.bytes()
        // Field 4 is a Coin only for MsgSeize; ordinary reason/ref bytes are ignored.
        try {
          const r = new BinaryReader(data)
          const coin: any = {}
          while (r.pos < r.len) {
            const t = r.uint32()
            if (t === 10) coin.denom = r.string()
            else if (t === 18) coin.amount = r.string()
            else r.skipType(t & 7)
          }
          if (coin.denom && coin.amount) coins.push(coin)
        } catch {
          /* reason/ref is not part of the v2 ABI */
        }
      } else (fields[field] ||= []).push(reader.string())
    } else reader.skipType(tag & 7)
  }
  return {
    address: fields[2]?.[0],
    addresses: fields[2] || [],
    from: fields[2]?.[0],
    to: fields[3]?.[0],
    amount: coins,
  }
}
