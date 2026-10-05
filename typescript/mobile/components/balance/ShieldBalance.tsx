import { useState } from 'react'
import { Text, View } from 'react-native'
import { formatUnits } from 'viem'
import { Button, Card, Input } from '@/components/ui'
import { useBalances, useWallet } from '@/hooks'
import { usePenumbraBalances } from '@/hooks/usePenumbraBalances'
import { useGlobalTransfer } from '@/providers/TransferProvider'
import { usePenumbraBridge } from '@/providers/PenumbraProvider'
import { amountInBaseUnits } from '@/lib/commonware/transactions'
import { colors, spacing } from '@/lib/theme'

/** Makes the wallet's existing shield/withdraw actions reachable without a demo service. */
export function ShieldBalance() {
  const { hexAddress } = useWallet()
  const { data: publicBalances } = useBalances(hexAddress)
  const { data: privateBalances } = usePenumbraBalances()
  const bridge = usePenumbraBridge()
  const transfer = useGlobalTransfer()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const busy = !['idle', 'confirmed', 'error'].includes(transfer.state.status)
  const publicAmount = publicBalances?.find(b => b.denom === 'abrl')?.amount ?? '0'
  const privateAmount = privateBalances?.filter(b => b.baseDenom === 'abrl').reduce((sum, b) => sum + BigInt(b.amount), 0n) ?? 0n
  const act = async (withdraw: boolean) => {
    setError('')
    try {
      const value = amountInBaseUnits(amount, 18)
      if (value > (withdraw ? privateAmount : BigInt(publicAmount))) throw new Error('Insufficient BRL balance')
      const success = withdraw
        ? await transfer.unshield({ amount: value.toString(), denom: 'abrl' })
        : await transfer.shield({ amount, denom: 'abrl', decimals: 18 })
      if (success) setAmount('')
    } catch (error) { setError(error instanceof Error ? error.message : 'Transfer failed') }
  }
  return (
    <Card title="Public BRL" style={{ marginHorizontal: spacing.xl, marginBottom: spacing.lg }}>
      <Text style={{ marginBottom: spacing.md }}>{formatUnits(BigInt(publicAmount), 18)} BRL</Text>
      <Input label="BRL amount" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {!!error && <Text style={{ color: colors.red[500] }}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Button title="Shield" onPress={() => void act(false)} disabled={busy || !amount || !bridge.penumbraAddress} />
        <Button title="Withdraw" variant="secondary" onPress={() => void act(true)} disabled={busy || !amount || !bridge.syncProgress?.isSynced} />
        {!!bridge.lastError && <Button title="Retry" variant="secondary" onPress={() => void bridge.resetAndResync()} />}
      </View>
    </Card>
  )
}
