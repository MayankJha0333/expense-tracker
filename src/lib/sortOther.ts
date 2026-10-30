import { isPlaceholderName } from './parser';
import type { Txn } from './types';

/** One shop whose payments are all in "Other". */
export type OtherGroup = { key: string; name: string; count: number; total: number; latest: Txn };

/** A payment Kharcha filed under "Other" on its own, that you haven't looked at yet. */
const unsortedOther = (t: Txn) => t.type === 'debit' && t.category === 'other' && t.categorySource === 'auto' && !t.excluded && !t.isManual;

/**
 * Payments in "Other" grouped by shop, biggest total first (for the Sort screen).
 * Made-up names ("UPI payment") are not one shop, so they come back one by one in [unnamed], newest first.
 */
export function otherGroups(txns: Txn[]): { groups: OtherGroup[]; unnamed: Txn[] } {
  const map = new Map<string, OtherGroup>();
  const unnamed: Txn[] = [];
  for (const t of txns) {
    if (!unsortedOther(t)) continue;
    if (!t.merchantKey || isPlaceholderName(t.merchant)) {
      unnamed.push(t);
      continue;
    }
    const g = map.get(t.merchantKey);
    if (g) {
      g.count += 1;
      g.total += t.amount;
      if (t.timestamp > g.latest.timestamp) g.latest = t;
    } else {
      map.set(t.merchantKey, { key: t.merchantKey, name: t.merchant, count: 1, total: t.amount, latest: t });
    }
  }
  return {
    groups: [...map.values()].sort((a, b) => b.total - a.total),
    unnamed: unnamed.sort((a, b) => b.timestamp - a.timestamp),
  };
}
