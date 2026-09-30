import type { SealedAuditPackage } from '@mizufinance/wasm/orbis'
import { candidates, confirmCandidate, transferOutputs } from './index'
import { runNative } from './native'
import { projectTransfer, type DecodedField } from './projection'
import { attachPackages, readState, updateState } from './store'
import type { AuditRequest, AuditRun, OrbisAuditRow } from './types'

export async function attach(packages: SealedAuditPackage[]) {
  if (!Array.isArray(packages) || !packages.length || packages.length > 96)
    throw new Error('Expected 1 to 96 sealed packages')
  const transactionId = packages[0]?.binding?.transaction_id
  if (
    typeof transactionId !== 'string' ||
    !/^[a-f\d]{64}$/.test(transactionId) ||
    packages.some((p) => p.binding?.transaction_id !== transactionId)
  )
    throw new Error('Attachment must contain one canonical transaction')
  const { delivery } = await readState()
  for (const package_ of packages) {
    const policy = package_.binding.delivery
    if (
      !policy ||
      policy.ring_id !== delivery.policy.ring_id ||
      policy.policy_id !== delivery.policy.policy_id ||
      policy.resource !== delivery.policy.resource ||
      policy.permission !== delivery.policy.permission ||
      JSON.stringify(package_.context?.ring_pk) !==
        JSON.stringify(delivery.ring_pk)
    )
      throw new Error('Package targets another Orbis delivery ring')
  }
  const found = await candidates(undefined, transactionId)
  if (found.length !== 1)
    throw new Error('Accepted transaction is not indexed yet')
  const accepted = await confirmCandidate(found[0]!)
  const entries = packages.map((package_) => ({
    height: accepted.height,
    package: package_,
  }))
  const registered = await runNative('register', entries)
  const stored = entries.map((entry, index) => ({
    ...entry,
    bankdTxHash: accepted.bankd_tx_hash,
    objectId: registered[index]!.object_id,
  }))
  await updateState((state) => attachPackages(state, stored))
  return { attached: stored.length }
}

export async function audit(request: AuditRequest): Promise<AuditRun> {
  const started = performance.now()
  let run: AuditRun
  const timings: AuditRun['timings'] = []
  let phaseStart = started
  const phase = (label: string) => {
    const now = performance.now()
    timings.push({ label, durationMs: now - phaseStart })
    phaseStart = now
  }
  try {
    const state = await readState()
    if (
      request.subject &&
      !state.users.some((user) => user.name === request.subject)
    )
      throw new Error('Unknown audit participant')
    const indexed = await candidates(request.scope)
    phase('Candidate discovery')
    const objects: OrbisAuditRow[] = []
    const selected: { height: number; package: SealedAuditPackage }[] = []
    const groups: {
      start: number
      count: number
      reference: OrbisAuditRow['output_ref']
    }[] = []
    let transfers = 0
    for (const candidate of indexed) {
      const accepted = await confirmCandidate(candidate)
      const scope = request.scope
      if (
        scope.kind === 'time_range' &&
        (accepted.block_time_unix < scope.startUnix ||
          accepted.block_time_unix > scope.endUnix)
      )
        continue
      if (
        scope.kind === 'tx_id' &&
        accepted.bankd_tx_hash !== scope.txId.toLowerCase()
      )
        throw new Error('Indexed transaction scope mismatch')
      for (const output of transferOutputs(accepted)) {
        if (++transfers > 32)
          throw new Error('Too many transfers; narrow the audit range')
        const fields =
          request.mode === 'subject'
            ? (['sender', 'receiver', 'amount'] as const)
            : request.fields
        const packages = fields.map((field) => {
          const stored = state.packages.find(
            (row) =>
              row.height === accepted.height &&
              row.package.binding.transaction_id === accepted.shieldd_tx_hash &&
              row.package.binding.action === output.actionIndex &&
              row.package.binding.output === output.outputIndex &&
              row.package.binding.field === field
          )
          if (!stored) throw new Error(`Audit package unavailable: ${field}`)
          return { height: stored.height, package: stored.package }
        })
        groups.push({
          start: selected.length,
          count: packages.length,
          reference: {
            height: accepted.height,
            bankd_tx_hash: accepted.bankd_tx_hash,
            action_index: output.actionIndex,
            output_index: output.outputIndex,
          },
        })
        selected.push(...packages)
      }
    }
    if (request.scope.kind === 'tx_id' && !transfers)
      throw new Error('Transaction unavailable for audit')
    phase('Acceptance and package selection')
    if (selected.length) {
      const rows = await runNative('audit', selected)
      phase('Authorization and PRE')
      for (const group of groups) {
        const decoded: DecodedField[] = rows
          .slice(group.start, group.start + group.count)
          .map((row) => ({
            field: row.field,
            value: row.value!,
            reference: group.reference,
          }))
        objects.push(...projectTransfer(request, decoded, state.users))
      }
    }
    if (Date.parse(request.expiresAt) <= Date.now())
      throw new Error('Audit request expired')
    run = {
      request,
      status: 'completed',
      result: { objects },
      timings: [],
      completedAt: new Date().toISOString(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed'
    run = {
      request,
      status: /permission.?denied|access denied/i.test(message)
        ? 'denied'
        : 'failed',
      error: message,
      timings: [],
      completedAt: new Date().toISOString(),
    }
  }
  run.timings = [
    ...timings,
    { label: 'Total', durationMs: performance.now() - started },
  ]
  await updateState((state) => {
    state.runs = [
      run,
      ...state.runs.filter((r) => r.request.requestId !== request.requestId),
    ].slice(0, 30)
  })
  return run
}
