'use client'

import { getPublicClient } from '@bankd/shared/chain/client'
import { getIBCClients } from '@bankd/shared/chain/queries'
import { IBC_ADAPTER_ABI, IBC_ADAPTER_ADDRESS } from '@bankd/shared/evm/bankd'
import { extractPacketSequenceFromTx } from '@bankd/shared/ibc'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { type Hex, formatUnits, getAddress, parseUnits } from 'viem'

import { PageContainer } from '@/components/layout'
import { Button, Card, Input } from '@/components/ui'
import { executeTx } from '@/lib/evm'
import { useActiveAccount } from '@/lib/multisig'

export default function NetworkPage() {
  const queryClient = useQueryClient()
  const routes = useQuery({
    queryKey: ['ibc-clients'],
    queryFn: getIBCClients,
    refetchInterval: 10_000,
  })
  const { evmAddress } = useActiveAccount()
  const [clientId, setClientId] = useState('')
  const [receiver, setReceiver] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const selected =
    clientId ||
    routes.data?.find((route) => route.status === 'Active')?.clientId ||
    ''

  async function send(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setResult('')
    try {
      const value = parseUnits(amount, 18)
      if (value <= 0n) throw new Error('Amount must be positive')
      const block = await getPublicClient().getBlock({ blockTag: 'latest' })
      let hash: Hex | undefined
      await executeTx(queryClient, {
        address: IBC_ADAPTER_ADDRESS,
        abi: IBC_ADAPTER_ABI,
        functionName: 'sendTransfer',
        args: [selected, getAddress(receiver), block.timestamp + 600n, memo],
        value,
        successMessage: 'IBC transfer submitted',
        onTransactionSent: (sent) => {
          hash = sent
        },
      })
      if (hash) {
        const packet = await extractPacketSequenceFromTx(hash)
        setResult(
          `Submitted ${hash}${packet ? ` · packet ${packet.sequence}` : ''}. Delivery awaits the relayer and acknowledgement.`
        )
      } else
        setResult(
          'Safe proposal created. Collect the required signatures to submit it.'
        )
      await routes.refetch()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Transfer failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer
      title="Network"
      description="IBC routes registered on the Bankd router."
    >
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Connected clients</h2>
          {routes.isPending && <p>Loading IBC clients…</p>}
          {routes.error && (
            <p role="alert" className="text-red-600">
              {routes.error.message}
            </p>
          )}
          {routes.data?.length === 0 && (
            <p>
              No clients registered. Run the IBC setup for the hub and spoke
              before sending.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2">Local client</th>
                  <th>Counterparty client</th>
                  <th>Status</th>
                  <th>Client height</th>
                  <th>Escrow (BRL)</th>
                </tr>
              </thead>
              <tbody>
                {routes.data?.map((route) => (
                  <tr key={route.clientId} className="border-t">
                    <td className="py-3">{route.clientId}</td>
                    <td>{route.counterpartyClientId}</td>
                    <td>{route.status}</td>
                    <td>{route.height?.toString() ?? 'Unknown'}</td>
                    <td>{formatUnits(route.escrowed, 18)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Send BRL over IBC</h2>
          <form onSubmit={send} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Client
              <select
                value={selected}
                onChange={(event) => setClientId(event.target.value)}
                className="mt-1 block w-full rounded-lg border p-2"
                required
              >
                <option value="">Select a client</option>
                {routes.data?.map((route) => (
                  <option
                    key={route.clientId}
                    value={route.clientId}
                    disabled={route.status !== 'Active'}
                  >
                    {route.clientId} ({route.status})
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Recipient on the other chain"
              placeholder="0x…"
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
              pattern="0x[0-9a-fA-F]{40}"
              required
            />
            <Input
              label="Amount (BRL)"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <Input
              label="Memo"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
            <p className="text-sm text-gray-500 md:col-span-2">
              Transfers expire after 10 minutes. A relayer must deliver the
              packet and acknowledgement.
            </p>
            <Button type="submit" disabled={!evmAddress || !selected || busy}>
              {busy ? 'Submitting…' : 'Send BRL'}
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          {result && <p className="mt-3 break-all text-sm">{result}</p>}
        </Card>
      </div>
    </PageContainer>
  )
}
