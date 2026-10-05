import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import {
  AuthInfo,
  SignDoc,
  SignerInfo,
  TxBody,
  TxRaw,
} from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import { Any } from 'cosmjs-types/google/protobuf/any'
import {
  bytesToHex,
  hexToBytes,
  keccak256,
  toHex,
} from 'viem'
import { sign } from 'viem/accounts'
import type { HDAccount } from 'viem/accounts'

import { chainConfig } from '@bankd/shared'

export type CosmosProtoEncoder<TMsg> = {
  typeUrl: string
  fromPartial: (partial: Partial<TMsg>) => TMsg
  toProto: (message: TMsg) => Uint8Array
}

export type CosmosMessage<TMsg = any> = {
  msg: CosmosProtoEncoder<TMsg>
  values: Partial<TMsg>
}

export type CosmosTransactionProgressCallback = (progress: {
  step: 'preparing' | 'signing' | 'broadcasting' | 'confirming' | 'confirmed' | 'error'
  message: string
  txHash?: string
}) => void

type AccountNumbers = {
  accountNumber: bigint
  sequence: bigint
}

type CometBroadcastResponse = {
  result?: {
    code?: number | string
    hash?: string
    log?: string
  }
  error?: {
    code?: number
    message?: string
    data?: string
  }
}

type CometTxResponse = {
  result?: {
    tx_result?: {
      code?: number | string
      log?: string
    }
  }
  error?: unknown
}

const ETH_SECP256K1_PUBKEY_TYPE =
  '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey'

function accountNumbers(value: unknown): AccountNumbers | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const accountNumber = record.account_number ?? record.accountNumber
  const sequence = record.sequence
  if (
    (typeof accountNumber === 'string' || typeof accountNumber === 'number') &&
    (typeof sequence === 'string' || typeof sequence === 'number')
  ) {
    return {
      accountNumber: BigInt(accountNumber),
      sequence: BigInt(sequence),
    }
  }

  for (const nested of Object.values(record)) {
    const found = accountNumbers(nested)
    if (found) return found
  }
  return null
}

async function fetchAccount(address: string): Promise<AccountNumbers> {
  const response = await fetch(
    `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${address}`,
  )
  if (!response.ok) {
    throw new Error(`Failed to load Bankd account: HTTP ${response.status}`)
  }

  const found = accountNumbers(await response.json())
  if (!found) {
    throw new Error('Bankd account response did not contain account number and sequence')
  }
  return found
}

function ethSecp256k1Pubkey(key: Uint8Array): Any {
  return Any.fromPartial({
    typeUrl: ETH_SECP256K1_PUBKEY_TYPE,
    value: PubKey.encode(PubKey.fromPartial({ key })).finish(),
  })
}

async function signDirect(
  account: HDAccount,
  signBytes: Uint8Array,
): Promise<Uint8Array> {
  const privateKey = account.getHdKey().privateKey
  if (!privateKey) {
    throw new Error('No signing key available - unlock your wallet first')
  }

  const signature = await sign({
    hash: keccak256(signBytes),
    privateKey: toHex(privateKey),
  })
  const result = new Uint8Array(64)
  result.set(hexToBytes(signature.r), 0)
  result.set(hexToBytes(signature.s), 32)
  return result
}

async function broadcastTx(txBytes: Uint8Array): Promise<string> {
  const response = await fetch(
    `${chainConfig.rpc}/broadcast_tx_sync?tx=${bytesToHex(txBytes)}`,
  )
  if (!response.ok) {
    throw new Error(`Bankd broadcast failed: HTTP ${response.status}`)
  }

  const data = await response.json() as CometBroadcastResponse
  if (data.error) {
    throw new Error(
      `Bankd broadcast failed: ${data.error.message ?? JSON.stringify(data.error)}`,
    )
  }
  if (Number(data.result?.code ?? 0) !== 0) {
    throw new Error(
      `Bankd broadcast rejected: ${data.result?.log || `code ${data.result?.code}`}`,
    )
  }

  const hash = data.result?.hash
  if (!hash) throw new Error('Bankd broadcast returned no transaction hash')
  return hash
}

async function waitForTx(hash: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const response = await fetch(
      `${chainConfig.rpc}/tx?hash=0x${hash}&prove=false`,
    )
    if (response.ok) {
      const data = await response.json() as CometTxResponse
      if (data.result?.tx_result) {
        const code = Number(data.result.tx_result.code ?? 0)
        if (code !== 0) {
          throw new Error(
            `Bankd transaction failed: ${data.result.tx_result.log || `code ${code}`}`,
          )
        }
        return
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1_000))
  }
  throw new Error(`Timed out waiting for Bankd transaction ${hash}`)
}

/**
 * Sign and submit native Bankd protobuf messages with the mobile wallet's
 * eth_secp256k1 key.
 */
export async function executeCosmosTx(
  account: HDAccount,
  signerAddress: string,
  messages: CosmosMessage[],
  onProgress?: CosmosTransactionProgressCallback,
): Promise<{ txHash: string }> {
  try {
    onProgress?.({ step: 'preparing', message: 'Preparing transaction...' })

    const accountState = await fetchAccount(signerAddress)
    const hdKey = account.getHdKey()
    if (!hdKey.publicKey) {
      throw new Error('No public key available - unlock your wallet first')
    }

    const bodyBytes = TxBody.encode(TxBody.fromPartial({
      messages: messages.map(({ msg, values }) => Any.fromPartial({
        typeUrl: msg.typeUrl,
        value: msg.toProto(msg.fromPartial(values)),
      })),
      memo: '',
    })).finish()

    const authInfoBytes = AuthInfo.encode(AuthInfo.fromPartial({
      signerInfos: [
        SignerInfo.fromPartial({
          publicKey: ethSecp256k1Pubkey(hdKey.publicKey),
          modeInfo: {
            single: { mode: SignMode.SIGN_MODE_DIRECT },
          },
          sequence: accountState.sequence,
        }),
      ],
      fee: {
        amount: [],
        gasLimit: 1_000_000n,
      },
    })).finish()

    const signDocBytes = SignDoc.encode(SignDoc.fromPartial({
      bodyBytes,
      authInfoBytes,
      chainId: chainConfig.chainId,
      accountNumber: accountState.accountNumber,
    })).finish()

    onProgress?.({ step: 'signing', message: 'Signing transaction...' })
    const signature = await signDirect(account, signDocBytes)
    const txBytes = TxRaw.encode(TxRaw.fromPartial({
      bodyBytes,
      authInfoBytes,
      signatures: [signature],
    })).finish()

    onProgress?.({ step: 'broadcasting', message: 'Broadcasting transaction...' })
    const txHash = await broadcastTx(txBytes)
    onProgress?.({
      step: 'confirming',
      message: 'Transaction sent. Waiting for confirmation...',
      txHash,
    })
    await waitForTx(txHash)
    onProgress?.({
      step: 'confirmed',
      message: 'Transaction confirmed',
      txHash,
    })
    return { txHash }
  } catch (error) {
    onProgress?.({
      step: 'error',
      message: error instanceof Error ? error.message : 'Transaction failed',
    })
    throw error
  }
}
