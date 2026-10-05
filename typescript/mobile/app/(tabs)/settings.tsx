import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNetworkSettings, type NetworkSettings } from '@/lib/network'
import { saveNetworkSettings } from '@/lib/network-storage'
import * as Clipboard from 'expo-clipboard'
import { useQueryClient } from '@tanstack/react-query'
import {
  exportEphemeralAddressRegistry,
  parseEphemeralAddressRegistryExport,
} from '@bankd/shared/penumbra'

import { usePenumbra } from '@/hooks'
import { ephemeralAddressRegistryQueryKey } from '@/hooks/useEphemeralAddressRecords'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import {
  coreDisableBiometric,
  coreEnableBiometric,
  isBiometricAvailable,
  useNativeWallet,
} from '@/lib/native-wallet'
import {
  getAllEphemeralAddressRecords,
  saveEphemeralAddressRecords,
} from '@/lib/native-wallet/storage'
import { borderRadius, colors, fontSize, fontWeight, spacing } from '@/lib/theme'

// =============================================================================
// Types
// =============================================================================

type SettingsItem = {
  key: string
  label: string
  type: 'navigate' | 'toggle' | 'info' | 'action'
}

type SettingsSection = {
  title: string
  data: SettingsItem[]
}

// =============================================================================
// Component
// =============================================================================

