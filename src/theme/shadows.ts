/**
 * Design Tokens — Shadows
 *
 * Light mode uses softer, more saturated shadows; dark mode raises elevation by
 * lifting the surface color and using a near-opaque shadow tint to keep the
 * illusion of depth on an already dark background.
 */

import { Platform, type ViewStyle } from 'react-native';

export interface ShadowScale {
  none: ViewStyle;
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
}

const build = (level: 0 | 1 | 2 | 3, tint: string): ViewStyle => {
  if (level === 0) return {};
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: tint,
      shadowOffset: { width: 0, height: level },
      shadowOpacity: 0.08 + level * 0.04,
      shadowRadius: level * 3,
    },
    android: {
      elevation: level * 2,
    },
    default: {},
  }) as ViewStyle;
};

export const lightShadows: ShadowScale = {
  none: build(0, '#000'),
  sm: build(1, '#000'),
  md: build(2, '#000'),
  lg: build(3, '#000'),
};

export const darkShadows: ShadowScale = {
  none: build(0, '#000'),
  sm: { ...build(1, '#000'), borderColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5 },
  md: { ...build(2, '#000'), borderColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5 },
  lg: { ...build(3, '#000'), borderColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5 },
};