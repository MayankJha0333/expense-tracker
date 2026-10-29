import { addMonths, monthKey, monthOf, sameMonth, type Month } from './analytics';
import { categoryFromMerchant } from './categorize';
import { inHome } from './currency';
import { keyOf } from './parser';
import { countsAsSaving, type ScheduledDebit, type Txn } from './types';

/*
 * SIPs and other investments, read from your bank messages.
 *
 * Banks don't always send a message when a SIP is taken. SBI, for example, sends
 * "UPI AutoPay for Indian Clearing Corporation debit of Rs.5000 is scheduled on 07/10/26"
 * but often no "debited" message after it. Those SIPs are listed as "no payment message
 * found", so you can add them and your savings stay right.
 */

const DAY = 86_400_000;

/** Payments to investment platforms (Groww, Zerodha, mutual funds) by any name. */
export const isInvestmentName = (name: string) => categoryFromMerchant(name) === 'investments';

/** One name per place the money goes, so "MUTUAL FUNDS ICCL" and "Indian Clearing Corp" are the same. */
export function platformOf(name: string): string {
  const k = keyOf(name);
  if (k.includes('groww')) return 'Groww';
  if (k.includes('zerodha') || k.includes('kite')) return 'Zerodha';
  if (k.includes('iccl') || k.includes('indianclearing')) return 'Mutual funds (via ICCL)';
  if (k.includes('upstox')) return 'Upstox';
  if (k.includes('kuvera')) return 'Kuvera';
  if (k.includes('indmoney')) return 'INDmoney';
  return name;
}

export type SipPlan = {
  key: string;
  name: string;
  /** One payment. */
  amount: number;
  /** Payments in a usual month (two SIPs of ₹5,000 = 2). */
  perMonth: number;
  /** Usual day of the month. */
  day: number;
  /** Months with a payment (or a scheduled one) in the last year. */
  months: number;
  last: number;
  /** When the next one is expected: a scheduled date if the bank sent one, else a month after the last. */
  next: number;
  active: boolean;
  from: string | null;
};

export type InvestmentOverview = {
  thisMonth: number;
  last12: number;
  /** Oldest first, 12 months ending with [month]. */
  byMonth: { month: Month; amount: number }[];
  monthsInvested: number;
  platforms: { name: string; amount: number; count: number }[];
  sips: SipPlan[];
  /** SIPs the bank said it will take, still ahead. */
  upcoming: ScheduledDebit[];
  /** SIPs the bank said it would take, with no payment message after them. */
  noDebitSeen: ScheduledDebit[];
  funds: string[];
  /** Investment payments in the last 12 months, newest first. */
  payments: Txn[];
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** The payment a scheduled SIP turned into: same amount, from a day before to four days after. */
function findPayment(s: ScheduledDebit, payments: Txn[], used: Set<string>): Txn | null {
  for (const t of payments) {
    if (used.has(t.id) || Math.abs(t.amount - s.amount) >= 1) continue;
    if (t.timestamp >= s.date - DAY && t.timestamp <= s.date + 5 * DAY) {
      used.add(t.id);
      return t;
    }
  }
  return null;
}

export function investmentOverview(
  txns: Txn[],
  scheduled: ScheduledDebit[],
  funds: string[],
  month: Month,
  ignored: ReadonlySet<string> = new Set(),
  now = Date.now(),
): InvestmentOverview {
  const start = addMonths(month, -11);
  const windowStart = new Date(start.year, start.month, 1).getTime();
  // A month earlier too, so a SIP scheduled on the 1st can still find its payment.
  const from = windowStart - 31 * DAY;
  const payments = txns
    .filter((t) => countsAsSaving(t) && inHome(t) && t.timestamp >= from)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Scheduled SIPs: which became a payment, which are ahead, which never showed a payment.
  const used = new Set<string>();
  const sipSchedules = scheduled.filter((s) => isInvestmentName(s.name) && s.date >= windowStart);
  const upcoming: ScheduledDebit[] = [];
  const noDebitSeen: ScheduledDebit[] = [];
  for (const s of sipSchedules) {
    const paid = findPayment(s, payments, used);
    if (paid) continue;
    if (s.date + 2 * DAY > now) upcoming.push(s);
    else if (!ignored.has(s.id)) noDebitSeen.push(s);
  }

  const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: addMonths(start, i), amount: 0 }));
  const slot = new Map(byMonth.map((b) => [monthKey(b.month), b]));
  for (const t of payments) {
    const b = slot.get(monthKey(monthOf(t.timestamp)));
    if (b) b.amount += t.amount;
  }
  const inWindow = payments.filter((t) => slot.has(monthKey(monthOf(t.timestamp))));

  const platformMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const t of inWindow) {
    const name = platformOf(t.merchant);
    const row = platformMap.get(name) ?? { name, amount: 0, count: 0 };
    row.amount += t.amount;
    row.count += 1;
    platformMap.set(name, row);
  }

  // SIP plans: the same amount to the same place in at least two months (paid, or scheduled by the bank).
  type Event = { at: number; amount: number; name: string; from: string | null };
  const events: Event[] = [
    ...payments.map((t) => ({ at: t.timestamp, amount: t.amount, name: platformOf(t.merchant), from: t.account ? `${t.bank ?? 'Bank'} ••${t.account}` : t.bank })),
    ...noDebitSeen.map((s) => ({ at: s.date, amount: s.amount, name: platformOf(s.name), from: s.bank })),
  ];
  const groups = new Map<string, Event[]>();
  for (const e of events) {
    const k = `${e.name}|${Math.round(e.amount)}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const sips: SipPlan[] = [];
  for (const [key, list] of groups) {
    const perMonthMap = new Map<string, number>();
    for (const e of list) {
      const mk = monthKey(monthOf(e.at));
      perMonthMap.set(mk, (perMonthMap.get(mk) ?? 0) + 1);
    }
    if (perMonthMap.size < 2) continue;
    const last = Math.max(...list.map((e) => e.at));
    const day = median(list.map((e) => new Date(e.at).getDate()));
    const ahead = upcoming.find((s) => platformOf(s.name) === list[0].name && Math.round(s.amount) === Math.round(list[0].amount));
    const lastDate = new Date(last);
    const next = ahead?.date ?? new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, day).getTime();
    sips.push({
      key,
      name: list[0].name,
      amount: list[0].amount,
      perMonth: Math.max(1, median([...perMonthMap.values()])),
      day,
      months: perMonthMap.size,
      last,
      next,
      active: now - last < 62 * DAY,
      from: [...list].sort((a, b) => b.at - a.at)[0].from,
    });
  }

  return {
    thisMonth: byMonth.find((b) => sameMonth(b.month, month))?.amount ?? 0,
    last12: byMonth.reduce((a, b) => a + b.amount, 0),
    byMonth,
    monthsInvested: byMonth.filter((b) => b.amount > 0).length,
    platforms: [...platformMap.values()].sort((a, b) => b.amount - a.amount),
    sips: sips.sort((a, b) => Number(b.active) - Number(a.active) || b.amount * b.perMonth - a.amount * a.perMonth),
    upcoming,
    noDebitSeen: noDebitSeen.sort((a, b) => b.date - a.date),
    funds,
    payments: [...inWindow].reverse(),
  };
}
