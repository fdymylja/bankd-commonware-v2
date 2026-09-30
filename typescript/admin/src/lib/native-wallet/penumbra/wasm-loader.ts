'use client'

// src/lib/native-wallet/wasm-loader.ts
/**
 * Dynamic WASM loader for @mizufinance/wasm
 *
 * This module provides lazy-loaded access to WASM functions.
 * The imports are deferred until actually called to avoid SSR issues.
 *
 * IMPORTANT: This file must only be imported from 'use client' components.
 */

import type { AssetId } from '@mizufinance/protobuf/shieldd/core/asset/v1/asset_pb'
import type {
  MsgRegisterAsset,
  MsgRegisterUser,
} from '@mizufinance/protobuf/shieldd/core/component/compliance/v1/compliance_pb'
import type {
  Address,
  AddressIndex,
  FullViewingKey,
  SpendKey,
  WalletId,
} from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import type {
  Action,
  AuthorizationData,
  Transaction,
  TransactionPlan,
  WitnessData,
} from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'
import type { TransactionPlannerRequest } from '@mizufinance/protobuf/shieldd/view/v1/view_pb'
import type { IdbConstants } from '@mizufinance/types/indexed-db'
import type { StateCommitmentTree } from '@mizufinance/types/state-commitment-tree'


import { installEmbeddedShielddQueryRouting } from './embedded-shieldd'

installEmbeddedShielddQueryRouting()

// Cached module references - loaded on first use
let keysModule: typeof import('@mizufinance/wasm/keys') | null = null
let buildModule: typeof import('@mizufinance/wasm/build') | null = null
let assetModule: typeof import('@mizufinance/wasm/asset') | null = null
let plannerModule: typeof import('@mizufinance/wasm/planner') | null = null
let addressModule: typeof import('@mizufinance/wasm/address') | null = null
let complianceModule: typeof import('@mizufinance/wasm/compliance') | null =
  null

/**
 * Load and cache the keys module.
 * Only loads when actually called (not at import time).
 */
export async function loadKeysModule() {
  if (typeof window === 'undefined') {
    throw new Error('WASM modules can only be loaded in the browser')
  }
  if (!keysModule) {
    keysModule = await import('@mizufinance/wasm/keys')
  }
  return keysModule
}

/**
 * Load and cache the build module.
 */
export async function loadBuildModule() {
  if (typeof window === 'undefined') {
    throw new Error('WASM modules can only be loaded in the browser')
  }
  if (!buildModule) {
    buildModule = await import('@mizufinance/wasm/build')
  }
  return buildModule
}

/**
 * Load and cache the asset module.
 */
export async function loadAssetModule() {
  if (typeof window === 'undefined') {
    throw new Error('WASM modules can only be loaded in the browser')
  }
  if (!assetModule) {
    assetModule = await import('@mizufinance/wasm/asset')
  }
  return assetModule
}

/**
 * Load and cache the address module (getAddressIndexByAddress, isControlledAddress).
 */
export async function loadAddressModule() {
  if (typeof window === 'undefined') {
    throw new Error('WASM modules can only be loaded in the browser')
  }
  if (!addressModule) {
    addressModule = await import('@mizufinance/wasm/address')
  }
  return addressModule
}

export async function loadComplianceModule() {
  if (typeof window === 'undefined') {
    throw new Error('WASM modules can only be loaded in the browser')
  }
  if (!complianceModule) {
    complianceModule = await import('@mizufinance/wasm/compliance')
  }
  return complianceModule
}

/**
 * Load and cache the planner module.
 */
export async function loadPlannerModule() {
  if (typeof window === 'undefined') {
    throw new Error('WASM modules can only be loaded in the browser')
  }
  if (!plannerModule) {
    plannerModule = await import('@mizufinance/wasm/planner')
  }
  return plannerModule
}

// =============================================================================
// Keys Module Wrappers
// =============================================================================

export async function generateSpendKey(seedPhrase: string): Promise<SpendKey> {
  const keys = await loadKeysModule()
  return keys.generateSpendKey(seedPhrase)
}

export async function getFullViewingKey(
  spendKey: SpendKey
): Promise<FullViewingKey> {
  const keys = await loadKeysModule()
  return keys.getFullViewingKey(spendKey)
}

export async function getWalletId(fvk: FullViewingKey): Promise<WalletId> {
  const keys = await loadKeysModule()
  return keys.getWalletId(fvk)
}

