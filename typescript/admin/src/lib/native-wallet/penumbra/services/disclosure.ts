import { committedDisclosureTransaction, disclosureRequest, type DisclosureSelection } from '@bankd/shared/shieldd/disclosure'
import { penumbraConfig } from '@/lib/config'
import { getFullViewingKey } from '../../core'

export async function prepareDisclosureExport(selection: DisclosureSelection, method: 'openings' | 'payload-keys') {
  const request = disclosureRequest(penumbraConfig.chainId, selection, method)
  const fvk = getFullViewingKey()
  const sdk = await import('@mizufinance/wasm/disclosure')
  const transaction = await committedDisclosureTransaction(penumbraConfig.grpcUrl, penumbraConfig.chainId, selection)
  const witness = await sdk.prepareDisclosure(request, [transaction], fvk)
  const packageJson = await sdk.exportDisclosure(witness, method)
  const verification = await sdk.confirmDisclosureAcceptance(packageJson, penumbraConfig.chainId, [{ height: selection.height, transactions: [transaction] }])
  return { packageJson, preview: await sdk.inspectDisclosure(packageJson), verification }
}
