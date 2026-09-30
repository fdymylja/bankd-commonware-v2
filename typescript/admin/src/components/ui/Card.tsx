import { clsx } from 'clsx'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode
  headerRight?: React.ReactNode
  noPadding?: boolean
  containerClassName?: string
}

export function Card({
  className,
  header,
  headerRight,
  noPadding = false,
  children,
  containerClassName,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col',
        className
      )}
      {...props}
    >
      {header && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-6 py-4">
          {typeof header === 'string' ? (
            <h3 className="text-lg font-medium text-gray-900">{header}</h3>
          ) : (
            header
          )}

          {headerRight}
        </div>
      )}
      <div className={clsx('grow', { 'p-6': !noPadding }, containerClassName)}>{children}</div>
    </div>
  )
}
