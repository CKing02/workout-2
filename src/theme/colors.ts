/**
 * Design Tokens — Colors
 *
 * Single source of truth for palette. Every component must consume colors via
 * the `useTheme()` hook so the same code renders correctly under both light and
 * dark modes.
 *
 * Conventions:
 * - Brand orange `#FF6B35` is the primary accent for a strength-training app:
 *   energetic, motivating, and high contrast on both light & dark backgrounds.
 * - Semantic names (`background`, `surface`, `text`, `border`) describe role,
 *   not appearance — so `text` flips value between modes.
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  // Brand
  primary: string;
  primaryPressed: string;
  primaryMuted: string;
  onPrimary: string;

  // Surface
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Border / divider
  border: string;
  divider: string;

  // Feedback
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Misc
  shadow: string;
  overlay: string;
  transparent: string;
}

export const lightPalette: Palette = {
  primary: '#FF6B35',
  primaryPressed: '#E55525',
  primaryMuted: '#FFE4D8',
  onPrimary: '#FFFFFF',

  background: '#FFFFFF',
  surface: '#F7F8FA',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EFF1F4',

  text: '#11181C',
  textSecondary: '#5C6770',
  textTertiary: '#8A9099',
  textInverse: '#FFFFFF',

  border: '#E6E8EB',
  divider: '#F0F2F4',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  shadow: 'rgba(15, 23, 42, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  transparent: 'transparent',
};

export const darkPalette: Palette = {
  primary: '#FF7A4D',
  primaryPressed: '#FF6B35',
  primaryMuted: '#3A1E14',
  onPrimary: '#FFFFFF',

  background: '#0E0F12',
  surface: '#181A1F',
  surfaceElevated: '#22252B',
  surfaceMuted: '#1C1E24',

  text: '#ECEDEE',
  textSecondary: '#A8ADB4',
  textTertiary: '#6E747C',
  textInverse: '#11181C',

  border: '#2A2D34',
  divider: '#1F2228',

  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',

  shadow: 'rgba(0, 0, 0, 0.5)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  transparent: 'transparent',
};