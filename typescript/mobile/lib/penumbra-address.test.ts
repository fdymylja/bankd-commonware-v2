import { strict as assert } from 'node:assert'

import { parseScannedPenumbraAddress } from './penumbra-address'

const validAddress =
  'penumbra1cz9sarazkjd685533cvg57y29yc3xu9y83xe69n5spqfkvqj2fpny9hlp5x6g5kl9k28mrrx4af3hnej33w48zj07nt3kj97jy4q3jm2jekpq0u7gund5lhcds8lp9tggfcg72'

assert.equal(parseScannedPenumbraAddress(validAddress), validAddress)
assert.equal(parseScannedPenumbraAddress(`  ${validAddress}\n`), validAddress)
assert.equal(parseScannedPenumbraAddress('wallet1deadbeef'), null)
assert.equal(parseScannedPenumbraAddress('penumbra:' + validAddress), null)
