// src/lib/native-wallet/services/address.ts
import type { OwnPenumbraAddressInfo } from '@bankd/shared/penumbra'
import {
  Address,
  type FullViewingKey,
} from '@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb'
import {
  AddressByIndexRequest,
  AddressByIndexResponse,
  TransparentAddressRequest,
  TransparentAddressResponse,
} from '@mizufinance/protobuf/shieldd/view/v1/view_pb'

import {
  addressFromBech32m,
  bech32mAddress,
} from '../shieldd-address'

// Dynamic import for WASM functions
async function loadWasm() {
  const wasm = await import('../wasm-loader')
  return {
    getAddressByIndex: wasm.getAddressByIndex,
    getEphemeralByIndex: wasm.getEphemeralByIndex,
    getTransparentAddress: wasm.getTransparentAddress,
    getAddressIndexByAddress: wasm.getAddressIndexByAddress,
  }
}

/**
 * Get an address by account index.
 */
export async function addressByIndex(
  fvk: FullViewingKey,
  request: AddressByIndexRequest
): Promise<AddressByIndexResponse> {
  const accountIndex = request.addressIndex?.account ?? 0
  const randomizer = request.addressIndex?.randomizer
  const wasm = await loadWasm()
  const address = await wasm.getAddressByIndex(
    fvk,
    accountIndex,
    randomizer && randomizer.length > 0 ? randomizer : undefined,
  )

  return new AddressByIndexResponse({
    address,
  })
}

/**
 * Get the address as a bech32m string.
 */
export async function getAddressString(fvk: FullViewingKey, accountIndex: number): Promise<string> {
  const wasm = await loadWasm()
  const address = await wasm.getAddressByIndex(fvk, accountIndex)
  return bech32mAddress(address)
}

/**
 * Generate a fresh ephemeral shielded address for the account index.
 */
export async function ephemeralAddressByIndex(
  fvk: FullViewingKey,
  accountIndex: number = 0,
): Promise<AddressByIndexResponse> {
  const wasm = await loadWasm()
  const address = await wasm.getEphemeralByIndex(fvk, accountIndex)

  return new AddressByIndexResponse({
    address,
  })
}

/**
 * Generate a fresh ephemeral shielded address as a bech32m string.
 */
export async function getEphemeralAddressString(
  fvk: FullViewingKey,
  accountIndex: number,
): Promise<string> {
  const wasm = await loadWasm()
  const address = await wasm.getEphemeralByIndex(fvk, accountIndex)
  return bech32mAddress(address)
}

/**
 * Get the transparent address for the wallet.
 */
export async function transparentAddress(
  fvk: FullViewingKey,
  _request: TransparentAddressRequest
): Promise<TransparentAddressResponse> {
  const wasm = await loadWasm()
  const result = await wasm.getTransparentAddress(fvk)

  return new TransparentAddressResponse({
    address: result.address,
    encoding: result.encoding,
  })
}

/**
 * Check if an address belongs to this wallet.
 */
export async function isOwnAddress(
  fvk: FullViewingKey,
  address: Address,
  maxAccountsToCheck: number = 100
): Promise<{ isOwn: boolean; accountIndex?: number }> {
  const wasm = await loadWasm()
  
  // Check each account index to see if the address matches
  for (let i = 0; i < maxAccountsToCheck; i++) {
    const derivedAddress = await wasm.getAddressByIndex(fvk, i)

    // Compare the inner bytes
    if (
      derivedAddress.inner.length === address.inner.length &&
      derivedAddress.inner.every((byte, idx) => byte === address.inner[idx])
    ) {
      return { isOwn: true, accountIndex: i }
    }
  }

  return { isOwn: false }
}

/**
 * Decode full address ownership metadata using the FVK.
 *
 * Uses the WASM `getAddressIndexByAddress` (equivalent to Prax's
 * `viewClient.indexByAddress`). This performs a single cryptographic
 * check rather than brute-force scanning, and works for both default
 * and ephemeral addresses.
 *
 * @param fvk  Full viewing key of the wallet
 * @param address  The address to check (protobuf Address or bech32m string)
 */
export async function getOwnAddressInfo(
  fvk: FullViewingKey,
  address: Address | string,
): Promise<OwnPenumbraAddressInfo> {
  const wasm = await loadWasm()

  // If a bech32m string was passed, decode it to an Address
  const addrProto =
    typeof address === 'string'
      ? new Address(addressFromBech32m(address))
      : address

  const index = await wasm.getAddressIndexByAddress(fvk, addrProto)
  if (!index) {
    return { belongsToWallet: false }
  }

  const randomizer = index.randomizer
  const isEphemeral =
    randomizer !== null &&
    randomizer !== undefined &&
    randomizer.length > 0 &&
    randomizer.some((b) => b !== 0)

  return {
    belongsToWallet: true,
    accountIndex: index.account,
    isEphemeral,
    randomizer: randomizer ?? new Uint8Array(),
  }
}
