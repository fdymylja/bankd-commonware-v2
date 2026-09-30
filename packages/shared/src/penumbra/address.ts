import { toBech32 } from '@cosmjs/encoding'
import { type Hex, bytesToHex, sha256, toBytes } from 'viem'

/**
 * A transparent Penumbra address with its bech32 encoding.
 */
export interface PenumbraTransparentAddress {
  address: import('@mizufinance/protobuf/shieldd/core/keys/v1/keys_pb').Address
  bech32: string
}

/**
 * Derives the deterministic intermediate Cosmos address for IBC transfers
 * via the EEM (EVM Execution Middleware).
 *
 * Mirrors the Go implementation in x/eem/keeper/evm_exec.go:DeriveIntermediateSender
 *
 * @param channel - The IBC channel (e.g., "channel-0")
 * @param originalSender - The original sender address (bech32 Penumbra address)
 * @returns The raw 20-byte address
 */
export function deriveIntermediateAddressData(
  channel: string,
  originalSender: string
): Uint8Array {
  // Match the Go implementation: "evmexecmiddleware/{channel}/{originalSender}"
  const senderStr = `evmexecmiddleware/${channel}/${originalSender}`
  const hashHex = sha256(toBytes(senderStr))
  // Take first 20 bytes of hash for the address (matches sdk.AccAddress)
  const hashBytes = hexToBytes(hashHex)
  return hashBytes.slice(0, 20)
}

/**
 * Derives the deterministic intermediate Cosmos address for IBC transfers
 * via the EEM (EVM Execution Middleware).
 *
 * Mirrors the Go implementation in x/eem/keeper/evm_exec.go:DeriveIntermediateSender
 *
 * @param channel - The IBC channel (e.g., "channel-0")
 * @param originalBech32Sender - The original sender address (bech32 Penumbra address)
 * @returns The bech32 "wallet" address that will be the intermediate sender on Bankd
 */
export function deriveIntermediateBech32Address(
  channel: string,
  originalBech32Sender: string
): string {
  return toBech32(
    'wallet',
    deriveIntermediateAddressData(channel, originalBech32Sender)
  )
}

/**
 * Derives the EVM (hex) address for the intermediate sender.
 * This is useful for whitelisting the buyer in the AtomicSwap contract.
 *
 * @param channel - The IBC channel (e.g., "channel-0")
 * @param originalBech32Sender - The original sender address (bech32 Penumbra address)
 * @returns The hex address (0x...) that corresponds to the intermediate sender
 */
export function deriveIntermediateEvmAddress(
  channel: string,
  originalBech32Sender: string
): Hex {
  return bytesToHex(
    deriveIntermediateAddressData(channel, originalBech32Sender)
  )
}

/**
 * Derives the deterministic intermediate Cosmos bech32 address and EVM (hex) address for sender.
 *
 * @param channel - The IBC channel (e.g., "channel-0")
 * @param originalBech32Sender - The original sender address (bech32 Penumbra address)
 * @returns The intermediate bech32 and hex addresses
 */
export function deriveIntermediateAddresses(
  channel: string,
  originalBech32Sender: string | PenumbraTransparentAddress
): { bech32: string; hex: string } {
  const originalSender =
    typeof originalBech32Sender === 'string'
      ? originalBech32Sender
      : originalBech32Sender.bech32
  return {
    bech32: deriveIntermediateBech32Address(channel, originalSender),
    hex: deriveIntermediateEvmAddress(channel, originalSender),
  }
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
