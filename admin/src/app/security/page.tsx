'use client'

import type { Validator } from '@bankd/shared/proto/cosmos/staking/v1beta1/staking'
import { BondStatus } from '@bankd/shared/proto/cosmos/staking/v1beta1/staking'
import {
  MsgAddValidator,
  MsgRemoveValidator,
  MsgUpdateValidatorWeight,
} from '@bankd/shared/proto/mizufinance/poa/v1/tx'
import { encodePubkey } from '@interchainjs/pubkey'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import { usePermissions, useValidators } from '@/hooks'
import { queryKeys } from '@/lib/cosmos'
import { executeTx } from '@/lib/evm'
import { useActiveAccount } from '@/lib/multisig'
import { truncateAddress } from '@/lib/utils'

const POWER_REDUCTION = BigInt(1_000_000)

export default function SecurityPage() {
  const { data: validators = [], isLoading, error } = useValidators()
  const { isPoaAuthority, poaAuthorityAddress, isPoaLoading } = usePermissions()
  const queryClient = useQueryClient()

  const invalidateValidators = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.validators.all })
  }

  return (
    <PageContainer
      title="Security"
      description="Add or remove network participants from the Proof of Authority set"
    >
      {/* PoA Authority Info */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">
              PoA Authority Status
            </h3>
            <p className="mt-1 font-mono text-sm text-gray-500">
              {isPoaLoading
                ? 'Loading...'
                : poaAuthorityAddress
                  ? truncateAddress(poaAuthorityAddress)
                  : 'Not set'}
            </p>
          </div>
          <PermissionBadge
            hasPermission={isPoaAuthority}
            isLoading={isPoaLoading}
            permittedLabel="You are PoA Authority"
            deniedLabel="Not PoA Authority"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AddValidatorForm onSuccess={invalidateValidators} />
        <UpdateValidatorWeightForm
          validators={validators}
          onSuccess={invalidateValidators}
        />
        <RemoveValidatorForm
          validators={validators}
          onSuccess={invalidateValidators}
        />
      </div>

      <div className="mt-8">
        <Card header="Active Validators">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">
              {error instanceof Error
                ? error.message
                : 'Failed to load validators'}
            </p>
          ) : validators.length === 0 ? (
            <p className="text-sm text-gray-500">No validators found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Moniker</th>
                    <th className="pb-3 font-medium">Address</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {validators.map((validator) => (
                    <tr
                      key={validator.operatorAddress}
                      className="border-b border-gray-100"
                    >
                      <td className="py-3 font-medium">
                        {validator.description?.moniker || 'Unknown'}
                      </td>
                      <td className="py-3 font-mono text-gray-600">
                        {truncateAddress(validator.operatorAddress)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            validator.status === BondStatus.BOND_STATUS_BONDED
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {validator.status === BondStatus.BOND_STATUS_BONDED
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 font-mono">{validator.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  )
}

function AddValidatorForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const [moniker, setMoniker] = useState('')
  const [pubkey, setPubkey] = useState('')
  const [weight, setWeight] = useState('1')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { cosmosAddress: bech32Address } = useActiveAccount()
  const { canAddValidator, isPoaLoading } = usePermissions()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bech32Address) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!moniker || !pubkey || !weight) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)

    try {
      await executeTx(queryClient, {
        msg: MsgAddValidator,
        values: {
          authority: bech32Address,
          moniker,
          pubKey: encodePubkey({
            type: 'tendermint/PubKeyEd25519',
            value: pubkey,
          }),
          weight: BigInt(weight),
        },
        successMessage: 'Validator added successfully!',
      })

      setMoniker('')
      setPubkey('')
      setWeight('1')
      onSuccess()
    } catch (error) {
      console.error('Failed to add validator', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card header="Add Validator">
      <div className="space-y-4">
        <PermissionAlert
          hasPermission={canAddValidator}
          isLoading={isPoaLoading}
          deniedMessage="Only the PoA authority can add validators."
        />
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Moniker"
            placeholder="My Validator"
            value={moniker}
            onChange={(e) => setMoniker(e.target.value)}
          />
          <Input
            label="Public Key (Base64)"
            placeholder="Consensus public key"
            value={pubkey}
            onChange={(e) => setPubkey(e.target.value)}
            hint="The ed25519 consensus public key in base64 format"
          />
          <Input
            label="Weight"
            placeholder="1"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            hint="Consensus power weight for this validator"
          />
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={!bech32Address || !canAddValidator}
            className="w-full"
          >
            Add Validator
          </Button>
        </form>
      </div>
    </Card>
  )
}

function ValidatorSelect({
  validators,
  value,
  onChange,
  label,
}: {
  validators: readonly Validator[]
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const selected = validators.find((v) => v.operatorAddress === value)

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Select a validator...</option>
        {validators.map((v) => {
          const weight = BigInt(v.tokens || '0') / POWER_REDUCTION
          return (
            <option key={v.operatorAddress} value={v.operatorAddress}>
              {v.description?.moniker || 'Unknown'} - weight: {weight.toString()} - {truncateAddress(v.operatorAddress)}
            </option>
          )
        })}
      </select>
      {selected && (
        <p className="mt-1.5 break-all font-mono text-xs text-gray-500">
          {selected.operatorAddress}
        </p>
      )}
    </div>
  )
}

function UpdateValidatorWeightForm({
  validators,
  onSuccess,
}: {
  validators: readonly Validator[]
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedValidator, setSelectedValidator] = useState('')
  const [weight, setWeight] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { cosmosAddress: bech32Address } = useActiveAccount()
  const { isPoaAuthority, isPoaLoading } = usePermissions()

  const selected = validators.find((v) => v.operatorAddress === selectedValidator)
  const currentWeight = selected
    ? (BigInt(selected.tokens || '0') / POWER_REDUCTION).toString()
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bech32Address) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!selectedValidator || !weight) {
      toast.error('Please select a validator and enter a weight')
      return
    }

    setIsSubmitting(true)

    try {
      await executeTx(queryClient, {
        msg: MsgUpdateValidatorWeight,
        values: {
          authority: bech32Address,
          validatorAddress: selectedValidator,
          weight: BigInt(weight),
        },
        successMessage: 'Validator weight updated!',
      })

      setWeight('')
      setSelectedValidator('')
      onSuccess()
    } catch (error) {
      console.error('Failed to update validator weight', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card header="Update Validator Weight">
      <div className="space-y-4">
        <PermissionAlert
          hasPermission={isPoaAuthority}
          isLoading={isPoaLoading}
          deniedMessage="Only the PoA authority can update validator weights."
        />
        <form onSubmit={handleSubmit} className="space-y-4">
          <ValidatorSelect
            validators={validators}
            value={selectedValidator}
            onChange={setSelectedValidator}
            label="Select Validator"
          />
          {currentWeight && (
            <p className="text-sm text-gray-500">
              Current weight: <span className="font-mono font-medium">{currentWeight}</span>
            </p>
          )}
          <Input
            label="New Weight"
            placeholder="1"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            hint="New consensus power weight for this validator"
          />
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={!bech32Address || !isPoaAuthority || !selectedValidator}
            className="w-full"
          >
            Update Weight
          </Button>
        </form>
      </div>
    </Card>
  )
}

function RemoveValidatorForm({
  validators,
  onSuccess,
}: {
  validators: readonly Validator[]
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedValidator, setSelectedValidator] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { cosmosAddress: bech32Address } = useActiveAccount()
  const { canRemoveValidator, isPoaLoading } = usePermissions()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bech32Address) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!selectedValidator) {
      toast.error('Please select a validator')
      return
    }

    setIsSubmitting(true)

    try {
      await executeTx(queryClient, {
        msg: MsgRemoveValidator,
        values: {
          authority: bech32Address,
          validatorAddress: selectedValidator,
        },
        successMessage: 'Validator removed successfully!',
      })

      setSelectedValidator('')
      onSuccess()
    } catch (error) {
      console.error('Failed to remove validator', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card header="Remove Validator">
      <div className="space-y-4">
        <PermissionAlert
          hasPermission={canRemoveValidator}
          isLoading={isPoaLoading}
          deniedMessage="Only the PoA authority can remove validators."
        />
        <form onSubmit={handleSubmit} className="space-y-4">
          <ValidatorSelect
            validators={validators}
            value={selectedValidator}
            onChange={setSelectedValidator}
            label="Select Validator"
          />
          <Button
            type="submit"
            variant="danger"
            isLoading={isSubmitting}
            disabled={
              !bech32Address || validators.length === 0 || !canRemoveValidator
            }
            className="w-full"
          >
            Remove Validator
          </Button>
        </form>
      </div>
    </Card>
  )
}
