import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  buildPalette,
  DEFAULT_THEME,
  LEGACY_THEME_KEY,
  parseSavedTheme,
  THEME_KEY,
  type ElectricId,
  type MidnightId,
  type Palette,
  type SavedTheme,
  type Scheme,
  type ThemeMode,
} from './lib/palette';

export { alpha, buildPalette, ELECTRIC, ELECTRIC_IDS, MIDNIGHT, MIDNIGHT_IDS, NOTICE_TONES, noticeColors, rgba } from './lib/palette';
export type { ElectricId, MidnightId, NoticeTone, Palette, Scheme, ThemeMode } from './lib/palette';

/* Theme: fonts, sizes, and the saved accent + light/dark choice. Colours live in lib/palette.ts. */

export const fonts = {
  /** Big numbers: the amount on Home, totals, the add screen. */
  number: 'Sora_700Bold',
  heavy: 'Sora_800ExtraBold',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
} as const;

/** Type scale. Sora is wide, so sizes are a touch smaller than usual. */
export const type = {
  display: { fontFamily: fonts.heavy, fontSize: 40, lineHeight: 46, letterSpacing: -1.5 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  amount: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 28, pill: 999 } as const;

/* ---------- Theme choice: saved on the phone, read once at start ---------- */

type ThemeState = {
  palette: Palette;
  scheme: Scheme;
  mode: ThemeMode;
  /** Colour used in dark mode (Midnight family). */
  midnight: MidnightId;
  /** Colour used in light mode (Electric family). */
  electric: ElectricId;
  /** False until the saved choice has been read. */
  ready: boolean;
  setMode: (m: ThemeMode) => void;
  setMidnight: (id: MidnightId) => void;
  setElectric: (id: ElectricId) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoice] = useState<SavedTheme>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([THEME_KEY, LEGACY_THEME_KEY])
      .then(([[, raw], [, legacy]]) => setChoice(parseSavedTheme(raw, legacy)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const save = useCallback((next: SavedTheme) => {
    setChoice(next);
    AsyncStorage.setItem(THEME_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const scheme: Scheme = choice.mode === 'system' ? (system === 'light' ? 'light' : 'dark') : choice.mode;
  const palette = useMemo(() => buildPalette(scheme, choice.midnight, choice.electric), [scheme, choice.midnight, choice.electric]);

  const value = useMemo<ThemeState>(
    () => ({
      palette,
      scheme,
      mode: choice.mode,
      midnight: choice.midnight,
      electric: choice.electric,
      ready,
      setMode: (mode) => save({ ...choice, mode }),
      setMidnight: (midnight) => save({ ...choice, midnight }),
      setElectric: (electric) => save({ ...choice, electric }),
    }),
    [palette, scheme, choice, ready, save],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeState {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}

/** The colours for the current mode and the colour picked for it. */
export function usePalette(): Palette {
  const t = useContext(ThemeContext);
  const system = useColorScheme();
  const fallback = useMemo(() => buildPalette(system === 'light' ? 'light' : 'dark', 'lime', 'blue'), [system]);
  return t ? t.palette : fallback;
}
