/**
 * PenumbraWebView — Hidden WebView that runs the Penumbra WASM bridge.
 *
 * Loads the bundled penumbra-bridge.html (with WASM inlined) and communicates
 * via postMessage / onMessage using the typed bridge protocol.
 */

import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Platform, StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

import type { BridgeCommand, BridgeEvent } from './bridge-protocol'

// =============================================================================
// Types
// =============================================================================

export interface PenumbraWebViewHandle {
  sendCommand(command: BridgeCommand): void
  reload(): void
}

export interface PenumbraWebViewProps {
  onEvent: (event: BridgeEvent) => void
  onError?: (error: string) => void
}

// =============================================================================
// Component
// =============================================================================

export const PenumbraWebView = forwardRef<
  PenumbraWebViewHandle,
  PenumbraWebViewProps
>(function PenumbraWebView({ onEvent, onError }, ref) {
  const webViewRef = useRef<WebView>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)

  // Load the HTML asset as a string so we can use source={{ html, baseUrl }}
  // This avoids file:// origin which blocks fetch() in WKWebView
  useEffect(() => {
    async function loadHtml() {
      try {
        const asset = Asset.fromModule(require('../../assets/penumbra-bridge.html'))
        await asset.downloadAsync()
        if (asset.localUri) {
          // Fetch the local file URI as text
          const html = await new File(asset.localUri).text()
          console.log('[PenumbraWebView] Loaded bridge HTML:', html.length, 'chars')
          setHtmlContent(html)
        }
      } catch (e: any) {
        console.error('[PenumbraWebView] Failed to load bridge HTML:', e)
        onError?.('Failed to load bridge HTML: ' + e.message)
      }
    }
    loadHtml()
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      sendCommand(command: BridgeCommand) {
        if (!webViewRef.current) {
          console.warn('[PenumbraWebView] Cannot send command — WebView not ready')
          return
        }
        const json = JSON.stringify(command)
        const script = `
          (function() {
            try {
              window.postMessage(${JSON.stringify(json)}, '*');
            } catch (e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: 'Failed to deliver command: ' + e.message
              }));
            }
          })();
          true;
        `
        webViewRef.current.injectJavaScript(script)
      },
      reload() {
        webViewRef.current?.reload()
      },
    }),
    []
  )

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as BridgeEvent
        onEvent(data)
      } catch (err) {
        console.error('[PenumbraWebView] Failed to parse message:', event.nativeEvent.data, err)
      }
    },
    [onEvent]
  )

  const handleError = useCallback(
    (syntheticEvent: { nativeEvent: { description: string } }) => {
      const { description } = syntheticEvent.nativeEvent
      console.error('[PenumbraWebView] Load error:', description)
      onError?.(description)
    },
    [onError]
  )

  if (!htmlContent) return null

  // Inject console forwarding so WebView logs appear in Metro
  // Uses type 'webviewLog' so the bridge protocol doesn't treat these as errors
  const injectedJS = `
    (function() {
      var origLog = console.log;
      var origWarn = console.warn;
      var origError = console.error;
      function forward(level, args) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'webviewLog',
            level: level,
            message: '[WebView ' + level + '] ' + Array.from(args).map(String).join(' ')
          }));
        } catch(e) {}
      }
      console.log = function() { forward('log', arguments); origLog.apply(console, arguments); };
      console.warn = function() { forward('warn', arguments); origWarn.apply(console, arguments); };
      console.error = function() { forward('error', arguments); origError.apply(console, arguments); };
      window.onerror = function(msg, url, line) {
        forward('onerror', [msg, 'at', url + ':' + line]);
      };
      window.addEventListener('unhandledrejection', function(e) {
        forward('rejection', [e.reason]);
      });
      true;
    })();
  `

  return (
    <WebView
      ref={webViewRef}
      source={{
        html: htmlContent,
        baseUrl: 'http://localhost',
      }}
      injectedJavaScriptBeforeContentLoaded={injectedJS}
      style={styles.hidden}
      onMessage={handleMessage}
      onError={handleError}
      originWhitelist={['*']}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowFileAccess={Platform.OS === 'android'}
      scrollEnabled={false}
      bounces={false}
      startInLoadingState={false}
      mixedContentMode="always"
      mediaPlaybackRequiresUserAction={true}
      allowUniversalAccessFromFileURLs={Platform.OS === 'android'}
    />
  )
})

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    top: -1000,
    left: -1000,
  },
})
