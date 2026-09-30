import { authorizeContractsRequest } from '@/lib/auth/contractsAccess'
import { listDeployedContracts } from '@/lib/contracts/deployed'

import { createContractsGET } from './handlers'
export const dynamic = 'force-dynamic'
export const GET = createContractsGET({ authorize: authorizeContractsRequest, list: listDeployedContracts })
