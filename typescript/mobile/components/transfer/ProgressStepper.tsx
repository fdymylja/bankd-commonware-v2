import React, { useEffect, useRef } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'

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

/** Default steps for a private ZK transaction. */
export const PRIVATE_TX_STEPS = [
  'Planning',
  'Authorizing',
  'Building',
  'Broadcasting',
  'Confirming',
  'Done',
] as const

/** Steps for a private EVM execution (withdraw + IBC relay). */
export const PRIVATE_EXEC_STEPS = [
  'Planning',
  'Building',
  'Broadcasting',
  'Confirming',
  'Relaying',
  'Done',
] as const

export interface ProgressStepperProps {
  /** Current step index (0-based). */
  currentStep: number
  /** Custom step labels. Defaults to PRIVATE_TX_STEPS. */
  steps?: readonly string[]
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepDot({
  index,
  currentStep,
  label,
}: {
  index: number
  currentStep: number
  label: string
}) {
  const scale = useRef(new Animated.Value(1)).current

  const isActive = index === currentStep
  const isCompleted = index < currentStep

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start()
    } else {
      scale.setValue(1)
    }
  }, [isActive, scale])

  return (
    <View style={styles.stepContainer}>
      <Animated.View
        style={[
          styles.dot,
          isCompleted && styles.dotCompleted,
          isActive && styles.dotActive,
          !isActive && !isCompleted && styles.dotPending,
          { transform: [{ scale }] },
        ]}
      >
        <Text
          style={[
            styles.dotText,
            (isCompleted || isActive) && styles.dotTextLight,
          ]}
        >
          {isCompleted ? '✓' : index + 1}
        </Text>
      </Animated.View>
      <Text
        style={[
          styles.stepLabel,
          isActive && styles.stepLabelActive,
          isCompleted && styles.stepLabelCompleted,
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

function StepConnector({ completed }: { completed: boolean }) {
  return (
    <View
      style={[
        styles.connector,
        completed ? styles.connectorCompleted : styles.connectorPending,
      ]}
    />
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProgressStepper({
  currentStep,
  steps = PRIVATE_TX_STEPS,
}: ProgressStepperProps) {
  const scrollRef = useRef<ScrollView>(null)
  const stepPositions = useRef<number[]>([])

  useEffect(() => {
    const x = stepPositions.current[currentStep]
    if (x != null && scrollRef.current) {
      // Center the active step in view
      scrollRef.current.scrollTo({ x: Math.max(0, x - 120), animated: true })
    }
  }, [currentStep])

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <View
            onLayout={(e) => {
              stepPositions.current[i] = e.nativeEvent.layout.x
            }}
          >
            <StepDot index={i} currentStep={currentStep} label={label} />
          </View>
          {i < steps.length - 1 && (
            <StepConnector completed={i < currentStep} />
          )}
        </React.Fragment>
      ))}
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const DOT_SIZE = 32

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  stepContainer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: colors.primary[500],
  },
  dotCompleted: {
    backgroundColor: colors.green[500],
  },
  dotPending: {
    backgroundColor: colors.gray[200],
  },
  dotText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.gray[500],
  },
  dotTextLight: {
    color: colors.white,
  },
  connector: {
    width: 20,
    height: 2,
    marginBottom: spacing.xl,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.full,
  },
  connectorCompleted: {
    backgroundColor: colors.green[500],
  },
  connectorPending: {
    backgroundColor: colors.gray[200],
  },
  stepLabel: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.medium,
    color: colors.gray[400],
  },
  stepLabelActive: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },
  stepLabelCompleted: {
    color: colors.green[600],
  },
})
