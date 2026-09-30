'use client'

import clsx from 'clsx'

interface PermissionBadgeProps {
  hasPermission: boolean
  isLoading?: boolean
  permittedLabel?: string
  deniedLabel?: string
  className?: string
}

export function PermissionBadge({
  hasPermission,
  isLoading = false,
  permittedLabel = 'Permitted',
  deniedLabel = 'Not Permitted',
  className,
}: PermissionBadgeProps) {
  if (isLoading) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          'bg-gray-100 text-gray-600',
          className
        )}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
        Checking...
      </span>
    )
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        hasPermission
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700',
        className
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          hasPermission ? 'bg-green-500' : 'bg-red-500'
        )}
      />
      {hasPermission ? permittedLabel : deniedLabel}
    </span>
  )
}

interface PermissionAlertProps {
  hasPermission: boolean
  isLoading?: boolean
  permittedMessage?: string
  deniedMessage: string
  className?: string
}

export function PermissionAlert({
  hasPermission,
  isLoading = false,
  permittedMessage,
  deniedMessage,
  className,
}: PermissionAlertProps) {
  if (isLoading) {
    return (
      <div
        className={clsx(
          'rounded-lg border px-4 py-3 text-sm',
          'border-gray-200 bg-gray-50 text-gray-600',
          className
        )}
      >
        Checking permissions...
      </div>
    )
  }

  if (hasPermission && !permittedMessage) {
    return null
  }

  return (
    <div
      className={clsx(
        'rounded-lg border px-4 py-3 text-sm',
        hasPermission
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        className
      )}
    >
      {hasPermission ? permittedMessage : deniedMessage}
    </div>
  )
}
