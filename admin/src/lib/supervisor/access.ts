import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'

const SUBJECT_HEADER = 'x-supervisor-subject'

type GrantsResponse = {
  subjects?: string[]
}

export type SupervisorAccess = {
  role: 'federal' | 'regional'
  scope: string
  subject: string
}

export type SupervisorAccessDecision =
  | { granted: true; access: SupervisorAccess }
  | { granted: false; response: NextResponse }

function requestSubject(request: NextRequest, role: SupervisorAccess['role']) {
  const supplied = request.headers.get(SUBJECT_HEADER)?.trim()
  if (supplied) return supplied
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.SUPERVISOR_DEV_AUTH !== 'false' &&
    role === 'federal'
  ) {
    return 'federal-supervisor'
  }
  return ''
}

export async function authorizeDisclosureSubject(
  subject: string,
  role: SupervisorAccess['role'],
  scope: string
): Promise<SupervisorAccessDecision> {
  try {
    const restURL = process.env.BANKD_DISCLOSURE_URL
    if (!restURL) return { granted: false, response: NextResponse.json({ error: 'Disclosure grants are unavailable on this base. Configure BANKD_DISCLOSURE_URL for an authorized disclosure service.' }, { status: 501 }) }
    const response = await fetch(`${restURL}/disclosure/v1/grants/${encodeURIComponent(role)}/${encodeURIComponent(scope)}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error(`x/disclosure returned HTTP ${response.status}`)
    const grants = (await response.json()) as GrantsResponse
    const encodedSubject = Buffer.from(subject, 'utf8').toString('base64')
    if (!(grants.subjects ?? []).includes(encodedSubject)) {
      return { granted: false, response: NextResponse.json({ error: 'Disclosure scope is not granted', role, scope }, { status: 403 }) }
    }
    return { granted: true, access: { role, scope, subject } }
  } catch (error) {
    console.error('[supervisor] Failed to query x/disclosure:', error)
    return { granted: false, response: NextResponse.json({ error: 'Unable to verify disclosure scope' }, { status: 502 }) }
  }
}

export async function authorizeSupervisorRequest(request: NextRequest, role: SupervisorAccess['role'], scope: string): Promise<SupervisorAccessDecision> {
  const subject = requestSubject(request, role)
  if (!subject) return { granted: false, response: NextResponse.json({ error: `Missing ${SUBJECT_HEADER} authenticated-subject header` }, { status: 401 }) }
  if (process.env.NODE_ENV === 'production' && process.env.SUPERVISOR_TRUST_PROXY_AUTH !== 'true') {
    return { granted: false, response: NextResponse.json({ error: 'Supervisor upstream authentication is not configured' }, { status: 503 }) }
  }
  return authorizeDisclosureSubject(subject, role, scope)
}
