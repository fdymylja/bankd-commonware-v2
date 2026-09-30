import { type NextRequest, NextResponse } from 'next/server'
import { type Address, getAddress } from 'viem'

import { authorizeDisclosureSubject } from '@/lib/supervisor/access'

export type ContractsAccessDecision = { granted: true; access: { subject: string; wallet: Address; canRead: true; canWrite: true } } | { granted: false; response: NextResponse }
const denied = (error: string, status: number): ContractsAccessDecision => ({ granted: false, response: NextResponse.json({ error }, { status }) })

export async function authorizeContractsRequest(request: NextRequest): Promise<ContractsAccessDecision> {
  let subject = '', walletInput = ''
  if (process.env.NODE_ENV === 'production') {
    if (process.env.SUPERVISOR_TRUST_PROXY_AUTH !== 'true') return denied('Contract tooling upstream authentication is not configured', 503)
    subject = request.headers.get('x-supervisor-subject')?.trim() ?? ''
    walletInput = request.headers.get('x-supervisor-wallet')?.trim() ?? ''
  } else {
    if (process.env.CONTRACTS_DEV_AUTH !== 'true') return denied('Contract tooling development authentication is disabled', 503)
    subject = process.env.CONTRACTS_DEV_SUBJECT?.trim() ?? ''
    walletInput = process.env.CONTRACTS_DEV_WALLET?.trim() ?? ''
  }
  if (!subject || !walletInput) return denied('Missing trusted contract-tool identity', 401)
  let wallet: Address
  try { wallet = getAddress(walletInput.toLowerCase()) } catch { return denied('Trusted contract-tool wallet is invalid', 401) }
  const disclosure = await authorizeDisclosureSubject(subject, 'federal', 'all')
  if (!disclosure.granted) return disclosure
  return { granted: true, access: { subject, wallet, canRead: true, canWrite: true } }
}
