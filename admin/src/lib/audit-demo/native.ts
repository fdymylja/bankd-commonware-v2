import { spawn } from 'node:child_process'
import type { SealedAuditPackage } from '@mizufinance/wasm/orbis'
import type { AuditField } from './types'
import type { DecodedValue } from './projection'

export type NativeRow = {
  reference: {
    transaction_id: string
    height: number
    action: { Body: number }
    output: number
  }
  field: AuditField
  object_id: string
  value?: DecodedValue
}
export function runNative(
  operation: 'register' | 'audit',
  packages: { height: number; package: SealedAuditPackage }[]
): Promise<NativeRow[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.SHIELDD_PCLI_BIN ?? 'pcli',
      [
        'disclosure',
        `orbis-${operation}`,
        '--node',
        process.env.AUDIT_DEMO_NODE_URL ?? 'http://127.0.0.1:9190',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )
    let stdout = '',
      stderr = '',
      overflow = false
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Orbis audit timed out'))
    }, 180_000)
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (stdout.length > 2 * 1024 * 1024) {
        overflow = true
        child.kill('SIGTERM')
      }
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 8192) stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new Error(`Audit runner unavailable: ${error.message}`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (overflow)
        return reject(new Error('Malformed oversized Orbis response'))
      if (code !== 0)
        return reject(new Error(stderr.trim() || 'Orbis request failed'))
      try {
        const rows: NativeRow[] = JSON.parse(stdout)
        if (!Array.isArray(rows) || rows.length !== packages.length)
          throw new Error('Malformed Orbis result count')
        for (const [index, row] of rows.entries()) {
          const expected = packages[index]!
          if (
            row.reference.transaction_id !==
              expected.package.binding.transaction_id ||
            row.reference.height !== expected.height ||
            row.reference.action.Body !== expected.package.binding.action ||
            row.reference.output !== expected.package.binding.output ||
            row.field !== expected.package.binding.field ||
            !/^[a-f\d]{64}$/.test(row.object_id) ||
            (operation === 'audit' && !row.value)
          )
            throw new Error('Malformed Orbis result binding')
        }
        resolve(rows)
      } catch (error) {
        reject(error)
      }
    })
    child.stdin.on('error', () => {
      /* Process exit is reported above. */
    })
    child.stdin.end(JSON.stringify({ packages }))
  })
}
