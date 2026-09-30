'use client'

/**
 * Global co-sign modal. Any page that raises a Safe proposal through
 * `executeTx` drops the pending tx into the coSignModal store; this component,
 * mounted at the app root, renders it so the initiator can sign, share the
 * unsigned blob, paste co-signer signatures, and execute - without navigating to
 * /multisig. Mirrors the SafePendingTxCard on that page.
 */

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { Button, Modal } from '@/components/ui'
import { useMultisig } from '@/lib/multisig'
import {
  type SafeInfo,
  type SafeMemberSignatureBlob,
  type UnsignedSafeTxBlob,
  getSafeInfo,
} from '@/lib/safe'
import { truncateAddress } from '@/lib/utils'
import { useCoSignModal } from '@/store/coSignModal'

/** Serialize the unsigned Safe tx for a co-signer to import and sign. */
function unsignedBlob(
  label: string,
  tx: {
    safeAddress: `0x${string}`
    chainId: number
    safeTx: unknown
    safeTxHash: `0x${string}`
    nonce: string
    summary: string
  }
): UnsignedSafeTxBlob {
  return {
    kind: 'bankd-safe-unsigned-tx',
    safe: { label, safeAddress: tx.safeAddress, chainId: tx.chainId },
    tx: {
      safeTx: tx.safeTx as UnsignedSafeTxBlob['tx']['safeTx'],
      safeTxHash: tx.safeTxHash,
      nonce: tx.nonce,
      summary: tx.summary,
    },
  }
}

export function CoSignModal() {
  const { pendingTx, close } = useCoSignModal()
  const {
    wallets,
    pendingSafeTxs,
    signSafeAsInitiator,
    addSafeMemberSignature,
    executePendingSafe,
    deletePendingSafe,
  } = useMultisig()

  const [info, setInfo] = useState<SafeInfo | null>(null)
  const [sigInput, setSigInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Live threshold + nonce for the quorum badge and the stale-nonce warning.
  useEffect(() => {
    if (!pendingTx) {
      setInfo(null)
      return
    }
    let cancelled = false
    getSafeInfo(pendingTx.safeAddress)
      .then((i) => !cancelled && setInfo(i))
      .catch(() => !cancelled && setInfo(null))
    return () => {
      cancelled = true
    }
  }, [pendingTx])

  if (!pendingTx) return null

  // The store only holds the snapshot from when the proposal was raised. Re-read
  // the live copy from context so signing / pasting sigs (which call refresh())
  // updates the count and flips Execute on. Falls back to the snapshot right
  // after execute deletes it (the modal closes in the same tick anyway).
  const tx = pendingSafeTxs.find((t) => t.id === pendingTx.id) ?? pendingTx
  const cfg = wallets.find((w) => w.id === tx.safeId)
  const threshold = info?.threshold ?? 0
  const signers = Object.keys(tx.signatures)
  const count = signers.length
  const ready = threshold > 0 && count >= threshold
  const stale = info?.nonce !== undefined && info.nonce !== tx.nonce

  const copyBlob = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify(unsignedBlob(cfg?.label ?? 'Safe', tx), null, 2)
    )
    toast.success('Unsigned Safe tx copied')
  }

  const doSign = async () => {
    setBusy(true)
    try {
      const blob = await signSafeAsInitiator(tx.id)
      toast.success(`Signed as ${truncateAddress(blob.ownerAddress)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sign failed')
    } finally {
      setBusy(false)
    }
  }

  const importSig = async () => {
    try {
      const parsed = JSON.parse(sigInput) as SafeMemberSignatureBlob
      if (parsed.kind !== 'bankd-safe-member-signature')
        throw new Error('Not a Safe member signature blob')
      if (parsed.safeTxHash !== tx.safeTxHash)
        throw new Error('Signature is for a different Safe tx')
      await addSafeMemberSignature(tx.id, parsed.signature)
      setSigInput('')
      toast.success('Signature added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid signature blob')
    }
  }

  const doExecute = async () => {
    setBusy(true)
    try {
      const { transactionHash, deployedAddress } = await executePendingSafe(tx.id)
      toast.success(
        deployedAddress
          ? `Executed. Deployed at ${deployedAddress}`
          : `Executed: ${transactionHash}`
      )
      close()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Execute failed')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    setBusy(true)
    try {
      await deletePendingSafe(tx.id)
      toast.success('Proposal discarded')
      close()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={close} title="Safe proposal" size="md">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {tx.summary}
            </div>
            <div className="text-xs text-gray-500">nonce {tx.nonce}</div>
          </div>
          <div
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              ready
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {count} / {threshold || '?'} signatures
          </div>
        </div>

        {stale && (
          <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            Stale: Safe is now at nonce {info?.nonce}. This tx was built for
            nonce {tx.nonce} and can&apos;t execute - discard and
            recreate it.
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Button size="sm" variant="secondary" onClick={copyBlob}>
            Copy unsigned
          </Button>
          <Button size="sm" onClick={doSign} isLoading={busy}>
            Sign as me
          </Button>
          <Button
            size="sm"
            onClick={doExecute}
            disabled={!ready || stale}
            isLoading={busy}
            className={ready && !stale ? undefined : '!bg-gray-200 !text-gray-400'}
          >
            Execute
          </Button>
          <Button size="sm" variant="danger" onClick={doDelete}>
            Discard
          </Button>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-500">
            Signatures ({count}/{threshold || '?'})
            {ready ? ' · quorum reached' : ''}
          </div>
          {count === 0 ? (
            <div className="text-xs text-gray-300">No signatures yet</div>
          ) : (
            signers.map((owner) => (
              <div
                key={owner}
                className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1"
              >
                <span className="font-mono text-xs text-gray-600">
                  {truncateAddress(owner)}
                </span>
                <span className="font-mono text-xs text-green-600">✓</span>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={sigInput}
            onChange={(e) => setSigInput(e.target.value)}
            placeholder="Paste an owner signature blob to add…"
            className="h-20 w-full rounded-lg border border-gray-300 p-2 font-mono text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={importSig}
            disabled={!sigInput.trim()}
          >
            Add owner signature
          </Button>
        </div>
      </div>
    </Modal>
  )
}
