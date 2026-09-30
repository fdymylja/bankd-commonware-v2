'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { Button, Input, Modal } from '@/components/ui'
import {
  type MultisigMember,
  deriveMultisigAddress,
  fetchMemberPubkey,
  parseShareBlob,
  useMultisig,
} from '@/lib/multisig'
import { truncateAddress } from '@/lib/utils'

interface MemberRow {
  address: string
  pubkeyBase64: string
}

interface CreateMultisigModalProps {
  isOpen: boolean
  onClose: () => void
}

/** Parse a pasted pubkey JSON `{"@type":".../ethsecp256k1.PubKey","key":"<b64>"}`. */
function parsePubkeyJson(input: string): string | null {
  try {
    const parsed = JSON.parse(input)
    if (typeof parsed?.key === 'string') return parsed.key
  } catch {
    // not JSON - maybe a bare base64 key
    if (/^[A-Za-z0-9+/=]+$/.test(input.trim())) return input.trim()
  }
  return null
}

export function CreateMultisigModal({ isOpen, onClose }: CreateMultisigModalProps) {
  const { createCosmosMultisig, addSafe } = useMultisig()

  const [label, setLabel] = useState('')
  const [threshold, setThreshold] = useState(1)
  const [rows, setRows] = useState<MemberRow[]>([
    { address: '', pubkeyBase64: '' },
    { address: '', pubkeyBase64: '' },
  ])
  const [busy, setBusy] = useState(false)

  const [safeLabel, setSafeLabel] = useState('')
  const [safeAddress, setSafeAddress] = useState('')

  const [importText, setImportText] = useState('')

  const completeMembers = useMemo<MultisigMember[]>(
    () =>
      rows
        .filter((r) => r.address.trim() && r.pubkeyBase64.trim())
        .map((r) => ({ address: r.address.trim(), pubkeyBase64: r.pubkeyBase64.trim() })),
    [rows]
  )

  const previewAddress = useMemo(() => {
    if (completeMembers.length < 1 || threshold < 1) return null
    try {
      return deriveMultisigAddress(completeMembers, threshold)
    } catch {
      return null
    }
  }, [completeMembers, threshold])

  const updateRow = (i: number, patch: Partial<MemberRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const handleFetch = async (i: number) => {
    const addr = rows[i].address.trim()
    if (!addr) return
    try {
      const pubkey = await fetchMemberPubkey(addr)
      if (!pubkey) {
        toast.error('No pubkey on chain yet - paste it manually')
        return
      }
      updateRow(i, { pubkeyBase64: pubkey })
      toast.success('Fetched pubkey')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fetch failed')
    }
  }

  const handlePaste = (i: number, raw: string) => {
    const key = parsePubkeyJson(raw)
    if (key) updateRow(i, { pubkeyBase64: key })
    else toast.error('Could not parse pubkey JSON')
  }

  const handleCreate = async () => {
    if (!label.trim()) return toast.error('Label required')
    if (completeMembers.length < 2)
      return toast.error('Need at least 2 members with pubkeys')
    if (threshold < 1 || threshold > completeMembers.length)
      return toast.error('Invalid threshold')
    setBusy(true)
    try {
      await createCosmosMultisig({ label: label.trim(), threshold, members: completeMembers })
      toast.success('Multisig created')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    setBusy(true)
    try {
      const blob = parseShareBlob(importText.trim())
      if (blob.type === 'cosmos-multisig') {
        await createCosmosMultisig({
          label: blob.label,
          threshold: blob.threshold!,
          members: blob.members!,
        })
      } else {
        await addSafe({ label: blob.label, safeAddress: blob.safeAddress! })
      }
      toast.success(`Imported "${blob.label}"`)
      setImportText('')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid config blob')
    } finally {
      setBusy(false)
    }
  }

  const handleAddSafe = async () => {
    if (!safeLabel.trim() || !safeAddress.trim())
      return toast.error('Safe label and address required')
    if (!/^0x[0-9a-fA-F]{40}$/.test(safeAddress.trim()))
      return toast.error('Invalid 0x address')
    setBusy(true)
    try {
      await addSafe({ label: safeLabel.trim(), safeAddress: safeAddress.trim() })
      toast.success('Safe added (watch-only)')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add multisig" size="lg">
      <div className="space-y-6">
        {/* Import a shared config */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Import shared multisig
          </h3>
          <p className="text-xs text-gray-500">
            Paste a config someone shared (the &quot;Share&quot; button on their
            multisig). Resolves to the same address - no need to re-enter members.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste multisig config JSON {"kind":"bankd-multisig-config",...}'
            className="h-24 w-full rounded-lg border border-gray-300 p-2 font-mono text-xs"
          />
          <Button
            variant="secondary"
            onClick={handleImport}
            isLoading={busy}
            disabled={!importText.trim()}
          >
            Import config
          </Button>
        </section>

        <div className="border-t border-gray-200" />

        {/* Cosmos multisig */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Multisig</h3>

          <Input
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Treasury multisig"
          />

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Member {i + 1}</span>
                  {rows.length > 2 && (
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      value={row.address}
                      onChange={(e) => updateRow(i, { address: e.target.value })}
                      placeholder="wallet1..."
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => handleFetch(i)}>
                    Fetch pubkey
                  </Button>
                </div>
                <Input
                  value={row.pubkeyBase64}
                  onChange={(e) => handlePaste(i, e.target.value)}
                  placeholder='Or paste pubkey JSON {"@type":".../ethsecp256k1.PubKey","key":"..."}'
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((prev) => [...prev, { address: '', pubkeyBase64: '' }])}
            >
              + Add member
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Threshold</label>
            <Input
              type="number"
              min={1}
              max={Math.max(completeMembers.length, 1)}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-gray-500">
              of {completeMembers.length || rows.length}
            </span>
          </div>

          {previewAddress && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Multisig address</div>
              <div className="font-mono text-sm text-gray-800 break-all">{previewAddress}</div>
            </div>
          )}

          <Button onClick={handleCreate} isLoading={busy} disabled={!previewAddress}>
            Create multisig
          </Button>
        </section>

        <div className="border-t border-gray-200" />

        {/* Safe (watch-only) */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Add existing Safe (watch-only)</h3>
          <Input
            label="Label"
            value={safeLabel}
            onChange={(e) => setSafeLabel(e.target.value)}
            placeholder="EVM Safe"
          />
          <Input
            label="Safe address"
            value={safeAddress}
            onChange={(e) => setSafeAddress(e.target.value)}
            placeholder="0x..."
          />
          {safeAddress && (
            <p className="text-xs text-gray-500">{truncateAddress(safeAddress)}</p>
          )}
          <Button variant="secondary" onClick={handleAddSafe} isLoading={busy}>
            Add Safe
          </Button>
        </section>
      </div>
    </Modal>
  )
}
