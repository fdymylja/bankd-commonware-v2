import { clsx } from 'clsx'

export interface ButtonSelectOption {
  value: string
  label: string
  detail?: string
  badge?: string
  tooltip?: string
  variant?: 'primary' | 'purple'
}

export interface ButtonSelectProps {
  label?: string
  options: ButtonSelectOption[]
  value: string | null
  onChange: (value: string) => void
  emptyMessage?: string
  fullWidth?: boolean
}

export function ButtonSelect({
  label,
  options,
  value,
  onChange,
  emptyMessage,
  fullWidth,
}: ButtonSelectProps) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      {options.length === 0 ? (
        emptyMessage && (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        )
      ) : (
        <div className={clsx('flex gap-2', fullWidth ? '[&>*]:flex-1' : 'flex-wrap')}>
          {options.map((option) => {
            const isSelected = value === option.value
            const variant = option.variant ?? 'primary'
            return (
              <button
                key={option.value}
                type="button"
                title={option.tooltip}
                onClick={() => onChange(option.value)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                  isSelected
                    ? variant === 'purple'
                      ? 'border-purple-500 bg-purple-50 text-purple-900'
                      : 'border-primary-500 bg-primary-50 text-primary-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <span className="font-medium">{option.label}</span>
                {option.detail && (
                  <span className="text-xs text-gray-500">{option.detail}</span>
                )}
                {option.badge && (
                  <span
                    className={clsx(
                      'rounded px-1.5 py-0.5 text-xs font-medium',
                      variant === 'purple'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-primary-100 text-primary-700'
                    )}
                  >
                    {option.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
