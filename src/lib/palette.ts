/*
 * Kharcha design tokens: colours, shadows and the saved theme choice.
 * Pure data and maths (no React Native imports) so scripts/test-tracking.ts can
 * check every theme for readable contrast.
 *
 * Two families, one per mode:
 * - Dark mode uses MIDNIGHT: near-black pages, one bright accent (Lime, Mango, Aqua,
 *   Lilac). The hero card is the bright accent with black text.
 * - Light mode uses ELECTRIC: soft tinted pages, one strong primary (Blue, Violet,
 *   Emerald, Magenta) plus a warm highlight. The hero card is the primary with white text.
 * You pick one colour for each family; the phone (or your setting) picks the mode.
 *
 * Every colour is backed up by a word or a number, never colour alone.
 */

export type MidnightId = 'lime' | 'mango' | 'aqua' | 'lilac';
export type ElectricId = 'blue' | 'violet' | 'emerald' | 'magenta';
export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

type MidnightSpec = {
  name: string;
  /** The bright accent: hero card, active tab, links, + button. */
  bright: string;
  /** Second and third chart colours (payment methods). */
  second: string;
  third: string;
  /** Near-black page tints: bg, surface, surfaceAlt, line. */
  night: [string, string, string, string];
};

type ElectricSpec = {
  name: string;
  /** The strong primary: hero card, active tab, links, + button. */
  primary: string;
  /** Warm highlight: chips on the hero card, the logo arrow, the hero progress bar. */
  highlight: string;
  /** Second and third chart colours (payment methods). */
  second: string;
  third: string;
  fourth: string;
  /** Text: ink, inkSoft, muted. */
  text: [string, string, string];
  /** Page tints: bg, surfaceAlt, line, track. */
  paper: [string, string, string, string];
};

export const MIDNIGHT: Record<MidnightId, MidnightSpec> = {
  lime: { name: 'Lime', bright: '#C8F65D', second: '#B9A5FF', third: '#7DD3FC', night: ['#0A0A0B', '#151517', '#1C1C1F', '#26262A'] },
  mango: { name: 'Mango', bright: '#FFB547', second: '#5EEAD4', third: '#C4B5FD', night: ['#0B0A09', '#171513', '#1F1C19', '#2A2622'] },
  aqua: { name: 'Aqua', bright: '#5EEAD4', second: '#C4B5FD', third: '#FFB547', night: ['#070B0C', '#111719', '#182022', '#22292C'] },
  lilac: { name: 'Lilac', bright: '#C4B5FD', second: '#FFB547', third: '#5EEAD4', night: ['#0B0A12', '#15131F', '#1D1A2A', '#262336'] },
};

export const ELECTRIC: Record<ElectricId, ElectricSpec> = {
  blue: {
    name: 'Blue',
    primary: '#3346FF',
    highlight: '#FFC93C',
    second: '#D97706',
    third: '#0D9488',
    fourth: '#BE185D',
    text: ['#0D1333', '#2E3456', '#5B6285'],
    paper: ['#F4F6FF', '#EBEEFF', '#E1E5F7', '#E3E7FF'],
  },
  violet: {
    name: 'Violet',
    primary: '#6C2BD9',
    highlight: '#FFD166',
    second: '#D97706',
    third: '#0284C7',
    fourth: '#BE185D',
    text: ['#1A1033', '#3A2E5C', '#5F5680'],
    paper: ['#F7F4FF', '#EFEAFC', '#E6E0F5', '#EAE2FF'],
  },
  emerald: {
    name: 'Emerald',
    primary: '#03684C',
    highlight: '#FDE047',
    second: '#7C3AED',
    third: '#D97706',
    fourth: '#BE185D',
    text: ['#0B2318', '#24402F', '#4F6B5E'],
    paper: ['#F1F8F4', '#E5F2EB', '#DAEBE2', '#D5EEE1'],
  },
  magenta: {
    name: 'Magenta',
    primary: '#A21CAF',
    highlight: '#FDE68A',
    second: '#0284C7',
    third: '#D97706',
    fourth: '#15803D',
    text: ['#2A0B2E', '#4A2A4E', '#6E5470'],
    paper: ['#FDF4FF', '#F6E9F8', '#F0DDF3', '#F5DFF8'],
  },
};

