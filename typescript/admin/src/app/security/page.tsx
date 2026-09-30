'use client'
import { VALIDATOR_ABI, VALIDATOR_ADDRESS } from '@bankd/shared/evm/bankd'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { type Hex, getAddress } from 'viem'

import { PageContainer } from '@/components/layout'
import { Button, Card, Input } from '@/components/ui'
import { usePermissions, useValidators } from '@/hooks'
import { executeTx } from '@/lib/evm/execute'
import { truncateAddress } from '@/lib/utils'

export default function SecurityPage() {
  const { data: validators, error, isLoading } = useValidators()
  const { isPoaAuthority, poaAuthorityAddress } = usePermissions()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    validatorAddress: '',
    publicKey: '',
    ingress: '',
    egress: '',
    feeRecipient: '',
    signature: '',
  })
  const labels = {
    validatorAddress: 'Validator EVM address',
    publicKey: 'Ed25519 public key (0x + 32 bytes)',
    ingress: 'Ingress (IP:port)',
    egress: 'Egress IP',
    feeRecipient: 'Fee recipient EVM address',
    signature: 'Key ownership signature (0x + 64 bytes)',
  }
  async function run(
    functionName: string,
    args: any[],
    successMessage: string
  ) {
    setBusy(true)
    try {
      await executeTx(queryClient, {
        address: VALIDATOR_ADDRESS,
        abi: VALIDATOR_ABI,
        functionName,
        args,
        successMessage,
      } as any)
      await queryClient.invalidateQueries({ queryKey: ['validators'] })
    } finally {
      setBusy(false)
    }
  }
  return (
    <PageContainer
      title="Security"
      description="Manage the Commonware validator registry"
    >
      <p className="mb-4 break-all text-sm">
        Validator administrator: {poaAuthorityAddress || 'Loading…'}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card header="Add validator">
          <p className="mb-4 text-sm text-gray-500">
            The validator signs the registration with their Ed25519 key.
            Registry changes take effect at an epoch boundary.
          </p>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void run(
                'addValidator',
                [
                  getAddress(form.validatorAddress),
                  form.publicKey as Hex,
                  form.ingress,
                  form.egress,
                  getAddress(form.feeRecipient),
                  form.signature as Hex,
                ],
                'Validator registered'
              ).catch(() => {})
            }}
          >
            {(Object.keys(form) as (keyof typeof form)[]).map((key) => (
              <Input
                key={key}
                label={labels[key]}
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
                required
                pattern={
                  key === 'publicKey'
                    ? '0x[0-9a-fA-F]{64}'
                    : key === 'signature'
                      ? '0x[0-9a-fA-F]{128}'
                      : key.endsWith('Address') || key === 'feeRecipient'
                        ? '0x[0-9a-fA-F]{40}'
                        : undefined
                }
              />
            ))}
            <Button type="submit" disabled={!isPoaAuthority || busy}>
              Register validator
            </Button>
          </form>
        </Card>
        <Card header="Active validators">
          {isLoading && <p>Loading…</p>}
          {error && <p className="text-red-600">{error.message}</p>}
          <ul className="space-y-4">
            {validators?.map((validator) => (
              <li
                key={validator.index.toString()}
                className="space-y-2 border-b border-gray-100 pb-4 text-sm"
              >
                <p className="font-mono">
                  {truncateAddress(validator.validatorAddress)}
                </p>
                <p>
                  Ingress: {validator.ingress} · Egress: {validator.egress}
                </p>
                <p>Registry index: {validator.index.toString()}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!isPoaAuthority || busy}
                  onClick={() =>
                    void run(
                      'deactivateValidator',
                      [validator.index],
                      'Validator deactivated'
                    ).catch(() => {})
                  }
                >
                  Deactivate
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageContainer>
  )
}
