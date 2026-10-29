import { monthOf, sameMonth, type Month } from './analytics';
import { inHome } from './currency';
import { cat, countsAsIncome, countsAsSpend, type CardBill, type CategoryId, type PayMode, type Txn } from './types';

/*
 * How you paid, and with what.
 * Groups each payment by method (UPI, card, cash...) and by the card or bank
 * account it came from (read from the last digits in the SMS), and matches
 * credit card statements to the payments made against them.
 */

const DAY = 86_400_000;

/* ---------- payment methods ---------- */

export type PayGroup = 'upi' | 'card' | 'cash' | 'netbanking' | 'other';

/** Fixed order, so each method keeps the same colour everywhere. */
export const PAY_GROUPS: PayGroup[] = ['upi', 'card', 'cash', 'netbanking', 'other'];

export const PAY_GROUP_LABEL: Record<PayGroup, string> = {
  upi: 'UPI',
  card: 'Card',
  cash: 'Cash',
  netbanking: 'Net banking',
  other: 'Other',
};

export const MODE_TO_GROUP: Record<PayMode, PayGroup> = {
  upi: 'upi',
  card: 'card',
  cash: 'cash',
  atm: 'cash',
  netbanking: 'netbanking',
  wallet: 'other',
  other: 'other',
};

export const payGroupOf = (t: Txn): PayGroup => MODE_TO_GROUP[t.mode] ?? 'other';

/** Index into palette.series for a method. */
export const payGroupColorIndex = (g: PayGroup) => PAY_GROUPS.indexOf(g);

export type PayMixRow = { group: PayGroup; amount: number; count: number; share: number };

/** Spending split by payment method, biggest first. Only methods that were used. */
export function payMix(txns: Txn[]): PayMixRow[] {
  const spends = txns.filter(countsAsSpend);
  const total = spends.reduce((a, t) => a + t.amount, 0);
  const rows = new Map<PayGroup, PayMixRow>();
  for (const t of spends) {
    const g = payGroupOf(t);
    const row = rows.get(g) ?? { group: g, amount: 0, count: 0, share: 0 };
    row.amount += t.amount;
    row.count += 1;
    rows.set(g, row);
  }
  for (const row of rows.values()) row.share = total > 0 ? row.amount / total : 0;
  return [...rows.values()].sort((a, b) => b.amount - a.amount);
}

/* ---------- cards and accounts ---------- */

export type InstrumentKind = 'credit_card' | 'debit_card' | 'card' | 'bank' | 'wallet' | 'cash';

