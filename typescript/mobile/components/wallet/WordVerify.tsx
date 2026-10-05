/**
 * WordVerify — Seed phrase verification challenge.
 *
 * Presents 3 random word positions for the user to confirm,
 * ensuring they've actually written down their seed phrase.
 */

import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Input } from '@/components/ui'
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

interface WordVerifyProps {
  /** The full mnemonic words array */
  words: string[]
  /** Number of words to verify (default: 3) */
  count?: number
  /** Called when all words are verified correctly */
  onVerified: () => void
  /** Called when verification state changes */
  onStateChange?: (allCorrect: boolean) => void
}

interface Challenge {
  /** 0-based index into the words array */
  index: number
  /** The correct word */
  word: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pick `count` random indices from `total`, sorted ascending.
 */
function pickRandomIndices(total: number, count: number): number[] {
  const indices = new Set<number>()
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * total))
  }
  return Array.from(indices).sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WordVerify({
  words,
  count = 3,
  onVerified,
  onStateChange,
}: WordVerifyProps) {
  const challenges: Challenge[] = useMemo(() => {
    const indices = pickRandomIndices(words.length, count)
    return indices.map((i) => ({ index: i, word: words[i] }))
  }, [words, count])

  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [hasAttempted, setHasAttempted] = useState(false)

  const updateAnswer = useCallback(
    (index: number, value: string) => {
      const newAnswers = { ...answers, [index]: value.trim().toLowerCase() }
      setAnswers(newAnswers)

      const allFilled = challenges.every(
        (c) => (newAnswers[c.index] ?? '').length > 0
      )
      const allCorrect = challenges.every(
        (c) => (newAnswers[c.index] ?? '') === c.word
      )

      onStateChange?.(allCorrect)

      if (allFilled && allCorrect) {
        setHasAttempted(true)
        onVerified()
      } else if (allFilled) {
        setHasAttempted(true)
      }
    },
    [answers, challenges, onVerified, onStateChange]
  )

  return (
    <View style={styles.container}>
      <Text style={styles.instruction}>
        Enter the words at the following positions to verify your seed phrase.
      </Text>

      {challenges.map((challenge) => {
        const answer = answers[challenge.index] ?? ''
        const isFilled = answer.length > 0
        const isCorrect = answer === challenge.word
        const showError = hasAttempted && isFilled && !isCorrect

        return (
          <View key={challenge.index} style={styles.challengeRow}>
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{challenge.index + 1}</Text>
            </View>
            <Input
              containerStyle={styles.inputContainer}
              placeholder={`Word #${challenge.index + 1}`}
              value={answers[challenge.index] ?? ''}
              onChangeText={(text) => updateAnswer(challenge.index, text)}
              autoCapitalize="none"
              autoCorrect={false}
              error={showError ? 'Incorrect word' : undefined}
              right={
                isFilled && isCorrect ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : null
              }
            />
          </View>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  instruction: {
    fontSize: fontSize.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  indexBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  indexText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  inputContainer: {
    flex: 1,
  },
  checkmark: {
    fontSize: fontSize.lg,
    color: colors.green[600],
    fontWeight: fontWeight.bold,
  },
})
