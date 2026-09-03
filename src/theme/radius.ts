/**
 * Design Tokens — Radius
 *
 * Modest rounded corners for a fitness app — friendly but not bubbly.
 */

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;