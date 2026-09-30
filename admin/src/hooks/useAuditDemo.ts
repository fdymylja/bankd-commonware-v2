'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AuditInput, AuditRun, AuditState } from '@/lib/audit-demo/types'
export type { DemoUser } from '@/lib/audit-demo/types'

export function useAuditDemo() {
  const [state, setState] = useState<AuditState | null>(null)
  const [submittingAction, setSubmittingAction] = useState<string | null>(null)
  const loadState = useCallback(async () => {
    const response = await fetch('/api/audit-demo/state', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load audit demo state')
    const payload: { state: AuditState } = await response.json()
    setState(payload.state)
  }, [])

  useEffect(() => {
    void loadState().catch(console.error)
  }, [loadState])

  const runAction = useCallback(async (action: string, body: AuditInput) => {
    setSubmittingAction(action)
    try {
      const response = await fetch(`/api/audit-demo/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload: { run?: AuditRun; error?: string } = await response.json()
      if (!response.ok && !payload.run)
        throw new Error(payload.error ?? 'Audit request failed')
      if (!payload.run) throw new Error('Audit result was not returned')
      return { run: payload.run }
    } finally {
      setSubmittingAction(null)
    }
  }, [])

  return { state, submittingAction, loadState, runAction }
}
