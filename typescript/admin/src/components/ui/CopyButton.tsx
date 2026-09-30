'use client'

import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export interface CopyButtonProps {
  value: string
  className?: string
  successMessage?: string
}

export function CopyButton({
  value,
  className,
  successMessage = 'Copied!',
}: CopyButtonProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    toast.success(successMessage)
  }

  return (
    <button
      onClick={handleCopy}
      className={clsx('text-blue-400 hover:text-blue-600 p-0.5 cursor-pointer', className)}
      title="Copy"
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3.5 h-3.5"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
    </button>
  )
}
