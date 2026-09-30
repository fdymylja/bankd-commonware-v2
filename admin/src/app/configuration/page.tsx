'use client'

import { MsgUpdateParams } from '@bankd/shared/proto/mizufinance/native/v1/tx'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  Input,
  PermissionAlert,
  PermissionBadge,
  Spinner,
} from '@/components/ui'
import { MinusIcon, PlusIcon } from '@/components/ui/icons'
import { useNativeParams, usePermissions, usePoaParams } from '@/hooks'
import { queryKeys } from '@/lib/cosmos'
import { executeTx } from '@/lib/evm/execute'
import { useActiveAccount } from '@/lib/multisig'
import { bech32ToHex, isValidBech32Address } from '@/lib/utils'

interface NativeParamsFormData {
  adminAddress: string
  minters: { address: string }[]
}

export default function ConfigurationPage() {
  return (
    <PageContainer
      title="Configuration"
      description="View and update system parameters"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <NativeParamsCard />
        <PoaParamsCard />
      </div>
    </PageContainer>
  )
}

function NativeParamsCard() {
  const { data: params, isLoading, error, refetch } = useNativeParams()
  const { cosmosAddress: bech32Address } = useActiveAccount()
  const { isNativeAdmin, isNativeLoading } = usePermissions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const { register, control, handleSubmit, reset } =
    useForm<NativeParamsFormData>({
      defaultValues: {
        adminAddress: '',
        minters: [],
      },
    })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'minters',
  })

  // Sync form with params when loaded
  useEffect(() => {
    if (params && !isLoading) {
      reset({
        adminAddress: '',
        minters:
          params.whitelistedMinters?.map((addr) => ({ address: addr })) ?? [],
      })
    }
  }, [params, isLoading, reset])

  const onSubmit = async (data: NativeParamsFormData) => {
    if (!bech32Address) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsSubmitting(true)

    try {
      const whitelistedMinters = data.minters
        .map((m) => m.address.trim())
        .filter((addr) => addr !== '')

      const adminAddress = data.adminAddress || params?.adminAddress || ''

      await executeTx(queryClient, {
        msg: MsgUpdateParams,
        values: {
          authority: bech32Address,
          params: { adminAddress, whitelistedMinters },
        },
        successMessage: 'Parameters updated successfully!',
      })

      queryClient.invalidateQueries({ queryKey: queryKeys.params.native() })
    } catch (error) {
      console.error('Failed to update parameters', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card
      header="Native Module"
      headerRight={
        <PermissionBadge
          hasPermission={isNativeAdmin}
          isLoading={isNativeLoading}
          permittedLabel="Admin"
          deniedLabel="Not Admin"
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600">
          <p>
            {error instanceof Error ? error.message : 'Failed to load params'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700">
              Current Parameters
            </h4>
            <div className="mt-2 space-y-2 rounded-lg bg-gray-50 p-4">
              <div>
                <span className="text-xs text-gray-500">Admin Address</span>
                <p className="break-all font-mono text-sm">
                  {params?.adminAddress
                    ? isValidBech32Address(params.adminAddress)
                      ? bech32ToHex(params.adminAddress)
                      : params.adminAddress
                    : 'Not set (authority module only)'}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">
                  Authorized Minters
                </span>
                {params?.whitelistedMinters &&
                params.whitelistedMinters.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {params.whitelistedMinters.map((minter, i) => (
                      <li key={i} className="break-all font-mono text-sm">
                        {minter}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-mono text-sm text-gray-400">None</p>
                )}
              </div>
            </div>
          </div>

          <PermissionAlert
            hasPermission={isNativeAdmin}
            isLoading={isNativeLoading}
            deniedMessage="Only the native module admin can update these parameters."
          />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="New Admin Address"
              placeholder="wallet1... or 0x..."
              {...register('adminAddress')}
              hint="Leave empty to keep current admin"
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Authorized Minters
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ address: '' })}
                >
                  <PlusIcon className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm italic text-gray-500">
                  No minters configured
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <input
                        {...register(`minters.${index}.address`)}
                        placeholder="0x..."
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                This list replaces all existing minters on submission.
              </p>
            </div>

            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={!bech32Address || !isNativeAdmin}
              className="w-full"
            >
              Update Parameters
            </Button>
          </form>
        </div>
      )}
    </Card>
  )
}

function PoaParamsCard() {
  const { data: poaParams, isLoading, error, refetch } = usePoaParams()
  const { isPoaAuthority, isPoaLoading } = usePermissions()

  return (
    <Card
      header="Proof of Authority"
      headerRight={
        <PermissionBadge
          hasPermission={isPoaAuthority}
          isLoading={isPoaLoading}
          permittedLabel="Authority"
          deniedLabel="Not Authority"
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600">
          <p>
            {error instanceof Error ? error.message : 'Failed to load authority'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700">
              Module Authority
            </h4>
            <div className="mt-2 space-y-2 rounded-lg bg-gray-50 p-4">
              <div>
                <span className="text-xs text-gray-500">Authority Address</span>
                <p className="break-all font-mono text-sm">
                  {poaParams?.admin || 'Not set'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            PoA validator management requires the authority module address.
            {isPoaAuthority &&
              ' You can add/remove validators on the Security page.'}
          </div>
        </div>
      )}
    </Card>
  )
}
