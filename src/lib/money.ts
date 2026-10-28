/** Money formatting in any currency: ₹1,23,456 · $123,456.78 · short forms like ₹1.2L or $1.2M. */
import { CURRENCIES, getHomeCurrency, isCurrencyCode, type CurrencyCode } from './currency';

/** 1234567 → "12,34,567" (Indian grouping). */
export function group(n: number): string {
  const s = Math.trunc(Math.abs(n)).toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

/** 1234567 → "1,234,567". */
export function groupWestern(n: number): string {
  return Math.trunc(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const resolve = (c?: string | null): CurrencyCode => (isCurrencyCode(c) ? c : getHomeCurrency());

export type MoneyOptions = {
  /** Which currency. Leave out for the home currency. */
  currency?: string | null;
  /** true: always show cents. false: never. Default: the currency's habit (cents for $, none for ₹). */
  decimals?: boolean;
};

/**
 * Formats an amount. Safe with any number: NaN/Infinity show as 0, -0 shows as 0,
 * and rounding never prints "$0.995".
 */
export function money(amount: number, opts: MoneyOptions = {}): string {
  const info = CURRENCIES[resolve(opts.currency)];
  const n = Number.isFinite(amount) ? amount : 0;
  const showCents = info.minor > 0 && (opts.decimals ?? info.cents);
  const scale = showCents ? 100 : 1;
  const units = Math.round(Math.abs(n) * scale);
  const negative = n < 0 && units > 0;
  const whole = Math.floor(units / scale);
  const cents = units % scale;
  const g = info.grouping === 'indian' ? group(whole) : groupWestern(whole);
  // Cents only when there are some; "$12" reads better than "$12.00" in lists. Totals stay consistent
  // because a total with cents shows them.
  const text = showCents && cents !== 0 ? `${g}.${String(cents).padStart(2, '0')}` : g;
  return `${negative ? '-' : ''}${info.symbol}${text}`;
}

/** The home currency's sign, for input fields: "₹", "$". */
export function currencySymbol(currency?: string | null): string {
  return CURRENCIES[resolve(currency)].symbol.trim();
}

const trim1 = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** Short form for tight spots (chart labels): ₹950 · ₹12.5k · ₹3.2L · ₹1.1Cr · $12.5K · $3.2M · $1.1B. */
export function moneyCompact(amount: number, currency?: string | null): string {
  const info = CURRENCIES[resolve(currency)];
  const n = Number.isFinite(amount) ? amount : 0;
  const v = Math.abs(n);
  const sign = n < 0 && Math.round(v) > 0 ? '-' : '';
  const s = info.symbol;
  if (info.compact === 'indian') {
    if (v < 1_000) return `${sign}${s}${Math.round(v)}`;
    if (v < 1_00_000) return `${sign}${s}${trim1(v / 1_000)}k`;
    if (v < 1_00_00_000) return `${sign}${s}${trim1(v / 1_00_000)}L`;
    return `${sign}${s}${trim1(v / 1_00_00_000)}Cr`;
  }
  if (v < 1_000) return `${sign}${s}${Math.round(v)}`;
  if (v < 1_000_000) return `${sign}${s}${trim1(v / 1_000)}K`;
  if (v < 1_000_000_000) return `${sign}${s}${trim1(v / 1_000_000)}M`;
  return `${sign}${s}${trim1(v / 1_000_000_000)}B`;
}

/** A plain count with the home currency's grouping: 1,00,000 or 100,000. */
export function formatCount(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return (v < 0 ? '-' : '') + (CURRENCIES[getHomeCurrency()].grouping === 'indian' ? group(v) : groupWestern(v));
}

export function percent(v: number): string {
  if (!Number.isFinite(v)) return '0%';
  if (v > 0 && v < 0.01) return '<1%';
  if (v >= 100) return '>9,999%';
  return `${Math.round(v * 100)}%`;
}
