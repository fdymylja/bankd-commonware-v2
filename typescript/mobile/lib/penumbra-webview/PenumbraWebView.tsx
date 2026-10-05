import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Asset } from 'expo-asset'
import type {
  BridgeCommand,
  BridgeEvent,
} from './bridge-protocol'

export interface PenumbraWebViewHandle {
  sendCommand(command: BridgeCommand): void
  reload(): void
}
export interface PenumbraWebViewProps {
  onEvent: (event: BridgeEvent) => void
  onError?: (error: string) => void
}

/** Browser transport for the exact same bundled WASM used by the native WebView.
 */
export const PenumbraWebView = forwardRef<
  PenumbraWebViewHandle,
  PenumbraWebViewProps
>(function BrowserShielddBridge({ onEvent, onError }, ref) {
  const frame = useRef<HTMLIFrameElement>(null)
  const callbacks = useRef({ onEvent, onError })
  callbacks.current = { onEvent, onError }
  const [html, setHtml] = useState('')
  const [generation, setGeneration] = useState(0)

  useImperativeHandle(
    ref,
    () => ({
      sendCommand(command) {
        frame.current?.contentWindow?.postMessage(
          JSON.stringify(command),
          window.location.origin,
        )
      },
      reload() {
        setGeneration((value) => value + 1)
      },
    }),
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    function receive(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== window.location.origin ||
        event.data?.channel !== 'bankd-wallet-shieldd'
      )
        return
      try {
        callbacks.current.onEvent(JSON.parse(event.data.message))
      } catch (error) {
        callbacks.current.onError?.(
          error instanceof Error ? error.message : 'Invalid bridge event',
        )
      }
    }
    window.addEventListener('message', receive)
    const asset = Asset.fromModule(
      require('../../assets/penumbra-bridge.html'),
    )
    fetch(asset.uri, { signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error('Could not load bundled Shieldd bridge')
        return response.text()
      })
      .then((source) => {
        const bootstrap = `<script>window.ReactNativeWebView={postMessage:function(message){window.parent.postMessage({channel:"bankd-wallet-shieldd",message:message},${JSON.stringify(window.location.origin)})}};</script>`
        setHtml(source.replace('<head>', `<head>${bootstrap}`))
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          callbacks.current.onError?.(String(error))
      })
    return () => {
      controller.abort()
      window.removeEventListener('message', receive)
    }
  }, [])

  if (!html) return null
  return (
    <iframe
      key={generation}
      ref={frame}
      srcDoc={html}
      title="Shieldd wallet engine"
      sandbox="allow-scripts allow-same-origin"
      aria-hidden
      tabIndex={-1}
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        border: 0,
        pointerEvents: 'none',
      }}
      onError={() =>
        callbacks.current.onError?.('Shieldd browser bridge failed to load')
      }
    />
  )
})
