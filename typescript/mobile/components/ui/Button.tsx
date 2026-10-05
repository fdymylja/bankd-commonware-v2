import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { borderRadius, colors, fontSize, fontWeight, spacing } from '@/lib/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'privacy'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  /** Button label */
  title: string
  /** Press handler */
  onPress?: () => void
  /** Visual variant */
  variant?: ButtonVariant
  /** Size preset */
  size?: ButtonSize
  /** Show loading spinner and disable interactions */
  loading?: boolean
  /** Disable interactions */
  disabled?: boolean
  /** Optional left icon (render prop) */
  icon?: React.ReactNode
  /** Additional container styles */
  style?: StyleProp<ViewStyle>
}

// ---------------------------------------------------------------------------
// Variant config
// ---------------------------------------------------------------------------

const variantStyles: Record<
  ButtonVariant,
  { bg: string; bgPressed: string; text: string; border?: string }
> = {
  primary: {
    bg: colors.primary[600],
    bgPressed: colors.primary[700],
    text: colors.white,
  },
  secondary: {
    bg: colors.white,
    bgPressed: colors.gray[100],
    text: colors.gray[800],
    border: colors.gray[200],
  },
  danger: {
    bg: colors.red[600],
    bgPressed: '#B91C1C',
    text: colors.white,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: colors.gray[100],
    text: colors.primary[600],
  },
  privacy: {
    bg: colors.purple[600],
    bgPressed: colors.purple[700],
    text: colors.white,
  },
}

const sizeStyles: Record<
  ButtonSize,
  { paddingV: number; paddingH: number; fontSize: number; radius: number }
> = {
  sm: { paddingV: spacing.sm, paddingH: spacing.lg, fontSize: fontSize.sm, radius: borderRadius.md },
  md: { paddingV: spacing.md + 2, paddingH: spacing.xl, fontSize: fontSize.md, radius: borderRadius.lg },
  lg: { paddingV: spacing.lg, paddingH: spacing.xxl, fontSize: fontSize.lg, radius: borderRadius.lg },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const v = variantStyles[variant]
  const s = sizeStyles[size]
  const isDisabled = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? v.bgPressed : v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          borderRadius: s.radius,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={v.text}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              {
                color: v.text,
                fontSize: s.fontSize,
                marginLeft: icon ? spacing.sm : 0,
              },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: fontWeight.semibold,
  },
})
