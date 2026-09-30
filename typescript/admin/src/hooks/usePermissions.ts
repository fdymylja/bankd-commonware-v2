import { useMemo } from 'react'

import { useActiveAccount } from '@/lib/multisig/use-active-account'
import { addressInList, addressesEqual } from '@/lib/utils'

import { useNativeParams, usePoaParams } from './useModuleParams'

export interface Permissions {
  // Native module permissions
  isNativeAdmin: boolean
  canMint: boolean
  canUpdateNativeParams: boolean

  // PoA module permissions
  isPoaAuthority: boolean
  canAddValidator: boolean
  canRemoveValidator: boolean

  // Loading states
  isLoading: boolean
  isNativeLoading: boolean
  isPoaLoading: boolean

  // Raw data for display
  nativeAdminAddress: string | null
  whitelistedMinters: string[]
  poaAuthorityAddress: string | null
}

export function usePermissions(): Permissions {
  const { evmAddress: bech32Address } = useActiveAccount()
  const { data: nativeParams, isLoading: isNativeLoading } = useNativeParams()
  const { data: poaParams, isLoading: isPoaLoading } = usePoaParams()

  return useMemo(() => {
    const nativeAdminAddress = nativeParams?.adminAddress || null
    const whitelistedMinters = nativeParams?.whitelistedMinters || []
    const poaAuthorityAddress = poaParams?.admin || null

    const isNativeAdmin = addressesEqual(bech32Address, nativeAdminAddress)
    const canMint = isNativeAdmin || addressInList(bech32Address, whitelistedMinters)
    const isPoaAuthority = addressesEqual(bech32Address, poaAuthorityAddress)

    return {
      // Native module permissions
      isNativeAdmin,
      canMint,
      canUpdateNativeParams: isNativeAdmin,

      // PoA module permissions
      isPoaAuthority,
      canAddValidator: isPoaAuthority,
      canRemoveValidator: isPoaAuthority,

      // Loading states
      isLoading: isNativeLoading || isPoaLoading,
      isNativeLoading,
      isPoaLoading,

      // Raw data for display
      nativeAdminAddress,
      whitelistedMinters,
      poaAuthorityAddress,
    }
  }, [bech32Address, nativeParams, poaParams, isNativeLoading, isPoaLoading])
}
