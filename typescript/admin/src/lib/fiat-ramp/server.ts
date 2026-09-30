import { existsSync } from 'node:fs'
import https from 'node:https'
import path from 'node:path'

// Lived in lib/audit-demo/server, which went away with the audit demo.
export function repoRoot() {
  const cwd = process.cwd()
  if (existsSync(path.join(cwd, 'infra/docker-compose.yml'))) {
    return cwd
  }
  return path.resolve(cwd, '../..')
}

export type CoreConfig = {
  baseUrl: string
  user: string
  password: string
  tenant: string
  accountId: string
  currency: string
  /** Decimals the banking core holds the currency at (Fineract seed uses 2). */
  decimals: number
  /** Decimals of the native denom on chain (ubrl is 6). */
  chainDecimals: number
}

export function coreConfig(): CoreConfig {
  return {
    baseUrl:
      process.env.FINERACT_BASE_URL ??
      'https://localhost:8443/fineract-provider/api/v1',
    user: process.env.FINERACT_USER ?? 'mifos',
    password: process.env.FINERACT_PASSWORD ?? 'password',
    tenant: process.env.FINERACT_TENANT ?? 'default',
    accountId: process.env.ALICE_ACCOUNT_ID ?? '',
    currency: process.env.FIAT_RAMP_CURRENCY ?? 'BRL',
    decimals: Number(process.env.FIAT_RAMP_DECIMALS ?? 2),
    chainDecimals: Number(process.env.FIAT_RAMP_CHAIN_DECIMALS ?? 6),
  }
}

export type CoreAccount = {
  accountId: string
  accountNo: string
  clientName: string
  balance: number
  currency: string
}

/** Reads the customer's savings account straight from the banking core. */
export async function readCoreAccount(
  cfg: CoreConfig = coreConfig()
): Promise<CoreAccount> {
  if (!cfg.accountId) {
    throw new Error(
      'ALICE_ACCOUNT_ID is not set; run services/banking-transfer-service/setup-fineract.sh and export the ids it prints'
    )
  }
  const body = await getJSON(`${cfg.baseUrl}/savingsaccounts/${cfg.accountId}`, cfg)
  return {
    accountId: cfg.accountId,
    accountNo: String(body.accountNo ?? cfg.accountId),
    clientName: String(body.clientName ?? 'Customer'),
    balance: Number(body.summary?.accountBalance ?? 0),
    currency: String(body.currency?.code ?? cfg.currency),
  }
}

// The local Fineract runs on a self-signed cert, so this goes through an agent
// that skips verification. Demo stack only, never point it at a real core.
function getJSON(
  url: string,
  cfg: CoreConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const auth = Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64')
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        agent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
          Authorization: `Basic ${auth}`,
          'Fineract-Platform-TenantId': cfg.tenant,
          Accept: 'application/json',
        },
        timeout: 10_000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`banking core ${res.statusCode}: ${text.slice(0, 300)}`))
            return
          }
          try {
            resolve(JSON.parse(text))
          } catch {
            reject(new Error(`banking core returned non-JSON: ${text.slice(0, 200)}`))
          }
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error('banking core timed out')))
    req.on('error', reject)
    req.end()
  })
}

export type BridgeCommand = {
  cmd: string
  args: string[]
  cwd: string
}

/**
 * Runs the prebuilt bridge if one is around, otherwise `go run .`. Same
 * fallback the audit demo uses, so a dev box with only Go still works.
 */
export function bridgeCommand(args: string[], root = repoRoot()): BridgeCommand {
  const built = path.join(root, '.dist/banking-transfer-service')
  const cwd = path.join(root, 'services/banking-transfer-service')
  if (existsSync(built)) {
    return { cmd: built, args, cwd }
  }
  return { cmd: 'go', args: ['run', '.', ...args], cwd }
}

/** Minor units for the core, e.g. "100" BRL at 2 decimals -> 10000 centavos. */
export function toMinorUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`amount must be a positive number, got "${amount}"`)
  }
  const [whole, frac = ''] = trimmed.split('.')
  if (frac.length > decimals) {
    throw new Error(`amount has more than ${decimals} decimal places`)
  }
  return BigInt(whole + frac.padEnd(decimals, '0'))
}
