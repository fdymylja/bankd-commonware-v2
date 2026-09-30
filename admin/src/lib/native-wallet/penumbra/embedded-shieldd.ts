import { Any } from '@bufbuild/protobuf'
import {
  AuthInfo,
  Fee,
  TxBody,
  TxRaw,
} from '@mizufinance/protobuf/cosmos/tx/v1beta1/tx_pb'

const BANKD_QUERY_PATH = '/mizufinance.shieldd.v1.Query/'

const SHIELDD_QUERY_REWRITES: Readonly<Record<string, string>> = {
  '/shieldd.core.app.v1.QueryService/AppParameters':
    BANKD_QUERY_PATH + 'AppParameters',
  '/shieldd.core.component.shielded_pool.v1.QueryService/AssetMetadataById':
    BANKD_QUERY_PATH + 'AssetMetadataById',
  '/shieldd.core.component.compliance.v1.QueryService/ComplianceAssetStatus':
    BANKD_QUERY_PATH + 'ComplianceAssetStatus',
  '/shieldd.core.component.compliance.v1.QueryService/ComplianceBatchMerkleProofs':
    BANKD_QUERY_PATH + 'ComplianceBatchMerkleProofs',
  '/shieldd.core.component.compliance.v1.QueryService/ComplianceUserLeaf':
    BANKD_QUERY_PATH + 'ComplianceUserLeaf',
  '/shieldd.cnidarium.v1.QueryService/KeyValue': BANKD_QUERY_PATH + 'KeyValue',
  '/shieldd.core.component.sct.v1.QueryService/NullifierWindow':
    BANKD_QUERY_PATH + 'NullifierWindow',
  '/shieldd.core.component.compact_block.v1.QueryService/CompactBlockRange':
    BANKD_QUERY_PATH + 'CompactBlockRange',
}

type FetchScope = typeof globalThis & {
  __bankdEmbeddedShielddFetchInstalled?: boolean
}

export function embeddedShielddQueryUrl(
  grpcUrl: string,
  method: string
): string {
  return `${grpcUrl.replace(/\/$/, '')}${BANKD_QUERY_PATH}${method}`
}

export function rewriteShielddQueryUrl(url: string): string {
  for (const [shielddPath, bankdPath] of Object.entries(
    SHIELDD_QUERY_REWRITES
  )) {
    if (url.includes(shielddPath)) {
      return url.replace(shielddPath, bankdPath)
    }
  }
  return url
}

/**
 * The vendored WASM planner issues Shieldd-native gRPC paths internally.
 * Rewrite those browser requests to Bankd's typed embedded-Shieldd service.
 */
export function installEmbeddedShielddQueryRouting(): void {
  if (typeof window === 'undefined') return

  const scope = globalThis as FetchScope
  if (scope.__bankdEmbeddedShielddFetchInstalled) return

  const nativeFetch = scope.fetch.bind(scope)
  scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const rewritten = rewriteShielddQueryUrl(url)

    if (typeof input === 'string' || input instanceof URL) {
      return nativeFetch(rewritten, init)
    }
    return nativeFetch(new Request(rewritten, input), init)
  }) as typeof fetch
  scope.__bankdEmbeddedShielddFetchInstalled = true
}

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = []
  let remaining = value
  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80)
    remaining = Math.floor(remaining / 0x80)
  }
  bytes.push(remaining)
  return new Uint8Array(bytes)
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(
    parts.reduce((length, part) => length + part.length, 0)
  )
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

/**
 * Wrap a Shieldd transaction in the unsigned Bankd envelope accepted by the
 * x/shieldd ante handler.
 */
export function wrapShielddTransaction(transaction: Uint8Array): Uint8Array {
  const deliverTx = concatBytes(
    new Uint8Array([0x0a]),
    encodeVarint(transaction.length),
    transaction
  )
  const body = new TxBody({
    messages: [
      new Any({
        typeUrl: '/mizufinance.shieldd.v1.MsgDeliverTx',
        value: deliverTx,
      }),
    ],
    extensionOptions: [
      new Any({
        typeUrl: '/mizufinance.shieldd.v1.ExtensionOptionsShielddTx',
        value: new Uint8Array(),
      }),
    ],
  })

  return new TxRaw({
    bodyBytes: body.toBinary(),
    authInfoBytes: new AuthInfo({ fee: new Fee({}) }).toBinary(),
    signatures: [],
  }).toBinary()
}
