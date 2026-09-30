'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button, Input, Modal } from '@/components/ui'
import { useMultisig } from '@/lib/multisig'

export function CreateMultisigModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { addSafe } = useMultisig()
  const [label, setLabel] = useState('')
  const [safeAddress, setSafeAddress] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Safe multisig">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          void addSafe({ label, safeAddress })
            .then(() => {
              toast.success('Safe added')
              onClose()
            })
            .catch((error) => toast.error(error.message))
            .finally(() => setBusy(false))
        }}
      >
        <p className="text-sm text-gray-500">
          Connect a Safe deployed on this chain. Owners can sign and execute
          proposals from the admin.
        </p>
        <Input
          label="Label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
        <Input
          label="Safe address"
          value={safeAddress}
          onChange={(event) => setSafeAddress(event.target.value)}
          required
          pattern="0x[0-9a-fA-F]{40}"
        />
        <Button type="submit" isLoading={busy}>
          Add Safe
        </Button>
      </form>
    </Modal>
  )
}
