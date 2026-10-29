import { categorize } from './categorize';
import { coreHeader, keyOf, parseCardNotice, parseFundName, parseScheduledDebit, parseSms, type CardBillDraft, type CardNotice, type ParsedTxn, type RawSms } from './parser';
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

/** Raw inbox → clean list of transactions, credit card bills, and counts of what was skipped. */
export function processInbox(messages: RawSms[], extraSkipped: Partial<Record<SkipReason, number>> = {}) {
  const skipped: Partial<Record<SkipReason, number>> = { ...extraSkipped };
  const bump = (r: SkipReason) => {
    skipped[r] = (skipped[r] ?? 0) + 1;
  };
  const kept: Txn[] = [];
  const notices: CardNotice[] = [];
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
  kept.sort((a, b) => b.timestamp - a.timestamp);
  const personal = extraSkipped.personal ?? 0;
  const stats: ScanStats = { scanned: messages.length + personal, kept: kept.length, skipped };
  const bills = mergeCardNotices(notices).sort((a, b) => b.statementDate - a.statementDate);
  return { txns: kept, stats, bills, scheduled: [...scheduled.values()].sort((a, b) => a.date - b.date), funds: [...funds] };
}
