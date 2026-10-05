import React, { useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from '@/lib/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Label displayed above the input */
  label?: string
  /** Hint text below the input */
  hint?: string
  /** Error message — replaces hint when present */
  error?: string
  /** Optional left element (e.g. currency symbol) */
  left?: React.ReactNode
  /** Optional right element (e.g. max button) */
  right?: React.ReactNode
  /** Additional container style */
  containerStyle?: StyleProp<ViewStyle>
  /** Additional input style */
  inputStyle?: StyleProp<TextStyle>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Input({
  label,
  hint,
  error,
  left,
  right,
  containerStyle,
  inputStyle,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const hasError = !!error

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
      >
        {left && <View style={styles.leftSlot}>{left}</View>}

        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.gray[400]}
          onFocus={(e) => {
            setIsFocused(true)
            textInputProps.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            textInputProps.onBlur?.(e)
          }}
          accessibilityLabel={textInputProps.accessibilityLabel ?? label}
          {...textInputProps}
        />

        {right && <View style={styles.rightSlot}>{right}</View>}
      </View>

      {(error || hint) && (
        <Text style={[styles.hint, hasError && styles.hintError]}>
          {error || hint}
        </Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.red[500],
    borderWidth: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.gray[900],
  },
  leftSlot: {
    paddingLeft: spacing.lg,
  },
  rightSlot: {
    paddingRight: spacing.md,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  hintError: {
    color: colors.red[500],
  },
})
