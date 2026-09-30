import { bech32m } from 'bech32'

const ADDRESS_PREFIX = 'shieldd'
const ADDRESS_BYTE_LENGTH = 48
const ADDRESS_STRING_LENGTH = 91

function assertAddressBytes(bytes: Uint8Array): void {
  if (bytes.length !== ADDRESS_BYTE_LENGTH) {
    throw new TypeError(
      `Invalid Shieldd address length: expected ${ADDRESS_BYTE_LENGTH}, got ${bytes.length}`
    )
  }
}

export function bech32mAddress({
  inner,
}: {
  inner: Uint8Array
}): string {
  assertAddressBytes(inner)
  const encoded = bech32m.encode(
    ADDRESS_PREFIX,
    bech32m.toWords(inner),
    ADDRESS_STRING_LENGTH
  )
  if (encoded.length !== ADDRESS_STRING_LENGTH) {
    throw new TypeError(
      `Invalid Shieldd address encoding length: expected ${ADDRESS_STRING_LENGTH}, got ${encoded.length}`
    )
  }
  return encoded
}

export function addressFromBech32m(address: string): {
  inner: Uint8Array
} {
  if (address.length !== ADDRESS_STRING_LENGTH) {
    throw new TypeError(
      `Invalid Shieldd address string length: expected ${ADDRESS_STRING_LENGTH}, got ${address.length}`
    )
  }
  const decoded = bech32m.decode(address, ADDRESS_STRING_LENGTH)
  if (decoded.prefix !== ADDRESS_PREFIX) {
    throw new TypeError(
      `Invalid Shieldd address prefix: expected ${ADDRESS_PREFIX}, got ${decoded.prefix}`
    )
  }
  const inner = new Uint8Array(bech32m.fromWords(decoded.words))
  assertAddressBytes(inner)
  return { inner }
}
