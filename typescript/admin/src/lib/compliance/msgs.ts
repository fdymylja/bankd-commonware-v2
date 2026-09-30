/**
 * The x/compliance tx messages, hand-encoded.
 *
 * packages/shared only carries generated protos for poa, native, eem and unwrap,
 * and the telescope toolchain that made them is not in this repo. executeTx only
 * ever asks a msg for `typeUrl`, `fromPartial` and `toProto` (see
 * convertMsgExecStep in lib/evm/execute.ts), so the six messages the sanctions
 * demo needs are written out here instead of pulling a codegen chain in for them.
 *
 * Field numbers come from proto/mizufinance/compliance/v1/tx.proto. If that file
 * changes, this one has to change with it, and nothing will tell you: the
 * encoding just goes wrong on chain.
 */

const utf8 = new TextEncoder()

class Writer {
  private parts: number[] = []

  private varint(n: number) {
    let v = n >>> 0
    while (v > 0x7f) {
      this.parts.push((v & 0x7f) | 0x80)
      v >>>= 7
    }
    this.parts.push(v)
  }

  private tag(field: number, wire: number) {
    this.varint((field << 3) | wire)
  }

  /** A string field. Empty strings are skipped, the way proto3 encodes them. */
  string(field: number, value: string | undefined) {
    if (!value) return this
    const bytes = utf8.encode(value)
    this.tag(field, 2)
    this.varint(bytes.length)
    this.parts.push(...bytes)
    return this
  }

  strings(field: number, values: readonly string[] | undefined) {
    for (const v of values ?? []) this.string(field, v)
    return this
  }

  bool(field: number, value: boolean | undefined) {
    if (!value) return this
    this.tag(field, 0)
    this.varint(1)
    return this
  }

  /** A nested message, already encoded. */
  bytes(field: number, value: Uint8Array) {
    this.tag(field, 2)
    this.varint(value.length)
    this.parts.push(...value)
    return this
  }

  finish() {
    return new Uint8Array(this.parts)
  }
}

export type Coin = { denom: string; amount: string }

const coin = (c: Coin) => new Writer().string(1, c.denom).string(2, c.amount).finish()

/** What executeTx needs off a message. Structurally what the generated ones give. */
type Msg<T> = {
  typeUrl: string
  fromPartial: (values: Partial<T>) => T
  toProto: (value: T) => Uint8Array
}

const msg = <T extends object>(
  name: string,
  defaults: T,
  encode: (w: Writer, v: T) => Writer
): Msg<T> => ({
  typeUrl: `/mizufinance.compliance.v1.${name}`,
  fromPartial: (values) => ({ ...defaults, ...values }),
  toProto: (value) => encode(new Writer(), value).finish(),
})

export type MsgAddSanctioned = {
  authority: string
  addresses: string[]
  reason: string
  ref: string
}

export const MsgAddSanctioned = msg<MsgAddSanctioned>(
  'MsgAddSanctioned',
  { authority: '', addresses: [], reason: '', ref: '' },
  (w, v) => w.string(1, v.authority).strings(2, v.addresses).string(3, v.reason).string(4, v.ref)
)

export const MsgRemoveSanctioned = msg<MsgAddSanctioned>(
  'MsgRemoveSanctioned',
  { authority: '', addresses: [], reason: '', ref: '' },
  (w, v) => w.string(1, v.authority).strings(2, v.addresses).string(3, v.reason).string(4, v.ref)
)

export type MsgFreeze = {
  authority: string
  address: string
  reason: string
  ref: string
}

export const MsgFreeze = msg<MsgFreeze>(
  'MsgFreeze',
  { authority: '', address: '', reason: '', ref: '' },
  (w, v) => w.string(1, v.authority).string(2, v.address).string(3, v.reason).string(4, v.ref)
)

export const MsgUnfreeze = msg<MsgFreeze>(
  'MsgUnfreeze',
  { authority: '', address: '', reason: '', ref: '' },
  (w, v) => w.string(1, v.authority).string(2, v.address).string(3, v.reason).string(4, v.ref)
)

export type MsgSeize = {
  authority: string
  from: string
  to: string
  amount: Coin[]
  reason: string
  ref: string
}

export const MsgSeize = msg<MsgSeize>(
  'MsgSeize',
  { authority: '', from: '', to: '', amount: [], reason: '', ref: '' },
  (w, v) => {
    w.string(1, v.authority).string(2, v.from).string(3, v.to)
    for (const c of v.amount) w.bytes(4, coin(c))
    return w.string(5, v.reason).string(6, v.ref)
  }
)

export type MsgSetGlobalPause = {
  authority: string
  paused: boolean
  reason: string
  ref: string
}

export const MsgSetGlobalPause = msg<MsgSetGlobalPause>(
  'MsgSetGlobalPause',
  { authority: '', paused: false, reason: '', ref: '' },
  (w, v) => w.string(1, v.authority).bool(2, v.paused).string(3, v.reason).string(4, v.ref)
)

// --- the authority wrapper ---------------------------------------------------
//
// Every message above is rejected if it arrives signed by the owner directly:
// the `authority` field has to be the x/authority module address, and the owner
// reaches it by wrapping the message in an authority MsgExec. That is what
// x/compliance/client/cli/tx.go does for the CLI, and it is what the page does
// here. The module address is read off the chain rather than hardcoded.

export type MsgExec = {
  sender: string
  msg: { typeUrl: string; value: Uint8Array }
}

const anyOf = (m: { typeUrl: string; value: Uint8Array }) =>
  new Writer().string(1, m.typeUrl).bytes(2, m.value).finish()

export const MsgExec: Msg<MsgExec> = {
  typeUrl: '/mizufinance.authority.v1.MsgExec',
  fromPartial: (values) => ({
    sender: '',
    msg: { typeUrl: '', value: new Uint8Array() },
    ...values,
  }),
  toProto: (value) => new Writer().string(1, value.sender).bytes(2, anyOf(value.msg)).finish(),
}

/**
 * One compliance message, ready to hand to executeTx. `sender` is the owner
 * signing it and `authority` inside `values` is the module address.
 */
export const exec = <T extends object>(sender: string, inner: Msg<T>, values: Partial<T>) => ({
  msg: MsgExec,
  values: {
    sender,
    msg: { typeUrl: inner.typeUrl, value: inner.toProto(inner.fromPartial(values)) },
  },
})
