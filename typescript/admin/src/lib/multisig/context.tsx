// src/lib/multisig/context.tsx
'use client'

/**
 * Multisig wallet context. Runs beside the native wallet as a parallel "active
 * wallet" - selecting a multisig doesn't touch the native EVM signing flow.
 * Independent of the native-wallet context by design; the only coupling is
 * pulling the unlocked signing key at initiator-sign time.
 */

import { type StdSignDoc, serializeSignDoc } from '@cosmjs/amino'
import { fromBase64, fromBech32, toBech32 } from '@cosmjs/encoding'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { type Hex, getAddress, hexToBytes, parseUnits, recoverAddress, toHex } from 'viem'

import { chainConfig } from '@/lib/config'
import { getEVMAccount } from '@/lib/native-wallet/evm'
import {
  type PendingSafeTx,
  type SafeExecResult,
  type SafeMemberSignatureBlob,
  type SafeTx,
  buildAddOwner,
  buildChangeThreshold,
  buildCosmosSend,
  buildNativeSend,
  executeSafeTx,
  getSafeInfo,
  getSafeNonce,
  getSafeTxHash,
  signSafeTxHash,
} from '@/lib/safe'

import { setActiveWallet as setActiveWalletMirror } from './active-store'
import { combineAndEncodeTx } from './assemble'
import { broadcast, buildUnsignedDeploySafe, buildUnsignedSend } from './cosmos'
import {
  deleteMultisigWallet,
  deletePendingMultisigTx,
  deletePendingSafeTx,
  getMultisigWallets,
  getPendingMultisigTx,
  getPendingMultisigTxs,
  getPendingSafeTx,
  getPendingSafeTxs,
  pruneOrphanedPendingTxs,
  saveMultisigWallet,
  savePendingMultisigTx,
  savePendingSafeTx,
} from './db'
import { fundFromPersonal } from './fund'
import { deriveMultisigAddress } from './pubkey'
import { signAsMember } from './sign'
import type {
  ActiveWallet,
  MemberSignatureBlob,
  MultisigConfig,
  MultisigMember,
  PendingMultisigTx,
  UnsignedTxBlob,
} from './types'

/** Broadcast result surfaced to the UI, with the raw chain log for debugging. */
export interface BroadcastResult {
  code: number
  transactionHash: string
  rawLog: string
  gasUsed: string
  gasWanted: string
}

const ACTIVE_WALLET_KEY = 'multisig-active-wallet'

interface CreateCosmosMultisigInput {
  label: string
  threshold: number
  members: MultisigMember[]
}

interface AddSafeInput {
  label: string
  safeAddress: string
}

interface CreatePendingSendInput {
  toAddress: string
  amount: string
  memo?: string
}

/**
 * A Safe tx to propose. The variant picks the target: a native EVM send, a
 * cosmos msg via msgexec, an authority-module exec, or owner/threshold mgmt.
 */
export type CreateSafeTxInput =
  | { variant: 'native-send'; to: string; amountDisplay: string }
  | { variant: 'cosmos-send'; toBech32: string; amount: string }
  | { variant: 'authority-send'; toBech32: string; amount: string }
  | { variant: 'add-owner'; owner: string; threshold: number }
  | { variant: 'change-threshold'; threshold: number }

interface MultisigContextValue {
  wallets: MultisigConfig[]
  activeWallet: ActiveWallet
  activeMultisig: MultisigConfig | null
  /** The active wallet when it's an EVM Safe (type: 'safe'), else null. */
  activeSafe: MultisigConfig | null
  pendingTxs: PendingMultisigTx[]
  /** Pending Safe txs for the active Safe (empty when a cosmos multisig is active). */
  pendingSafeTxs: PendingSafeTx[]
  loading: boolean
  refresh: () => Promise<void>
  setActiveWallet: (w: ActiveWallet) => void
  createCosmosMultisig: (
    input: CreateCosmosMultisigInput
  ) => Promise<MultisigConfig>
  addSafe: (input: AddSafeInput) => Promise<MultisigConfig>
  deleteWallet: (id: string) => Promise<void>
  createPendingSend: (
    input: CreatePendingSendInput
  ) => Promise<PendingMultisigTx>
  /** Import an unsigned tx blob from another party into a signable pending tx. */
  importPendingTx: (blob: UnsignedTxBlob) => Promise<PendingMultisigTx>
  createPendingDeploySafe: () => Promise<PendingMultisigTx>
  signAsInitiator: (txId: string) => Promise<MemberSignatureBlob>
  addMemberSignature: (
    txId: string,
    memberAddress: string,
    signatureB64: string
  ) => Promise<void>
  broadcastPending: (txId: string) => Promise<BroadcastResult>
  /** Send `amount` (base units) from the personal account to the multisig. */
  fundMultisig: (amount: string) => Promise<BroadcastResult>
  deletePending: (txId: string) => Promise<void>
  // EVM-Safe host surface (mirrors the cosmos path above).
  createPendingSafeTx: (input: CreateSafeTxInput) => Promise<PendingSafeTx>
  signSafeAsInitiator: (txId: string) => Promise<SafeMemberSignatureBlob>
  addSafeMemberSignature: (txId: string, signature: Hex) => Promise<void>
  executePendingSafe: (txId: string) => Promise<SafeExecResult>
  deletePendingSafe: (txId: string) => Promise<void>
}