const slug = (s: string | null) => (s ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';

// A credit card used over UPI: "Txn Rs.45 On HDFC Bank Card 8429 At gpay-... by UPI",
// or a refund "adjusted against HDFC Bank Credit Card 8429". The money is on the card, not in a bank account.
const CARD_RAIL =
  /\b(?:on|against|to)\s+(?:your\s+)?[A-Za-z ]{0,24}?\bcredit\s*card\s*(?:no\.?\s*)?(?:ending(?:\s+with)?\s*)?(?:x+|\*+)?\d{4}\b|\bon\s+[A-Za-z ]{2,24}?\bcard\s+(?:x+|\*+)?\d{4}\b[\s\S]{0,80}?\bby\s+upi\b/i;

/** Paid with (or refunded to) a card, including a credit card used through UPI. */
export function isCardTxn(t: Txn): boolean {
  if (t.mode === 'card') return true;
  return !t.isManual && t.mode === 'upi' && !!t.account && !!t.rawSms && CARD_RAIL.test(t.rawSms);
}

/** Which card, bank account, wallet or cash a payment belongs to. */
export function instrumentKey(t: Txn): string {
  if (t.isManual) return t.mode === 'card' ? 'card:manual' : t.mode === 'upi' ? 'bank:manual-upi' : 'cash';
  if (isCardTxn(t)) return `card:${slug(t.bank)}:${t.account ?? 'x'}`;
  if (t.mode === 'wallet') return `wallet:${slug(t.bank)}`;
  return `bank:${slug(t.bank)}:${t.account ?? 'x'}`;
}

export const billKey = (b: CardBill) => `card:${slug(b.bank)}:${b.account}`;

const CREDIT_HINT = /\bcredit\s*card\b|\bavl\.?\s*(?:credit\s*)?(?:lmt|limit)\b|\bavailable\s+(?:credit\s+)?limit\b/i;
// A card SMS that shows a bank balance ("Spent Rs.500 From HDFC Bank Card x2232 … Bal Rs.66748") is a debit card.
const DEBIT_HINT = /\bdebit\s*card\b|\bavl\.?\s*bal|\bavailable\s+balance\b|\bbal(?:ance)?\s*:?\s*(?:rs\.?|inr|₹)\s*[0-9]/i;

export type Instrument = {
  key: string;
  kind: InstrumentKind;
  bank: string | null;
  last4: string | null;
  /** "HDFC Bank credit card ••7788", "SBI account ••9876", "Cash". */
  name: string;
  spent: number;
  spendCount: number;
  received: number;
  receivedCount: number;
  /** Everything on it in the period, newest first, counted or not. */
  txns: Txn[];
};

function nameFor(kind: InstrumentKind, bank: string | null, last4: string | null): string {
  const dots = last4 && last4 !== 'x' ? ` ••${last4}` : '';
  const who = bank ?? (kind === 'cash' ? '' : 'Unknown bank');
  switch (kind) {
    case 'credit_card':
      return `${who} credit card${dots}`;
    case 'debit_card':
      return `${who} debit card${dots}`;
    case 'card':
      return `${who} card${dots}`;
    case 'wallet':
      return bank ? `${bank} wallet` : 'Wallet';
    case 'cash':
      return 'Cash';
    default:
      return `${who}${dots}`;
  }
}

/** Card keys known to be credit cards: they have a statement, or their SMS mention a credit limit. */
export function creditCardKeys(all: Txn[], bills: CardBill[]): Set<string> {
  const keys = new Set(bills.map(billKey));
  const lastDigits = new Set(bills.map((b) => b.account));
  for (const t of all) {
    if (!isCardTxn(t) || t.isManual) continue;
    if ((t.rawSms && CREDIT_HINT.test(t.rawSms)) || (t.account && lastDigits.has(t.account))) keys.add(instrumentKey(t));
  }
  return keys;
}

function kindOf(key: string, list: Txn[], credit: Set<string>): InstrumentKind {
  if (key === 'cash') return 'cash';
  if (key.startsWith('wallet:')) return 'wallet';
  if (key.startsWith('bank:')) return 'bank';
  if (credit.has(key)) return 'credit_card';
  if (list.some((t) => t.rawSms && DEBIT_HINT.test(t.rawSms))) return 'debit_card';
  return 'card';
}

/** Every card, account, wallet and cash used in [txns], biggest spender first. */
export function instruments(txns: Txn[], credit: Set<string>): Instrument[] {
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const k = instrumentKey(t);
    const g = groups.get(k);
    if (g) g.push(t);
    else groups.set(k, [t]);
  }
  const out: Instrument[] = [];
  for (const [key, list] of groups) {
    const kind = kindOf(key, list, credit);
    const first = list[0];
    const last4 = key === 'cash' || first.isManual ? null : first.account;
    const spends = list.filter(countsAsSpend);
    const incomes = list.filter(countsAsIncome);
    out.push({
      key,
      kind,
      bank: first.isManual ? null : first.bank,
      last4,
      name: first.isManual && key !== 'cash' ? (key === 'card:manual' ? 'Card (added by you)' : 'UPI (added by you)') : nameFor(kind, first.bank, last4),
      spent: spends.reduce((a, t) => a + t.amount, 0),
      spendCount: spends.length,
      received: incomes.reduce((a, t) => a + t.amount, 0),
      receivedCount: incomes.length,
      txns: [...list].sort((a, b) => b.timestamp - a.timestamp),
    });
  }
  return out.sort((a, b) => b.spent - a.spent || b.received - a.received);
}

/** One instrument by key, looking at all payments in a month (or all time when month is null). */
export function instrumentFor(key: string, all: Txn[], credit: Set<string>, month: Month | null): Instrument | null {
  const list = all.filter((t) => instrumentKey(t) === key && (month === null || sameMonth(monthOf(t.timestamp), month)));
  if (list.length === 0) return null;
  return instruments(list, credit)[0] ?? null;
}

/* ---------- credit card bills ---------- */

export type BillStatus = 'paid' | 'partly_paid' | 'due' | 'overdue';

