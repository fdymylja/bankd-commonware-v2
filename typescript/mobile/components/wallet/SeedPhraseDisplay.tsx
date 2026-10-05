/**
 * SeedPhraseDisplay — Numbered grid of mnemonic words.
 *
 * Used during wallet creation to show the generated seed phrase.
 * Optionally blurs words with a tap-to-reveal overlay.
 */

import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

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

interface SeedPhraseDisplayProps {
  /** The mnemonic words as an array */
  words: string[]
  /** Whether to blur/hide words initially (default: true) */
  concealable?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SeedPhraseDisplay({
  words,
  concealable = true,
}: SeedPhraseDisplayProps) {
  const [revealed, setRevealed] = useState(!concealable)

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordCell}>
            <Text style={styles.wordIndex}>{index + 1}</Text>
            <Text style={styles.wordText}>
              {revealed ? word : '••••••'}
            </Text>
          </View>
        ))}
      </View>

      {concealable && !revealed && (
        <Pressable
          onPress={() => setRevealed(true)}
          style={styles.revealOverlay}
        >
          <Text style={styles.revealText}>Tap to reveal seed phrase</Text>
          <Text style={styles.revealHint}>
            Make sure no one is looking at your screen
          </Text>
        </Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wordCell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    width: '47%' as unknown as number, // 2 columns with gap
    flexGrow: 0,
    flexBasis: '47%',
  },
  wordIndex: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.gray[400],
    width: 20,
  },
  wordText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[800],
    flex: 1,
  },
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249, 250, 251, 0.95)',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  revealText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  revealHint: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
})
