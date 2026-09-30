import { createHash } from 'node:crypto'
import { Transaction } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import { wrapShielddTransaction } from '@/lib/native-wallet/penumbra/embedded-shieldd'
import type { AuditScope } from './types'
import type { StoredPackage } from './store'

export type Candidate = {
  height: number
  block_time_unix: number
  bankd_tx_hash: string
  shieldd_tx_hash: string
  tx_index: number
  tx_bytes: string
}
const rpc = () =>
  (
    process.env.AUDIT_DEMO_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    'http://127.0.0.1:27657'
  ).replace(/\/$/, '')
export async function candidates(
  scope?: AuditScope,
  shielddId?: string
): Promise<Candidate[]> {
  const filter = shielddId
    ? `{ shieldd_tx_hash: { _eq: ${JSON.stringify(shielddId)} } }`
    : scope?.kind === 'tx_id'
      ? `{ bankd_tx_hash: { _eq: ${JSON.stringify(scope.txId.toLowerCase())} } }`
      : scope?.kind === 'time_range'
        ? `{ _and: [{ block_time_unix: { _geq: ${scope.startUnix} } }, { block_time_unix: { _leq: ${scope.endUnix} } }] }`
        : undefined
  const response = await fetch(
    process.env.SHINZO_GRAPHQL_URL ?? 'http://127.0.0.1:9181/api/v0/graphql',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        query: `query { rows: ShielddMutationTx(${filter ? `filter: ${filter},` : ''} order: [{ height: DESC }, { tx_index: DESC }], limit: 101) { height block_time_unix bankd_tx_hash shieldd_tx_hash tx_index tx_bytes } }`,
      }),
    }
  )
  const payload: { data?: { rows?: Candidate[] }; errors?: unknown[] } =
    await response.json()
  if (
    !response.ok ||
    payload.errors?.length ||
    !Array.isArray(payload.data?.rows)
  )
    throw new Error('Shinzo index unavailable')
  if (scope && payload.data.rows.length > 100)
    throw new Error('Too many candidates; narrow the audit range')
  return payload.data.rows.slice(0, 100)
}

/** Index rows locate candidates; the chosen node supplies acceptance and block time. */
export async function confirmCandidate(
  candidate: Candidate
): Promise<Candidate> {
  if (
    !Number.isSafeInteger(candidate.height) ||
    candidate.height < 1 ||
    !/^[a-f\d]{64}$/i.test(candidate.bankd_tx_hash) ||
    !/^[a-f\d]{64}$/.test(candidate.shieldd_tx_hash)
  )
    throw new Error('Malformed indexed transaction')
  const bytes = Buffer.from(candidate.tx_bytes, 'base64')
  if (
    bytes.length > 100 * 1024 * 1024 ||
    createHash('sha256').update(bytes).digest('hex') !==
      candidate.shieldd_tx_hash
  )
    throw new Error('Indexed transaction ID mismatch')
  const expected = Buffer.from(wrapShielddTransaction(bytes))
  if (
    createHash('sha256').update(expected).digest('hex') !==
    candidate.bankd_tx_hash.toLowerCase()
  )
    throw new Error('Indexed Bankd transaction mismatch')
  const response = await fetch(
    `${rpc()}/tx?hash=0x${candidate.bankd_tx_hash}`,
    { cache: 'no-store', signal: AbortSignal.timeout(15_000) }
  )
  const payload: {
    result?: { height: string; tx: string; tx_result: { code: number } }
  } = await response.json()
  if (
    !response.ok ||
    !payload.result ||
    Number(payload.result.tx_result.code) !== 0 ||
    Number(payload.result.height) !== candidate.height ||
    !Buffer.from(payload.result.tx, 'base64').equals(expected)
  )
    throw new Error('Candidate is not an accepted transaction')
  const blockResponse = await fetch(
    `${rpc()}/block?height=${candidate.height}`,
    { cache: 'no-store', signal: AbortSignal.timeout(15_000) }
  )
  const block: {
    result?: { block?: { header?: { height: string; time: string } } }
  } = await blockResponse.json()
  const header = block.result?.block?.header
  const timestamp = header ? Math.floor(Date.parse(header.time) / 1000) : NaN
  if (
    !blockResponse.ok ||
    !header ||
    Number(header.height) !== candidate.height ||
    !Number.isSafeInteger(timestamp)
  )
    throw new Error('Accepted block time unavailable')
  return {
    ...candidate,
    bankd_tx_hash: candidate.bankd_tx_hash.toLowerCase(),
    block_time_unix: timestamp,
  }
}

export function transferOutputs(candidate: Candidate) {
  const transaction = Transaction.fromBinary(
    Buffer.from(candidate.tx_bytes, 'base64')
  )
  return (transaction.body?.actions ?? []).flatMap((action, actionIndex) => {
    if (action.action.case !== 'transfer') return []
    const output = action.action.value.body?.outputs[0]
    if (!output?.complianceCiphertext.length) return []
    return [
      {
        actionIndex,
        outputIndex: 0,
        encryptedPayload: Buffer.from(output.complianceCiphertext).toString(
          'hex'
        ),
      },
    ]
  })
}

export function transactionRows(rows: Candidate[], packages: StoredPackage[]) {
  return rows.flatMap((row) =>
    transferOutputs(row).map((output) => ({
      height: row.height,
      blockTimeUnix: row.block_time_unix,
      bankdTxHash: row.bankd_tx_hash.toLowerCase(),
      shielddTxHash: row.shieldd_tx_hash,
      txIndex: row.tx_index,
      ...output,
      auditable: ['amount', 'sender', 'receiver'].every((field) =>
        packages.some(
          (p) =>
            p.package.binding.transaction_id === row.shieldd_tx_hash &&
            p.height === row.height &&
            p.package.binding.action === output.actionIndex &&
            p.package.binding.field === field
        )
      ),
    }))
  )
}