export type CardDue = {
  key: string;
  bank: string | null;
  last4: string;
  name: string;
  bill: CardBill;
  /** Paid towards this bill since the statement. */
  paid: number;
  /** Still to pay (0 when paid). */
  left: number;
  status: BillStatus;
  /** How we know it was paid. */
  paidVia: 'card_alert' | 'bank_payment' | 'marked' | null;
  /** Whole days until the due date (negative = late), or null with no date. */
  daysLeft: number | null;
  /** Spent on this card since the statement: the next bill so far. */
  spentSince: number;
  /** The payments that paid this bill (card alert and/or bank debit), oldest first. */
  paidBy: Txn[];
  /** When it was paid, or null. */
  paidOn: number | null;
  /** Reminders that arrived after it was already paid (safe to ignore). */
  remindersAfterPaid: number;
};

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Days from today to [dueDate], counted in calendar days. */
export function daysUntil(dueDate: number, now: number): number {
  return Math.round((startOfDay(dueDate) - startOfDay(now)) / DAY);
}

/**
 * The latest statement for each credit card and whether it has been paid.
 * Paid means one of:
 * - the card sent a "payment received" alert after the statement (adds up partial payments),
 * - a card bill payment left a bank account for about the same amount (within 1%),
 * - you marked it as paid.
 * Only bills in the home currency are listed, so "₹21,130 to pay" never mixes currencies.
 */
