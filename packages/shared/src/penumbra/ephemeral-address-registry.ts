import type { Hex } from 'viem'

import { deriveIntermediateAddresses } from './address'

// =============================================================================
// Address Ownership Detection
// =============================================================================

/**
 * Result of checking whether a Penumbra address belongs to the current wallet.
 *
 * This mirrors Prax's `indexByAddress` capability: given a full viewing key,
 * the WASM layer can decode any address derived from that FVK and extract
 * the AddressIndex (account + randomizer). A populated randomizer means the
 * address is ephemeral/one-time.
 */
export interface OwnPenumbraAddressInfo {
  belongsToWallet: boolean
  accountIndex?: number
  /** True when the address was generated via `getEphemeralByIndex` (non-zero randomizer). */
  isEphemeral?: boolean
  /** Raw randomizer bytes from the AddressIndex (empty/zeroed for default addresses). */
  randomizer?: Uint8Array
}

/**
 * Interface for components that can decode address ownership.
 * Implemented by both admin (direct WASM) and mobile (WebView bridge).
 */
export interface AddressOwnershipDecoder {
  getOwnAddressInfo(address: string): Promise<OwnPenumbraAddressInfo>
}

export type ExternalAddressPurpose =
  | 'generated-deposit'
  | 'ibc-return'
  | 'eem-swap-place-order'
  | 'eem-swap-execute-order'
  | 'eem-swap-cancel-order'
  | 'eem-loan-create'
  | 'eem-loan-fund'
  | 'eem-loan-repay'
  | 'eem-loan-cancel'
  | 'eem-loan-liquidate'
  | 'generic-eem'

export interface EphemeralAddressRecord {
  id: string
  version: 1
  walletId?: string
  accountIndex: number
  penumbraAddress: string
  purpose: ExternalAddressPurpose
  sourceChannel?: string
  destinationChannel?: string
  intermediateBech32?: string
  intermediateHex?: Hex
  relatedKind?:
    | 'atomic-swap-order'
    | 'simple-lending-loan'
    | 'transfer'
    | 'unknown'
  relatedId?: string
  txHash?: string
  createdAt: number
  label?: string
}

export interface EphemeralAddressRegistryExport {
  version: 1
  exportedAt: number
  walletId?: string
  records: EphemeralAddressRecord[]
}

export interface CreateEphemeralAddressRecordInput {
  walletId?: string
  accountIndex: number
  penumbraAddress: string
  purpose: ExternalAddressPurpose
  sourceChannel?: string
  destinationChannel?: string
  relatedKind?: EphemeralAddressRecord['relatedKind']
  relatedId?: string
  txHash?: string
  label?: string
  now?: number
  id?: string
}

function createRegistryRecordId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `registry-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

export function createEphemeralAddressRecord(
  input: CreateEphemeralAddressRecordInput
): EphemeralAddressRecord {
  const intermediate = input.destinationChannel
    ? deriveIntermediateAddresses(input.destinationChannel, input.penumbraAddress)
    : null
  const createdAt = input.now ?? Date.now()

  return {
    id: input.id ?? createRegistryRecordId(),
    version: 1,
    walletId: input.walletId,
    accountIndex: input.accountIndex,
    penumbraAddress: input.penumbraAddress,
    purpose: input.purpose,
    sourceChannel: input.sourceChannel,
    destinationChannel: input.destinationChannel,
    intermediateBech32: intermediate?.bech32,
    intermediateHex: intermediate?.hex as Hex | undefined,
    relatedKind: input.relatedKind,
    relatedId: input.relatedId,
    txHash: input.txHash,
    createdAt,
    label: input.label,
  }
}

export function isOwnPenumbraAddress(
  address: string | null | undefined,
  records: readonly EphemeralAddressRecord[]
): boolean {
  if (!address) return false
  return records.some((record) => record.penumbraAddress === address)
}

export function isOwnIntermediateAddress(
  address: string | null | undefined,
  records: readonly EphemeralAddressRecord[]
): boolean {
  if (!address) return false
  const normalized = address.toLowerCase()
  return records.some(
    (record) => record.intermediateHex?.toLowerCase() === normalized
  )
}

export function findRecordsByIntermediateAddress(
  address: string | null | undefined,
  records: readonly EphemeralAddressRecord[]
): EphemeralAddressRecord[] {
  if (!address) return []
  const normalized = address.toLowerCase()
  return records.filter(
    (record) => record.intermediateHex?.toLowerCase() === normalized
  )
}

export function getOwnIntermediateHexSet(
  records: readonly EphemeralAddressRecord[],
  fallbackAddresses: readonly string[] = []
): Set<string> {
  const values = new Set<string>()
  for (const address of fallbackAddresses) {
    if (address) values.add(address.toLowerCase())
  }
  for (const record of records) {
    if (record.intermediateHex) values.add(record.intermediateHex.toLowerCase())
  }
  return values
}

export function isOwnContractAddress(
  address: string | null | undefined,
  records: readonly EphemeralAddressRecord[],
  fallbackAddresses: readonly string[] = []
): boolean {
  if (!address) return false
  return getOwnIntermediateHexSet(records, fallbackAddresses).has(
    address.toLowerCase()
  )
}

export function isWhitelistedForPrivateExecution(
  whitelistedBuyer: string,
  zeroAddress: string,
  records: readonly EphemeralAddressRecord[],
  fallbackIntermediateHex?: string | null
): boolean {
  if (whitelistedBuyer.toLowerCase() === zeroAddress.toLowerCase()) return true
  return isOwnContractAddress(
    whitelistedBuyer,
    records,
    fallbackIntermediateHex ? [fallbackIntermediateHex] : []
  )
}

export function filterOwnBorrowedLoans<T extends { borrower: string }>(
  loans: readonly T[],
  records: readonly EphemeralAddressRecord[],
  fallbackAddresses: readonly string[] = []
): T[] {
  const own = getOwnIntermediateHexSet(records, fallbackAddresses)
  return loans.filter((loan) => own.has(loan.borrower.toLowerCase()))
}

export function filterOwnLentLoans<T extends { lender: string }>(
  loans: readonly T[],
  records: readonly EphemeralAddressRecord[],
  fallbackAddresses: readonly string[] = []
): T[] {
  const own = getOwnIntermediateHexSet(records, fallbackAddresses)
  return loans.filter((loan) => own.has(loan.lender.toLowerCase()))
}

export function filterFundableLoans<T extends { borrower: string }>(
  loans: readonly T[],
  records: readonly EphemeralAddressRecord[],
  fallbackAddresses: readonly string[] = []
): T[] {
  const own = getOwnIntermediateHexSet(records, fallbackAddresses)
  return loans.filter((loan) => !own.has(loan.borrower.toLowerCase()))
}

export function exportEphemeralAddressRegistry(
  records: readonly EphemeralAddressRecord[],
  walletId?: string,
  now: number = Date.now()
): EphemeralAddressRegistryExport {
  return {
    version: 1,
    exportedAt: now,
    walletId,
    records: [...records],
  }
}

export function parseEphemeralAddressRegistryExport(
  value: unknown
): EphemeralAddressRegistryExport {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid registry export')
  }
  const parsed = value as Partial<EphemeralAddressRegistryExport>
  if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
    throw new Error('Unsupported registry export')
  }
  return parsed as EphemeralAddressRegistryExport
}
