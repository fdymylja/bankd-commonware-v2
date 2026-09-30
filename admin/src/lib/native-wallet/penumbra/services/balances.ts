// src/lib/native-wallet/services/balances.ts
import { AssetId, Metadata, Value, ValueView } from '@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb'
import {
  AssetMetadataByIdRequest,
  AssetMetadataByIdResponse,
} from '@mizufinance/protobuf/shieldd/core/component/shielded_pool/v1/shielded_pool_pb'
import { Address, AddressIndex, AddressView, AddressView_Decoded } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import { Amount } from '@mizufinance/protobuf/shieldd/core/num/v1/num_pb'
import {
  BalancesRequest,
  BalancesResponse,
  SpendableNoteRecord as SpendableNoteRecordProto,
} from '@mizufinance/protobuf/shieldd/view/v1/view_pb'

import { DB_NAME, DB_VERSION, type SpendableNoteRecord, base64ToUint8Array, getAllSpendableNotes, getUnspentNotesByAsset } from '../../core'

/**
 * Get all spendable notes from the Penumbra-standard SPENDABLE_NOTES table.
 * Falls back to our custom table if the standard table is empty.
 */
async function getPenumbraSpendableNotes(): Promise<SpendableNoteRecordProto[]> {
  const { openDB } = await import('idb')
  const db = await openDB(DB_NAME, DB_VERSION)
  
  try {
    // Try Penumbra-standard table first
    const allNotes = await db.getAll('SPENDABLE_NOTES')
    
    if (allNotes.length > 0) {
      // Convert JSON records to protobuf objects
      // Filter unspent and parse
      const result: SpendableNoteRecordProto[] = []
      for (const n of allNotes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const noteJson = n as any
        if (!noteJson.heightSpent) {
          try {
            result.push(SpendableNoteRecordProto.fromJson(noteJson))
          } catch {
            // Skip malformed notes
          }
        }
      }
      return result
    }
    
    return []
  } catch (error) {
    console.warn('[Balances] Error reading SPENDABLE_NOTES:', error)
    return []
  } finally {
    db.close()
  }
}

// Cache for asset metadata
const metadataCache = new Map<string, Metadata | null>()

/**
 * Fetch asset metadata from the chain via gRPC-web proxy.
 */
async function fetchAssetMetadata(assetIdBase64: string): Promise<Metadata | null> {
  // Check cache first
  if (metadataCache.has(assetIdBase64)) {
    return metadataCache.get(assetIdBase64) ?? null
  }

  try {
    const assetIdBytes = base64ToUint8Array(assetIdBase64)
    const request = new AssetMetadataByIdRequest({
      assetId: new AssetId({ inner: assetIdBytes })
    })
    const requestBytes = request.toBinary()

    // Encode as gRPC-web frame
    const frame = new Uint8Array(5 + requestBytes.length)
    frame[0] = 0
    const len = requestBytes.length
    frame[1] = (len >> 24) & 0xff
    frame[2] = (len >> 16) & 0xff
    frame[3] = (len >> 8) & 0xff
    frame[4] = len & 0xff
    frame.set(requestBytes, 5)

    const base64Request = btoa(String.fromCharCode(...frame))

    const response = await fetch('/api/penumbra/asset-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web-text',
        'Accept': 'application/grpc-web-text',
      },
      body: base64Request,
    })

    if (!response.ok) {
      metadataCache.set(assetIdBase64, null)
      return null
    }

    const base64Response = await response.text()
    
    // Decode gRPC-web frames
    const frames = base64Response.trim().split(/(?<==)(?=[A-Za-z])/)
    const allBytes: number[] = []
    for (const f of frames) {
      if (f) {
        const decoded = atob(f)
        for (let i = 0; i < decoded.length; i++) {
          allBytes.push(decoded.charCodeAt(i))
        }
      }
    }

    const responseBytes = Uint8Array.from(allBytes)
    const msgLen = (responseBytes[1] << 24) | (responseBytes[2] << 16) | (responseBytes[3] << 8) | responseBytes[4]

    if (msgLen > 0) {
      const messageBytes = responseBytes.slice(5, 5 + msgLen)
      const metadataResponse = AssetMetadataByIdResponse.fromBinary(messageBytes)
      const metadata = metadataResponse.denomMetadata ?? null
      metadataCache.set(assetIdBase64, metadata)
      return metadata
    }

    metadataCache.set(assetIdBase64, null)
    return null
  } catch (error) {
    console.error('[Balances] Failed to fetch asset metadata:', error)
    metadataCache.set(assetIdBase64, null)
    return null
  }
}

/**
 * Aggregate balances from unspent notes.
 * Returns an async generator that yields BalancesResponse for each unique asset.
 * 
 * Tries Penumbra-standard SPENDABLE_NOTES table first (populated by ViewServer sync),
 * falls back to custom spendableNotes table (populated by simplified sync).
 */
