import React, { useCallback, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'

import { Button } from '@/components/ui'
import { parseScannedPenumbraAddress } from '@/lib/penumbra-address'
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from '@/lib/theme'

interface QRCodeScannerModalProps {
  visible: boolean
  onClose: () => void
  onAddressScanned: (address: string) => void
}

export function QRCodeScannerModal({
  visible,
  onClose,
  onAddressScanned,
}: QRCodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (isProcessing) return
      setIsProcessing(true)

      const address = parseScannedPenumbraAddress(data)
      if (!address) {
        setError('QR code does not contain a valid Penumbra address.')
        setTimeout(() => setIsProcessing(false), 1200)
        return
      }

      setError(null)
      onAddressScanned(address)
      onClose()
      setTimeout(() => setIsProcessing(false), 500)
    },
    [isProcessing, onAddressScanned, onClose]
  )

  const handleClose = useCallback(() => {
    setError(null)
    setIsProcessing(false)
    onClose()
  }, [onClose])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Deposit Address</Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.centerContent}>
            <Text style={styles.message}>Checking camera permission…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerContent}>
            <Ionicons name="camera-outline" size={48} color={colors.primary[400]} />
            <Text style={styles.message}>Camera access is needed to scan QR codes.</Text>
            <Button title="Allow Camera Access" onPress={requestPermission} />
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
            />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.scanFrame} />
            </View>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructions}>Point your camera at a Penumbra deposit address QR code.</Text>
              {error && <Text style={styles.error}>{error}</Text>}
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.black,
  },
  title: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[800],
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  message: {
    color: colors.white,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: colors.primary[400],
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
  },
  instructionsCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(0,0,0,0.75)',
    gap: spacing.sm,
  },
  instructions: {
    color: colors.white,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  error: {
    color: colors.red[500],
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
})
