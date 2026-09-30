/**
 * Reading x/compliance state, server side.
 *
 * The REST gateway on :1317 answers "Not Implemented" for this module, so every
 * read here goes over CometBFT's abci_query instead. The pause flag is the odd
 * one out: there is no query RPC for it, so it is read as a raw store key
 * (GlobalPausedKey, prefix 8, in x/compliance/types/keys.go).
 */

const RPC = process.env.COMETBFT_RPC ?? 'http://localhost:27657'

const utf8 = new TextEncoder()

type AbciResponse = { code?: number; log?: string; value?: string | null; height?: string }

async function abci(path: string, data = ''): Promise<AbciResponse> {
  const url = `${RPC}/abci_query?path=${encodeURIComponent(`"${path}"`)}&data=0x${data}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`abci_query ${path}: HTTP ${res.status}`)
  const body = (await res.json()) as { result?: { response?: AbciResponse }; error?: unknown }
  const response = body.result?.response
  if (!response) throw new Error(`abci_query ${path}: ${JSON.stringify(body.error ?? body)}`)
  if (response.code) throw new Error(`abci_query ${path}: ${response.log ?? `code ${response.code}`}`)
  return response
}

const bytesOf = (value: string | null | undefined) =>
  value ? Uint8Array.from(Buffer.from(value, 'base64')) : new Uint8Array()

// --- a protobuf reader, only the wire types this module's responses use ------

class Reader {
  private i = 0
  constructor(private readonly buf: Uint8Array) {}

  get done() {
    return this.i >= this.buf.length
  }

  varint() {
    let result = 0
    let shift = 0
    for (;;) {
      const b = this.buf[this.i++]
      result += (b & 0x7f) * 2 ** shift
      if (!(b & 0x80)) return result
      shift += 7
    }
  }

  /** field number and wire type off the next tag */
  key() {
    const tag = this.varint()
    return { field: tag >>> 3, wire: tag & 7 }
  }

  chunk() {
    const len = this.varint()
    const out = this.buf.subarray(this.i, this.i + len)
    this.i += len
    return out
  }

  string() {
    return Buffer.from(this.chunk()).toString('utf8')
  }

  /** step over a field this decoder does not care about */
  skip(wire: number) {
    if (wire === 0) this.varint()
    else if (wire === 2) this.chunk()
    else if (wire === 5) this.i += 4
    else if (wire === 1) this.i += 8
    else throw new Error(`unsupported wire type ${wire}`)
  }
}

/** Both Sanctioned and Frozen answer with `repeated string addresses = 1`. */
function decodeAddresses(bytes: Uint8Array) {
  const r = new Reader(bytes)
  const out: string[] = []
  while (!r.done) {
    const { field, wire } = r.key()
    if (field === 1 && wire === 2) out.push(r.string())
    else r.skip(wire)
  }
  return out
}

export type AuditEntry = {
  id: number
  height: number
  action: string
  authority: string
  addresses: string[]
  amount: { denom: string; amount: string }[]
  reason: string
  ref: string
}

function decodeEntry(bytes: Uint8Array): AuditEntry {
  const r = new Reader(bytes)
  const e: AuditEntry = {
    id: 0, height: 0, action: '', authority: '',
    addresses: [], amount: [], reason: '', ref: '',
  }
  while (!r.done) {
    const { field, wire } = r.key()
    if (field === 1 && wire === 0) e.id = r.varint()
    else if (field === 2 && wire === 0) e.height = r.varint()
    else if (field === 4 && wire === 2) e.action = r.string()
    else if (field === 5 && wire === 2) e.authority = r.string()
    else if (field === 6 && wire === 2) e.addresses.push(r.string())
    else if (field === 7 && wire === 2) {
      const c = new Reader(r.chunk())
      const coin = { denom: '', amount: '' }
      while (!c.done) {
        const k = c.key()
        if (k.field === 1 && k.wire === 2) coin.denom = c.string()
        else if (k.field === 2 && k.wire === 2) coin.amount = c.string()
        else c.skip(k.wire)
      }
      e.amount.push(coin)
    } else if (field === 8 && wire === 2) e.reason = r.string()
    else if (field === 9 && wire === 2) e.ref = r.string()
    else r.skip(wire)
  }
  return e
}

function decodeEntries(bytes: Uint8Array) {
  const r = new Reader(bytes)
  const out: AuditEntry[] = []
  while (!r.done) {
    const { field, wire } = r.key()
    if (field === 1 && wire === 2) out.push(decodeEntry(r.chunk()))
    else r.skip(wire)
  }
  return out
}

/** A PageRequest with a limit, wrapped as field 1 of the request message.
    `limit` is field 3. Field 2 is `offset`, and sending the limit there reads as
    "skip the first 500", which comes back as an empty list rather than an error. */
function pageRequest(limit: number) {
  const varint = (n: number) => {
    const bytes: number[] = []
    let v = n >>> 0
    while (v > 0x7f) {
      bytes.push((v & 0x7f) | 0x80)
      v >>>= 7
    }
    bytes.push(v)
    return bytes
  }
  const inner = [0x18, ...varint(limit)]
  return Buffer.from([0x0a, inner.length, ...inner]).toString('hex')
}

/** The x/authority owner, which is the only account these messages accept. */
export async function readAuthorityOwner() {
  const r = await abci('/mizufinance.authority.v1.Query/Owner')
  const reader = new Reader(bytesOf(r.value))
  while (!reader.done) {
    const { field, wire } = reader.key()
    if (field === 1 && wire === 2) return reader.string()
    reader.skip(wire)
  }
  return ''
}

/** What the ante decorator would see for one account, asked of the chain. */
export async function readIsBlocked(address: string) {
  const bytes = utf8.encode(address)
  const data = Buffer.from([0x0a, bytes.length, ...bytes]).toString('hex')
  const r = await abci('/mizufinance.compliance.v1.Query/IsBlocked', data)
  const reader = new Reader(bytesOf(r.value))
  const out = { sanctioned: false, frozen: false }
  while (!reader.done) {
    const { field, wire } = reader.key()
    if (field === 1 && wire === 0) out.sanctioned = reader.varint() === 1
    else if (field === 2 && wire === 0) out.frozen = reader.varint() === 1
    else reader.skip(wire)
  }
  return out
}

export type ComplianceState = {
  height: number
  paused: boolean
  owner: string
  authorityModule: string
  sanctioned: string[]
  frozen: string[]
  entries: AuditEntry[]
}

export async function readComplianceState(limit = 500): Promise<ComplianceState> {
  const page = pageRequest(limit)
  const [sanctioned, frozen, entries, paused, owner, authorityModule] = await Promise.all([
    abci('/mizufinance.compliance.v1.Query/Sanctioned', page),
    abci('/mizufinance.compliance.v1.Query/Frozen', page),
    abci('/mizufinance.compliance.v1.Query/AuditEntries', page),
    abci('/store/compliance/key', '08'),
    readAuthorityOwner(),
    readAuthorityModule(),
  ])
  return {
    height: Number(sanctioned.height ?? 0),
    owner,
    authorityModule,
    // the key is absent until the switch is thrown once, and collections stores
    // a bool as a single 0x00 / 0x01 byte
    paused: bytesOf(paused.value)[0] === 1,
    sanctioned: decodeAddresses(bytesOf(sanctioned.value)),
    frozen: decodeAddresses(bytesOf(frozen.value)),
    entries: decodeEntries(bytesOf(entries.value)).sort((a, b) => b.id - a.id),
  }
}

/**
 * The x/authority module account, which is what every compliance message wants
 * in its `authority` field. Read off the chain so a prefix or module rename does
 * not leave a stale constant in the page.
 */
export async function readAuthorityModule(): Promise<string> {
  const rest = process.env.REST_URL ?? 'http://localhost:11317'
  const res = await fetch(`${rest}/cosmos/auth/v1beta1/module_accounts`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`module_accounts: HTTP ${res.status}`)
  const body = (await res.json()) as {
    accounts?: { name?: string; base_account?: { address?: string } }[]
  }
  const hit = body.accounts?.find((a) => a.name === 'authority')
  if (!hit?.base_account?.address) throw new Error('no authority module account')
  return hit.base_account.address
}