export const MIDNIGHT_IDS = Object.keys(MIDNIGHT) as MidnightId[];
export const ELECTRIC_IDS = Object.keys(ELECTRIC) as ElectricId[];

export type Palette = {
  scheme: Scheme;
  /** "Midnight Lime", "Electric Blue". */
  familyName: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  /** Accent for marks, active states and links on the page. */
  accent: string;
  /** Accent safe to use as text on the page. */
  accentInk: string;
  accentSoft: string;
  /** Text and icons on top of `accent`. */
  onAccent: string;
  /** The family's key colour (Midnight bright / Electric primary). */
  brand: string;
  onBrand: string;
  /** Electric's warm highlight; Midnight uses its bright accent. */
  highlight: string;
  onHighlight: string;
  income: string;
  incomeSoft: string;
  savings: string;
  savingsSoft: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  /** Budget nearly used up, bills due soon, payments to check. */
  warn: string;
  warnSoft: string;
  onWarn: string;
  /** A deep slab for small highlight cards (settings, goals, account page). */
  card: string;
  cardText: string;
  cardMuted: string;
  cardLine: string;
  cardAccent: string;
  cardIncome: string;
  /* ----- The hero card (the big card at the top of Home) ----- */
  hero: string;
  heroText: string;
  heroMuted: string;
  heroValue: string;
  heroTrack: string;
  heroBar: string;
  /** The decorative ring in the top-right corner. */
  heroRing: string;
  /** A small solid circle inside the ring (Electric only; transparent in Midnight). */
  heroOrb: string;
  /** The "23% of income" chip. */
  heroChip: string;
  heroChipText: string;
  /** The two small tiles inside the hero (money in / money out). */
  heroTile: string;
  /* ----- The + button and the logo ----- */
  fab: string;
  onFab: string;
  /** Every colour in the wallet logo (see lib/logo.ts). */
  logo: LogoColors;
  /* ----- Elevation (CSS box-shadow strings, used with the `boxShadow` style) ----- */
  /** Cards and list blocks. */
  shadowCard: string;
  /** The hero card. */
  shadowHero: string;
  /** Floating things: the + button. */
  shadowRaised: string;
  /** Empty chart track and empty calendar cell. */
  track: string;
  scrim: string;
  /** Colours for payment methods and other series, most used first. */
  series: [string, string, string, string, string];
  /** Text/icons on top of series[1..3] badges. */
  onSeries: string;
};

