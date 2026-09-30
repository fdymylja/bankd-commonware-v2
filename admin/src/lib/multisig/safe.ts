// src/lib/multisig/safe.ts
/**
 * MsgDeploySafe encoding for the multisig flow. Deploying a Safe is a tx signed
 * by the multisig itself (sender == the multisig address), so it rides the same
 * threshold sign/broadcast path as a MsgSend - only the message body differs.
 *
 * The message carries just the sender. The chain reads the multisig members +
 * threshold off the sender account's recorded pubkey (the state the sig ante
 * leaves once the multisig has signed), so there's nothing else to put on it.
 *
 * Both the proto body and the amino sign-doc msg are hand-built (no telescope
 * bindings for x/safe yet), matching the rest of this package:
 *
 *   {"type":"safe/MsgDeploySafe","value":{"sender":"wallet1..."}}
 */

import type { AminoMsg } from '@cosmjs/amino'
import { BinaryWriter } from 'cosmjs-types/binary'

/** proto msg typeUrl (matches x/safe/types). */
export const MSG_DEPLOY_SAFE_TYPE = '/mizufinance.safe.v1.MsgDeploySafe'
/** amino concrete name registered on-chain (x/safe/types/codec.go). */
export const AMINO_DEPLOY_SAFE_TYPE = 'safe/MsgDeploySafe'

/** Proto-encode a `MsgDeploySafe`: field 1 = sender (string). */
export function encodeMsgDeploySafe(sender: string): Uint8Array {
  return new BinaryWriter().uint32(10).string(sender).finish()
}

/** The amino msg every member signs. */
export function aminoDeploySafe(sender: string): AminoMsg {
  return {
    type: AMINO_DEPLOY_SAFE_TYPE,
    value: { sender },
  }
}
