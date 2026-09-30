import { openDB, type DBSchema } from 'idb'
import type { SealedAuditPackage } from '@mizufinance/wasm/orbis'

type Entry = {
  id: string
  packages: SealedAuditPackage[]
  attempts: number
  retryAt: number
}
interface Outbox extends DBSchema {
  packages: { key: string; value: Entry }
}
const database = () =>
  openDB<Outbox>('orbis-audit-outbox', 1, {
    upgrade(db) {
      db.createObjectStore('packages', { keyPath: 'id' })
    },
  })

/** Only sealed packages cross this durable boundary, before payment broadcast. */
export async function enqueuePackages(packages: SealedAuditPackage[]) {
  if (!packages.length) return
  const first = packages[0]!.binding
  const id = `${first.chain_id}:${first.transaction_id}`
  if (
    packages.length > 96 ||
    packages.some(
      (p) =>
        p.binding.chain_id !== first.chain_id ||
        p.binding.transaction_id !== first.transaction_id
    )
  )
    throw new Error('Invalid audit package batch')
  const db = await database()
  try {
    const tx = db.transaction('packages', 'readwrite')
    if (await tx.store.get(id)) {
      await tx.done
      return
    }
    if ((await tx.store.count()) >= 50) {
      await tx.done
      throw new Error('Audit upload queue is full')
    }
    await tx.store.put({ id, packages, attempts: 0, retryAt: 0 })
    await tx.done
  } finally {
    db.close()
  }
}

let flushing: Promise<void> | undefined
export function flushPackages(): Promise<void> {
  if (flushing) return flushing
  flushing = flush().finally(() => {
    flushing = undefined
  })
  return flushing
}
async function flush() {
  const db = await database()
  try {
    for (const entry of await db.getAll('packages')) {
      if (entry.retryAt > Date.now()) continue
      let attached = false
      try {
        const response = await fetch('/api/audit-demo/objects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(entry.packages),
          signal: AbortSignal.timeout(180_000),
        })
        const result = await response.json()
        attached = response.ok && result.attached === entry.packages.length
      } catch {
        /* Retain sealed packages across outages and reloads. */
      }
      if (attached) await db.delete('packages', entry.id)
      else
        await db.put('packages', {
          ...entry,
          attempts: Math.min(entry.attempts + 1, 10),
          retryAt: Date.now() + Math.min(60_000, 1000 * 2 ** entry.attempts),
        })
    }
  } finally {
    db.close()
  }
}

export function startPackageUploads() {
  const retry = () => {
    void flushPackages().catch(() => undefined)
  }
  retry()
  const interval = setInterval(retry, 15_000)
  window.addEventListener('online', retry)
  return () => {
    clearInterval(interval)
    window.removeEventListener('online', retry)
  }
}