/** Blends two #RRGGBB colours: t = 0 gives [a], t = 1 gives [b]. */
export function mix(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    '#' +
    ca
      .map((v, i) => Math.round(Math.max(0, Math.min(255, v + (cb[i] - v) * t))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/*
 * The wallet logo: a tile, two bills tucked into a wallet, and a clasp with a coin.
 * Light (Electric): brand-coloured tile, white wallet, a gold bill and a gold coin.
 * Dark (Midnight): near-black tile with a glow, bills and wallet in the bright colour.
 * Everything is worked out from the family's key colour, so the logo follows your pick.
 */
export type LogoColors = {
  tileTop: string;
  tileBottom: string;
  tileBorder: string;
  billBack: string;
  billFront: string;
  billCoin: string;
  walletTop: string;
  walletBottom: string;
  /** The hard shadow under the wallet. */
  walletShadow: string;
  walletShadowOpacity: number;
  clasp: string;
  /** The coin on the clasp. */
  dot: string;
  /** Soft glow / drop shadow around the tile at large sizes (box-shadow colour). */
  glow: string;
};

export function logoColors(kind: 'light' | 'dark', key: string, coin: string): LogoColors {
  if (kind === 'light') {
    // A solid brand tile so the logo stands out on light pages and stays clear when small:
    // white wallet, a gold bill and a gold coin (the family's highlight colour).
    return {
      tileTop: mix(key, '#FFFFFF', 0.28),
      tileBottom: mix(key, '#000000', 0.1),
      tileBorder: mix(key, '#000000', 0.06),
      billBack: coin,
      billFront: mix(key, '#FFFFFF', 0.8),
      billCoin: mix(key, '#FFFFFF', 0.3),
      walletTop: '#FFFFFF',
      walletBottom: mix(key, '#FFFFFF', 0.88),
      walletShadow: mix(key, '#000000', 0.45),
      walletShadowOpacity: 1,
      clasp: key,
      dot: coin,
      glow: rgba(key, 0.35),
    };
  }
  return {
    tileTop: '#1E1F22',
    tileBottom: '#0C0C0E',
    tileBorder: mix(key, '#0A0A0B', 0.55),
    billBack: mix(key, '#0A0A0B', 0.35),
    billFront: key,
    billCoin: mix(key, '#0A0A0B', 0.55),
    walletTop: mix(key, '#FFFFFF', 0.62),
    walletBottom: mix(key, '#FFFFFF', 0.28),
    walletShadow: '#000000',
    walletShadowOpacity: 0.35,
    clasp: mix(key, '#0A0A0B', 0.82),
    dot: coin,
    glow: rgba(key, 0.4),
  };
}

/** Adds transparency to a #RRGGBB colour. */
export function alpha(hex: string, a: number): string {
  const n = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return hex.slice(0, 7) + n.toString(16).padStart(2, '0');
}

/** "rgba(r,g,b,a)" from #RRGGBB — box-shadow strings read this form everywhere. */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export function midnightPalette(id: MidnightId): Palette {
  const m = MIDNIGHT[id];
  const [bg, surface, surfaceAlt, line] = m.night;
  return {
    scheme: 'dark',
    familyName: `Midnight ${m.name}`,
    bg,
    surface,
    surfaceAlt,
    ink: '#F4F4F5',
    inkSoft: '#D4D4D8',
    muted: '#A1A1AA',
    line,
    accent: m.bright,
    accentInk: m.bright,
    accentSoft: alpha(m.bright, 0.14),
    onAccent: '#0A0A0B',
    brand: m.bright,
    onBrand: '#0A0A0B',
    highlight: m.bright,
    onHighlight: '#0A0A0B',
    income: '#86EFAC',
    incomeSoft: alpha('#86EFAC', 0.14),
    savings: '#7DD3FC',
    savingsSoft: alpha('#7DD3FC', 0.14),
    danger: '#F87171',
    dangerSoft: alpha('#F87171', 0.14),
    onDanger: '#0A0A0B',
    warn: '#FF8A5B',
    warnSoft: alpha('#FF8A5B', 0.12),
    onWarn: '#0A0A0B',
    card: surfaceAlt,
    cardText: '#F4F4F5',
    cardMuted: '#A1A1AA',
    cardLine: 'rgba(255,255,255,0.10)',
    cardAccent: m.bright,
    cardIncome: '#86EFAC',
    hero: m.bright,
    heroText: '#0A0A0B',
    heroMuted: 'rgba(10,10,11,0.72)',
    heroValue: '#0A0A0B',
    heroTrack: 'rgba(10,10,11,0.16)',
    heroBar: '#0A0A0B',
    heroRing: 'rgba(10,10,11,0.07)',
    heroOrb: 'transparent',
    heroChip: '#0A0A0B',
    heroChipText: m.bright,
    heroTile: 'rgba(10,10,11,0.08)',
    fab: m.bright,
    onFab: '#0A0A0B',
    logo: logoColors('dark', m.bright, '#FFC93C'),
    // On near-black a dark drop shadow barely shows, so cards lean on their border;
    // the hero and the + button get a soft glow in their own colour instead.
    shadowCard: '0px 10px 28px rgba(0,0,0,0.45)',
    shadowHero: `0px 18px 40px -12px ${rgba(m.bright, 0.42)}`,
    shadowRaised: `0px 8px 22px ${rgba(m.bright, 0.35)}`,
    track: line,
    scrim: 'rgba(0,0,0,0.6)',
    series: [m.bright, m.second, m.third, '#F9A8D4', '#71717A'],
    onSeries: '#0A0A0B',
  };
}

export function electricPalette(id: ElectricId): Palette {
  const e = ELECTRIC[id];
  const [ink, inkSoft, muted] = e.text;
  const [bg, surfaceAlt, line, track] = e.paper;
  return {
    scheme: 'light',
    familyName: `Electric ${e.name}`,
    bg,
    surface: '#FFFFFF',
    surfaceAlt,
    ink,
    inkSoft,
    muted,
    line,
    accent: e.primary,
    accentInk: e.primary,
    accentSoft: alpha(e.primary, 0.1),
    onAccent: '#FFFFFF',
    brand: e.primary,
    onBrand: '#FFFFFF',
    highlight: e.highlight,
    onHighlight: ink,
    income: '#15803D',
    incomeSoft: alpha('#15803D', 0.1),
    savings: '#0369A1',
    savingsSoft: alpha('#0369A1', 0.1),
    danger: '#DC2626',
    dangerSoft: alpha('#DC2626', 0.1),
    onDanger: '#FFFFFF',
    warn: '#C2410C',
    warnSoft: alpha('#C2410C', 0.1),
    onWarn: '#FFFFFF',
    card: ink,
    cardText: '#F4F4F5',
    cardMuted: '#B4B9D2',
    cardLine: 'rgba(255,255,255,0.12)',
    cardAccent: e.highlight,
    cardIncome: '#86EFAC',
    hero: e.primary,
    heroText: '#FFFFFF',
    heroMuted: 'rgba(255,255,255,0.86)',
    heroValue: '#FFFFFF',
    heroTrack: 'rgba(255,255,255,0.22)',
    heroBar: e.highlight,
    heroRing: 'rgba(255,255,255,0.13)',
    heroOrb: e.highlight,
    heroChip: e.highlight,
    heroChipText: ink,
    heroTile: 'rgba(255,255,255,0.14)',
    fab: e.primary,
    onFab: '#FFFFFF',
    logo: logoColors('light', e.primary, e.highlight),
    shadowCard: `0px 10px 28px ${rgba(e.primary, 0.09)}`,
    shadowHero: `0px 20px 40px -14px ${rgba(e.primary, 0.55)}`,
    shadowRaised: `0px 10px 22px ${rgba(e.primary, 0.35)}`,
    track,
    scrim: rgba(ink, 0.45),
    series: [e.primary, e.second, e.third, e.fourth, '#8E8E96'],
    onSeries: '#FFFFFF',
  };
}

/** The palette for a scheme, using the family colour picked for that scheme. */
export function buildPalette(scheme: Scheme, midnight: MidnightId, electric: ElectricId): Palette {
  return scheme === 'dark' ? midnightPalette(midnight) : electricPalette(electric);
}

/* ---------- Saved theme choice ---------- */

/** What we save: light/dark/Auto plus one colour for each family. */
export type SavedTheme = { mode: ThemeMode; midnight: MidnightId; electric: ElectricId };

export const THEME_KEY = 'kharcha:theme:v3';
/** v2 kept a light/dark choice that earlier builds set for everyone; v3 starts everyone on Auto once. */
export const V2_THEME_KEY = 'kharcha:theme:v2';
export const LEGACY_THEME_KEY = 'kharcha:theme:v1';

const isMode = (v: unknown): v is ThemeMode => v === 'system' || v === 'light' || v === 'dark';

/** Auto (follow the phone) by default. */
export const DEFAULT_THEME: SavedTheme = { mode: 'system', midnight: 'lime', electric: 'blue' };

/**
 * Reads the saved theme. [raw] is the current (v3) entry. Older entries keep your colours
 * but move you to Auto once, because older builds saved "dark" without you choosing it.
 */
export function parseSavedTheme(raw: string | null, v2: string | null = null, v1: string | null = null): SavedTheme {
  try {
    if (raw) {
      const v = JSON.parse(raw) as Partial<SavedTheme>;
      return {
        mode: isMode(v.mode) ? v.mode : DEFAULT_THEME.mode,
        midnight: v.midnight && v.midnight in MIDNIGHT ? v.midnight : DEFAULT_THEME.midnight,
        electric: v.electric && v.electric in ELECTRIC ? v.electric : DEFAULT_THEME.electric,
      };
    }
    if (v2) {
      const v = JSON.parse(v2) as Partial<SavedTheme>;
      return {
        mode: DEFAULT_THEME.mode,
        midnight: v.midnight && v.midnight in MIDNIGHT ? v.midnight : DEFAULT_THEME.midnight,
        electric: v.electric && v.electric in ELECTRIC ? v.electric : DEFAULT_THEME.electric,
      };
    }
    if (v1) {
      // v1 saved { accent, mode } where accent was a Midnight colour.
      const v = JSON.parse(v1) as { accent?: string; mode?: string };
      return {
        mode: DEFAULT_THEME.mode,
        midnight: v.accent && v.accent in MIDNIGHT ? (v.accent as MidnightId) : DEFAULT_THEME.midnight,
        electric: DEFAULT_THEME.electric,
      };
    }
  } catch {
    // fall through
  }
  return DEFAULT_THEME;
}

/* ------------------------------------------------------------------ */
/* Notices: the rows that tell you something (bills due, things to    */
/* check, sample data). One tone decides every colour in the row.      */
/* ------------------------------------------------------------------ */

/**
 * - neutral: plain info (next card bill when nothing is urgent)
 * - accent:  an invitation (set a budget)
 * - info:    app status (sample data, SMS reading off)
 * - warn:    needs you soon (payments to check, bill due in a few days)
 * - danger:  something is late or wrong (bill overdue)
 */
export type NoticeTone = 'neutral' | 'accent' | 'info' | 'warn' | 'danger';
export const NOTICE_TONES: NoticeTone[] = ['neutral', 'accent', 'info', 'warn', 'danger'];

export type NoticeColors = {
  /** warn and danger get a tinted card; the rest sit on a normal card with a shadow. */
  tinted: boolean;
  cardBg: string;
  border: string;
  shadow: string | undefined;
  /** The square icon tile on the left. */
  tileBg: string;
  tileFg: string;
  /** The small label pill on the right ("Review", "8 days"). */
  pillBg: string;
  pillFg: string;
};

export function noticeColors(p: Palette, tone: NoticeTone): NoticeColors {
  if (tone === 'warn' || tone === 'danger') {
    const c = tone === 'warn' ? p.warn : p.danger;
    return {
      tinted: true,
      cardBg: tone === 'warn' ? p.warnSoft : p.dangerSoft,
      border: alpha(c, p.scheme === 'dark' ? 0.32 : 0.26),
      shadow: undefined,
      tileBg: c,
      tileFg: tone === 'warn' ? p.onWarn : p.onDanger,
      pillBg: p.surface,
      pillFg: c,
    };
  }
  const tile =
    tone === 'accent'
      ? { tileBg: p.accentSoft, tileFg: p.accentInk }
      : tone === 'info'
        ? { tileBg: p.savingsSoft, tileFg: p.savings }
        : { tileBg: p.surfaceAlt, tileFg: p.ink };
  return {
    tinted: false,
    cardBg: p.surface,
    border: p.line,
    shadow: p.shadowCard,
    ...tile,
    pillBg: tone === 'neutral' ? p.surfaceAlt : tile.tileBg,
    pillFg: tone === 'neutral' ? p.ink : tile.tileFg,
  };
}
