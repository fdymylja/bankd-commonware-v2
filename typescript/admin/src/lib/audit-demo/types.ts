export type AuditField = 'sender' | 'receiver' | 'amount'
export type AuditScope =
  | { kind: 'time_range'; startUnix: number; endUnix: number }
  | { kind: 'tx_id'; txId: string }

export type AuditRequest = {
  requestId: string
  mode: 'subject' | 'investigation' | 'transaction'
  subject?: string
  scope: AuditScope
  fields: AuditField[]
  issuedAt: string
  expiresAt: string
}

export type AuditInput = Pick<AuditRequest, 'subject' | 'scope' | 'fields'>

export type OrbisAuditRow = {
  output_ref: {
    height: number
    bankd_tx_hash: string
    action_index: number
    output_index: number
  }
  field: AuditField
  value: string
  alias?: string
  status: 'decrypt_succeeded'
}

export type AuditRun = {
  request: AuditRequest
  status: 'completed' | 'denied' | 'failed'
  result?: { objects: OrbisAuditRow[] }
  timings: { label: string; durationMs: number }[]
  completedAt: string
  error?: string
}

export type DemoUser = {
  name: string
  slug: string
}

export type AuditState = { users: DemoUser[]; runs: AuditRun[] }
