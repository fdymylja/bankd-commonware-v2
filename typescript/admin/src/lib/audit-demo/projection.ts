import type { AuditField, AuditRequest, OrbisAuditRow } from './types'

export type AddressComponents = {
  diversified_generator: number[]
  transmission_key: number[]
}
export type DecodedValue =
  | { kind: 'amount'; base_units: string }
  | ({ kind: 'address_components' } & AddressComponents)
export type DecodedField = {
  reference: OrbisAuditRow['output_ref']
  field: AuditField
  value: DecodedValue
}
export type Participant = {
  name: string
  slug: string
  addresses: AddressComponents[]
}

function addressKey(address: AddressComponents) {
  const bytes = [...address.diversified_generator, ...address.transmission_key]
  if (
    address.diversified_generator.length !== 32 ||
    address.transmission_key.length !== 32 ||
    bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    throw new Error('Malformed decoded address')
  }
  return Buffer.from(bytes).toString('hex')
}

/** Project one verified transfer; identities used for matching never enter released rows. */
export function projectTransfer(
  request: AuditRequest,
  decoded: DecodedField[],
  participants: Participant[]
): OrbisAuditRow[] {
  if (
    Date.parse(request.expiresAt) <= Date.now() ||
    !Number.isFinite(Date.parse(request.expiresAt))
  ) {
    throw new Error('Audit request expired')
  }
  const fields = new Map(decoded.map((row) => [row.field, row]))
  if (fields.size !== decoded.length) throw new Error('Duplicate decoded field')
  const reference = decoded[0]?.reference
  for (const row of decoded) {
    if (
      !reference ||
      row.reference.bankd_tx_hash !== reference.bankd_tx_hash ||
      row.reference.height !== reference.height ||
      row.reference.action_index !== reference.action_index ||
      row.reference.output_index !== reference.output_index
    )
      throw new Error('Mixed transaction references')
    if ((row.field === 'amount') !== (row.value.kind === 'amount'))
      throw new Error('Decoded field type mismatch')
    if (
      row.value.kind === 'amount' &&
      (typeof row.value.base_units !== 'string' ||
        !/^(0|[1-9]\d*)$/.test(row.value.base_units) ||
        row.value.base_units.length > 39 ||
        BigInt(row.value.base_units) > (1n << 128n) - 1n)
    )
      throw new Error('Malformed decoded amount')
  }
  const requested = new Set(request.fields)
  if (request.mode === 'subject') {
    const participant = participants.find(
      (person) => person.name === request.subject
    )
    if (!participant) throw new Error('Unknown audit participant')
    const addresses = new Set(participant.addresses.map(addressKey))
    const matches: AuditField[] = []
    for (const field of ['sender', 'receiver'] as const) {
      const row = fields.get(field)
      if (!row || row.value.kind !== 'address_components')
        throw new Error('Identity package unavailable')
      if (addresses.has(addressKey(row.value))) matches.push(field)
    }
    if (!matches.length) return []
    for (const field of matches) requested.add(field)
  }
  return [...requested].map((field) => {
    const row = fields.get(field)
    if (!row) throw new Error(`Audit package unavailable: ${field}`)
    const value =
      row.value.kind === 'amount' ? row.value.base_units : addressKey(row.value)
    const alias =
      row.value.kind === 'address_components'
        ? participants.find((person) =>
            person.addresses.some((address) => addressKey(address) === value)
          )?.name
        : undefined
    return {
      output_ref: row.reference,
      field,
      value,
      ...(alias ? { alias } : {}),
      status: 'decrypt_succeeded',
    }
  })
}
