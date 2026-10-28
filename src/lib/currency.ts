/*
 * Currencies. Pure logic, no React, so tests can run it.
 *
 * - Every payment can carry its own currency (read from the SMS: ₹/Rs/INR, $/USD, €, £ …).
 * - The app has one "home" currency. Totals only add up payments in the home currency,
 *   because Kharcha works offline and has no exchange rates. Payments in other currencies
 *   still show in lists, in their own currency, and Home says they are left out.
 * - Home currency = your choice in Settings, or (Auto) the currency most of your payments use,
 *   or your phone's region when there are no payments yet.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'CAD' | 'AUD' | 'JPY';

export type CurrencyInfo = {
  code: CurrencyCode;
  /** What goes in front of the number. */
  symbol: string;
  name: string;
  /** Indian grouping (1,00,000) or the usual 3-digit grouping (100,000). */
  grouping: 'indian' | 'western';
  /** Digits after the point. JPY has none. */
  minor: 0 | 2;
  /** Show cents on everyday amounts? INR rounds to whole rupees, like the bank apps. */
  cents: boolean;
  /** Short forms: k / L / Cr (India) or K / M / B. */
  compact: 'indian' | 'western';
};

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian rupee', grouping: 'indian', minor: 2, cents: false, compact: 'indian' },
  USD: { code: 'USD', symbol: '$', name: 'US dollar', grouping: 'western', minor: 2, cents: true, compact: 'western' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', grouping: 'western', minor: 2, cents: true, compact: 'western' },
  GBP: { code: 'GBP', symbol: '£', name: 'British pound', grouping: 'western', minor: 2, cents: true, compact: 'western' },
  AED: { code: 'AED', symbol: 'AED\u00A0', name: 'UAE dirham', grouping: 'western', minor: 2, cents: true, compact: 'western' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', grouping: 'western', minor: 2, cents: true, compact: 'western' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian dollar', grouping: 'western', minor: 2, cents: true, compact: 'western' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian dollar', grouping: 'western', minor: 2, cents: true, compact: 'western' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese yen', grouping: 'western', minor: 0, cents: false, compact: 'western' },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export const isCurrencyCode = (v: unknown): v is CurrencyCode => typeof v === 'string' && v in CURRENCIES;

/** "Auto" or a fixed currency, as saved in Settings. */
export type CurrencySetting = 'auto' | CurrencyCode;

/* ---------- the home currency (set by the store, read by formatting and totals) ---------- */

let home: CurrencyCode = 'INR';

export function setHomeCurrency(code: CurrencyCode): void {
  home = code;
}

export function getHomeCurrency(): CurrencyCode {
  return home;
}

/** A payment's currency. Old saved payments have none: they are in the home currency. */
export function currencyOf(t: { currency?: string | null }): CurrencyCode {
  return isCurrencyCode(t.currency) ? t.currency : home;
}

/** Only these payments go into totals. */
export function inHome(t: { currency?: string | null }): boolean {
  return currencyOf(t) === home;
}

/** US and Canadian dates put the month first ("Nov 15"); everyone else the day ("15 Nov"). */
export function monthFirstDates(): boolean {
  return home === 'USD' || home === 'CAD';
}

/* ---------- picking the home currency ---------- */

const REGION_CURRENCY: Record<string, CurrencyCode> = {
  IN: 'INR', US: 'USD', PR: 'USD', GB: 'GBP', AE: 'AED', SG: 'SGD', CA: 'CAD', AU: 'AUD', JP: 'JPY',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR',
  FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', MT: 'EUR',
  CY: 'EUR', HR: 'EUR',
};

/** "en-US", "en_IN", "hi-IN-u-nu-latn" → its currency, or null. */
export function currencyForLocale(locale: string | null | undefined): CurrencyCode | null {
  if (!locale) return null;
  const parts = locale.replace(/_/g, '-').split('-');
  for (const part of parts.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part)) return REGION_CURRENCY[part.toUpperCase()] ?? null;
  }
  return null;
}

/**
 * The currency used by most recent payments. Ignores payments with no currency
 * (old saved ones and hand-added ones made before this existed).
 */
export function mostUsedCurrency(txns: { currency?: string | null; timestamp: number }[], now = Date.now()): CurrencyCode | null {
  const since = now - 120 * 86_400_000;
  const counts = new Map<CurrencyCode, number>();
  for (const t of txns) {
    if (t.timestamp < since || !isCurrencyCode(t.currency)) continue;
    counts.set(t.currency, (counts.get(t.currency) ?? 0) + 1);
  }
  let best: CurrencyCode | null = null;
  let bestCount = 0;
  for (const [code, n] of counts) {
    if (n > bestCount) [best, bestCount] = [code, n];
  }
  return best;
}

export function pickHomeCurrency(
  setting: CurrencySetting,
  txns: { currency?: string | null; timestamp: number }[],
  deviceLocale: string | null,
  now = Date.now(),
): CurrencyCode {
  if (setting !== 'auto') return setting;
  return mostUsedCurrency(txns, now) ?? currencyForLocale(deviceLocale) ?? 'INR';
}

/* ---------- reading currencies in SMS ---------- */

/** Words and signs that name a currency, longest first so "US$" wins over "$". */
const TOKENS: [string, CurrencyCode][] = [
  ['rupees', 'INR'], ['rs.', 'INR'], ['rs', 'INR'], ['inr', 'INR'], ['₹', 'INR'],
  ['us$', 'USD'], ['usd', 'USD'], ['s$', 'SGD'], ['sgd', 'SGD'], ['ca$', 'CAD'], ['c$', 'CAD'], ['cad', 'CAD'],
  ['a$', 'AUD'], ['aud', 'AUD'], ['$', 'USD'],
  ['eur', 'EUR'], ['€', 'EUR'], ['gbp', 'GBP'], ['£', 'GBP'], ['aed', 'AED'], ['dhs', 'AED'], ['jpy', 'JPY'], ['¥', 'JPY'],
];

export function currencyFromToken(token: string): CurrencyCode | null {
  const t = token.trim().toLowerCase();
  return TOKENS.find(([k]) => k === t)?.[1] ?? null;
}

/** Regex source matching any currency token (used by the SMS reader). */
export const CURRENCY_TOKEN_SOURCE = String.raw`(?:\brupees|\brs\.?|\binr|₹|\bus\$|\busd|\bs\$|\bsgd|\bca\$|\bc\$|\bcad|\ba\$|\baud|\$|\beur|€|\bgbp|£|\baed|\bdhs|\bjpy|¥)`;
/** Codes written after the number: "12.50 USD". */
export const CURRENCY_CODE_AFTER_SOURCE = String.raw`(?:inr|usd|eur|gbp|aed|sgd|cad|aud|jpy)\b`;

/**
 * "1,234.56" / "1.234,56" / "12,50" / "1,00,000" → a number.
 * A comma followed by exactly 1-2 digits at the end is a decimal comma, except in rupees
 * (Indian SMS never use decimal commas).
 */
export function parseAmountText(raw: string, currency: CurrencyCode | null): number {
  let s = raw.trim().replace(/[.,]$/, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // Whichever comes last is the decimal mark.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    if (currency !== 'INR' && currency !== null && /,\d{1,2}$/.test(s) && !/,\d{3},/.test(s)) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot && (s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : NaN;
}
