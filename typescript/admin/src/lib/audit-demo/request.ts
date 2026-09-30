import { randomUUID } from 'node:crypto'
import type { AuditField, AuditRequest, AuditScope } from './types'

export function normalizeRequest(
  action: string,
  raw: unknown,
  now = Date.now()
): AuditRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Invalid audit request')
  const body = raw as {
    subject?: unknown
    fields?: unknown
    scope?: unknown
    expiresAt?: unknown
  }
  const mode =
    action === 'audit-subject'
      ? 'subject'
      : action === 'investigate-time'
        ? 'investigation'
        : action === 'audit-transaction'
          ? 'transaction'
          : undefined
  if (!mode) throw new Error('Unknown audit action')
  if (
    !Array.isArray(body.fields) ||
    body.fields.length > 3 ||
    body.fields.length === 0 ||
    body.fields.some(
      (field) => !['sender', 'receiver', 'amount'].includes(field)
    )
  )
    throw new Error('Select supported audit fields')
  const fields = [...new Set(body.fields)] as AuditField[]
  if (
    mode === 'subject' &&
    !(fields.length === 3 || (fields.length === 1 && fields[0] === 'amount'))
  )
    throw new Error('Select Regular or Extended audit')
  if (!body.scope || typeof body.scope !== 'object')
    throw new Error('Audit scope is required')
  const supplied = body.scope as {
    kind?: unknown
    txId?: unknown
    startUnix?: unknown
    endUnix?: unknown
  }
  let scope: AuditScope
  if (mode === 'transaction') {
    if (
      supplied.kind !== 'tx_id' ||
      typeof supplied.txId !== 'string' ||
      !/^[a-f\d]{64}$/i.test(supplied.txId)
    )
      throw new Error('Invalid transaction ID')
    scope = { kind: 'tx_id', txId: supplied.txId.toLowerCase() }
  } else {
    if (
      supplied.kind !== 'time_range' ||
      !Number.isSafeInteger(supplied.startUnix) ||
      !Number.isSafeInteger(supplied.endUnix) ||
      Number(supplied.startUnix) < 0 ||
      Number(supplied.startUnix) > Number(supplied.endUnix)
    )
      throw new Error('Invalid timestamp range')
    scope = {
      kind: 'time_range',
      startUnix: Number(supplied.startUnix),
      endUnix: Number(supplied.endUnix),
    }
  }
  if (
    mode === 'subject' &&
    (typeof body.subject !== 'string' ||
      body.subject.length === 0 ||
      body.subject.length > 100)
  )
    throw new Error('Select an audit participant')
  const expiresAt =
    body.expiresAt === undefined
      ? now + 15 * 60_000
      : typeof body.expiresAt === 'string'
        ? Date.parse(body.expiresAt)
        : NaN
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + 15 * 60_000
  )
    throw new Error('Invalid or expired audit request')
  return {
    requestId: randomUUID(),
    mode,
    ...(mode === 'subject' ? { subject: body.subject as string } : {}),
    scope,
    fields,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  }
}
