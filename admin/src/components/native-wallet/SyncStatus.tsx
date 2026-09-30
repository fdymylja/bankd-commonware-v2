'use client'

import { clsx } from 'clsx'

import { Spinner } from '@/components/ui/Spinner'
import type { SyncProgress } from '@/lib/native-wallet'

interface SyncStatusProps {
  isSyncing: boolean
  progress: SyncProgress | null
  className?: string
}

export function SyncStatus({
  isSyncing,
  progress,
  className,
}: SyncStatusProps) {
  if (!isSyncing && !progress) {
    return null
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm',
        className
      )}
    >
      {isSyncing && <Spinner className="h-4 w-4" />}

      <div className="flex flex-col">
        <span className="font-medium text-gray-700">
          {isSyncing ? 'Syncing...' : 'Synced'}
        </span>

        {progress && (
          <span className="text-xs text-gray-500">
            Block {progress.current.toString()} / {progress.target.toString()}
            <span className="ml-1">({progress.percentage.toFixed(1)}%)</span>
          </span>
        )}
      </div>
    </div>
  )
}

interface SyncStatusBadgeProps {
  isSyncing: boolean
  progress: SyncProgress | null
}

/**
 * Compact sync status badge for headers/toolbars.
 */
export function SyncStatusBadge({ isSyncing, progress }: SyncStatusBadgeProps) {
  if (!isSyncing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Synced
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      <Spinner className="h-3 w-3" />
      {progress ? `${progress.percentage.toFixed(0)}%` : 'Syncing'}
    </span>
  )
}

interface SyncProgressBarProps {
  progress: SyncProgress | null
  className?: string
}

/**
 * Full-width sync progress bar.
 */
export function SyncProgressBar({ progress, className }: SyncProgressBarProps) {
  if (!progress) {
    return null
  }

  return (
    <div className={clsx('w-full', className)}>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>Syncing blocks...</span>
        <span>{progress.percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>Block {progress.current.toString()}</span>
        <span>Target: {progress.target.toString()}</span>
      </div>
    </div>
  )
}
