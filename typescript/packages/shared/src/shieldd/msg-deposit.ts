import { BinaryWriter } from '@bankd/shared/proto/binary'

export interface MsgDepositValue {
  sender: string
  amount: {
    denom: string
    amount: string
  }
  recipient: string
}

export const MsgDeposit = {
  typeUrl: '/mizufinance.shieldd.v1.MsgDeposit',

  fromPartial(value: Partial<MsgDepositValue>): MsgDepositValue {
    return {
      sender: value.sender ?? '',
      amount: {
        denom: value.amount?.denom ?? '',
        amount: value.amount?.amount ?? '',
      },
      recipient: value.recipient ?? '',
    }
  },

  toProto(message: MsgDepositValue): Uint8Array {
    const writer = BinaryWriter.create()
    if (message.sender) writer.uint32(10).string(message.sender)
    if (message.amount.denom || message.amount.amount) {
      const coin = writer.uint32(18).fork()
      if (message.amount.denom) coin.uint32(10).string(message.amount.denom)
      if (message.amount.amount) coin.uint32(18).string(message.amount.amount)
      coin.ldelim()
    }
    if (message.recipient) writer.uint32(26).string(message.recipient)
    return writer.finish()
  },
}