export default function SettingsScreen() {
  const wallet = useNativeWallet()
  const penumbra = usePenumbra()
  const bridge = usePenumbraBridge()

  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const network = useNetworkSettings()
  const evmRpc = network.rpcUrl
  const proverRpc = network.proverUrl
  const [networkField, setNetworkField] = useState<keyof NetworkSettings | null>(null)
  const [endpointInput, setEndpointInput] = useState('')
  const [endpointError, setEndpointError] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const queryClient = useQueryClient()

  // Load persisted settings
  useEffect(() => {
    void (async () => {
      const available = await isBiometricAvailable()
      setBiometricAvailable(available)
      // hasPasskey is reused for biometric enabled state
      setBiometricEnabled(wallet.hasPasskey)
    })()
  }, [wallet.hasPasskey])

  // ---------------------------------------------------------------------------
  // Section definitions
  // ---------------------------------------------------------------------------

  const sections: SettingsSection[] = [
    {
      title: 'Wallet',
      data: [
        { key: 'label', label: 'Wallet Name', type: 'info' },
        { key: 'account', label: 'Account Index', type: 'info' },
      ],
    },
    {
      title: 'Security',
      data: [
        { key: 'biometric', label: 'Biometric Unlock', type: 'toggle' },
        { key: 'password', label: 'Change Password', type: 'navigate' },
        { key: 'export', label: 'Export Seed Phrase', type: 'navigate' },
      ],
    },
    {
      title: 'Network',
      data: [
        { key: 'evm_rpc', label: 'EVM RPC', type: 'navigate' },
        { key: 'prover_rpc', label: 'Shieldd Prover', type: 'navigate' },
      ],
    },
    {
      title: 'Address Registry',
      data: [
        { key: 'export_registry', label: 'Export Address Registry', type: 'action' },
        { key: 'import_registry', label: 'Import Address Registry', type: 'action' },
      ],
    },
    {
      title: 'About',
      data: [
        { key: 'version', label: 'App Version', type: 'info' },
        { key: 'chain_id', label: 'Chain ID', type: 'info' },
        { key: 'sync_status', label: 'Sync', type: 'info' },
        { key: 'clear_penumbra', label: 'Clear Cache & Resync', type: 'action' },
      ],
    },
    {
      title: 'Danger Zone',
      data: [
        { key: 'lock', label: 'Lock Wallet', type: 'action' },
        { key: 'delete', label: 'Delete Wallet', type: 'action' },
      ],
    },
  ]

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      try {
        if (value) {
          await coreEnableBiometric()
        } else {
          await coreDisableBiometric()
        }
        setBiometricEnabled(value)
      } catch (err) {
        Alert.alert(
          'Biometric Error',
          err instanceof Error ? err.message : 'Failed to update biometric setting'
        )
      }
    },
    []
  )

  const handleChangePassword = useCallback(() => {
    Alert.prompt(
      'Change Password',
      'Enter your current password:',
      (currentPwd) => {
        if (!currentPwd) return
        Alert.prompt(
          'New Password',
          'Enter your new password:',
          (newPwd) => {
            if (!newPwd) return
            // Password change not yet implemented in wallet core
            Alert.alert('Info', 'Password change is not yet supported.')
          },
          'secure-text'
        )
      },
      'secure-text'
    )
  }, [])

  const handleExportSeedPhrase = useCallback(() => {
    Alert.prompt(
      'Export Seed Phrase',
      'Enter your password to reveal seed phrase:',
      async (password) => {
        if (!password) return
        try {
          const mnemonic = await wallet.exportSeedPhrase(password)
          Alert.alert(
            'Seed Phrase',
            mnemonic,
            [{ text: 'Done', style: 'cancel' }],
            { cancelable: false }
          )
        } catch (err) {
          Alert.alert(
            'Error',
            err instanceof Error ? err.message : 'Failed to export seed phrase'
          )
        }
      },
      'secure-text'
    )
  }, [wallet])

  const handleEditEvmRpc = useCallback(() => {
    setNetworkField('rpcUrl'); setEndpointInput(evmRpc); setEndpointError('')
  }, [evmRpc])
  const handleEditProverRpc = useCallback(() => {
    setNetworkField('proverUrl'); setEndpointInput(proverRpc); setEndpointError('')
  }, [proverRpc])
  const handleSaveEndpoint = async () => {
    if (!networkField) return
    try {
      await saveNetworkSettings({ ...network, [networkField]: endpointInput })
      queryClient.removeQueries()
      setNetworkField(null)
    } catch (error) {
      setEndpointError(error instanceof Error ? error.message : 'Could not save endpoint')
    }
  }

  const handleExportRegistry = useCallback(async () => {
    try {
      const records = await getAllEphemeralAddressRecords()
      const payload = exportEphemeralAddressRegistry(records)
      await Clipboard.setStringAsync(JSON.stringify(payload, null, 2))
      Alert.alert('Exported', 'Address registry copied to clipboard')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to export registry')
    }
  }, [])

  const handleImportRegistry = useCallback(async () => {
    let json: unknown
    try {
      json = JSON.parse(importText)
    } catch {
      Alert.alert('Error', 'Invalid JSON. Please paste valid registry export data.')
      return
    }
    try {
      const parsed = parseEphemeralAddressRegistryExport(json)
      await saveEphemeralAddressRecords(parsed.records)
      queryClient.invalidateQueries({ queryKey: ephemeralAddressRegistryQueryKey })
      setShowImportModal(false)
      setImportText('')
      Alert.alert('Imported', 'Address registry imported successfully')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to import registry')
    }
  }, [importText, queryClient])

  const handleLockWallet = useCallback(() => {
    wallet.lock()
  }, [wallet])

  const handleClearPenumbra = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'This will delete all synced notes and block data, then resync from scratch. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & Resync',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true)
            try {
              await bridge.resetAndResync()
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to clear cache')
            } finally {
              setIsClearing(false)
            }
          },
        },
      ]
    )
  }, [bridge])

  const handleDeleteWallet = useCallback(() => {
    Alert.alert(
      'Delete Wallet',
      'Are you sure you want to delete your wallet? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete your wallet and all data. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Permanently',
                  style: 'destructive',
                  onPress: () => void wallet.reset(),
                },
              ]
            )
          },
        },
      ]
    )
  }, [wallet])

  const handleRowPress = useCallback(
    (key: string) => {
      switch (key) {
        case 'password':
          handleChangePassword()
          break
        case 'export':
          handleExportSeedPhrase()
          break
        case 'evm_rpc':
          handleEditEvmRpc()
          break
        case 'prover_rpc':
          handleEditProverRpc()
          break
        case 'export_registry':
          handleExportRegistry()
          break
        case 'import_registry':
          setShowImportModal(true)
          break
        case 'clear_penumbra':
          handleClearPenumbra()
          break
        case 'lock':
          handleLockWallet()
          break
        case 'delete':
          handleDeleteWallet()
          break
      }
    },
    [
      handleChangePassword,
      handleExportSeedPhrase,
      handleExportRegistry,
      handleEditEvmRpc,
      handleEditProverRpc,
      handleClearPenumbra,
      handleLockWallet,
      handleDeleteWallet,
    ]
  )

  // ---------------------------------------------------------------------------
  // Value display helpers
  // ---------------------------------------------------------------------------

  const getHintForItem = (key: string): string | null => {
    switch (key) {
      case 'label':
        return 'My Wallet'
      case 'account':
        return `#${wallet.currentAccount}`
      case 'evm_rpc':
        return evmRpc
      case 'prover_rpc':
        return proverRpc
      case 'version':
        return '1.0.0'
      case 'chain_id':
        return penumbra.chainId ?? '—'
      case 'sync_status':
        if (bridge.isSyncing && bridge.syncProgress) {
          return `${bridge.syncProgress.currentHeight}/${bridge.syncProgress.targetHeight} (${bridge.syncProgress.percent}%)`
        }
        if (bridge.isInitialized && !bridge.isSyncing) {
          return 'Synced'
        }
        return 'Not syncing'
      default:
        return null
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Modal visible={!!networkField} transparent animationType="slide" onRequestClose={() => setNetworkField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{networkField === 'rpcUrl' ? 'Commonware RPC' : 'Shieldd Prover'}</Text>
            <TextInput accessibilityLabel="Network endpoint" style={styles.modalTextInput} value={endpointInput} onChangeText={setEndpointInput} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            {!!endpointError && <Text style={{ color: colors.red[500] }}>{endpointError}</Text>}
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButtonCancel} onPress={() => setNetworkField(null)}><Text style={styles.modalButtonCancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.modalButtonImport} onPress={handleSaveEndpoint}><Text style={styles.modalButtonImportText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Registry Modal */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Import Address Registry</Text>
            <Text style={styles.modalDescription}>
              Paste the exported registry JSON below:
            </Text>
            <TextInput
              style={styles.modalTextInput}
              multiline
              placeholder='{"version": 1, "records": [...]}'
              placeholderTextColor={colors.gray[400]}
              value={importText}
              onChangeText={setImportText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonCancel}
                onPress={() => {
                  setShowImportModal(false)
                  setImportText('')
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButtonImport, !importText.trim() && styles.modalButtonDisabled]}
                onPress={handleImportRegistry}
                disabled={!importText.trim()}
              >
                <Text style={styles.modalButtonImportText}>Import</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, index, section }) => {
          const isDanger = section.title === 'Danger Zone'
          const isFirst = index === 0
          const isLast = index === section.data.length - 1
          const hint = getHintForItem(item.key)
          const isInteractive = item.type === 'navigate' || item.type === 'action'

          const rowContent = (
            <View
              style={[
                styles.row,
                isFirst && styles.rowFirst,
                isLast && styles.rowLast,
                isDanger && styles.dangerRow,
              ]}
            >
              <Text
                style={[
                  styles.rowLabel,
                  isDanger && styles.dangerLabel,
                ]}
              >
                {item.label}
              </Text>
              <View style={styles.rowRight}>
                {item.key === 'clear_penumbra' && isClearing ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                ) : item.type === 'toggle' && item.key === 'biometric' ? (
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    disabled={!biometricAvailable}
                    trackColor={{ false: colors.gray[200], true: colors.primary[400] }}
                    thumbColor={colors.white}
                  />
                ) : (
                  <>
                    {hint != null && <Text style={styles.rowHint}>{hint}</Text>}
                    {isInteractive && (
                      <Text style={styles.chevron}>›</Text>
                    )}
                  </>
                )}
              </View>
            </View>
          )

          if (isInteractive) {
            return (
              <Pressable onPress={() => handleRowPress(item.key)}>
                {rowContent}
              </Pressable>
            )
          }

          return rowContent
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  )
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  rowFirst: {
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
  },
  rowLast: {
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.gray[900],
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  rowHint: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },
  chevron: {
    fontSize: fontSize.lg,
    color: colors.gray[300],
    marginLeft: 4,
  },
  dangerRow: {
    backgroundColor: colors.red[50],
  },
  dangerLabel: {
    color: colors.red[600],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: fontSize.sm,
    color: colors.gray[600],
    marginBottom: spacing.md,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.xs,
    fontFamily: 'monospace' as const,
    height: 160,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
    color: colors.gray[900],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
  },
  modalButtonImport: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonImportText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.white,
  },
})
