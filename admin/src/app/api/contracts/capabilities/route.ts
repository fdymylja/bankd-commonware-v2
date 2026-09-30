import { authorizeContractsRequest } from '@/lib/auth/contractsAccess'
import { chainDefinition } from '@/lib/config'

import { createCapabilitiesGET } from '../handlers'
export const dynamic = 'force-dynamic'
export const GET = createCapabilitiesGET({ authorize: authorizeContractsRequest, chainId: chainDefinition.id })