export function cardDues(bills: CardBill[], txns: Txn[], markedPaid: ReadonlySet<string>, now = Date.now()): CardDue[] {
  const latest = new Map<string, CardBill>();
  for (const b of bills) {
    if (!inHome(b)) continue;
    const k = billKey(b);
    const prev = latest.get(k);
    if (!prev || b.statementDate > prev.statementDate) latest.set(k, b);
  }
  const out: CardDue[] = [];
  for (const [key, bill] of latest) {
    const after = txns.filter((t) => t.timestamp >= bill.statementDate && !t.excluded && inHome(t));
    const onCard = after.filter((t) => isCardTxn(t) && t.account === bill.account);
    const cardCredits = onCard.filter((t) => t.type === 'credit' && t.category === 'card_bill');
    const paidOnCard = cardCredits.reduce((a, t) => a + t.amount, 0);
    const tolerance = Math.max(1, bill.amountDue * 0.01);
    const bankPayments = after.filter(
      (t) => t.type === 'debit' && t.category === 'card_bill' && !isCardTxn(t) && Math.abs(t.amount - bill.amountDue) <= tolerance,
    );
    const bankPayment = bankPayments.length > 0;
    // The card alert, plus the bank debit it is linked to (or a bank debit for the same amount).
    const paidBy = [...new Map([...cardCredits, ...bankPayments.slice(0, 1)].map((t) => [t.id, t])).values()].sort((a, b) => a.timestamp - b.timestamp);
    const marked = markedPaid.has(bill.id);
    let paidVia: CardDue['paidVia'] = null;
    let paid = paidOnCard;
    if (marked) paidVia = 'marked';
    else if (paidOnCard >= bill.amountDue - tolerance) paidVia = 'card_alert';
    else if (bankPayment) paidVia = 'bank_payment';
    if (paidVia) paid = Math.max(paid, bill.amountDue);
    const left = Math.max(0, bill.amountDue - paid);
    const daysLeft = bill.dueDate === null ? null : daysUntil(bill.dueDate, now);
    let status: BillStatus;
    if (paidVia || left <= tolerance) status = 'paid';
    else if (daysLeft !== null && daysLeft < 0) status = 'overdue';
    else if (paid > 0) status = 'partly_paid';
    else status = 'due';
    const spentSince = onCard.filter(countsAsSpend).reduce((a, t) => a + t.amount, 0);
    const paidOn = status === 'paid' && paidBy.length ? paidBy[0].timestamp : null;
    out.push({
      key,
      bank: bill.bank,
      last4: bill.account,
      name: nameFor('credit_card', bill.bank, bill.account),
      bill,
      paid,
      left: status === 'paid' ? 0 : left,
      status,
      paidVia,
      daysLeft,
      spentSince,
      paidBy,
      paidOn,
      remindersAfterPaid: paidOn === null ? 0 : (bill.reminders ?? []).filter((r) => r > paidOn).length,
    });
  }
  // Most urgent first: late, then soonest due, then paid.
  const rank = (d: CardDue) => (d.status === 'paid' ? 2 : d.status === 'overdue' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
}

/** Total still to pay on credit cards, and the soonest unpaid bill. */
export function duesSummary(dues: CardDue[]): { total: number; open: CardDue[]; next: CardDue | null } {
  const open = dues.filter((d) => d.status !== 'paid');
  return { total: open.reduce((a, d) => a + d.left, 0), open, next: open[0] ?? null };
}

/* ---------- credit card overview ---------- */

/** A statement older than this is not "the current bill" any more: a newer one was probably missed. */
const STALE_BILL_DAYS = 40;

export type CardSummary = {
  key: string;
  name: string;
  /** The latest bill, or null when no statement was found. */
  due: CardDue | null;
  /** No statement in the last 40 days: we can't tell what is owed right now. */
  stale: boolean;
  /** Still to pay on the current bill. */
  billLeft: number;
  /** Spent since the statement: goes on the next bill. */
  unbilled: number;
  /** billLeft + unbilled: what you owe on this card right now. */
  outstanding: number;
};

export type CardOverview = {
  cards: CardSummary[];
  totalOutstanding: number;
  totalBillLeft: number;
  totalUnbilled: number;
  /** The soonest unpaid bill. */
  next: CardDue | null;
};

/**
 * Every credit card with what you owe on it now: the unpaid part of the latest bill plus what
 * you spent since that statement. Cards with no recent statement are listed but not added up.
 */
export function cardOverview(bills: CardBill[], txns: Txn[], markedPaid: ReadonlySet<string>, now = Date.now()): CardOverview {
  const dues = cardDues(bills, txns, markedPaid, now);
  const credit = creditCardKeys(txns, bills);
  const byKey = new Map(dues.map((d) => [d.key, d]));
  const recent = now - 60 * DAY;
  // Cards with a bill, or used in the last 60 days.
  const keys = new Set([...byKey.keys()]);
  for (const t of txns) if (t.timestamp >= recent && credit.has(instrumentKey(t))) keys.add(instrumentKey(t));
  const cards: CardSummary[] = [];
  for (const key of keys) {
    const due = byKey.get(key) ?? null;
    const stale = !due || now - due.bill.statementDate > STALE_BILL_DAYS * DAY;
    // Only a recent card shows up without a bill; an old card with an old bill and no use is left out.
    const used = txns.some((t) => t.timestamp >= recent && instrumentKey(t) === key);
    if (stale && !used && !(due && due.status !== 'paid')) continue;
    const sample = txns.find((t) => instrumentKey(t) === key);
    const name = due?.name ?? nameFor('credit_card', sample?.bank ?? null, sample?.account ?? null);
    const billLeft = due && !stale ? due.left : 0;
    const unbilled = due && !stale ? due.spentSince : 0;
    cards.push({ key, name, due, stale, billLeft, unbilled, outstanding: billLeft + unbilled });
  }
  const fresh = cards.filter((c) => !c.stale);
  const open = dues.filter((d) => d.status !== 'paid' && cards.some((c) => c.key === d.key && !c.stale));
  return {
    cards: cards.sort((a, b) => Number(a.stale) - Number(b.stale) || b.outstanding - a.outstanding),
    totalOutstanding: fresh.reduce((a, c) => a + c.outstanding, 0),
    totalBillLeft: fresh.reduce((a, c) => a + c.billLeft, 0),
    totalUnbilled: fresh.reduce((a, c) => a + c.unbilled, 0),
    next: open[0] ?? null,
  };
}

/**
 * Card bill payments we could not tie to a bill or to the other side of the payment:
 * money paid to a card from an account we don't see, or a bank payment to a card we don't see.
 * Last 90 days, minus the ones you already checked.
 */
export function cardPaymentsToCheck(txns: Txn[], dues: CardDue[], checked: ReadonlySet<string>, now = Date.now()): Txn[] {
  const matched = new Set(dues.flatMap((d) => d.paidBy.map((t) => t.id)));
  return txns
    .filter(
      (t) =>
        t.category === 'card_bill' &&
        !t.excluded &&
        !t.isManual &&
        t.timestamp >= now - 90 * DAY &&
        !(t.links ?? []).some((l) => l.kind === 'transfer') &&
        !matched.has(t.id) &&
        !checked.has(t.id),
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

/* ---------- payments to check ---------- */

/**
 * Payments Kharcha sorted on its own but couldn't be sure about:
 * spends it could only file under "Other", and money from people that may be
 * income or may be someone paying you back. Picking a category clears them.
 */
export function needsReview(t: Txn): boolean {
  // Linked to another payment (a transfer or refund): Kharcha already knows what it is.
  if (t.excluded || t.categorySource !== 'auto' || (t.links?.length ?? 0) > 0) return false;
  // Maybe paid twice: worth a look whatever the category.
  if (t.maybeDuplicateOf) return true;
  if (t.type === 'debit') return t.category === 'other';
  return t.category === 'received';
}

/* ---------- money in that is not income ---------- */

export type NotCountedReason = 'self_transfer' | 'card_bill' | 'refund_linked' | 'loans' | 'excluded' | 'other';

export const NOT_COUNTED_LABEL: Record<NotCountedReason, string> = {
  self_transfer: 'Moved between your own accounts',
  card_bill: 'Credit card bill payments',
  refund_linked: 'Refunds taken off what you bought',
  loans: 'Loans: lent money back, or borrowed',
  excluded: 'Left out by you',
  other: 'Other money in',
};

export type NotCountedRow = { reason: NotCountedReason; amount: number; count: number };

/** Money that came in but is not counted as income, and why. */
export function notCountedIncome(txns: Txn[]): { total: number; rows: NotCountedRow[] } {
  const rows = new Map<NotCountedReason, NotCountedRow>();
  for (const t of txns) {
    // Other currencies can't be added to this total; they have their own place in Activity.
    if (t.type !== 'credit' || countsAsIncome(t) || !inHome(t)) continue;
    const reason: NotCountedReason = t.excluded
      ? 'excluded'
      : t.netted
        ? 'refund_linked'
        : t.category === 'self_transfer'
        ? 'self_transfer'
        : t.category === 'loans'
        ? 'loans'
        : t.category === 'card_bill'
          ? 'card_bill'
          : 'other';
    const row = rows.get(reason) ?? { reason, amount: 0, count: 0 };
    row.amount += t.amount;
    row.count += 1;
    rows.set(reason, row);
  }
  const list = [...rows.values()].sort((a, b) => b.amount - a.amount);
  return { total: list.reduce((a, r) => a + r.amount, 0), rows: list };
}

/** Category shares for one set of payments (used on a card's page). */
export function categoryTotals(txns: Txn[]): { category: CategoryId; amount: number; count: number; share: number }[] {
  const spends = txns.filter(countsAsSpend);
  const total = spends.reduce((a, t) => a + t.amount, 0);
  const map = new Map<CategoryId, { category: CategoryId; amount: number; count: number; share: number }>();
  for (const t of spends) {
    const row = map.get(t.category) ?? { category: t.category, amount: 0, count: 0, share: 0 };
    row.amount += t.amount;
    row.count += 1;
    map.set(t.category, row);
  }
  for (const r of map.values()) r.share = total > 0 ? r.amount / total : 0;
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/** Short words for where a payment came from: "UPI", "HDFC Bank card ••7788", "Cash". */
export function payLabel(t: Txn): string {
  if (t.isManual) return t.mode === 'card' ? 'Card' : t.mode === 'upi' ? 'UPI' : 'Cash';
  const dots = t.account ? ` ••${t.account}` : '';
  const bankShort = t.bank ? t.bank.replace(/ Bank$/, '') : null;
  switch (t.mode) {
    case 'card':
      return `${bankShort ?? ''}${bankShort ? ' ' : ''}card${dots}`.trim();
    case 'upi':
      return 'UPI';
    case 'atm':
      return 'ATM';
    case 'netbanking':
      return `${bankShort ?? 'Bank'}${dots}`;
    case 'wallet':
      return bankShort ? `${bankShort} wallet` : 'Wallet';
    default:
      return bankShort ? `${bankShort}${dots}` : cat(t.category).label;
  }
}

/** "HDFC Bank credit card ••7788" → "HDFC ••7788", so a bill row fits on one line. */
export function shortCardName(name: string): string {
  return name.replace(/\s*(bank\s+)?credit\s+card\s*/i, ' ').replace(/\s+/g, ' ').trim();
}
