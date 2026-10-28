import { categorize } from './categorize';
import { coreHeader, parseSms, type ParsedTxn, type RawSms } from './parser';
import type { ScanStats, SkipReason, Txn } from './types';

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

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
      (t.account === null || p.account === null || t.account === p.account)
    ) {
      return true;
    }
  }
  return false;
}

/** Raw inbox → clean list of transactions + counts of what was skipped. */
export function processInbox(messages: RawSms[], extraSkipped: Partial<Record<SkipReason, number>> = {}) {
  const skipped: Partial<Record<SkipReason, number>> = { ...extraSkipped };
  const bump = (r: SkipReason) => {
    skipped[r] = (skipped[r] ?? 0) + 1;
  };
  const kept: Txn[] = [];
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
      continue;
    }
    const p = r.txn;
    if (isDuplicate(kept, p, sms)) {
      bump('duplicate');
      continue;
    }
    kept.push({
      id: `sms-${sms.id}`,
      amount: p.amount,
      type: p.type,
      merchant: p.merchant,
      merchantKey: p.merchantKey,
      category: categorize(p, sms.body),
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
  return { txns: kept, stats };
}
