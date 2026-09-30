import {
  ComplianceAssetStatusRequest,
  ComplianceAssetStatusResponse,
  ComplianceUserLeafRequest,
  ComplianceUserLeafResponse,
  MsgRegisterAsset,
  MsgRegisterUser,
} from '@mizufinance/protobuf/shieldd/core/component/compliance/v1/compliance_pb'
import type { Address } from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import { ActionPlan } from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'

import { penumbraConfig } from '@/lib/config'

import { getFullViewingKey } from '../../core'
import { embeddedShielddQueryUrl } from '../embedded-shieldd'
import {
  assetIdFromBaseDenom,
  validateUserRegistration,
  getAddressByIndex,
  validateAssetRegistration,
} from '../wasm-loader'
import { TransactionService } from './transaction'

export interface RegisterAssetInput {
  denom: string
  registrationJson: string
}

export async function registerRegulatedAsset(input: RegisterAssetInput) {
  const assetId = await assetIdFromBaseDenom(input.denom.trim())
  const supplied = MsgRegisterAsset.fromJsonString(input.registrationJson)
  if (!supplied.assetId || !supplied.assetId.equals(assetId)) {
    throw new Error('Registration asset does not match the selected denomination')
  }
  const msg = await validateAssetRegistration(supplied, penumbraConfig.chainId)
  const action = new ActionPlan({
    action: { case: 'complianceRegisterAsset', value: msg },
  })

  return new TransactionService({
    grpcUrl: penumbraConfig.grpcUrl,
    chainId: penumbraConfig.chainId,
  }).executeActionPlans([action])
}

/** Decode a grpc-web-text body: concatenated, independently padded base64
 * segments wrapping length-prefixed frames. */
function decodeGrpcWebText(text: string): Uint8Array {
  const segments = text.trim().match(/[A-Za-z0-9+/]+={0,2}/g) ?? []
  const chunks = segments.map((segment) =>
    Uint8Array.from(atob(segment), (char) => char.charCodeAt(0))
  )
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/** gRPC-web unary against the chain's compliance QueryService (the same
 * pattern the WASM planner uses). Transport and framing failures are surfaced
 * so state-changing callers can distinguish them from an on-chain result. */
async function complianceUnary(
  method: string,
  requestBytes: Uint8Array
): Promise<Uint8Array> {
  const frame = new Uint8Array(5 + requestBytes.length)
  new DataView(frame.buffer).setUint32(1, requestBytes.length, false)
  frame.set(requestBytes, 5)

  const response = await fetch(
    embeddedShielddQueryUrl(penumbraConfig.grpcUrl, method),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web-text',
        Accept: 'application/grpc-web-text',
      },
      body: btoa(String.fromCharCode(...frame)),
      // These queries feed UI hints and error messages — a wedged RPC must
      // not hang the caller (e.g. the transfer-failure path).
      signal: AbortSignal.timeout(10_000),
    }
  )
  if (!response.ok) {
    throw new Error(
      `Compliance query ${method} failed: HTTP ${response.status} ${response.statusText}`
    )
  }

  const raw = decodeGrpcWebText(await response.text())
  if (raw.length < 5) {
    throw new Error(`Compliance query ${method} returned a truncated frame`)
  }
  if (raw[0] !== 0) {
    throw new Error(`Compliance query ${method} returned no data frame`)
  }
  const length = new DataView(raw.buffer, raw.byteOffset).getUint32(1, false)
  if (raw.length < 5 + length) {
    throw new Error(`Compliance query ${method} returned a truncated message`)
  }
  return raw.subarray(5, 5 + length)
}

export interface ComplianceAssetStatus {
  isRegistered: boolean
  isRegulated: boolean
  policyId?: string
}

async function queryComplianceAssetStatus(denom: string): Promise<
  ComplianceAssetStatus & {
    policy: ComplianceAssetStatusResponse['assetPolicy']
  }
> {
  const assetId = await assetIdFromBaseDenom(denom.trim())
  const message = await complianceUnary(
    'ComplianceAssetStatus',
    new ComplianceAssetStatusRequest({ assetId }).toBinary()
  )
  const status = ComplianceAssetStatusResponse.fromBinary(message)
  return {
    isRegistered: status.isRegistered,
    isRegulated: status.isRegulated,
    policyId: status.assetPolicy?.policyId,
    policy: status.assetPolicy,
  }
}

/**
 * Query the chain's compliance module for a denom's registration status.
 * Returns null when the query fails — callers should treat that as
 * "unknown", not "unregulated"; the planner enforces regardless.
 */
export async function getComplianceAssetStatus(
  denom: string
): Promise<ComplianceAssetStatus | null> {
  try {
    const { isRegistered, isRegulated, policyId } =
      await queryComplianceAssetStatus(denom)
    return { isRegistered, isRegulated, policyId }
  } catch (error) {
    console.warn('[compliance] asset status query failed:', error)
    return null
  }
}

/**
 * Whether an address is registered as a compliance user for a denom.
 * Returns null when the query fails (unknown).
 */
export async function isComplianceUserRegistered(
  address: Address,
  denom: string
): Promise<boolean | null> {
  try {
    const assetId = await assetIdFromBaseDenom(denom.trim())
    const message = await complianceUnary(
      'ComplianceUserLeaf',
      new ComplianceUserLeafRequest({ address, assetId }).toBinary()
    )
    return ComplianceUserLeafResponse.fromBinary(message).isRegistered
  } catch (error) {
    console.warn('[compliance] user leaf query failed:', error)
    return null
  }
}

export async function registerRegulatedUser(input: {
  denom: string
  addressIndex?: number
  registrationJson: string
}) {
  const addressIndex = input.addressIndex ?? 0
  if (!Number.isInteger(addressIndex) || addressIndex < 0 || addressIndex > 0xffffffff) {
    throw new Error('Address index must be an integer between 0 and 4294967295')
  }
  const fvk = getFullViewingKey()
  const address = await getAddressByIndex(fvk, addressIndex)
  const assetId = await assetIdFromBaseDenom(input.denom.trim())
  // Registration is state-changing, so an unavailable compliance RPC must be
  // surfaced rather than misreported as a missing on-chain policy.
  const status = await queryComplianceAssetStatus(input.denom)
  const policyId = status.policyId
  if (
    !status.isRegistered ||
    !status.isRegulated ||
    !policyId ||
    !status.policy
  ) {
    throw new Error(
      'The regulated asset policy is not available on-chain; register the asset first'
    )
  }
  const supplied = MsgRegisterUser.fromJsonString(input.registrationJson)
  if (!supplied.leaf?.assetId?.equals(assetId) || !supplied.leaf.address?.equals(address)) {
    throw new Error('Registration does not match this wallet address and asset')
  }
  const msg = await validateUserRegistration(supplied, status.policy, penumbraConfig.chainId)
  const action = new ActionPlan({
    action: { case: 'complianceRegisterUser', value: msg },
  })

  return new TransactionService({
    grpcUrl: penumbraConfig.grpcUrl,
    chainId: penumbraConfig.chainId,
  }).executeActionPlans([action])
}
