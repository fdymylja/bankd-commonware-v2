'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { DisclosureExport } from '@/components/DisclosureExport'

import { PageContainer } from '@/components/layout'
import { Button, Card, Spinner } from '@/components/ui'
import { useNativeWallet } from '@/lib/native-wallet'
import {
  getNativeWalletDiagnostics,
  resetNativeWalletSyncState,
  type NativeWalletDiagnostics,
} from '@/lib/native-wallet/penumbra/services/diagnostics'

function isEnabled() {
  return process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ENABLE_NATIVE_WALLET_DEBUG === '1'
}

function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (_key, item) => typeof item === 'bigint' ? item.toString() : item,
    2,
  )
}

export default function NativeWalletDebugPage() {
  const wallet = useNativeWallet()
  const [diagnostics, setDiagnostics] = useState<NativeWalletDiagnostics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const enabled = isEnabled()

  const refresh = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    try {
      setDiagnostics(await getNativeWalletDiagnostics())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load diagnostics')
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 5_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const resetSync = useCallback(async () => {
    try {
      wallet.stopSync()
      await resetNativeWalletSyncState()
      if (wallet.initState === 'unlocked') {
        await wallet.startSync()
      }
      await refresh()
      toast.success('Native wallet sync reset')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset native wallet sync')
    }
  }, [refresh, wallet])

  if (!enabled) {
    return (
      <PageContainer title="Native Wallet Diagnostics">
        <Card>
          <p className="text-sm text-gray-600">Diagnostics are disabled.</p>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="Native Wallet Diagnostics"
      description="Development-only private wallet sync state"
    >
      <div className="space-y-4">
        <Card header="Voluntary disclosure">
      <DisclosureExport />
      <p>Submit original evidence directly to Defra, explicitly share it, and sign manual endorsements of an exact stored version using the local disclosure-audit client.</p>
      <p className="font-semibold text-amber-800">Trusted local testers only. Node access control is disabled and connected clients can perform administrative operations. Untrusted multi-user access is unsupported.</p>
      <pre className="overflow-auto rounded bg-gray-100 p-4">{`disclosure-audit capabilities
disclosure-audit submit --identity-file actor.seed --store-key STORE_PUBLIC_KEY --policy POLICY_ID --input evidence.json
disclosure-audit share --identity-file actor.seed --store-key STORE_PUBLIC_KEY --policy POLICY_ID --id DOC_ID --reader READER_DID
disclosure-audit endorse --identity-file reader.seed --store-key STORE_PUBLIC_KEY --policy POLICY_ID --id DOC_ID --cid VERSION_CID --verdict valid
disclosure-audit review --identity-file actor.seed --store-key STORE_PUBLIC_KEY --policy POLICY_ID --id DOC_ID --cid VERSION_CID`}</pre>
      <p>Endorsements are shared separately. They record each signer’s opinion, not consensus, proof validity, or historical authorization. Evidence changes require a new version review.</p>
      <p>Live PET and protected delivery are unavailable. Setup and verification instructions are in infra/disclosure-audit/README.md; upstream requirements are in infra/disclosure-audit/GAPS.md.</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {wallet.addresses?.penumbra.bech32 ?? 'No active private address'}
              </p>
              <p className="text-xs text-gray-500">
                Controller {diagnostics?.runtimeStatus.isRunning ? 'running' : 'stopped'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={refresh} disabled={isLoading}>
                {isLoading ? <Spinner size="sm" /> : 'Refresh'}
              </Button>
              <Button type="button" variant="danger" onClick={resetSync}>
                Reset native wallet sync
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card header="Sync">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">fullSyncHeight</span>
                <span>{diagnostics?.syncState?.fullSyncHeight ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">chain height</span>
                <span>{diagnostics?.syncStatus.chainHeight ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">observed chain height</span>
                <span>{diagnostics?.syncState?.lastObservedChainHeight ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">FULL_SYNC_HEIGHT table</span>
                <span>{String(diagnostics?.fullSyncHeightTable ?? 0)}</span>
              </div>
            </div>
          </Card>

          <Card header="Notes">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">spendable notes</span>
                <span>{diagnostics?.spendableNoteCount ?? 0}</span>
              </div>
              {diagnostics?.notesByAsset.map((asset) => (
                <div key={asset.assetId} className="rounded bg-gray-50 p-2">
                  <p className="truncate font-mono text-xs">{asset.assetId}</p>
                  <p className="text-xs text-gray-500">
                    {asset.noteCount} notes, {asset.amountBaseUnits} base units
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card header="Private Jobs">
            <div className="space-y-2 text-sm">
              {diagnostics?.privateJobs.length ? diagnostics.privateJobs.map((job) => (
                <div key={job.id} className="rounded bg-gray-50 p-2">
                  <p>{job.type}: {job.status}</p>
                  <p className="text-xs text-gray-500">{job.statusMessage}</p>
                  {job.error && <p className="text-xs text-red-600">{job.error}</p>}
                </div>
              )) : (
                <p className="text-gray-500">No jobs</p>
              )}
            </div>
          </Card>
        </div>

        <Card header="Raw">
          <pre className="max-h-[420px] overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-100">
            {formatJson(diagnostics)}
          </pre>
        </Card>
      </div>
    </PageContainer>
  )
}
