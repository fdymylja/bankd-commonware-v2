// src/lib/native-wallet/evm/connector.ts
/**
 * Wagmi connector for the native EVM wallet.
 * 
 * This allows the native wallet to be used with wagmi hooks like
 * useAccount, useConnect, useSignMessage, etc.
 */

import { type CreateConnectorFn, createConnector } from '@wagmi/core'
import {
  type Address,
  type Chain,
  type EIP1193RequestFn,
  type Hex,
  createWalletClient,
  custom,
  getAddress,
  numberToHex,
} from 'viem'

import { chainDefinition } from '@/lib/config'

import {
  getEVMAccount,
  getEVMAddressInfo,
  hasEVMKeys,
} from './keys'

// Connector type identifier
export const nativeWalletConnectorType = 'nativeWallet' as const

/**
 * Native wallet connector parameters.
 */
export interface NativeWalletConnectorParameters {
  /**
   * Callback to show the unlock modal when connection is attempted
   * while wallet is locked.
   */
  onConnectRequest?: () => Promise<void>
}


/**
 * Create a wagmi connector for the native EVM wallet.
 * 
 * @example
 * ```ts
 * import { createConfig } from 'wagmi'
 * import { nativeWallet } from '@/lib/native-wallet/evm/connector'
 * 
 * const config = createConfig({
 *   connectors: [nativeWallet()],
 *   // ...
 * })
 * ```
 */
export function nativeWallet(parameters: NativeWalletConnectorParameters = {}): CreateConnectorFn {
  let connected = false
  const onConnectRequest = parameters.onConnectRequest

  return createConnector((config) => ({
    id: 'native-wallet',
    name: 'Native Wallet',
    type: nativeWalletConnectorType,

    async setup() {
      // Check if already connected (wallet is unlocked)
      connected = hasEVMKeys()
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async connect(parameters: { chainId?: number; isReconnecting?: boolean; withCapabilities?: boolean } = {}): Promise<any> {
      const { chainId } = parameters
      
      // If wallet is locked, trigger the unlock flow
      if (!hasEVMKeys()) {
        if (onConnectRequest) {
          await onConnectRequest()
        }
        // After onConnectRequest resolves, check if we're now connected
        if (!hasEVMKeys()) {
          throw new Error('Wallet is locked. Please unlock to connect.')
        }
      }

      const accounts = await this.getAccounts()
      let currentChainId = await this.getChainId()

      // We only support our target chain
      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain?.({ chainId })
        currentChainId = chain?.id ?? currentChainId
      }

      connected = true

      return {
        accounts,
        chainId: currentChainId,
      }
    },

    async disconnect() {
      connected = false
    },

    async getAccounts(): Promise<readonly Address[]> {
      if (!hasEVMKeys()) {
        return []
      }

      const { hex } = getEVMAddressInfo()
      return [getAddress(hex)]
    },

    async getChainId(): Promise<number> {
      return chainDefinition.id
    },

    async isAuthorized(): Promise<boolean> {
      if (!connected) return false
      if (!hasEVMKeys()) return false
      
      const accounts = await this.getAccounts()
      return accounts.length > 0
    },

    async switchChain({ chainId }): Promise<Chain> {
      // We only support our target chain
      const chain = config.chains.find((x) => x.id === chainId)
      if (!chain) {
        throw new Error(`Chain ${chainId} not configured`)
      }
      if (chainId !== chainDefinition.id) {
        throw new Error(`Native wallet only supports chain ${chainDefinition.id}`)
      }
      return chain
    },

    onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) {
        this.onDisconnect()
      } else {
        config.emitter.emit('change', {
          accounts: accounts.map((x) => getAddress(x)),
        })
      }
    },

    onChainChanged(chain: string) {
      const chainId = Number(chain)
      config.emitter.emit('change', { chainId })
    },

    async onDisconnect() {
      config.emitter.emit('disconnect')
      connected = false
    },

    async getProvider() {
      return createProvider()
    },
  }))
}

/**
 * Create an EIP-1193 compatible provider for the native wallet.
 */
