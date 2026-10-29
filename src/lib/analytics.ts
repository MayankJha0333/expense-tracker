import { monthFirstDates } from './currency';
import { money } from './money';
import { cat, countsAsIncome, countsAsSaving, countsAsSpend, type CategoryId, type IconName, type PayMode, type Txn } from './types';

/** A month written as { year, month } where month is 0-11 (like JS Date). */
export type Month = { year: number; month: number };

/**
 * The day of the calendar month a "month" starts on, 1-28. People paid on the
 * 5th or 7th can start their month there so salary and the spending it pays
 * for land in the same month. A month is named after the calendar month it
 * starts in: with a start of 7, "October" runs 7 Oct to 6 Nov.
 */
let cycleStart = 1;
export const MONTH_START_MAX = 28;
export const clampMonthStart = (day: number) => (Number.isFinite(day) ? Math.min(MONTH_START_MAX, Math.max(1, Math.round(day))) : 1);
export const getMonthStart = () => cycleStart;
/** Set for the whole app before render, like the home currency. */
export function setMonthStart(day: number) {
  cycleStart = clampMonthStart(day);
}

/** Midnight on the first day of [m]. */
export const monthStartDate = (m: Month) => new Date(m.year, m.month, cycleStart);
/** Midnight on the first day of the next month, so the end is exclusive. */
export const monthEndDate = (m: Month) => new Date(m.year, m.month + 1, cycleStart);

