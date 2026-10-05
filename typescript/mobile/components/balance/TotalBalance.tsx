import React, { useCallback, useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SymbolView } from 'expo-symbols'

import { colors, fontSize, fontWeight, spacing } from '@/lib/theme'

interface TotalBalanceProps {
  /** Formatted balance string, e.g. "1.234,56" */
  amount: string
  /** Currency label, e.g. "R$" */
  currency?: string
}

export function TotalBalance({ amount, currency = 'R$' }: TotalBalanceProps) {
  const [visible, setVisible] = useState(true)
  const opacity = useRef(new Animated.Value(1)).current

  const toggle = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setVisible((v) => !v)
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start()
    })
  }, [opacity])

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total balance</Text>
      <View style={styles.row}>
        <Animated.Text style={[styles.amount, { opacity }]}>
          {visible ? `${currency} ${amount}` : `${currency} ****`}
        </Animated.Text>
        <Pressable onPress={toggle} hitSlop={12} style={styles.toggle}>
          <SymbolView
            name={{
              ios: visible ? 'eye.fill' : 'eye.slash.fill',
              android: visible ? 'visibility' : 'visibility_off',
              web: visible ? 'visibility' : 'visibility_off',
            }}
            size={20}
            tintColor={colors.gray[400]}
          />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.white,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontSize: fontSize.balance,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  toggle: {
    marginLeft: spacing.md,
    padding: spacing.xs,
  },
})
