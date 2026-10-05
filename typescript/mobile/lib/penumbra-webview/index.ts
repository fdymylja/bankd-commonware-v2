/**
 * Penumbra WebView Bridge — barrel export.
 *
 * Provides the hidden WebView component and hook for managing
 * Penumbra WASM operations (sync, balances, transactions) via
 * a postMessage bridge.
 */

export { PenumbraWebView } from './PenumbraWebView'
export type {
  PenumbraWebViewHandle,
  PenumbraWebViewProps,
} from './PenumbraWebView'

export { usePenumbraWebView } from './usePenumbraWebView'
export type {
  PenumbraWebViewState,
  SyncProgress,
} from './usePenumbraWebView'

export type {
  BridgeCommand,
  BridgeEvent,
  PenumbraBridgeBalance,
} from './bridge-protocol'
export { generateRequestId } from './bridge-protocol'
