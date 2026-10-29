import { categorize } from './categorize';
import { coreHeader, keyOf, parseCardBill, parseSms, type ParsedTxn, type RawSms } from './parser';
import type { CardBill, ScanStats, SkipReason, Txn } from './types';

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

/** Raw inbox → clean list of transactions, credit card bills, and counts of what was skipped. */
export function processInbox(messages: RawSms[], extraSkipped: Partial<Record<SkipReason, number>> = {}) {
  const skipped: Partial<Record<SkipReason, number>> = { ...extraSkipped };
  const bump = (r: SkipReason) => {
    skipped[r] = (skipped[r] ?? 0) + 1;
  };
  const kept: Txn[] = [];
  const bills: CardBill[] = [];
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

    const r = parseSms(sms);
    if (!r.ok) {
      bump(r.reason);
      // A card statement is not a payment, but its amount due and due date are worth keeping.
      if (r.reason === 'reminder') {
        const bill = parseCardBill(sms);
        if (bill) bills.push(bill);
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
  bills.sort((a, b) => b.statementDate - a.statementDate);
  return { txns: kept, stats, bills };
}