function createProvider() {
  const request: EIP1193RequestFn = async ({ method, params }) => {
    switch (method) {
      case 'eth_chainId':
        return numberToHex(chainDefinition.id)

      case 'eth_accounts':
      case 'eth_requestAccounts': {
        if (!hasEVMKeys()) {
          return []
        }
        const { hex } = getEVMAddressInfo()
        return [hex]
      }

      case 'personal_sign': {
        if (!hasEVMKeys()) {
          throw new Error('Wallet is locked')
        }
        const [message, address] = params as [Hex, Address]
        const account = getEVMAccount()
        
        // Verify the address matches
        if (getAddress(address) !== getAddress(account.address)) {
          throw new Error('Address mismatch')
        }

        // personal_sign message is hex-encoded
        const messageString = Buffer.from(message.slice(2), 'hex').toString('utf-8')
        return account.signMessage({ message: messageString })
      }

      case 'eth_signTypedData_v4': {
        if (!hasEVMKeys()) {
          throw new Error('Wallet is locked')
        }
        const [address, typedDataJson] = params as [Address, string]
        const account = getEVMAccount()

        if (getAddress(address) !== getAddress(account.address)) {
          throw new Error('Address mismatch')
        }

        const typedData = JSON.parse(typedDataJson)
        return account.signTypedData(typedData)
      }

      case 'eth_sendTransaction': {
        if (!hasEVMKeys()) {
          throw new Error('Wallet is locked')
        }
        const [tx] = params as [any]
        const account = getEVMAccount()
        const rpcUrl = chainDefinition.rpcUrls.default.http[0]

        // Helper to make RPC calls
        const rpcCall = async (method: string, rpcParams: any[]) => {
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method,
              params: rpcParams,
            }),
          })
          const json = await response.json()
          if (json.error) {
            throw new Error(json.error.message)
          }
          return json.result
        }

        // Estimate gas if not provided
        let gasLimit = tx.gas ? BigInt(tx.gas) : undefined
        if (!gasLimit) {
          try {
            const estimateResult = await rpcCall('eth_estimateGas', [{
              from: tx.from,
              to: tx.to,
              data: tx.data,
              value: tx.value,
            }])
            // Add 20% buffer to estimated gas
            gasLimit = (BigInt(estimateResult) * 120n) / 100n
          } catch (e) {
            console.warn('[NativeWallet] Gas estimation failed, using default:', e)
            gasLimit = 500000n // Fallback gas limit
          }
        }

        // Create wallet client for sending transaction
        const walletClient = createWalletClient({
          account,
          chain: chainDefinition,
          transport: custom({
            request: async ({ method, params }) => rpcCall(method, params as any[]),
          }),
        })

        // Send the transaction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hash = await (walletClient.sendTransaction as any)({
          account: walletClient.account,
          chain: chainDefinition,
          to: tx.to as Address,
          value: tx.value ? BigInt(tx.value) : undefined,
          data: tx.data as Hex | undefined,
          gas: gasLimit,
          gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
          maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
          nonce: tx.nonce ? Number(tx.nonce) : undefined,
        })

        return hash
      }

      case 'eth_sign': {
        throw new Error('eth_sign is deprecated. Use personal_sign instead.')
      }

      case 'wallet_switchEthereumChain': {
        const [{ chainId }] = params as [{ chainId: Hex }]
        const targetChainId = parseInt(chainId, 16)
        if (targetChainId !== chainDefinition.id) {
          throw new Error(`Native wallet only supports chain ${chainDefinition.id}`)
        }
        return null
      }

      case 'wallet_addEthereumChain': {
        // We don't support adding chains, but don't throw if it's our chain
        const [{ chainId }] = params as [{ chainId: Hex }]
        const targetChainId = parseInt(chainId, 16)
        if (targetChainId !== chainDefinition.id) {
          throw new Error('Native wallet does not support adding chains')
        }
        return null
      }

      // For read-only methods, forward to RPC
      default: {
        const response = await fetch(chainDefinition.rpcUrls.default.http[0], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
          }),
        })
        const json = await response.json()
        if (json.error) {
          throw new Error(json.error.message)
        }
        return json.result
      }
    }
  }

  return { request }
}
