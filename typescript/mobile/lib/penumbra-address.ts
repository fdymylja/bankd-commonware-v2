import { bech32m } from 'bech32'

/** Shieldd uses a 48-byte address and bech32m checksum. */
export function parseScannedPenumbraAddress(payload: string): string | null {
  const value = payload.trim()
  try {
    const decoded = bech32m.decode(value, 1023)
    if (decoded.prefix !== 'shieldd' || bech32m.fromWords(decoded.words).length !== 48) return null
    return value.toLowerCase()
  } catch { return null }
}