export const monthOf = (ts: number): Month => {
  const d = new Date(ts);
  const back = d.getDate() < cycleStart ? 1 : 0;
  const first = new Date(d.getFullYear(), d.getMonth() - back, 1);
  return { year: first.getFullYear(), month: first.getMonth() };
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
/** Days between [a] and [b] at midnight, safe across daylight saving changes. */
const daysBetween = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
export const daysInMonth = (m: Month) => daysBetween(monthStartDate(m), monthEndDate(m));
/** Which day of its month [ts] falls on, 1-based. With a start of 7, 7 Oct is day 1. */
export const dayOfMonth = (ts: number) => {
  const d = new Date(ts);
  return daysBetween(monthStartDate(monthOf(ts)), new Date(d.getFullYear(), d.getMonth(), d.getDate())) + 1;
};
export const isAfter = (a: Month, b: Month) => a.year > b.year || (a.year === b.year && a.month > b.month);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthShort = (m: Month) => MONTHS_SHORT[m.month];

const dayMon = (d: Date) => (monthFirstDates() ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`);

/** "7 Oct – 6 Nov", the dates a month covers. */
export function monthRange(m: Month): string {
  const end = monthEndDate(m);
  end.setDate(end.getDate() - 1);
  return `${dayMon(monthStartDate(m))} – ${dayMon(end)}`;
}

/**
 * The month as people say it: "October", or "7 Oct – 6 Nov" when months start
 * later than the 1st. No year.
 */
export const monthTitle = (m: Month) => (cycleStart === 1 ? MONTHS[m.month] : monthRange(m));

/** "October 2026", or "7 Oct – 6 Nov" (with the year when it is not this year). */
export function monthName(m: Month): string {
  if (cycleStart === 1) return `${MONTHS[m.month]} ${m.year}`;
  return m.year === thisMonth().year ? monthRange(m) : `${monthRange(m)} ${m.year}`;
}

/** "15 Nov" or "Nov 15" (US). [long] gives "15 November". */
export function shortDay(ts: number, long = false): string {
  const d = new Date(ts);
  const mon = (long ? MONTHS : MONTHS_SHORT)[d.getMonth()];
  return monthFirstDates() ? `${mon} ${d.getDate()}` : `${d.getDate()} ${mon}`;
}

/** "Nov 2026". */
export const monthYear = (ts: number) => {
  const d = new Date(ts);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

/** "Today", "Yesterday", or "Sat, 24 Oct". */
export function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const base = `${DAYS_SHORT[d.getDay()]}, ${shortDay(ts)}`;
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

export type IncomeSource = { name: string; key: string; amount: number; count: number; category: CategoryId; share: number };

export type MonthSummary = {
  month: Month;
  spent: number;
  received: number;
  /** Put into investments and SIPs. Part of what you saved, not spending. */
  invested: number;
  /** received - spent. Negative when you spent more than came in. */
  saved: number;
  /** saved / received, or null when nothing came in. */
  savingsRate: number | null;
  spendCount: number;
  incomeCount: number;
  incomeByCategory: CategorySlice[];
  incomeSources: IncomeSource[];
  byCategory: CategorySlice[];
  /** Day of the month (1 = the month's first day, see dayOfMonth) → amount spent. */
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
  const incomes = inMonth.filter(countsAsIncome);
  const received = sum(incomes);
  const invested = sum(inMonth.filter(countsAsSaving));
  const saved = received - spent;

  const incomeByCategory: CategorySlice[] = [...groupBy(incomes, (t) => t.category)]
    .map(([category, list]) => {
      const amount = sum(list);
      return { category, amount, count: list.length, share: received > 0 ? amount / received : 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeSources: IncomeSource[] = [...groupBy(incomes, (t) => t.merchantKey || t.merchant)]
    .map(([key, list]) => {
      const amount = sum(list);
      return { name: list[0].merchant, key: String(key), amount, count: list.length, category: list[0].category, share: received > 0 ? amount / received : 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const byCategory: CategorySlice[] = [...groupBy(spends, (t) => t.category)]
    .map(([category, list]) => {
      const amount = sum(list);
      return { category, amount, count: list.length, share: spent > 0 ? amount / spent : 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const byDay: Record<number, number> = {};
  for (const t of spends) {
    const day = dayOfMonth(t.timestamp);
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
  const days = sameMonth(month, now) ? dayOfMonth(Date.now()) : isAfter(month, now) ? 1 : daysInMonth(month);

  let biggest: Txn | null = null;
  for (const t of spends) if (!biggest || t.amount > biggest.amount) biggest = t;

  return {
    month,
    spent,
    received,
    invested,
    saved,
    savingsRate: received > 0 ? saved / received : null,
    spendCount: spends.length,
    incomeCount: incomes.length,
    incomeByCategory,
    incomeSources,
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

export type FlowMonth = { month: Month; income: number; spent: number; saved: number; invested: number };

/** Money in, money out and what was left, for [count] months ending at [end], oldest first. */
export function cashflow(all: Txn[], end: Month, count = 6): FlowMonth[] {
  const totals = new Map<string, FlowMonth>();
  const out: FlowMonth[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const m = addMonths(end, -back);
    const row = { month: m, income: 0, spent: 0, saved: 0, invested: 0 };
    totals.set(monthKey(m), row);
    out.push(row);
  }
  for (const t of all) {
    const row = totals.get(monthKey(monthOf(t.timestamp)));
    if (!row) continue;
    if (countsAsSpend(t)) row.spent += t.amount;
    else if (countsAsIncome(t)) row.income += t.amount;
    else if (countsAsSaving(t)) row.invested += t.amount;
  }
  for (const row of out) row.saved = row.income - row.spent;
  return out;
}

export type Recurring = { name: string; key: string; category: CategoryId; amount: number; months: number; lastTs: number };

/**
 * Payments to the same place in at least 3 of the last 4 months, for about the
 * same amount: rent, bills, subscriptions, SIPs.
 */
export function recurring(all: Txn[], end: Month): Recurring[] {
  const window = new Set([0, 1, 2, 3].map((b) => monthKey(addMonths(end, -b))));
  const byMerchant = groupBy(
    all.filter((t) => t.type === 'debit' && !t.excluded && (countsAsSpend(t) || countsAsSaving(t)) && window.has(monthKey(monthOf(t.timestamp)))),
    (t) => t.merchantKey || t.merchant,
  );
  const out: Recurring[] = [];
  for (const [key, list] of byMerchant) {
    const perMonth = groupBy(list, (t) => monthKey(monthOf(t.timestamp)));
    if (perMonth.size < 3) continue;
    // Several payments a month (food delivery, cabs) are habits, not fixed bills.
    if (list.length > perMonth.size + 1) continue;
    const amounts = list.map((t) => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (Math.max(...amounts) > avg * 1.4 || Math.min(...amounts) < avg * 0.6) continue;
    const last = list.reduce((a, t) => (t.timestamp > a.timestamp ? t : a), list[0]);
    out.push({ name: last.merchant, key: String(key), category: last.category, amount: avg, months: perMonth.size, lastTs: last.timestamp });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** How the month is going against a spending budget. */
export function budgetPace(summary: MonthSummary, budget: number) {
  const days = daysInMonth(summary.month);
  const current = sameMonth(summary.month, thisMonth());
  const projected = current ? (summary.spent / Math.max(1, summary.daysCounted)) * days : summary.spent;
  const left = budget - summary.spent;
  const daysLeft = current ? days - summary.daysCounted : 0;
  return {
    used: budget > 0 ? summary.spent / budget : 0,
    left,
    projected,
    daysLeft,
    perDayLeft: daysLeft > 0 && left > 0 ? left / daysLeft : 0,
    onTrack: projected <= budget,
  };
}

export type Insight = { id: string; icon: IconName; tone: 'good' | 'warn' | 'info'; title: string; body: string };

/** A few plain-language facts about the month, most useful first. */
export function insights(now: MonthSummary, prev: MonthSummary, flow: FlowMonth[]): Insight[] {
  const out: Insight[] = [];
  const name = monthShort(now.month);
  const prevName = monthShort(prev.month);
  const rupees = (v: number) => money(v, { decimals: false });

  if (now.savingsRate !== null) {
    const rate = Math.round(now.savingsRate * 100);
    if (rate >= 20) {
      out.push({ id: 'rate', icon: 'piggy-bank-outline', tone: 'good', title: `You kept ${rate}% of what came in`, body: `${rupees(now.saved)} left over in ${name}. Saving 20% or more is a strong habit.` });
    } else if (rate < 0) {
      out.push({ id: 'rate', icon: 'alert-circle-outline', tone: 'warn', title: `Spent ${rupees(-now.saved)} more than came in`, body: `Money out was higher than money in for ${name}. Check the big categories below.` });
    } else {
      out.push({ id: 'rate', icon: 'piggy-bank-outline', tone: 'info', title: `You kept ${rate}% of your income`, body: `${rupees(now.saved)} left over so far in ${name}.` });
    }
  }

  const prevBy = new Map(prev.byCategory.map((c) => [c.category, c.amount]));
  let rise: { c: CategoryId; diff: number; pct: number } | null = null;
  let drop: { c: CategoryId; diff: number; pct: number } | null = null;
  for (const c of now.byCategory) {
    const before = prevBy.get(c.category) ?? 0;
    if (before < 500) continue;
    const diff = c.amount - before;
    const pct = (diff / before) * 100;
    if (diff > 0 && pct >= 15 && (!rise || diff > rise.diff)) rise = { c: c.category, diff, pct };
    if (diff < 0 && pct <= -15 && (!drop || diff < drop.diff)) drop = { c: c.category, diff, pct };
  }
  if (rise) out.push({ id: 'rise', icon: 'trending-up', tone: 'warn', title: `${cat(rise.c).label} is up ${Math.round(rise.pct)}%`, body: `${rupees(rise.diff)} more than in ${prevName}.` });
  if (drop) out.push({ id: 'drop', icon: 'trending-down', tone: 'good', title: `${cat(drop.c).label} is down ${Math.round(-drop.pct)}%`, body: `${rupees(-drop.diff)} less than in ${prevName}. Nice.` });

  const top = now.byCategory[0];
  if (top && now.spent > 0) {
    out.push({ id: 'top', icon: cat(top.category).icon, tone: 'info', title: `${cat(top.category).label} takes ${Math.round(top.share * 100)}% of spending`, body: `${rupees(top.amount)} across ${top.count} ${top.count === 1 ? 'payment' : 'payments'}.` });
  }

  const past = flow.slice(0, -1).filter((f) => f.income > 0);
  if (past.length >= 2 && now.received > 0) {
    const avgIncome = past.reduce((a, f) => a + f.income, 0) / past.length;
    if (now.received > avgIncome * 1.1) {
      out.push({ id: 'income', icon: 'cash-plus', tone: 'good', title: 'More money came in than usual', body: `${rupees(now.received - avgIncome)} above your ${past.length}-month average.` });
    }
  }

  if (now.invested > 0) {
    out.push({ id: 'invested', icon: 'chart-line', tone: 'good', title: `${rupees(now.invested)} went into investments`, body: 'SIPs and investments count as savings here, not spending.' });
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
