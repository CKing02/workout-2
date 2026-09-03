/**
 * Design Tokens — Typography
 *
 * Uses the system default font stack on both iOS (San Francisco) and Android
 * (Roboto) — no custom font files. We only vary weight/size/lineHeight.
 *
 * Naming convention follows a t-shirt scale (display/heading/title/body/label).
 */

import type { TextStyle } from 'react-native';

export interface TypographyScale {
  display: TextStyle;
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  title: TextStyle;
  subtitle: TextStyle;
  body: TextStyle;
  bodySmall: TextStyle;
  caption: TextStyle;
  label: TextStyle;
  numeric: TextStyle; // mono-ish weight for timers / numbers
}

const baseFamily = undefined; // let the OS pick — keeps bundle slim

export const typography: TypographyScale = {
  display: {
    fontFamily: baseFamily,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: baseFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: baseFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  h3: {
    fontFamily: baseFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontFamily: baseFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  subtitle: {
    fontFamily: baseFamily,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  body: {
    fontFamily: baseFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodySmall: {
    fontFamily: baseFamily,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  caption: {
    fontFamily: baseFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  label: {
    fontFamily: baseFamily,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  numeric: {
    fontFamily: baseFamily,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
};