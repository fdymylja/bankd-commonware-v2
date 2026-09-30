import { ActiveWalletBanner } from '@/components/multisig'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface PageContainerProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function PageContainer({
  title,
  description,
  children,
}: PageContainerProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <ActiveWalletBanner />
        <Header title={title} description={description} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