const MultisigContext = createContext<MultisigContextValue | null>(null)

/** hex EVM address (0x...) -> bech32 `wallet1...` (same 20 bytes). */
function hexToCosmos(hex: string): string {
  return toBech32(chainConfig.bech32Prefix, hexToBytes(hex as `0x${string}`))
}

export function MultisigProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<MultisigConfig[]>([])
  const [activeWallet, setActiveWalletState] = useState<ActiveWallet>('personal')
  const [pendingTxs, setPendingTxs] = useState<PendingMultisigTx[]>([])
  const [pendingSafeTxs, setPendingSafeTxs] = useState<PendingSafeTx[]>([])
  const [loading, setLoading] = useState(true)

  const activeConfig = useMemo(() => {
    if (activeWallet === 'personal') return null
    return wallets.find((w) => w.id === activeWallet.multisigId) ?? null
  }, [activeWallet, wallets])

  // Route by type: the cosmos surface only sees cosmos-multisig configs, the
  // Safe surface only sees 'safe' configs.
  const activeMultisig =
    activeConfig?.type === 'cosmos-multisig' ? activeConfig : null
  const activeSafe = activeConfig?.type === 'safe' ? activeConfig : null

  const refresh = useCallback(async () => {
    const all = await getMultisigWallets()
    setWallets(all)
    // Clear any pending txs (and their signatures) left orphaned by a deleted
    // multisig, so they can't resurface under a freshly created one.
    await pruneOrphanedPendingTxs(all.map((w) => w.id))
    if (activeWallet === 'personal') {
      setPendingTxs([])
      setPendingSafeTxs([])
      return
    }
    const active = all.find((w) => w.id === activeWallet.multisigId)
    if (active?.type === 'safe') {
      setPendingTxs([])
      setPendingSafeTxs(await getPendingSafeTxs(activeWallet.multisigId))
    } else {
      // A cosmos multisig can also drive its Safe for EVM signing, so load both
      // its cosmos pending txs and any Safe proposals (keyed by the same id) -
      // otherwise the global co-sign modal can't live-update after signing.
      setPendingTxs(await getPendingMultisigTxs(activeWallet.multisigId))
      setPendingSafeTxs(await getPendingSafeTxs(activeWallet.multisigId))
    }
  }, [activeWallet])

  // Load persisted active wallet + initial data.
  useEffect(() => {
    const stored = sessionStorage.getItem(ACTIVE_WALLET_KEY)
    if (stored) {
      try {
        setActiveWalletState(JSON.parse(stored))
      } catch {
        // ignore malformed persisted value
      }
    }
    getMultisigWallets()
      .then(setWallets)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Mirror the active multisig selection into the module store so non-hook code
  // (executeTx) can read it synchronously and route EVM signing to the Safe
  // queue instead of the personal account. A Safe deploys at the cosmos
  // multisig's OWN address, so either wallet type resolves to the same Safe
  // address - selecting the cosmos multisig drives its Safe for EVM ops too.
  // (If the Safe isn't deployed yet, executeTx surfaces a clear error.)
  useEffect(() => {
    const safe = activeSafe?.safeAddress
      ? { id: activeSafe.id, address: getAddress(activeSafe.safeAddress) as Hex }
      : activeMultisig?.cosmosAddress
        ? {
            id: activeMultisig.id,
            address: getAddress(
              toHex(fromBech32(activeMultisig.cosmosAddress).data)
            ) as Hex,
          }
        : null
    if (safe) {
      setActiveWalletMirror({
        kind: 'safe',
        safeId: safe.id,
        safeAddress: safe.address,
      })
    } else {
      setActiveWalletMirror({ kind: 'personal' })
    }
  }, [activeSafe, activeMultisig])

  const setActiveWallet = useCallback((w: ActiveWallet) => {
    setActiveWalletState(w)
    sessionStorage.setItem(ACTIVE_WALLET_KEY, JSON.stringify(w))
  }, [])

  const createCosmosMultisig = useCallback(
    async (input: CreateCosmosMultisigInput) => {
      const cosmosAddress = deriveMultisigAddress(input.members, input.threshold)
      const config: MultisigConfig = {
        id: crypto.randomUUID(),
        label: input.label,
        type: 'cosmos-multisig',
        createdAt: Date.now(),
        threshold: input.threshold,
        members: input.members,
        cosmosAddress,
      }
      await saveMultisigWallet(config)
      await refresh()
      return config
    },
    [refresh]
  )

  const addSafe = useCallback(
    async (input: AddSafeInput) => {
      const config: MultisigConfig = {
        id: crypto.randomUUID(),
        label: input.label,
        type: 'safe',
        createdAt: Date.now(),
        safeAddress: input.safeAddress,
      }
      await saveMultisigWallet(config)
      await refresh()
      return config
    },
    [refresh]
  )

  const deleteWallet = useCallback(
    async (id: string) => {
      await deleteMultisigWallet(id)
      if (activeWallet !== 'personal' && activeWallet.multisigId === id) {
        setActiveWallet('personal')
      }
      await refresh()
    },
    [activeWallet, refresh, setActiveWallet]
  )

  const createPendingSend = useCallback(
    async (input: CreatePendingSendInput) => {
      if (!activeMultisig) throw new Error('No active cosmos multisig')
      const tx = await buildUnsignedSend({
        multisig: activeMultisig,
        toAddress: input.toAddress,
        amount: input.amount,
        memo: input.memo,
      })
      await savePendingMultisigTx(tx)
      await refresh()
      return tx
    },
    [activeMultisig, refresh]
  )

  const importPendingTx = useCallback(
    async (blob: UnsignedTxBlob): Promise<PendingMultisigTx> => {
      if (blob.kind !== 'bankd-multisig-unsigned-tx') {
        throw new Error('Not an unsigned multisig tx blob')
      }
      // The address is deterministic from members+threshold. Re-derive and reject
      // a tampered blob before we auto-create a wallet from it - otherwise a
      // co-signer would sign against attacker-chosen members under a trusted label.
      const derived = deriveMultisigAddress(
        blob.multisig.members,
        blob.multisig.threshold
      )
      if (derived !== blob.multisig.cosmosAddress) {
        throw new Error('Blob address does not match its members/threshold')
      }
      // Find the multisig this tx belongs to; auto-create it from the blob's
      // members if this browser doesn't have it yet (same members -> same
      // address), so a co-signer can paste one blob and sign right away.
      let config = wallets.find(
        (w) =>
          w.type === 'cosmos-multisig' &&
          w.cosmosAddress === blob.multisig.cosmosAddress
      )
      if (!config) {
        config = await createCosmosMultisig({
          label: blob.multisig.label,
          threshold: blob.multisig.threshold,
          members: blob.multisig.members,
        })
      }
      const pending: PendingMultisigTx = {
        id: crypto.randomUUID(),
        multisigId: config.id,
        chainId: blob.tx.chainId,
        accountNumber: blob.tx.accountNumber,
        sequence: blob.tx.sequence,
        bodyBytesB64: blob.tx.bodyBytesB64,
        fee: blob.tx.fee,
        signDocJson: blob.tx.signDocJson,
        signatures: {},
        summary: blob.tx.summary,
        createdAt: Date.now(),
      }
      await savePendingMultisigTx(pending)
      // Switch to this multisig so the imported tx is visible for signing.
      setActiveWallet({ multisigId: config.id })
      await refresh()
      return pending
    },
    [wallets, createCosmosMultisig, setActiveWallet, refresh]
  )

  const createPendingDeploySafe = useCallback(async () => {
    if (!activeMultisig) throw new Error('No active cosmos multisig')
    const tx = await buildUnsignedDeploySafe(activeMultisig)
    await savePendingMultisigTx(tx)
    await refresh()
    return tx
  }, [activeMultisig, refresh])

  const addMemberSignature = useCallback(
    async (txId: string, memberAddress: string, signatureB64: string) => {
      if (!activeMultisig) throw new Error('No active cosmos multisig')
      // Read from the store, not the in-memory list: a just-created tx may not
      // be mirrored into React state yet.
      const tx = await getPendingMultisigTx(txId)
      if (!tx) throw new Error('Pending tx not found')
      const isMember = activeMultisig.members?.some(
        (m) => m.address === memberAddress
      )
      if (!isMember) throw new Error('Signer is not a member of this multisig')
      const updated: PendingMultisigTx = {
        ...tx,
        signatures: { ...tx.signatures, [memberAddress]: signatureB64 },
      }
      await savePendingMultisigTx(updated)
      await refresh()
    },
    [activeMultisig, refresh]
  )

  const signAsInitiator = useCallback(
    async (txId: string): Promise<MemberSignatureBlob> => {
      const tx = await getPendingMultisigTx(txId)
      if (!tx) throw new Error('Pending tx not found')
      const account = getEVMAccount()
      const hdKey = account.getHdKey()
      if (!hdKey.privateKey) throw new Error('No signing key available')
      const privHex = toHex(hdKey.privateKey)
      const initiatorAddress = hexToCosmos(account.address)

      const signDoc = JSON.parse(tx.signDocJson) as StdSignDoc
      const signBytes = serializeSignDoc(signDoc)
      const signatureB64 = await signAsMember(signBytes, privHex)
      await addMemberSignature(txId, initiatorAddress, signatureB64)
      return {
        kind: 'bankd-multisig-member-signature',
        cosmosAddress: activeMultisig?.cosmosAddress ?? '',
        memberAddress: initiatorAddress,
        signatureB64,
      }
    },
    [addMemberSignature, activeMultisig]
  )

  const broadcastPending = useCallback(
    async (txId: string) => {
      if (!activeMultisig || !activeMultisig.members || !activeMultisig.threshold) {
        throw new Error('No active cosmos multisig')
      }
      const tx = await getPendingMultisigTx(txId)
      if (!tx) throw new Error('Pending tx not found')
      const txBytes = combineAndEncodeTx({
        members: activeMultisig.members,
        threshold: activeMultisig.threshold,
        bodyBytes: fromBase64(tx.bodyBytesB64),
        fee: { amount: tx.fee.amount, gas: tx.fee.gas, denom: chainConfig.denom },
        sequence: tx.sequence,
        signatures: tx.signatures,
      })
      const result = await broadcast(txBytes)
      if (result.code === 0) {
        await deletePendingMultisigTx(txId)
        await refresh()
      }
      return {
        code: result.code,
        transactionHash: result.transactionHash,
        rawLog: result.rawLog ?? '',
        gasUsed: result.gasUsed?.toString() ?? '',
        gasWanted: result.gasWanted?.toString() ?? '',
      }
    },
    [activeMultisig, refresh]
  )

  const fundMultisig = useCallback(
    async (amount: string): Promise<BroadcastResult> => {
      const recipient = activeSafe?.safeAddress ?? activeMultisig?.cosmosAddress
      if (!recipient) throw new Error('No active Safe')
      const result = await fundFromPersonal({
        toAddress: recipient,
        amount,
      })
      if (result.code === 0) await refresh()
      return {
        code: result.code,
        transactionHash: result.transactionHash,
        rawLog: result.rawLog ?? '',
        gasUsed: result.gasUsed?.toString() ?? '',
        gasWanted: result.gasWanted?.toString() ?? '',
      }
    },
    [activeSafe, activeMultisig, refresh]
  )

  const deletePending = useCallback(
    async (txId: string) => {
      await deletePendingMultisigTx(txId)
      await refresh()
    },
    [refresh]
  )

  // ===========================================================================
  // EVM-Safe host surface
  // ===========================================================================

  const createPendingSafeTx = useCallback(
    async (input: CreateSafeTxInput): Promise<PendingSafeTx> => {
      if (!activeSafe?.safeAddress) throw new Error('No active Safe')
      const safeAddress = getAddress(activeSafe.safeAddress) as Hex
      const safeBech32 = hexToCosmos(safeAddress)
      // Build against the Safe's live nonce - stored on the tx and re-checked at
      // execute time (stale-nonce guard).
      const nonce = await getSafeNonce(safeAddress)
      const denom = chainConfig.denom

      let safeTx: SafeTx
      let summary: string
      switch (input.variant) {
        case 'native-send': {
          const valueWei = parseUnits(input.amountDisplay, 18).toString()
          safeTx = buildNativeSend({
            to: getAddress(input.to) as Hex,
            valueWei,
            nonce,
          })
          summary = `Send ${input.amountDisplay} ${chainConfig.displayDenom} to ${input.to}`
          break
        }
        case 'cosmos-send': {
          safeTx = buildCosmosSend({
            fromBech32: safeBech32,
            toBech32: input.toBech32,
            denom,
            amount: input.amount,
            nonce,
          })
          summary = `Cosmos send ${input.amount}${denom} to ${input.toBech32}`
          break
        }
        case 'authority-send': throw new Error('Authority module sends are unavailable on Commonware; propose an explicit contract call instead')
        case 'add-owner': {
          safeTx = buildAddOwner({
            safeAddress,
            owner: getAddress(input.owner) as Hex,
            threshold: input.threshold,
            nonce,
          })
          summary = `Add owner ${input.owner} (threshold ${input.threshold})`
          break
        }
        case 'change-threshold': {
          safeTx = buildChangeThreshold({
            safeAddress,
            threshold: input.threshold,
            nonce,
          })
          summary = `Change threshold to ${input.threshold}`
          break
        }
      }

      // Let the Safe compute its own EIP-712 digest (provably what execute checks).
      const safeTxHash = await getSafeTxHash(safeAddress, safeTx)
      const pending: PendingSafeTx = {
        id: crypto.randomUUID(),
        safeId: activeSafe.id,
        safeAddress,
        chainId: chainConfig.evmChainId,
        safeTx,
        safeTxHash,
        nonce,
        summary,
        signatures: {},
        createdAt: Date.now(),
      }
      await savePendingSafeTx(pending)
      await refresh()
      return pending
    },
    [activeSafe, refresh]
  )

  const addSafeMemberSignature = useCallback(
    async (txId: string, signature: Hex) => {
      const tx = await getPendingSafeTx(txId)
      if (!tx) throw new Error('Pending Safe tx not found')
      // Recover the signer from the signature rather than trusting a label -
      // the recovered address is what Safe.checkSignatures will key on, and it
      // keeps the ascending-order concat correct.
      const signer = await recoverAddress({ hash: tx.safeTxHash, signature })
      // Reject a signature from a non-owner up front. Without this the quorum
      // badge counts it and Execute goes green, only to revert at execute time
      // in Safe.checkSignatures. Fail here with a clear message instead.
      const { owners } = await getSafeInfo(tx.safeAddress)
      if (!owners.some((o) => o.toLowerCase() === signer.toLowerCase())) {
        throw new Error('Signature is not from an owner of this Safe')
      }
      const updated: PendingSafeTx = {
        ...tx,
        signatures: { ...tx.signatures, [signer.toLowerCase()]: signature },
      }
      await savePendingSafeTx(updated)
      await refresh()
    },
    [refresh]
  )

  const signSafeAsInitiator = useCallback(
    async (txId: string): Promise<SafeMemberSignatureBlob> => {
      const tx = await getPendingSafeTx(txId)
      if (!tx) throw new Error('Pending Safe tx not found')
      const account = getEVMAccount()
      const hdKey = account.getHdKey()
      if (!hdKey.privateKey) throw new Error('No signing key available')
      const privHex = toHex(hdKey.privateKey)
      const ownerAddress = getAddress(account.address) as Hex
      const signature = await signSafeTxHash(tx.safeTxHash, privHex)
      await addSafeMemberSignature(txId, signature)
      return {
        kind: 'bankd-safe-member-signature',
        safeAddress: tx.safeAddress,
        safeTxHash: tx.safeTxHash,
        ownerAddress,
        signature,
      }
    },
    [addSafeMemberSignature]
  )

  const executePendingSafe = useCallback(
    async (txId: string): Promise<SafeExecResult> => {
      const tx = await getPendingSafeTx(txId)
      if (!tx) throw new Error('Pending Safe tx not found')
      const result = await executeSafeTx(tx)
      await deletePendingSafeTx(txId)
      await refresh()
      return result
    },
    [refresh]
  )

  const deletePendingSafe = useCallback(
    async (txId: string) => {
      await deletePendingSafeTx(txId)
      await refresh()
    },
    [refresh]
  )

  const value: MultisigContextValue = {
    wallets,
    activeWallet,
    activeMultisig,
    activeSafe,
    pendingTxs,
    pendingSafeTxs,
    loading,
    refresh,
    setActiveWallet,
    createCosmosMultisig,
    addSafe,
    deleteWallet,
    createPendingSend,
    importPendingTx,
    createPendingSafeTx,
    signSafeAsInitiator,
    addSafeMemberSignature,
    executePendingSafe,
    deletePendingSafe,
    createPendingDeploySafe,
    signAsInitiator,
    addMemberSignature,
    broadcastPending,
    fundMultisig,
    deletePending,
  }

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  )
}

export function useMultisig(): MultisigContextValue {
  const ctx = useContext(MultisigContext)
  if (!ctx) throw new Error('useMultisig must be used within MultisigProvider')
  return ctx
}
