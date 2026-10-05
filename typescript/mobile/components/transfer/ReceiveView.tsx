import * as Clipboard from 'expo-clipboard'
import QRCode from 'qrcode'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { WebView } from 'react-native-webview'

import { useWallet } from '@/hooks/useWallet'
import { Card } from '@/components/ui'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from '@/lib/theme'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReceiveView() {
  const { hexAddress } = useWallet()
  const [publicCopied, setPublicCopied] = useState(false)
  const { penumbraAddress, generateEphemeralAddressRecord } = usePenumbraBridge()
  const [copied, setCopied] = useState(false)
  const [depositAddress, setDepositAddress] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [depositCopied, setDepositCopied] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)
  const [qrSvg, setQrSvg] = useState<string | null>(null)

  const walletAddress = penumbraAddress ?? '—'

  const handleCopyWalletAddress = async () => {
    if (!walletAddress || walletAddress === '—') return
    await Clipboard.setStringAsync(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGenerateDepositAddress = useCallback(async () => {
    if (!penumbraAddress) return
    setIsGenerating(true)
    setDepositError(null)
    try {
      // Manual receive addresses are tracked in the registry for ownership and
      // UX recovery, but intentionally omit channel/intermediate metadata: the
      // sender may use this address for a local private send or any IBC channel.
      const record = await generateEphemeralAddressRecord({
        purpose: 'generated-deposit',
        label: 'Generated receive address',
      })
      setDepositAddress(record.penumbraAddress)
    } catch (err: any) {
      console.warn('[ReceiveView] Failed to generate deposit address:', err)
      setDepositError(err?.message || 'Failed to generate deposit address')
    } finally {
      setIsGenerating(false)
    }
  }, [penumbraAddress, generateEphemeralAddressRecord])

  const handleCopyDeposit = async () => {
    if (!depositAddress) return
    await Clipboard.setStringAsync(depositAddress)
    setDepositCopied(true)
    setTimeout(() => setDepositCopied(false), 2000)
  }

  useEffect(() => {
    let cancelled = false

    async function generateQrCode() {
      if (!depositAddress) {
        setQrSvg(null)
        return
      }

      try {
        const svg = await QRCode.toString(depositAddress, {
          type: 'svg',
          margin: 1,
          width: 220,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) setQrSvg(svg)
      } catch (err) {
        console.warn('[ReceiveView] Failed to generate QR code:', err)
        if (!cancelled) setQrSvg(null)
      }
    }

    generateQrCode()

    return () => {
      cancelled = true
    }
  }, [depositAddress])

  const qrHtml = useMemo(() => {
    if (!qrSvg) return null
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>html,body{margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100%;height:100%;overflow:hidden;}svg{width:100%;height:100%;}</style></head><body>${qrSvg}</body></html>`
  }, [qrSvg])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card title="Public receive address" style={{ marginBottom: spacing.lg }}>
        <Text selectable style={{ fontSize: fontSize.xs, marginBottom: spacing.md }}>{hexAddress ?? '—'}</Text>
        <Pressable onPress={async () => {
          if (!hexAddress) return
          await Clipboard.setStringAsync(hexAddress)
          setPublicCopied(true)
          setTimeout(() => setPublicCopied(false), 2000)
        }}><Text style={{ color: colors.primary[600] }}>{publicCopied ? 'Copied' : 'Copy Public Address'}</Text></Pressable>
      </Card>
      <Card title="Receive Deposit" style={styles.primaryCard}>
        <Text style={styles.primaryHint}>
          Generate a fresh deposit address every time you receive funds. Share
          different addresses with different people to avoid linking payments.
        </Text>

        {depositAddress ? (
          <>
            <View style={styles.qrCard}>
              {qrHtml ? Platform.OS === 'web' ? (
                <iframe title="Receive QR code" srcDoc={qrHtml} style={{ width: 220, height: 220, border: 0 }} />
              ) : (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: qrHtml }}
                  style={styles.qrWebView}
                  scrollEnabled={false}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <ActivityIndicator size="small" color={colors.primary[600]} />
              )}
            </View>

            <View style={styles.depositAddressBox}>
              <Text style={styles.depositLabel}>Deposit address</Text>
              <Text style={styles.depositAddressText} selectable numberOfLines={4}>
                {depositAddress}
              </Text>
            </View>

            <View style={styles.depositActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={handleCopyDeposit}
              >
                <Text style={styles.primaryButtonText}>
                  {depositCopied ? '✓ Copied' : 'Copy Address'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                  isGenerating && styles.buttonDisabled,
                ]}
                onPress={handleGenerateDepositAddress}
                disabled={isGenerating}
              >
                <Text style={styles.secondaryButtonText}>
                  {isGenerating ? 'Generating…' : 'Generate New'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.emptyQrCard}>
              <Text style={styles.emptyQrIcon}>▦</Text>
              <Text style={styles.emptyQrText}>
                Your QR code will appear after generating a deposit address.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.largeGenerateButton,
                pressed && styles.primaryButtonPressed,
                (isGenerating || !penumbraAddress) && styles.buttonDisabled,
              ]}
              onPress={handleGenerateDepositAddress}
              disabled={isGenerating || !penumbraAddress}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.largeGenerateButtonText}>
                  Generate Deposit Address
                </Text>
              )}
            </Pressable>
            {depositError && <Text style={styles.errorText}>{depositError}</Text>}
          </>
        )}
      </Card>

      <Card title="Your Wallet Address" style={styles.walletCard}>
        <Text style={styles.walletHint}>
          Use this stable address only when you specifically need your main
          private Penumbra wallet address. For most receives, generate a fresh
          deposit address above.
        </Text>
        <View style={styles.walletAddressRow}>
          <Text style={styles.walletAddressText} selectable numberOfLines={2}>
            {walletAddress}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.copyButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={handleCopyWalletAddress}
          >
            <Text style={styles.copyButtonText}>{copied ? '✓' : 'Copy'}</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  primaryCard: {
    marginBottom: 0,
  },
  walletCard: {
    marginBottom: 0,
    opacity: 0.9,
  },
  primaryHint: {
    fontSize: fontSize.sm,
    color: colors.gray[600],
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  walletHint: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  qrCard: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  qrWebView: {
    width: 220,
    height: 220,
    backgroundColor: 'transparent',
  },
  emptyQrCard: {
    alignSelf: 'center',
    width: 240,
    minHeight: 180,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
    backgroundColor: colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptyQrIcon: {
    fontSize: 42,
    color: colors.gray[300],
    marginBottom: spacing.sm,
  },
  emptyQrText: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  depositAddressBox: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  depositLabel: {
    fontSize: fontSize.xs,
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  depositAddressText: {
    fontSize: fontSize.xxs,
    color: colors.gray[800],
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  depositActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  secondaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  largeGenerateButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  largeGenerateButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  walletAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walletAddressText: {
    flex: 1,
    fontSize: fontSize.xxs,
    color: colors.gray[600],
    fontFamily: 'monospace',
  },
  copyButton: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  copyButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.gray[700],
  },
  errorText: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.red?.[600] ?? '#dc2626',
    textAlign: 'center' as const,
  },
})
