'use client'

import { clsx } from 'clsx'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { CheckIcon, CopyIcon } from '@/components/ui/icons'
import { truncateAddress } from '@/lib/utils'

interface AddressDisplayProps {
  address: string
  truncate?: boolean
  className?: string
  showCopy?: boolean
}

export function AddressDisplay({
  address,
  truncate = true,
  className,
  showCopy = true,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false)

  const displayAddress = truncate ? truncateAddress(address) : address

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy address')
    }
  }

  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <span className="font-mono text-sm">{displayAddress}</span>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Copy address"
        >
          {copied ? (
            <CheckIcon className="h-4 w-4 text-green-500" />
          ) : (
            <CopyIcon className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  )
}
