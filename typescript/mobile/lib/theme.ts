/**
 * Bankd Mobile — Design System Theme
 *
 * Nubank-inspired fintech aesthetic: clean, minimal, white space,
 * card-based, big bold balance numbers.
 * Purple accent for privacy features, blue for public/primary.
 */

export const colors = {
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  purple: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    300: '#D8B4FE',
    400: '#C084FC',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
  },
  yellow: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
  },
  white: '#FFFFFF',
  black: '#000000',
  /** Semi-transparent backdrop for modals/sheets */
  backdrop: 'rgba(0, 0, 0, 0.5)',
} as const

export const spacing = {
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px */
  lg: 16,
  /** 24px */
  xl: 24,
  /** 32px */
  xxl: 32,
  /** 48px */
  xxxl: 48,
} as const

export const fontSize = {
  /** 11px — micro labels */
  xxs: 11,
  /** 12px — captions */
  xs: 12,
  /** 14px — body small */
  sm: 14,
  /** 16px — body */
  md: 16,
  /** 18px — body large */
  lg: 18,
  /** 20px — subtitle */
  xl: 20,
  /** 24px — title */
  xxl: 24,
  /** 32px — section header */
  xxxl: 32,
  /** 40px — balance display */
  balance: 40,
} as const

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
}

export const borderRadius = {
  /** 6px */
  sm: 6,
  /** 10px */
  md: 10,
  /** 14px */
  lg: 14,
  /** 20px */
  xl: 20,
  /** 9999px — pill shape */
  full: 9999,
} as const

export const shadow = {
  /** Subtle card shadow */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  /** Standard card shadow */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  /** Elevated card shadow */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const
