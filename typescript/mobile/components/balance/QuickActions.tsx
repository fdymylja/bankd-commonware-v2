import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SymbolView } from 'expo-symbols'

import { colors, fontSize, fontWeight, spacing, borderRadius } from '@/lib/theme'

export type QuickActionName = 'send' | 'receive' | 'shieldd-demo' | 'create-token'

interface QuickActionsProps {
  onAction: (action: QuickActionName) => void
  disabled?: boolean
}

const actions: {
  name: QuickActionName
  label: string
  icon: { ios: string; android: string; web: string }
  color: string
}[] = [
  {
    name: 'send',
    label: 'Send',
    icon: { ios: 'arrow.up.circle.fill', android: 'arrow_upward', web: 'arrow_upward' },
    color: colors.primary[500],
  },
  {
    name: 'receive',
    label: 'Receive',
    icon: { ios: 'arrow.down.circle.fill', android: 'arrow_downward', web: 'arrow_downward' },
    color: colors.green[500],
  },
  {
    name: 'shieldd-demo',
    label: 'Shieldd',
    icon: { ios: 'shield.lefthalf.filled', android: 'security', web: 'security' },
    color: colors.primary[600],
  },
  {
    name: 'create-token',
    label: 'New Token',
    icon: { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' },
    color: colors.gray[600],
  },
]

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {actions.map((a) => (
        <Pressable
          key={a.name}
          style={[styles.action, disabled && styles.actionDisabled]}
          onPress={() => onAction(a.name)}
          disabled={disabled}
        >
          <View style={[styles.circle, { backgroundColor: a.color }]}>
            <SymbolView
              name={a.icon as any}
              size={22}
              tintColor={colors.white}
            />
          </View>
          <Text style={styles.label}>{a.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  action: {
    alignItems: 'center',
    gap: spacing.sm,
    width: 56,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
    textAlign: 'center',
  },
})
