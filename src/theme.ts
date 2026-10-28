import { useColorScheme } from 'react-native';

/*
 * Kharcha visual system
 * - Paper: a cool, slightly green-grey page, like a bank passbook page.
 * - Ink: deep blue-slate for text and the month card.
 * - Marigold: the one accent. It marks spending (calendar heat, chart highlight).
 * - Leaf / Chili: money in, and "more than last month".
 * Amounts are set in Fraunces (a soft serif) so numbers read like a ledger.
 * Everything else is Manrope.
 */

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  marigold: string;
  marigoldSoft: string;
  leaf: string;
  chili: string;
  /** The month card on Home. */
  card: string;
  cardText: string;
  cardMuted: string;
  /** Empty calendar cell. */
  heatEmpty: string;
  scrim: string;
};

const light: Palette = {
  bg: '#F3F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#E9EDEA',
  ink: '#13232E',
  inkSoft: '#34444E',
  muted: '#66737B',
  line: '#DCE2DE',
  marigold: '#E8962E',
  marigoldSoft: '#FBE6C8',
  leaf: '#2E8B6A',
  chili: '#C8453A',
  card: '#13232E',
  cardText: '#F3F5F2',
  cardMuted: '#9DB0BB',
  heatEmpty: '#E4E9E5',
  scrim: 'rgba(19,35,46,0.45)',
};

const dark: Palette = {
  bg: '#0E171D',
  surface: '#16222A',
  surfaceAlt: '#1D2B34',
  ink: '#E6ECEE',
  inkSoft: '#C2CDD2',
  muted: '#8A99A2',
  line: '#24333D',
  marigold: '#F0A846',
  marigoldSoft: '#3B2E1C',
  leaf: '#4DB38A',
  chili: '#E2675B',
  card: '#1B2C37',
  cardText: '#EEF2F0',
  cardMuted: '#8FA3AE',
  heatEmpty: '#1C2932',
  scrim: 'rgba(0,0,0,0.55)',
};

export const fonts = {
  serif: 'Fraunces_600SemiBold',
  serifMedium: 'Fraunces_500Medium',
  regular: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

/** Type scale (roughly a 1.25 ratio). */
export const type = {
  display: { fontFamily: fonts.serif, fontSize: 46, lineHeight: 52, letterSpacing: -1 },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  amount: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Adds transparency to a #RRGGBB colour. */
export function alpha(hex: string, a: number): string {
  const n = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return hex + n.toString(16).padStart(2, '0');
}
