'use client'
import { getPublicClient } from '@bankd/shared/chain/client'
import {
  AUTHORITY_ABI,
  AUTHORITY_ADDRESS,
  NATIVE_ABI,
  NATIVE_ADDRESS,
} from '@bankd/shared/evm/bankd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getAddress, zeroAddress } from 'viem'

import { PageContainer } from '@/components/layout'
import { Button, Card, Input } from '@/components/ui'
import { useNativeParams, usePermissions, usePoaParams } from '@/hooks'
import { executeTx } from '@/lib/evm/execute'
import { useActiveAccount } from '@/lib/multisig'

export default function ConfigurationPage() {
  const client = useQueryClient()
  const { data: params, error } = useNativeParams()
  const { data: poa } = usePoaParams()
  const { isNativeAdmin } = usePermissions()
  const { evmAddress } = useActiveAccount()
  const [minter, setMinter] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: pendingOwner } = useQuery({
    queryKey: ['authority', 'pendingOwner'],
    queryFn: () =>
      getPublicClient().readContract({
        address: AUTHORITY_ADDRESS,
        abi: AUTHORITY_ABI,
        functionName: 'pendingOwner',
      }),
    refetchInterval: 10_000,
  })
  async function run(step: any) {
    setBusy(true)
    try {
      await executeTx(client, step)
      await client.invalidateQueries()
    } finally {
      setBusy(false)
    }
  }
  return (
    <PageContainer
      title="Configuration"
      description="Manage issuance permissions and bank administration"
    >
      {error && <p className="mb-4 text-red-600">{error.message}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card header="Native BRL">
          <p className="mb-4 break-all text-sm">
            Admin: {params?.adminAddress || 'Loading…'}
          </p>
          <p className="mb-4 text-sm text-gray-500">
            The admin can mint and burn BRL. Additional minters can be
            authorized individually.
          </p>
          <ul className="mb-4 space-y-2">
            {params?.whitelistedMinters.map((address) => (
              <li
                key={address}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="break-all font-mono">{address}</span>
                <Button
                  size="sm"
                  disabled={!isNativeAdmin || busy}
                  onClick={() =>
                    void run({
                      address: NATIVE_ADDRESS,
                      abi: NATIVE_ABI,
                      functionName: 'setMinter',
                      args: [getAddress(address), false],
                      successMessage: 'Minter revoked',
                    }).catch(() => {})
                  }
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void run({
                address: NATIVE_ADDRESS,
                abi: NATIVE_ABI,
                functionName: 'setMinter',
                args: [getAddress(minter), true],
                successMessage: 'Minter authorized',
              }).catch(() => {})
            }}
          >
            <Input
              label="Minter address"
              placeholder="0x…"
              value={minter}
              onChange={(event) => setMinter(event.target.value)}
              required
              pattern="0x[0-9a-fA-F]{40}"
            />
            <Button type="submit" disabled={!isNativeAdmin || busy}>
              Authorize minter
            </Button>
          </form>
        </Card>
        <Card header="Admin ownership">
          <p className="mb-4 break-all text-sm">
            Current admin: {params?.adminAddress || 'Loading…'}
          </p>
          <p className="mb-4 text-sm text-gray-500">
            The new admin must accept the transfer from their wallet. Validator,
            bridge adapter and router administrators are managed separately.
          </p>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void run({
                address: AUTHORITY_ADDRESS,
                abi: AUTHORITY_ABI,
                functionName: 'transferOwnership',
                args: [getAddress(newOwner)],
                successMessage: 'Ownership transfer started',
              }).catch(() => {})
            }}
          >
            <Input
              label="New admin address"
              value={newOwner}
              onChange={(event) => setNewOwner(event.target.value)}
              required
              pattern="0x[0-9a-fA-F]{40}"
            />
            <Button type="submit" disabled={!isNativeAdmin || busy}>
              Start transfer
            </Button>
          </form>
          {pendingOwner && pendingOwner !== zeroAddress && (
            <div className="mt-4 space-y-3">
              <p className="break-all text-sm">Pending admin: {pendingOwner}</p>
              <Button
                disabled={
                  busy ||
                  evmAddress?.toLowerCase() !== pendingOwner.toLowerCase()
                }
                onClick={() =>
                  void run({
                    address: AUTHORITY_ADDRESS,
                    abi: AUTHORITY_ABI,
                    functionName: 'acceptOwnership',
                    args: [],
                    successMessage: 'Ownership accepted',
                  }).catch(() => {})
                }
              >
                Accept ownership
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !isNativeAdmin}
                onClick={() =>
                  void run({
                    address: AUTHORITY_ADDRESS,
                    abi: AUTHORITY_ABI,
                    functionName: 'cancelTransferOwnership',
                    args: [],
                    successMessage: 'Transfer cancelled',
                  }).catch(() => {})
                }
              >
                Cancel transfer
              </Button>
            </div>
          )}
          <p className="mt-4 break-all text-sm">
            Validator admin: {poa?.admin || 'Loading…'}
          </p>
        </Card>
      </div>
    </PageContainer>
  )
}
