'use client'

import { State as ChannelState } from '@bankd/shared/proto/ibc/core/channel/v1/channel'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { Button, Card, CopyButton, Input } from '@/components/ui'
import { useBalances, useCustomTokenBalances, useCustomTokens, useEVMWallet, useIBCChannels } from '@/hooks'
import { chainConfig } from '@/lib/config'
import { registerRegulatedAsset, registerRegulatedUser, useNativeWallet } from '@/lib/native-wallet'
import { RegulatedAssetRecord, getRegulatedAssets, saveRegulatedAsset } from '@/lib/regulated-assets/storage'
import { truncateAddress } from '@/lib/utils'

export function RegulatedAssetCommandBuilder() {
  const [denom, setDenom] = useState('')
  const [addressIndex, setAddressIndex] = useState('0')
  const [assetRegistration, setAssetRegistration] = useState('')
  const [userRegistration, setUserRegistration] = useState('')
  const [savedRecords, setSavedRecords] = useState<RegulatedAssetRecord[]>([])
  const [submitting, setSubmitting] = useState<'asset' | 'user' | null>(null)
  const wallet = useNativeWallet()
  const gap = wallet.syncProgress ? wallet.syncProgress.target - wallet.syncProgress.current : null
  const walletReady = wallet.initState === 'unlocked' && gap !== null && gap >= -5n && gap <= 5n
  const validIndex = /^\d+$/.test(addressIndex) && Number(addressIndex) <= 0xffffffff
  useEffect(() => setSavedRecords(getRegulatedAssets()), [])
  const { hexAddress, bech32Address } = useEVMWallet()
  const { data: publicBalances = [] } = useBalances(bech32Address ?? null)
  const { tokens: customTokens } = useCustomTokens()
  // The balance query drops tokens whose contract no longer exists on-chain
  // (stale localStorage entries from a previous localnet).
  const { data: customTokenBalances = [] } = useCustomTokenBalances(
    customTokens,
    hexAddress ?? null
  )
  const { data: channels = [] } = useIBCChannels()

  const activeChannel = channels.find(
    (c) => c.state === ChannelState.STATE_OPEN && c.clientStatus === 'Active'
  )
  // The voucher path uses the privacy-chain side channel id.
  const penumbraChannel =
    activeChannel?.counterparty?.channelId ??
    activeChannel?.channelId ??
    'channel-0'

  const knownAssets = useMemo(() => {
    const assets: Array<{
      denom: string
      label: string
      suggestedName: string
      decimals: number
    }> = [
      {
        denom: `transfer/${penumbraChannel}/${chainConfig.denom}`,
        label: `${chainConfig.displayDenom} — native ${chainConfig.denom}`,
        suggestedName: chainConfig.displayDenom,
        decimals: chainConfig.decimals,
      },
    ]
    for (const token of customTokenBalances) {
      // The native-token ERC20 alias (0xEeee…) shields as the native denom,
      // so its own voucher denom could never hold supply.
      if (
        token.address.toLowerCase() ===
        chainConfig.nativeErc20Address.toLowerCase()
      ) {
        continue
      }
      assets.push({
        denom: `transfer/${penumbraChannel}/erc20:${token.address}`,
        label: `${token.symbol} — ERC20 ${truncateAddress(token.address, 6, 4)}`,
        suggestedName: token.name,
        decimals: token.decimals,
      })
    }
    for (const balance of publicBalances) {
      if (balance.denom === chainConfig.denom) continue
      if (balance.denom.startsWith('ibc/')) continue
      if (balance.denom.startsWith('transfer/')) continue
      const denom = `transfer/${penumbraChannel}/${balance.denom}`
      if (assets.some((asset) => asset.denom === denom)) continue
      assets.push({
        denom,
        label: `${balance.symbol || balance.name || balance.denom} — ${balance.denom}`,
        suggestedName: balance.name || balance.symbol || '',
        decimals: balance.decimals,
      })
    }
    return assets
  }, [customTokenBalances, publicBalances, penumbraChannel])


  const submit = async (kind: 'asset' | 'user') => {
    if (!walletReady || !denom.trim() || submitting) return
    setSubmitting(kind)
    try {
      const result = kind === 'asset'
        ? await registerRegulatedAsset({ denom: denom.trim(), registrationJson: assetRegistration })
        : await registerRegulatedUser({ denom: denom.trim(), addressIndex: Number(addressIndex), registrationJson: userRegistration })
      if (!result.success) throw new Error(result.error || 'Registration failed')
      if (kind === 'asset') {
        saveRegulatedAsset({ id: denom.trim(), denom: denom.trim(), registration: assetRegistration, createdAt: Date.now() })
        setSavedRecords(getRegulatedAssets())
      }
      toast.success(`Registration submitted: ${result.hash}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Card header="Regulated Asset Setup">
      <div className="space-y-5">
        <p className="text-sm text-gray-600">Submit signed registrations issued by the registrar and committee. The signed JSON defines the asset policy; the selected denomination must match it. Do not paste private keys or seed phrases.</p>
        <label className="block text-sm text-gray-700">
          Known asset
          <select className="mt-1 block w-full rounded border p-2" value={knownAssets.some(asset => asset.denom === denom) ? denom : ''} onChange={event => setDenom(event.target.value)}>
            <option value="">Choose an asset or enter its denomination below</option>
            {knownAssets.map(asset => <option key={asset.denom} value={asset.denom}>{asset.label}</option>)}
          </select>
        </label>
        <Input label="Base denom" value={denom} onChange={event => setDenom(event.target.value)} placeholder="ubrl" />
        <p className="text-sm text-gray-600">{walletReady ? 'Wallet is unlocked and synced.' : 'Unlock the wallet and wait for sync before submitting.'}</p>
        <label className="block text-sm text-gray-700">
          Issued asset registration (JSON)
          <textarea value={assetRegistration} onChange={event => setAssetRegistration(event.target.value)} className="mt-1 w-full rounded border p-2 font-mono" rows={8} />
        </label>
        <Button type="button" onClick={() => submit('asset')} isLoading={submitting === 'asset'} disabled={!walletReady || !denom.trim() || !assetRegistration.trim() || submitting !== null}>Register regulated asset</Button>
        <Input label="User address index" value={addressIndex} onChange={event => setAddressIndex(event.target.value)} error={validIndex ? undefined : 'Enter an integer between 0 and 4294967295'} />
        <label className="block text-sm text-gray-700">
          Issued user registration (JSON)
          <textarea value={userRegistration} onChange={event => setUserRegistration(event.target.value)} className="mt-1 w-full rounded border p-2 font-mono" rows={8} />
        </label>
        <Button type="button" onClick={() => submit('user')} isLoading={submitting === 'user'} disabled={!walletReady || !denom.trim() || !validIndex || !userRegistration.trim() || submitting !== null}>Register this wallet for regulated asset</Button>
        <p className="text-sm text-amber-800">Live PET collection and authenticated committee encryption-key provisioning are unavailable.</p>
        {savedRecords.map(record => (
          <details key={record.id} className="rounded border p-3">
            <summary>{record.denom} — submitted registration</summary>
            <CopyButton value={record.registration} successMessage="Registration copied!" />
            <pre className="overflow-auto text-xs">{record.registration}</pre>
          </details>
        ))}
      </div>
    </Card>
  )
}
