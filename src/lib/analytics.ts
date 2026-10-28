import { countsAsIncome, countsAsSpend, type CategoryId, type PayMode, type Txn } from './types';

/** A month written as { year, month } where month is 0-11 (like JS Date). */
export type Month = { year: number; month: number };

export const monthOf = (ts: number): Month => {
  const d = new Date(ts);
  return { year: d.getFullYear(), month: d.getMonth() };
};
export const thisMonth = (): Month => monthOf(Date.now());
export const sameMonth = (a: Month, b: Month) => a.year === b.year && a.month === b.month;
export const addMonths = (m: Month, n: number): Month => {
  const d = new Date(m.year, m.month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};
export const monthKey = (m: Month) => `${m.year}-${String(m.month + 1).padStart(2, '0')}`;
export const parseMonthKey = (k: string | undefined): Month | null => {
  const hit = /^(\d{4})-(\d{2})$/.exec(k ?? '');
  return hit ? { year: Number(hit[1]), month: Number(hit[2]) - 1 } : null;
};
export const daysInMonth = (m: Month) => new Date(m.year, m.month + 1, 0).getDate();
export const isAfter = (a: Month, b: Month) => a.year > b.year || (a.year === b.year && a.month > b.month);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthName = (m: Month) => `${MONTHS[m.month]} ${m.year}`;
export const monthShort = (m: Month) => MONTHS_SHORT[m.month];

/** "Today", "Yesterday", or "Sat, 24 Oct". */
export function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const base = `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function timeLabel(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

export const dateKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type CategorySlice = { category: CategoryId; amount: number; count: number; share: number };
export type MerchantStat = { name: string; key: string; amount: number; count: number; category: CategoryId };
export type ModeStat = { mode: PayMode; amount: number; count: number; share: number };

export type MonthSummary = {
  month: Month;
  spent: number;
  received: number;
  spendCount: number;
  byCategory: CategorySlice[];
  /** Day of month (1..31) → amount spent. */
  byDay: Record<number, number>;
  byMode: ModeStat[];
  topMerchants: MerchantStat[];
  biggest: Txn | null;
  avgPerDay: number;
  daysCounted: number;
  /** Every transaction in this month, newest first. */
  txns: Txn[];
};

function groupBy<T, K extends string | number>(list: T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const sum = (list: Txn[]) => list.reduce((a, t) => a + t.amount, 0);

export function summarize(all: Txn[], month: Month): MonthSummary {
  const inMonth = all.filter((t) => sameMonth(monthOf(t.timestamp), month));
  const spends = inMonth.filter(countsAsSpend);
  const spent = sum(spends);
  const received = sum(inMonth.filter(countsAsIncome));

  const byCategory: CategorySlice[] = [...groupBy(spends, (t) => t.category)]
    .map(([category, list]) => {
      const amount = sum(list);
      return { category, amount, count: list.length, share: spent > 0 ? amount / spent : 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const byDay: Record<number, number> = {};
  for (const t of spends) {
    const day = new Date(t.timestamp).getDate();
    byDay[day] = (byDay[day] ?? 0) + t.amount;
  }

  const byMode: ModeStat[] = [...groupBy(spends, (t) => t.mode)]
    .map(([mode, list]) => {
      const amount = sum(list);
      return { mode, amount, count: list.length, share: spent > 0 ? amount / spent : 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const topMerchants: MerchantStat[] = [...groupBy(spends, (t) => t.merchantKey || t.merchant)]
    .map(([key, list]) => {
      const counts = new Map<CategoryId, number>();
      for (const t of list) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      const category = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      return { name: list[0].merchant, key: String(key), amount: sum(list), count: list.length, category };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const now = thisMonth();
  const days = sameMonth(month, now) ? new Date().getDate() : isAfter(month, now) ? 1 : daysInMonth(month);

  let biggest: Txn | null = null;
  for (const t of spends) if (!biggest || t.amount > biggest.amount) biggest = t;

  return {
    month,
    spent,
    received,
    spendCount: spends.length,
    byCategory,
    byDay,
    byMode,
    topMerchants,
    biggest,
    avgPerDay: days > 0 ? spent / days : 0,
    daysCounted: days,
    txns: [...inMonth].sort((a, b) => b.timestamp - a.timestamp),
  };
}

/** Spending for [count] months ending at [end], oldest first. */
export function trend(all: Txn[], end: Month, count = 6): { month: Month; spent: number }[] {
  const totals = new Map<string, number>();
  for (const t of all) {
    if (!countsAsSpend(t)) continue;
    const k = monthKey(monthOf(t.timestamp));
    totals.set(k, (totals.get(k) ?? 0) + t.amount);
  }
  const out: { month: Month; spent: number }[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const m = addMonths(end, -back);
    out.push({ month: m, spent: totals.get(monthKey(m)) ?? 0 });
  }
  return out;
}

/** Spending per weekday, Monday first. */
export function byWeekday(txns: Txn[]): { label: string; amount: number }[] {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  for (const t of txns) {
    if (!countsAsSpend(t)) continue;
    const jsDay = new Date(t.timestamp).getDay(); // 0 = Sunday
    sums[(jsDay + 6) % 7] += t.amount;
  }
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, amount: sums[i] }));
}

export function percentChange(now: number, before: number): number | null {
  if (before <= 0) return null;
  return ((now - before) / before) * 100;
}
