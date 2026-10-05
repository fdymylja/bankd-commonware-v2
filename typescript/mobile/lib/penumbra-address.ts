const PENUMBRA_ADDRESS_PATTERN = /^penumbra1[ac-hj-np-z02-9]+$/

/**
 * Parse a QR payload into a Penumbra address suitable for private sends.
 *
 * For now this intentionally accepts only plain bech32m Penumbra addresses.
 * URI payloads such as `penumbra:...` can be added later without changing UI
 * call sites.
 */
export function parseScannedPenumbraAddress(payload: string): string | null {
  const value = payload.trim()
  if (!PENUMBRA_ADDRESS_PATTERN.test(value)) return null
  return value
}
