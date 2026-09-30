export type RampAction = 'deposit' | 'withdraw'

export type StageKey =
  | 'requested'
  | 'debited'
  | 'verified'
  | 'issued'
  | 'redeemed'
  | 'credited'

export type Stage = {
  key: StageKey
  label: string
  /** What the money is actually doing at this point, for the operator. */
  detail: string
}

// Deposit moves fiat first (the debit is reversible), then issues on chain.
export const DEPOSIT_STAGES: Stage[] = [
  { key: 'requested', label: 'Request accepted', detail: 'Idempotency key assigned' },
  { key: 'debited', label: 'Fiat debited', detail: 'Funds left the banking core' },
  { key: 'verified', label: 'Debit verified', detail: 'Re-read from the core one block later' },
  { key: 'issued', label: 'Issued on ledger', detail: 'Customer holds the balance on chain' },
]

// Withdraw burns first: the burn is the gate, so no fiat moves against funds
// that were never there.
export const WITHDRAW_STAGES: Stage[] = [
  { key: 'requested', label: 'Request accepted', detail: 'Idempotency key assigned' },
  { key: 'redeemed', label: 'Redeemed on ledger', detail: 'On-chain balance destroyed' },
  { key: 'credited', label: 'Fiat credited', detail: 'Funds back in the customer account' },
]

export function stagesFor(action: RampAction): Stage[] {
  return action === 'deposit' ? DEPOSIT_STAGES : WITHDRAW_STAGES
}

export type StageEvent = {
  type: 'stage'
  key: StageKey
  at: string
  transactionId?: string
  txHash?: string
}

export type LogEvent = { type: 'log'; line: string }
export type DoneEvent = { type: 'done'; requestId: string }
export type ErrorEvent = { type: 'error'; message: string }
export type RampEvent = StageEvent | LogEvent | DoneEvent | ErrorEvent

/**
 * Maps a bridge log line onto a stage. The bridge writes slog text to stderr,
 * so the match is on the msg text it already prints.
 */
export function stageFromLog(line: string): Omit<StageEvent, 'at' | 'type'> | null {
  const fields = parseFields(line)
  if (line.includes('PENDING: fiat debited from customer')) {
    return { key: 'debited', transactionId: fields.transactionId }
  }
  if (line.includes('VERIFIED: transaction still present in banking core')) {
    return { key: 'verified', transactionId: fields.transactionId }
  }
  if (line.includes('LIVE: minted on')) {
    return { key: 'issued', txHash: fields.tx }
  }
  if (line.includes('BURNED: tokens destroyed on chain')) {
    return { key: 'redeemed', txHash: fields.tx }
  }
  if (line.includes('LIVE: fiat credited to customer')) {
    return { key: 'credited', transactionId: fields.transactionId }
  }
  return null
}

function parseFields(line: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const match of line.matchAll(/(\w+)=("[^"]*"|\S+)/g)) {
    out[match[1]] = match[2].replace(/^"|"$/g, '')
  }
  return out
}
