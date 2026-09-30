import type {
  Transaction,
  TransactionPlan,
} from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import type { OrbisDelivery } from '@mizufinance/wasm/orbis'
import { enqueuePackages } from './outbox'

export async function prepareAuditPackages(
  plan: TransactionPlan,
  transaction: Transaction
) {
  if (process.env.NEXT_PUBLIC_ORBIS_AUDIT_DEMO !== 'true') return
  if (!plan.actions.some((action) => action.action.case === 'transfer')) return
  const response = await fetch('/api/audit-demo/config', {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 204) return
  if (!response.ok) throw new Error('Orbis demo configuration unavailable')
  const delivery: OrbisDelivery = await response.json()
  const { prepareOrbisPackages } = await import('@mizufinance/wasm/orbis')
  await enqueuePackages(await prepareOrbisPackages(plan, transaction, delivery))
}
