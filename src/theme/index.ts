/**
 * Public barrel for the theme module.
 *
 * Components should never reach into individual files — import everything from
 * `@/theme`. That keeps the surface area stable as the theme evolves.
 */

export { ThemeProvider, useTheme, useColors } from './ThemeProvider';
export type { Theme, ThemeMode } from './ThemeProvider';
export { lightPalette, darkPalette } from './colors';
export type { Palette, ColorScheme } from './colors';
export { typography } from './typography';
export type { TypographyScale } from './typography';
export { spacing } from './spacing';
export type { SpacingKey } from './spacing';
export { radius } from './radius';
export type { RadiusKey } from './radius';
export { lightShadows, darkShadows } from './shadows';
export type { ShadowScale } from './shadows';
/**
 * G46 — 动效 token（duration / easing / springs）。详见 motion.ts 顶部说明。
 */
export { duration, easing, springs, motion } from './motion';
export type { DurationKey, EasingKey, SpringKey } from './motion';
