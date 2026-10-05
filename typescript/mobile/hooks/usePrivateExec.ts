/** Unavailable private swap/lending actions; host execution integration is tracked in bankd#339. */

import { useCallback, useState } from 'react'

import type { ExternalAddressPurpose, EphemeralAddressRecord } from '@bankd/shared/penumbra/ephemeral-address-registry'

export type PrivateExecStatus =
  | 'idle'
  | 'planning' // tx planning
  | 'authorizing' // authorizing spend
  | 'building' // ZK proof
  | 'broadcasting' // submitting to Penumbra
  | 'confirming' // waiting for block inclusion
  | 'syncing' // wallet sync after confirm
  | 'relaying' // waiting for IBC relay
  | 'confirmed'
  | 'error'

export interface PrivateExecState {
  status: PrivateExecStatus
  message: string
  error?: string
}

export interface PrivateExecParams {
  /** Amount in base units (e.g. "1000000" for 1 token with 6 decimals) */
  amount: string
  /** IBC denom path, e.g. "transfer/channel-0/erc20:0x..." */
  denom: string
  /** EEM memo (from shared memo helpers) */
  memo: string
  /** Source channel on Penumbra side (default: "channel-0") */
  sourceChannel?: string
  /** Destination channel on Bankd side — used for EEM intermediate address derivation and relay tracking */
  destinationChannel?: string
  /** Address index for Penumbra note selection */
  addressIndex?: number
  /** Purpose tag for the ephemeral address record */
  purpose: ExternalAddressPurpose
  /** Related entity kind (e.g. 'atomic-swap-order', 'simple-lending-loan') */
  relatedKind?: EphemeralAddressRecord['relatedKind']
  /** Related entity identifier */
  relatedId?: string
  /**
   * Existing ephemeral record to reuse for actions that must be sent from the
   * same EEM intermediate address as an earlier action, such as cancelling an
   * order where the contract requires `msg.sender == order.seller`.
   */
  ephemeralRecord?: EphemeralAddressRecord
}

export function usePrivateExec() {
  const [state, setState] = useState<PrivateExecState>({
    status: 'idle',
    message: '',
  })

  const execute = useCallback(
    async (_params: PrivateExecParams): Promise<boolean> => {
      const message = 'Private swap and lending are unavailable until host withdrawal integration is complete.'
      setState({ status: 'error', message, error: message })
      return false
    },
    [],
  )

  const reset = useCallback(() => {
    setState({ status: 'idle', message: '' })
  }, [])

  return { state, execute, reset }
}
