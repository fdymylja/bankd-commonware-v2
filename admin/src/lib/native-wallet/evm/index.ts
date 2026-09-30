// src/lib/native-wallet/evm/index.ts
/**
 * EVM key derivation, signing, and wagmi connector.
 */

export {
  generateNewMnemonic,
  validateMnemonic,
  initializeEVMKeys,
  clearEVMKeys,
  hasEVMKeys,
  switchEVMAccount,
  getEVMAccountIndex,
  getEVMAddressInfo,
  getEVMAddressInfoForIndex,
  getEVMAddressForAccountIndex,
  signMessage,
  signTypedData,
  signTransaction,
  getEVMAccount,
} from './keys'

export {
  nativeWallet,
  nativeWalletConnectorType,
  type NativeWalletConnectorParameters,
} from './connector'
