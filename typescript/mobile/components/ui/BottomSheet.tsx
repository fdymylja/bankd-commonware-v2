import React, { forwardRef, useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetProps as GorhomBottomSheetProps,
} from '@gorhom/bottom-sheet'

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

export interface BottomSheetProps
  extends Omit<GorhomBottomSheetProps, 'children'> {
  /** Sheet title */
  title?: string
  /** Optional element rendered on the right of the header */
  headerRight?: React.ReactNode
  /** Sheet content */
  children: React.ReactNode
}

// Re-export the ref type for consumers
export type BottomSheetRef = GorhomBottomSheet

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BottomSheet = forwardRef<GorhomBottomSheet, BottomSheetProps>(
  function BottomSheet(
    { title, headerRight, children, snapPoints: _snapPoints, ...rest },
    ref,
  ) {
    const snapPoints = useMemo(() => _snapPoints ?? ['50%', '90%'], [_snapPoints])

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      ),
      [],
    )

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.background}
        {...rest}
      >
        <BottomSheetView style={styles.content}>
          {(title || headerRight) && (
            <View style={styles.header}>
              {title ? (
                <Text style={styles.title}>{title}</Text>
              ) : (
                <View />
              )}
              {headerRight}
            </View>
          )}
          {children}
        </BottomSheetView>
      </GorhomBottomSheet>
    )
  },
)

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  handleIndicator: {
    backgroundColor: colors.gray[300],
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
})
