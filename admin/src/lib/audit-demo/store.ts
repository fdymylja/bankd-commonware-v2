import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { OrbisDelivery, SealedAuditPackage } from '@mizufinance/wasm/orbis'
import type { AuditRun } from './types'
import type { Participant } from './projection'

export type StoredPackage = {
  height: number
  bankdTxHash: string
  objectId: string
  package: SealedAuditPackage
}
export type DemoState = {
  version: 1
  delivery: OrbisDelivery
  users: Participant[]
  packages: StoredPackage[]
  runs: AuditRun[]
}
const queues = new Map<string, Promise<unknown>>()
export function stateFile() {
  return path.resolve(
    process.env.AUDIT_DEMO_STATE ??
      path.join(
        process.cwd().endsWith('/admin') ? '..' : '.',
        '.localnet/audit-demo/state.json'
      )
  )
}
export async function readState(file = stateFile()): Promise<DemoState> {
  const state: DemoState = JSON.parse(await readFile(file, 'utf8'))
  if (
    state.version !== 1 ||
    !state.delivery ||
    !Array.isArray(state.users) ||
    !Array.isArray(state.packages) ||
    !Array.isArray(state.runs)
  )
    throw new Error('Invalid demo state; run fresh demo setup')
  return state
}
export function updateState<T>(
  change: (state: DemoState) => T | Promise<T>,
  file = stateFile()
): Promise<T> {
  const next = (queues.get(file) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const state = await readState(file)
      const result = await change(state)
      await mkdir(path.dirname(file), { recursive: true })
      const temporary = `${file}.${randomUUID()}.tmp`
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
      await rename(temporary, file)
      return result
    })
  queues.set(file, next)
  void next
    .finally(() => {
      if (queues.get(file) === next) queues.delete(file)
    })
    .catch(() => undefined)
  return next
}
export function packageKey(package_: SealedAuditPackage) {
  const b = package_.binding
  return `${b.chain_id}:${b.transaction_id}:${b.action}:${b.output}:${b.field}`
}
export function attachPackages(state: DemoState, incoming: StoredPackage[]) {
  const existing = new Map(
    state.packages.map((row) => [packageKey(row.package), row])
  )
  for (const row of incoming) {
    const key = packageKey(row.package),
      previous = existing.get(key)
    if (
      previous &&
      (previous.objectId !== row.objectId ||
        previous.height !== row.height ||
        previous.bankdTxHash !== row.bankdTxHash)
    )
      throw new Error('Conflicting audit package attachment')
    existing.set(key, row)
  }
  if (existing.size > 4096)
    throw new Error('Demo package limit reached; reset disposable demo state')
  state.packages = [...existing.values()]
}

export function clearAuditHistory(file = stateFile()) {
  return updateState((state) => {
    state.runs = []
  }, file)
}
