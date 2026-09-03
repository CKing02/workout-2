/**
 * Design Tokens — Spacing
 *
 * 4-pt base grid. Values are deliberately few — reach for these tokens, not
 * random inline numbers. If a layout needs something outside this scale,
 * question it first (and add a token instead of going rogue).
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
} as const;

export type SpacingKey = keyof typeof spacing;