import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQueryClient } from '@tanstack/react-query'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Hex } from 'viem'

import {
  SIMPLE_LENDING_ABI,
  SIMPLE_LENDING_BYTECODE,
  type SimpleLendingLoanWithId,
} from '@bankd/shared/evm/simpleLending'
import {
  CreateLoanForm,
  LoanDetailSheet,
  LoansList,
} from '@/components/lending'
import { Button, Card, Input } from '@/components/ui'
import { useNextLoanId } from '@/hooks'
import { executeTx } from '@/lib/evm/execute'
import { getEVMAccount } from '@/lib/native-wallet/evm-keys'
import { colors, fontSize, fontWeight, spacing } from '@/lib/theme'

const STORAGE_KEY = 'bankd-simplelending-address'

export default function LendingScreen() {
  const queryClient = useQueryClient()
  const [contractInput, setContractInput] = useState('')
  const [contractAddress, setContractAddress] = useState<Hex | null>(null)
  const [selectedLoan, setSelectedLoan] =
    useState<SimpleLendingLoanWithId | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  // Verify contract exists by trying to read nextLoanId
  const {
    data: nextLoanId,
    isLoading: isVerifying,
    isError: isContractInvalid,
  } = useNextLoanId(contractAddress)

  const isContractVerified =
    contractAddress !== null &&
    !isVerifying &&
    !isContractInvalid &&
    nextLoanId !== undefined

  // Load saved address from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && stored.startsWith('0x') && stored.length === 42) {
        setContractAddress(stored as Hex)
        setContractInput(stored)
      }
    })
  }, [])

  const handleSaveContract = useCallback(async () => {
    const trimmed = contractInput.trim()
    if (trimmed.startsWith('0x') && trimmed.length === 42) {
      const addr = trimmed as Hex
      setContractAddress(addr)
      await AsyncStorage.setItem(STORAGE_KEY, addr)
    }
  }, [contractInput])

  const handleClearContract = useCallback(async () => {
    setContractAddress(null)
    setContractInput('')
    await AsyncStorage.removeItem(STORAGE_KEY)
  }, [])

  const handleDeploy = useCallback(async () => {
    setIsDeploying(true)
    try {
      const account = getEVMAccount()
      const results = await executeTx(account, queryClient, [
        {
          abi: SIMPLE_LENDING_ABI,
          bytecode: SIMPLE_LENDING_BYTECODE,
          successMessage: 'Contract deployed!',
          onContractDeployed: async (addr) => {
            setContractAddress(addr)
            setContractInput(addr)
            await AsyncStorage.setItem(STORAGE_KEY, addr)
          },
        },
      ])
    } catch (error) {
      Alert.alert('Deploy Failed', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsDeploying(false)
    }
  }, [queryClient])

  const handleSelectLoan = useCallback((loan: SimpleLendingLoanWithId) => {
    setSelectedLoan(loan)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedLoan(null)
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lending</Text>
        <Text style={styles.subtitle}>Cross-chain lending with privacy</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Contract config */}
        <Card title="Contract Address">
          <View style={styles.contractRow}>
            <View style={styles.contractInput}>
              <Input
                placeholder="0x..."
                value={contractInput}
                onChangeText={setContractInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Button
              title="Save"
              size="sm"
              onPress={handleSaveContract}
              disabled={
                !contractInput.trim().startsWith('0x') ||
                contractInput.trim().length !== 42
              }
            />
          </View>

          <View style={styles.deployRow}>
            <Button
              title={isDeploying ? 'Deploying...' : 'Deploy New'}
              variant="secondary"
              size="sm"
              onPress={handleDeploy}
              disabled={isDeploying}
            />
            {contractAddress && (
              <Button
                title="Clear"
                variant="ghost"
                size="sm"
                onPress={handleClearContract}
              />
            )}
          </View>

          {/* Verification status */}
          {contractAddress && isVerifying && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.gray[400]} />
              <Text style={styles.verifyingText}>Verifying contract…</Text>
            </View>
          )}
          {contractAddress && isContractInvalid && (
            <Text style={styles.errorAddress}>
              ✗ No SimpleLending contract found at this address
            </Text>
          )}
          {isContractVerified && (
            <Text style={styles.savedAddress}>
              ✓ Connected: {contractAddress.slice(0, 10)}…
              {contractAddress.slice(-8)}
            </Text>
          )}
        </Card>

        {/* Create loan */}
        <CreateLoanForm contractAddress={isContractVerified ? contractAddress : null} />

        {/* Loans list */}
        {isContractVerified && (
          <LoansList
            contractAddress={contractAddress}
            onSelectLoan={handleSelectLoan}
          />
        )}
      </ScrollView>

      {/* Loan detail modal */}
      <Modal
        visible={selectedLoan !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseDetail}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Button
              title="Close"
              variant="ghost"
              size="sm"
              onPress={handleCloseDetail}
            />
          </View>
          {selectedLoan && contractAddress && (
            <ScrollView>
              <LoanDetailSheet
                loan={selectedLoan}
                contractAddress={contractAddress}
                onDismiss={handleCloseDetail}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.gray[500],
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
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
    marginTop: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  verifyingText: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  savedAddress: {
    fontSize: fontSize.xs,
    color: colors.green[600],
    marginTop: spacing.sm,
    fontFamily: 'monospace',
  },
  errorAddress: {
    fontSize: fontSize.xs,
    color: colors.red[600],
    marginTop: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
})
