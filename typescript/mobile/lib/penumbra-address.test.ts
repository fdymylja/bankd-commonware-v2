import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { bech32m } from 'bech32'
import { parseScannedPenumbraAddress } from './penumbra-address'
const address = bech32m.encode('shieldd', bech32m.toWords(new Uint8Array(48).fill(7)), 1023)

test('private QR parsing accepts a checksummed 48-byte Shieldd address', () => {
  assert.equal(parseScannedPenumbraAddress(address), address)
  assert.equal(parseScannedPenumbraAddress(`  ${address}\n`), address)
})
test('QR parsing rejects tampered checksums and wrong address lengths', () => {
  assert.equal(parseScannedPenumbraAddress(address.slice(0, -1) + (address.endsWith('q') ? 'p' : 'q')), null)
  assert.equal(parseScannedPenumbraAddress(bech32m.encode('shieldd', bech32m.toWords(new Uint8Array(32)), 1023)), null)
})
test('public addresses, legacy Penumbra prefixes and URI payloads are rejected', () => {
  for (const input of ['wallet1deadbeef', '0x' + '11'.repeat(20), `shieldd:${address}`, bech32m.encode('penumbra', bech32m.toWords(new Uint8Array(48)), 1023)]) {
    assert.equal(parseScannedPenumbraAddress(input), null)
  }
})