export async function* balances(
  request: BalancesRequest
): AsyncGenerator<BalancesResponse, void, unknown> {
  const accountFilter = request.accountFilter?.account
  const assetIdFilter = request.assetIdFilter?.inner
    ? Buffer.from(request.assetIdFilter.inner).toString('base64')
    : null

  // Group notes by asset
  const balancesByAsset = new Map<string, { amount: bigint; accountIndex: number }>()

  // Try Penumbra-standard notes first (from ViewServer sync)
  const penumbraNotes = await getPenumbraSpendableNotes()
  
  if (penumbraNotes.length > 0) {
    // Use Penumbra-standard notes
    for (const note of penumbraNotes) {
      const assetId = note.note?.value?.assetId?.inner
      const addressIndex = note.addressIndex?.account ?? 0
      
      if (!assetId) continue
      
      const assetIdBase64 = Buffer.from(assetId).toString('base64')
      
      if (assetIdFilter && assetIdBase64 !== assetIdFilter) continue
      if (accountFilter !== undefined && addressIndex !== accountFilter) continue
      
      const amount = note.note?.value?.amount
      const amountBigInt = amount ? (BigInt(amount.hi ?? 0n) << 64n) + BigInt(amount.lo ?? 0n) : 0n
      
      const key = `${assetIdBase64}:${addressIndex}`
      const existing = balancesByAsset.get(key)
      
      if (existing) {
        existing.amount += amountBigInt
      } else {
        balancesByAsset.set(key, { amount: amountBigInt, accountIndex: addressIndex })
      }
    }
  } else {
    // Fall back to custom notes (from simplified sync)
    if (accountFilter !== undefined) {
      const notesByAsset = await getUnspentNotesByAsset(accountFilter)

      for (const [assetId, notes] of notesByAsset) {
        if (assetIdFilter && assetId !== assetIdFilter) {
          continue
        }

        const amount = aggregateNoteAmounts(notes)
        balancesByAsset.set(assetId, { amount, accountIndex: accountFilter })
      }
    } else {
      const allNotes = await getAllSpendableNotes()
      const unspentNotes = allNotes.filter((n) => n.heightSpent === null)

      for (const note of unspentNotes) {
        if (assetIdFilter && note.assetId !== assetIdFilter) {
          continue
        }

        const key = `${note.assetId}:${note.addressIndex}`
        const existing = balancesByAsset.get(key)

        if (existing) {
          existing.amount += parseNoteAmount(note)
        } else {
          balancesByAsset.set(key, {
            amount: parseNoteAmount(note),
            accountIndex: note.addressIndex,
          })
        }
      }
    }
  }

  // Yield a BalancesResponse for each unique balance
  for (const [key, { amount, accountIndex }] of balancesByAsset) {
    // Parse asset ID from key (handle both formats)
    const assetIdBase64 = key.includes(':') ? key.split(':')[0] : key
    const assetIdBytes = base64ToUint8Array(assetIdBase64)

    // Fetch metadata for this asset
    const metadata = await fetchAssetMetadata(assetIdBase64)

    const amountProto = new Amount({
      lo: amount & BigInt('0xFFFFFFFFFFFFFFFF'),
      hi: amount >> BigInt(64),
    })

    const assetId = new AssetId({ inner: assetIdBytes })

    // Build the response with the new format (balanceView + accountAddress)
    const valueView = metadata
      ? new ValueView({
          valueView: {
            case: 'knownAssetId',
            value: {
              amount: amountProto,
              metadata: metadata,
            },
          },
        })
      : new ValueView({
          valueView: {
            case: 'unknownAssetId',
            value: {
              amount: amountProto,
              assetId: assetId,
            },
          },
        })

    const addressView = new AddressView({
      addressView: {
        case: 'decoded',
        value: new AddressView_Decoded({
          index: new AddressIndex({ account: accountIndex }),
          address: new Address(), // Empty address - we don't need it for balances
        }),
      },
    })

    yield new BalancesResponse({
      // New format
      balanceView: valueView,
      accountAddress: addressView,
      // Also include deprecated fields for compatibility
      account: new AddressIndex({ account: accountIndex }),
      balance: new Value({
        assetId: assetId,
        amount: amountProto,
      }),
    })
  }
}

/**
 * Aggregate the amounts of multiple notes.
 */
function aggregateNoteAmounts(notes: SpendableNoteRecord[]): bigint {
  let total = 0n
  for (const note of notes) {
    total += parseNoteAmount(note)
  }
  return total
}

/**
 * Parse the amount from a spendable note record.
 * Deserializes the protobuf-encoded note to extract the amount.
 */
function parseNoteAmount(noteRecord: SpendableNoteRecord): bigint {
  try {
    // Deserialize the SpendableNoteRecord protobuf
    const proto = SpendableNoteRecordProto.fromBinary(noteRecord.note)

    // Get the amount from note.value.amount
    const amount = proto.note?.value?.amount
    if (!amount) {
      return 0n
    }

    // Convert hi/lo to bigint: (hi << 64) + lo
    return (amount.hi << 64n) + amount.lo
  } catch (error) {
    console.error('[Balances] Failed to parse note amount:', error)
    return 0n
  }
}

/**
 * Get total balance for a specific asset across all accounts.
 */
export async function getTotalBalance(assetId: string): Promise<bigint> {
  const allNotes = await getAllSpendableNotes()
  const relevantNotes = allNotes.filter(
    (n) => n.assetId === assetId && n.heightSpent === null
  )
  return aggregateNoteAmounts(relevantNotes)
}

/**
 * Get balance for a specific asset in a specific account.
 */
export async function getAccountBalance(
  accountIndex: number,
  assetId: string
): Promise<bigint> {
  const notesByAsset = await getUnspentNotesByAsset(accountIndex)
  const notes = notesByAsset.get(assetId) ?? []
  return aggregateNoteAmounts(notes)
}
