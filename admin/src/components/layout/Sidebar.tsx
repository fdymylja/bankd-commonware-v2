'use client'

import { clsx } from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  ContractIcon,
  HomeIcon,
  IBCIcon,
  LendingIcon,
  NetworkIcon,
  SettingsIcon,
  SupervisorIcon,
  SwapIcon,
  TokenIcon,
  ValidatorIcon,
} from '@/components/ui/icons'

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

type NavSection = {
  title: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    title: '',
    items: [{ name: 'Home', href: '/', icon: HomeIcon }],
  },
  {
    title: 'Admin',
    items: [
      { name: 'Account', href: '/account', icon: HomeIcon },
      { name: 'Assets', href: '/assets', icon: TokenIcon },
      { name: 'Contracts', href: '/contracts', icon: ContractIcon },
      { name: 'Security', href: '/security', icon: ValidatorIcon },
      { name: 'Multisig', href: '/multisig', icon: SupervisorIcon },
      { name: 'Transfers', href: '/transfers', icon: IBCIcon },
      { name: 'Network', href: '/network', icon: NetworkIcon },
      { name: 'Supervisor', href: '/supervisor', icon: SupervisorIcon },
      { name: 'Configuration', href: '/configuration', icon: SettingsIcon },
    ],
  },
  {
    title: 'Demo',
    items: [
      { name: 'Compliance', href: '/demo/sanctions', icon: SupervisorIcon },
      { name: 'Orbis Legal Audit', href: '/demo/audit', icon: ValidatorIcon },
      { name: 'Lending', href: '/demo/lending', icon: LendingIcon },
      { name: 'AvP Swap', href: '/demo/avp-swap', icon: SwapIcon },
      { name: 'Fiat Ramp', href: '/demo/fiat-ramp', icon: TokenIcon },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
          <span className="text-sm font-bold">M</span>
        </div>
        <span className="text-lg font-semibold text-gray-900">Mizu</span>
      </div>

      <nav className="flex flex-col gap-4 p-4">
        {navigation.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {section.title}
            </h3>
            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      {
                        'bg-primary-50 text-primary-700': isActive,
                        'text-gray-700 hover:bg-gray-100': !isActive,
                      }
                    )}
                  >
                    <item.icon
                      className={clsx('h-5 w-5', {
                        'text-primary-600': isActive,
                        'text-gray-400': !isActive,
                      })}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
