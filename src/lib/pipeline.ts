import { categorize } from './categorize';
import {
  coreHeader,
  isPlaceholderName,
  keyOf,
  parseCardNotice,
  parseFailNotice,
  parseFundName,
  parseScheduledDebit,
  parseSms,
  type CardBillDraft,
  type CardNotice,
  type FailNotice,
  type ParsedTxn,
  type RawSms,
} from './parser';
import type { CardBill, ScanStats, ScheduledDebit, SkipReason, Txn } from './types';

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const CARD_BILL_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Same amount, same direction, same account, within 5 minutes, but from a
 * different sender = one payment reported twice (e.g. bank + card network).
 * Two ₹20 chai payments from the same bank stay as two payments.
 */
function isDuplicate(kept: Txn[], p: ParsedTxn, sms: RawSms): boolean {
  const cents = Math.round(p.amount * 100);
  const sender = coreHeader(sms.sender);
  for (let i = kept.length - 1; i >= 0; i--) {
    const t = kept[i];
    if (sms.date - t.timestamp > DUPLICATE_WINDOW_MS) break;
    if ((t.sender ? coreHeader(t.sender) : null) === sender) continue;
    if (
      t.type === p.type &&
      Math.round(t.amount * 100) === cents &&
      (t.currency ?? null) === (p.currency ?? null) &&
      (t.account === null || p.account === null || t.account === p.account)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Banks often confirm one credit card bill payment twice, days apart and from the same sender
 * ("payment received towards your credit card" on the 3rd, "online payment credited to your card" on the 5th).
 * Same card, same exact amount, within 4 days = one payment.
 */
function isRepeatCardBill(kept: Txn[], amount: number, account: string | null, at: number): boolean {
  const cents = Math.round(amount * 100);
  for (let i = kept.length - 1; i >= 0; i--) {
    const t = kept[i];
    if (at - t.timestamp > CARD_BILL_WINDOW_MS) break;
    if (t.category === 'card_bill' && t.type === 'credit' && t.account === account && Math.round(t.amount * 100) === cents) return true;
  }
  return false;
}

const BILL_LINK_WINDOW_MS = 35 * 86_400_000;
const sameBankName = (a: string | null, b: string | null) => !a || !b || keyOf(a).slice(0, 4) === keyOf(b).slice(0, 4);

/**
 * Card bills come in pieces. Since mid-2026 HDFC sends "Statement Generated … XX8429" with no
 * amount, and the amount arrives later in a reminder from an app ("Your HDFC Credit Card bill of
 * Rs.49243 is due on 2026-10-21") that names no card. This puts the pieces together:
 * - a bill without a card number gets the card of the latest statement from that bank (up to 35 days before),
 *   or the bank's only known credit card;
 * - a bill's start is the statement day, so a payment made before the reminder still counts as paying it;
 * - the same bill told several times (statement, reminder, second reminder) is kept once.
 */
export function mergeCardNotices(notices: CardNotice[]): CardBill[] {
  const statements = notices.filter((n): n is Extract<CardNotice, { kind: 'statement' }> => n.kind === 'statement');
  const drafts = notices.filter((n): n is Extract<CardNotice, { kind: 'bill' }> => n.kind === 'bill').map((n) => n.bill);
  const knownCards = new Map<string, Set<string>>();
  const note = (bank: string | null, account: string) => {
    const k = keyOf(bank ?? '').slice(0, 4);
    knownCards.set(k, (knownCards.get(k) ?? new Set()).add(account));
  };
  for (const st of statements) note(st.bank, st.account);
  for (const d of drafts) if (d.account) note(d.bank, d.account);

  const out = new Map<string, CardBill>();
  for (const d of [...drafts].sort((a, b) => a.statementDate - b.statementDate)) {
    const st = statements
      .filter((x) => (d.account ? x.account === d.account : sameBankName(x.bank, d.bank)) && x.date <= d.statementDate && d.statementDate - x.date <= BILL_LINK_WINDOW_MS)
      .sort((a, b) => b.date - a.date)[0];
    let account = d.account ?? st?.account ?? null;
    if (!account) {
      const only = knownCards.get(keyOf(d.bank ?? '').slice(0, 4));
      if (only && only.size === 1) account = [...only][0];
    }
    if (!account) continue;
    const bill: CardBill = { ...(d as CardBillDraft), account, bank: d.bank ?? st?.bank ?? null, statementDate: st ? Math.min(st.date, d.statementDate) : d.statementDate };
    const day = bill.dueDate === null ? 'x' : new Date(bill.dueDate).toDateString();
    const key = `${account}|${Math.round(bill.amountDue)}|${day}`;
    const prev = out.get(key);
    // A bill message that came after its statement (an app reminder) is a reminder too.
    if (!prev) out.set(key, { ...bill, reminders: st && d.statementDate > st.date ? [d.statementDate] : [] });
    else
      out.set(key, {
        ...prev,
        statementDate: Math.min(prev.statementDate, bill.statementDate),
        // d.statementDate is when this message arrived (before it was moved back to the statement day).
        reminders: [...(prev.reminders ?? []), d.statementDate],
      });
  }
  return [...out.values()];
}

// HDFC hides part of the UPI ID in card-on-UPI alerts: "At *1.bd@axisbank". The same shop shows in full
// in other alerts ("At playstore1.bd@axisbank"), so the visible end is often enough to know who it was.
const FULL_VPA = /\b(?:at|to)\s+([a-z0-9][\w.-]{2,}@[a-z]{2,})\b/i;
const MASKED_VPA = /\b(?:at|to)\s+\*([\w.-]{2,}@[a-z]{2,})\b/i;
const NO_NAME = /^(?:upi payment|card payment|payment|.*qr payment)$/i;

/** Names payments to a half-hidden UPI ID after the one shop it can be. Left alone when it could be more than one. */
function nameMaskedPayments(kept: Txn[]) {
  const known: { vpa: string; t: Txn }[] = [];
  for (const t of kept) {
    const m = t.rawSms ? FULL_VPA.exec(t.rawSms) : null;
    // Shops only: a person's UPI ID can share an ending with a shop's ("*line@ybl").
    if (m && !NO_NAME.test(t.merchant) && t.category !== 'people') known.push({ vpa: m[1].toLowerCase(), t });
  }
  for (const t of kept) {
    const m = t.rawSms ? MASKED_VPA.exec(t.rawSms) : null;
    if (!m) continue;
    const tail = m[1].toLowerCase();
    // "*ne@ybl" is too short to tell shops apart; "*1.bd@axisbank" or "*mato@hdfcbank" is enough.
    if (tail.split('@')[0].replace(/[^a-z0-9]/g, '').length < 3) continue;
    const matches = new Map<string, Txn>();
    for (const k of known) if (k.vpa.endsWith(tail)) matches.set(k.t.merchantKey, k.t);
    if (matches.size !== 1) continue;
    const from = [...matches.values()][0];
    t.merchant = from.merchant;
    t.merchantKey = from.merchantKey;
    // Only fill in a guess we didn't have; never change a category that came from the message itself.
    if (t.category === 'other' || t.category === 'people') t.category = from.category;
  }
}

/* ---------- "your payment failed" ---------- */

const MIN = 60_000;
/** An autopay can be taken the night before the shop says it failed. */
const FAIL_BEFORE_WITH_AMOUNT = 24 * 60 * MIN;
/** With no amount, only a payment just before the message can be the one it means. */
const FAIL_BEFORE_NO_AMOUNT = 30 * MIN;
/** The shop's message and the bank's can arrive in either order. */
const FAIL_AFTER = 10 * MIN;
/** Phones stamp messages from different senders a little apart. */
const FAIL_CLOCK_SLACK = 2 * MIN;
/** Same amount this close in time is the same payment, even when the bank names no shop. */
const FAIL_SAME_MOMENT = 15 * MIN;
// Web and company words around a shop's name: "WWW FURLENCO COM", "BANANACLUB PVT LTD".
const NAME_NOISE = /^www|(?:com|in|pvtltd|privatelimited|ltd|limited|pvt)+$/g;

/** The part of a shop's name worth looking for in a message: "wwwfurlencocom" → "furlenco". */
const shopCore = (merchantKey: string) => merchantKey.replace(NAME_NOISE, '');

/**
 * Puts a note on payments a shop or bank later said failed ("didn't go through, any money taken
 * will be refunded"). Nothing is taken off the totals: often no money left at all, or the money is
 * already back, and only you can tell. The payment shows up in "needs a look" until you say
 * it came back (it stops counting) or that it went through.
 *
 * A message matches a payment that came before it (or at most 10 minutes after) when:
 * - it gives an amount: the same rupees and paise, within a day, and the shop's name is in the
 *   message or the two are within 15 minutes;
 * - it gives no amount: the shop's name is in the message, and it is the closest payment to that shop in the
 *   30 minutes before.
 */
export function markFailedPayments(kept: Txn[], notices: FailNotice[]): void {
  if (!notices.length) return;
  const debits = kept.filter((t) => t.type === 'debit' && !t.isManual);
  const mark = (t: Txn, n: FailNotice) => {
    if (!t.failNotice) t.failNotice = { at: n.at, text: n.text };
  };
  for (const n of notices) {
    const named = (t: Txn) => {
      const core = isPlaceholderName(t.merchant) ? '' : shopCore(t.merchantKey);
      return core.length >= 4 && n.key.includes(core);
    };
    if (n.amount === null) {
      // Only an order number: the one payment to that shop just before the message (two orders a few
      // minutes apart are usually a failed try and the retry that worked).
      let best: Txn | null = null;
      for (const t of debits) {
        const gap = n.at - t.timestamp;
        if (gap > FAIL_BEFORE_NO_AMOUNT || gap < -FAIL_CLOCK_SLACK || !named(t)) continue;
        if (!best || Math.abs(gap) < Math.abs(n.at - best.timestamp)) best = t;
      }
      if (best) mark(best, n);
      continue;
    }
    const cents = Math.round(n.amount * 100);
    for (const t of debits) {
      const gap = n.at - t.timestamp;
      if (gap > FAIL_BEFORE_WITH_AMOUNT || gap < -FAIL_AFTER || Math.round(t.amount * 100) !== cents) continue;
      // The same amount from two accounts (an autopay and a retry by hand): both get the note, you pick.
      if (named(t) || Math.abs(gap) <= FAIL_SAME_MOMENT) mark(t, n);
    }
  }
}

/* ---------- ids that survive a new phone ---------- */

/** cyrb53: a fast 53-bit string hash (not for security, just for telling messages apart). */
function hash53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * An id for a message made from who sent it, when (to the second) and what it says.
 * Android's own row number changes when SMS move to a new phone or a backup is restored,
 * which would lose every correction tied to it. This one stays the same.
 * Starts with "h", so it can never be mistaken for Android's numeric id.
 */
export function stableSmsId(sms: Pick<RawSms, 'sender' | 'date' | 'body'>): string {
  return `h${hash53(`${sms.sender.trim()}|${Math.floor(sms.date / 1000)}|${sms.body}`).toString(36)}`;
}

/** Gives every message its stable id. `idMap` is Android id → stable id, used once to move old corrections over. */
export function withStableIds(messages: RawSms[]): { messages: RawSms[]; idMap: Record<string, string> } {
  const idMap: Record<string, string> = {};
  const out = messages.map((m) => {
    if (m.id.startsWith('h')) return m;
    const id = stableSmsId(m);
    idMap[m.id] = id;
    return { ...m, id };
  });
  return { messages: out, idMap };
}

/**
 * True when a message adds something to the app: a payment, a credit card bill or statement notice,
 * a payment the bank says it will take, or a shop saying a payment failed. Only these are kept between starts (see lib/smsCache.ts);
 * OTPs, offers and everything else are not. Mirrors the checks in processInbox, so the kept messages
 * alone give exactly the same payments, bills and scheduled payments as the whole inbox.
 * Fund names are kept on their own, because they come from OTP messages.
 */
export function isRelevant(sms: RawSms): boolean {
  if (parseScheduledDebit(sms)) return true;
  const r = parseSms(sms);
  if (r.ok) return true;
  if ((r.reason === 'reminder' || r.reason === 'promo' || r.reason === 'not_transaction') && parseCardNotice(sms) !== null) return true;
  return parseFailNotice(sms) !== null;
}

/** Why a message was skipped, or null when it is kept. Used to count what new messages were. */
export function skipReason(sms: RawSms): SkipReason | null {
  if (isRelevant(sms)) return null;
  const r = parseSms(sms);
  return r.ok ? null : r.reason;
}

/** Raw inbox → clean list of transactions, credit card bills, and counts of what was skipped. */
export function processInbox(messages: RawSms[], extraSkipped: Partial<Record<SkipReason, number>> = {}) {
  const skipped: Partial<Record<SkipReason, number>> = { ...extraSkipped };
  const bump = (r: SkipReason) => {
    skipped[r] = (skipped[r] ?? 0) + 1;
  };
  const kept: Txn[] = [];
  const notices: CardNotice[] = [];
  const failed: FailNotice[] = [];
  // Payments the bank said it will take (SIP autopay, mandates), once each.
  const scheduled = new Map<string, ScheduledDebit>();
  const funds = new Set<string>();
  // Same text from the same sender within a minute = the phone stored it twice.
  const lastSeen = new Map<string, number>();

  // Oldest first, so the first alert of a pair wins.
  const sorted = [...messages].sort((a, b) => a.date - b.date);
  for (const sms of sorted) {
    const bodyKey = `${coreHeader(sms.sender) ?? ''}|${sms.body.trim()}`;
    const prev = lastSeen.get(bodyKey);
    lastSeen.set(bodyKey, sms.date);
    if (prev !== undefined && sms.date - prev < 60_000) {
      bump('duplicate');
      continue;
    }

    const due = parseScheduledDebit(sms);
    if (due) scheduled.set(`${keyOf(due.name)}|${due.amount}|${due.date}`, due);
    const fund = parseFundName(sms);
    if (fund) funds.add(fund);

    const r = parseSms(sms);
    if (!r.ok) {
      bump(r.reason);
      // A card statement or bill reminder is not a payment, but its amount due and due date are worth keeping.
      // App reminders often come from promo senders, so look there too.
      if (r.reason === 'reminder' || r.reason === 'promo' || r.reason === 'not_transaction') {
        const notice = parseCardNotice(sms);
        if (notice) notices.push(notice);
      }
      const f = parseFailNotice(sms);
      if (f) failed.push(f);
      continue;
    }
    const p = r.txn;
    if (isDuplicate(kept, p, sms)) {
      bump('duplicate');
      continue;
    }
    const category = categorize(p, sms.body);
    if (category === 'card_bill' && p.type === 'credit' && p.account !== null && isRepeatCardBill(kept, p.amount, p.account, sms.date)) {
      bump('duplicate');
      continue;
    }
    // "Credit to SBI" says nothing; for interest the bank is the source.
    let merchant = category === 'interest' && p.bank && /^Credit to /.test(p.merchant) ? `${p.bank} interest` : p.merchant;
    // "Payment received on your credit card" names no shop; say what it is.
    if (category === 'card_bill' && p.type === 'credit' && p.mode === 'card' && /^Credit to /.test(merchant)) {
      merchant = `${p.bank ?? 'Card'} card bill paid`;
    }
    kept.push({
      id: `sms-${sms.id}`,
      amount: p.amount,
      ...(p.currency ? { currency: p.currency } : {}),
      type: p.type,
      merchant,
      merchantKey: merchant === p.merchant ? p.merchantKey : keyOf(merchant),
      category,
      mode: p.mode,
      bank: p.bank,
      account: p.account,
      timestamp: sms.date,
      rawSms: sms.body,
      sender: sms.sender,
      isManual: false,
      excluded: false,
      categorySource: 'auto',
    });
  }
  nameMaskedPayments(kept);
  markFailedPayments(kept, failed);
  kept.sort((a, b) => b.timestamp - a.timestamp);
  const personal = extraSkipped.personal ?? 0;
  const stats: ScanStats = { scanned: messages.length + personal, kept: kept.length, skipped };
  const bills = mergeCardNotices(notices).sort((a, b) => b.statementDate - a.statementDate);
  return { txns: kept, stats, bills, scheduled: [...scheduled.values()].sort((a, b) => a.date - b.date), funds: [...funds] };
}