export async function getAddressByIndex(
  fvk: FullViewingKey,
  accountIndex: number,
  randomizer?: Uint8Array
): Promise<Address> {
  const keys = await loadKeysModule()
  return keys.getAddressByIndex(fvk, accountIndex, randomizer)
}

export async function getEphemeralByIndex(
  fvk: FullViewingKey,
  accountIndex: number
): Promise<Address> {
  const keys = await loadKeysModule()
  return keys.getEphemeralByIndex(fvk, accountIndex)
}

export async function getTransparentAddress(fvk: FullViewingKey): Promise<{
  address: Address
  encoding: string
}> {
  const keys = await loadKeysModule()
  return keys.getTransparentAddress(fvk)
}

// =============================================================================
// Address Module Wrappers (ownership detection)
// =============================================================================

/**
 * Decode the AddressIndex for an address using the full viewing key.
 * Returns undefined if the address does not belong to this wallet.
 *
 * This is the Prax-style `indexByAddress` equivalent — the WASM layer
 * performs the actual cryptographic check (no brute-force scanning).
 */
export async function getAddressIndexByAddress(
  fvk: FullViewingKey,
  address: Address
): Promise<AddressIndex | undefined> {
  const addrMod = await loadAddressModule()
  return addrMod.getAddressIndexByAddress(fvk, address)
}

/**
 * Check whether an address is controlled by the given full viewing key.
 */
export async function isControlledAddress(
  fvk: FullViewingKey,
  address?: Address
): Promise<boolean> {
  const addrMod = await loadAddressModule()
  return addrMod.isControlledAddress(fvk, address)
}

// =============================================================================
// Planner Module Wrappers
// =============================================================================

export async function planTransaction(
  idbConstants: IdbConstants,
  request: TransactionPlannerRequest,
  fullViewingKey: FullViewingKey,
  gasFeeToken: AssetId,
  grpcUrl: string
): Promise<TransactionPlan> {
  const planner = await loadPlannerModule()
  return planner.planTransaction(
    idbConstants,
    request,
    fullViewingKey,
    gasFeeToken,
    grpcUrl
  )
}

// =============================================================================
// Build Module Wrappers
// =============================================================================

export async function authorizePlan(
  spendKey: SpendKey,
  plan: TransactionPlan
): Promise<AuthorizationData> {
  const build = await loadBuildModule()
  return build.authorizePlan(spendKey, plan)
}

export async function getWitness(
  txPlan: TransactionPlan,
  sct: StateCommitmentTree
): Promise<WitnessData> {
  const build = await loadBuildModule()
  return build.getWitness(txPlan, sct)
}

export async function buildParallel(
  batchActions: Action[],
  txPlan: TransactionPlan,
  witnessData: WitnessData,
  authData: AuthorizationData
): Promise<Transaction> {
  const build = await loadBuildModule()
  return build.buildParallel(batchActions, txPlan, witnessData, authData)
}

export async function buildActionParallel(
  txPlan: TransactionPlan,
  witnessData: WitnessData,
  fullViewingKey: FullViewingKey,
  actionId: number,
  proverUrl: string
): Promise<Action> {
  const build = await loadBuildModule()

  const actionPlan = txPlan.actions[actionId]
  const actionCase = actionPlan?.action.case

  if (!actionCase) {
    throw new Error(`No action case for action ${actionId}`)
  }

  console.log(`[WASM] Building action ${actionCase}`)

  return build.buildActionParallel(
    txPlan,
    witnessData,
    fullViewingKey,
    actionId,
    { proverUrl }
  )
}

// =============================================================================
// Asset Module Wrappers
// =============================================================================

export async function assetIdFromBaseDenom(denom: string): Promise<AssetId> {
  const asset = await loadAssetModule()
  return asset.assetIdFromBaseDenom(denom)
}

export async function validateAssetRegistration(message: MsgRegisterAsset, chainId: string): Promise<MsgRegisterAsset> {
  return (await loadComplianceModule()).validateAssetRegistration(message, chainId)
}

export async function validateUserRegistration(
  message: MsgRegisterUser,
  policy: import('@mizufinance/protobuf/shieldd/core/component/compliance/v1/compliance_pb').AssetPolicy,
  chainId: string,
): Promise<MsgRegisterUser> {
  return (await loadComplianceModule()).validateUserRegistration(message, policy, chainId)
}
