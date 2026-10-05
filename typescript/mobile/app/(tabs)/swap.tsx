import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Hex } from 'viem'
import { useQueryClient } from '@tanstack/react-query'

import { Button, Card, Input } from '@/components/ui'
import { OrderBook, OrderDetailSheet, PlaceOrderForm } from '@/components/swap'
import { useOrderCounter, useWallet } from '@/hooks'
import { executeTx } from '@/lib/evm/execute'
import { getEVMAccount } from '@/lib/native-wallet/evm-keys'
import { colors, fontSize, fontWeight, spacing, borderRadius } from '@/lib/theme'
import {
  ATOMIC_SWAP_ABI,
  ATOMIC_SWAP_BYTECODE,
  type AtomicSwapOrderWithId,
} from '@bankd/shared/evm/atomicSwap'

const STORAGE_KEY = 'bankd-atomicswap-address'

function isValidHexAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr.trim())
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SwapScreen() {
  const queryClient = useQueryClient()
  const { isConnected, hexAddress } = useWallet()

  // Contract config
  const [contractInput, setContractInput] = useState('')
  const [contractAddress, setContractAddress] = useState<Hex | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  // Order detail modal
  const [selectedOrder, setSelectedOrder] =
    useState<AtomicSwapOrderWithId | null>(null)

  // Verify contract exists
  const {
    data: orderCounter,
    isLoading: isVerifying,
    isError: isContractInvalid,
  } = useOrderCounter(contractAddress)

  const isContractVerified =
    contractAddress != null &&
    !isVerifying &&
    !isContractInvalid &&
    orderCounter !== undefined

  // Load saved contract address on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && isValidHexAddress(stored)) {
        setContractAddress(stored as Hex)
        setContractInput(stored)
      }
    })
  }, [])

  const handleSaveContract = useCallback(() => {
    const trimmed = contractInput.trim()
    if (!isValidHexAddress(trimmed)) {
      Alert.alert('Invalid Address', 'Please enter a valid contract address (0x…)')
      return
    }
    const addr = trimmed as Hex
    setContractAddress(addr)
    AsyncStorage.setItem(STORAGE_KEY, addr)
  }, [contractInput])

  const handleClearContract = useCallback(() => {
    setContractAddress(null)
    setContractInput('')
    AsyncStorage.removeItem(STORAGE_KEY)
  }, [])

  const handleDeploy = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Wallet Required', 'Please set up your wallet first.')
      return
    }

    setIsDeploying(true)
    try {
      const account = getEVMAccount()
      await executeTx(
        account,
        queryClient,
        [
          {
            abi: ATOMIC_SWAP_ABI,
            bytecode: ATOMIC_SWAP_BYTECODE as `0x${string}`,
            successMessage: 'AtomicSwap contract deployed!',
            onContractDeployed: (addr) => {
              setContractAddress(addr)
              setContractInput(addr)
              AsyncStorage.setItem(STORAGE_KEY, addr)
            },
          },
        ],
      )
    } catch (error) {
      Alert.alert('Deploy Failed', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsDeploying(false)
    }
  }, [isConnected, queryClient])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Swap</Text>
          <Text style={styles.subtitle}>
            AvP atomic swaps with instant finality
          </Text>
        </View>

        {/* Contract address config */}
        <View style={styles.section}>
          <Card title="Contract">
            <View style={styles.contractRow}>
              <Input
                placeholder="0x… swap contract address"
                value={contractInput}
                onChangeText={setContractInput}
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={styles.contractInput}
              />
              <Button
                title="Save"
                size="sm"
                variant={contractAddress ? 'secondary' : 'primary'}
                onPress={handleSaveContract}
              />
            </View>

            {/* Deploy button */}
            <View style={styles.deployRow}>
              <Button
                title="Deploy New"
                size="sm"
                variant="secondary"
                onPress={handleDeploy}
                loading={isDeploying}
                disabled={!isConnected}
              />
              {contractAddress && (
                <Button
                  title="Clear"
                  size="sm"
                  variant="ghost"
                  onPress={handleClearContract}
                />
              )}
            </View>

            {/* Status messages */}
            {contractAddress && isVerifying && (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.gray[400]} />
                <Text style={styles.statusText}>Verifying contract…</Text>
              </View>
            )}
            {contractAddress && isContractInvalid && (
              <Text style={styles.contractError}>
                No AtomicSwap contract found at this address
              </Text>
            )}
            {isContractVerified && (
              <Text style={styles.contractHint}>
                ✓ Connected: {contractAddress.slice(0, 8)}…
                {contractAddress.slice(-6)}
              </Text>
            )}
            {!isConnected && (
              <Text style={styles.warningText}>
                Set up your wallet to deploy a new contract
              </Text>
            )}
          </Card>
        </View>

        {/* Place order — only shown when contract is verified */}
        {isContractVerified && (
          <View style={styles.section}>
            <PlaceOrderForm contractAddress={contractAddress} />
          </View>
        )}

        {/* Order book — only shown when contract is verified */}
        {isContractVerified && (
          <View style={styles.section}>
            <OrderBook
              contractAddress={contractAddress}
              onOrderPress={setSelectedOrder}
            />
          </View>
        )}

        {/* Empty state when no contract or not verified */}
        {contractAddress && !isContractVerified && !isVerifying && (
          <View style={styles.section}>
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Enter a valid AtomicSwap contract address to get started.
                </Text>
              </View>
            </Card>
          </View>
        )}

        {!contractAddress && (
          <View style={styles.section}>
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Enter the AtomicSwap contract address above or deploy a new one.
                </Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Order detail modal */}
      <Modal
        visible={selectedOrder !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedOrder(null)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={() => {
              // prevent closing when pressing the sheet content
            }}
          >
            {selectedOrder && contractAddress && (
              <OrderDetailSheet
                order={selectedOrder}
                contractAddress={contractAddress}
                onClose={() => setSelectedOrder(null)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.gray[500],
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  contractRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  contractInput: {
    flex: 1,
  },
  deployRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  contractHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.green[600],
    fontWeight: fontWeight.medium,
  },
  contractError: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.red[600],
    fontWeight: fontWeight.medium,
  },
  warningText: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.yellow[600],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'flex-end',
  },
  modalContent: {
    // sheet rises from bottom
  },
})
