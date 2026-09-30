import type { NextRequest } from 'next/server'

import { authorizeSupervisorRequest } from '@/lib/supervisor/access'
import { systemOverviewResponse } from '@/lib/supervisor/system-overview'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const decision = await authorizeSupervisorRequest(request, 'federal', 'all')
  if (!decision.granted) return decision.response
  return systemOverviewResponse(decision.access)
}
