/**
 * ThemeProvider
 *
 * Owns the active theme for the whole app.
 *
 * Modes:
 * - `'system'` (default): follow OS via `Appearance.getColorScheme()`.
 *   When the user toggles dark mode in the OS, the entire app re-renders.
 * - `'light'` / `'dark'`: force a scheme regardless of OS. Used by the
 *   future Settings screen (G10).
 *
 * Components should consume theme via `useTheme()` so they re-render whenever
 * the active scheme changes.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

import { darkPalette, lightPalette, type ColorScheme, type Palette } from './colors';
import { darkShadows, lightShadows, type ShadowScale } from './shadows';
import { radius, type RadiusKey } from './radius';
import { spacing, type SpacingKey } from './spacing';
import { typography, type TypographyScale } from './typography';

export type ThemeMode = 'system' | ColorScheme;

export interface Theme {
  /** Effective scheme actually being rendered (resolves `'system'` to a concrete value). */
  scheme: ColorScheme;
  /** The user-configured mode (`'system' | 'light' | 'dark'`). */
  mode: ThemeMode;
  colors: Palette;
  typography: TypographyScale;
  spacing: typeof spacing;
  spacingValue: (key: SpacingKey) => number;
  radius: typeof radius;
  radiusValue: (key: RadiusKey) => number;
  shadows: ShadowScale;
}

const defaultTheme: Theme = {
  scheme: 'light',
  mode: 'system',
  colors: lightPalette,
  typography,
  spacing,
  spacingValue: (k) => spacing[k],
  radius,
  radiusValue: (k) => radius[k],
  shadows: lightShadows,
};

const ThemeContext = createContext<Theme>(defaultTheme);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Override initial mode. Defaults to `'system'`. */
  initialMode?: ThemeMode;
}

function normalizeOsScheme(scheme: ColorSchemeName | null | undefined): ColorScheme {
  return scheme === 'dark' ? 'dark' : 'light';
}

function resolveScheme(mode: ThemeMode, osScheme: ColorSchemeName | null | undefined): ColorScheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return normalizeOsScheme(osScheme);
}

export function ThemeProvider({ children, initialMode = 'system' }: ThemeProviderProps) {
  // Persisted user choice lives in settingsStore (DB-backed, rehydrated by
  // DatabaseBootstrap in App.tsx before first paint). We subscribe here so
  // every `useTheme()` consumer re-renders on toggle — `SettingsScreen` only
  // needs to call `setThemeMode()` and the palette flips automatically.
  const mode = useSettingsStore((s) => s.themeMode);
  const [osScheme, setOsScheme] = useState<ColorSchemeName | null>(
    Appearance.getColorScheme() ?? null,
  );

  // Subscribe to OS color-scheme changes (only matters when mode === 'system').
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setOsScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  // `initialMode` is kept in the prop signature for API stability but the
  // persisted store value always wins at runtime; suppress the unused-var
  // lint without removing the prop.
  void initialMode;

  const scheme = useMemo(() => resolveScheme(mode, osScheme), [mode, osScheme]);

  const palette = scheme === 'dark' ? darkPalette : lightPalette;
  const shadows = scheme === 'dark' ? darkShadows : lightShadows;

  const value = useMemo<Theme>(
    () => ({
      scheme,
      mode,
      colors: palette,
      typography,
      spacing,
      spacingValue: (k: SpacingKey) => spacing[k],
      radius,
      radiusValue: (k: RadiusKey) => radius[k],
      shadows,
    }),
    [scheme, mode, palette, shadows],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Read the active theme from context. Throws if used outside a `ThemeProvider`
 * so misuse is loud rather than silent.
 */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (ctx === defaultTheme) {
    // We only land here if a component tries to read theme before the provider
    // mounts — surface that as a developer error.
    throw new Error('useTheme must be used inside a <ThemeProvider>.');
  }
  return ctx;
}

/** Helper that returns the palette only (lighter dependency). */
export function useColors(): Palette {
  return useTheme().colors;
}