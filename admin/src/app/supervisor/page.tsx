import { PageContainer } from '@/components/layout'
import { SystemOverview } from '@/components/supervisor/SystemOverview'

export default function SupervisorPage() {
  return (
    <PageContainer
      title="Supervisor"
      description="Live, verifiable network metrics indexed by Shinzo."
    >
      <SystemOverview />
    </PageContainer>
  )
}
