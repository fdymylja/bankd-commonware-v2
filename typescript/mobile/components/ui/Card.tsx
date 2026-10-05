import React from 'react'
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  shadow,
  spacing,
} from '@/lib/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardProps {
  /** Optional title text rendered in a header bar */
  title?: string
  /** Optional element rendered on the right of the header bar */
  headerRight?: React.ReactNode
  /** Card content */
  children: React.ReactNode
  /** Visual variant — 'default' white or 'privacy' purple gradient-like */
  variant?: 'default' | 'privacy'
  /** Additional container styles */
  style?: StyleProp<ViewStyle>
  /** Disable the default shadow */
  noShadow?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Card({
  title,
  headerRight,
  children,
  variant = 'default',
  style,
  noShadow = false,
}: CardProps) {
  const isPrivacy = variant === 'privacy'

  return (
    <View
      style={[
        styles.container,
        isPrivacy && styles.privacyContainer,
        !noShadow && shadow.md,
        style,
      ]}
    >
      {(title || headerRight) && (
        <View style={styles.header}>
          {title ? (
            <Text
              style={[styles.headerTitle, isPrivacy && styles.privacyText]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            <View />
          )}
          {headerRight}
        </View>
      )}
      {children}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  privacyContainer: {
    backgroundColor: colors.purple[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  privacyText: {
    color: colors.purple[200],
  },
})
