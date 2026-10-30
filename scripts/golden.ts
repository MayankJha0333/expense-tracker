/*
 * Before/after check on your real SMS. Nothing leaves your computer.
 *
 *   npm run golden -- --update   save what the app reads today (private/golden.json)
 *   npm run golden               compare today's code with that saved result
 *
 * Needs private/inbox.json (made by `npm run scan:sms`). private/ is git-ignored.
 * Payments are matched by time, direction, amount and account, not by id, so a change
 * in how ids are made doesn't show up as a difference. Every other change does:
 * a new or lost payment, a different shop name or category, a link, a monthly total.
 *
 * Exit code 1 when anything changed, so a change is never missed. If the change is
 * what you meant (a new keyword, a parser fix), look at the list and run --update.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { addMonths, monthKey, monthOf, setMonthStart, summarize, type Month } from '../src/lib/analytics';
import { setHomeCurrency } from '../src/lib/currency';
import { resolveFlows } from '../src/lib/flows';
import type { RawSms } from '../src/lib/parser';
import { processInbox, withStableIds } from '../src/lib/pipeline';
import { fromCache, fromFullRead, mergeRead, OVERLAP_MS, type InboxData, type InboxRead } from '../src/lib/smsCache';
import { shownAmount, type Txn } from '../src/lib/types';

const INBOX = 'private/inbox.json';
const GOLDEN = 'private/golden.json';
const update = process.argv.includes('--update');
const details = process.argv.includes('--details');

if (!existsSync(INBOX)) {
  console.log(`No ${INBOX}. Run \`npm run scan:sms\` first (see scripts/scan-sms.ts). Skipping.`);
  process.exit(0);
}

type TxnSnap = { merchant: string; category: string; amount: number; netted: boolean; links: string; maybeDuplicate: boolean };
type Snapshot = {
  txns: Record<string, TxnSnap>;
  bills: string[];
  scheduled: number;
  months: Record<string, { spent: number; received: number; invested: number; saved: number }>;
};

setHomeCurrency('INR');
setMonthStart(1);

const inbox = JSON.parse(readFileSync(INBOX, 'utf8')) as { messages: RawSms[]; personalSkipped?: number };
const t0 = performance.now();
const { txns: raw, bills, scheduled } = processInbox(inbox.messages, { personal: inbox.personalSkipped ?? 0 });
const t1 = performance.now();
const txns = resolveFlows(raw);
const t2 = performance.now();

const cents = (n: number) => Math.round(n * 100);
const keyOfTxn = (t: Txn) => `${t.timestamp}|${t.type}|${cents(shownAmount(t))}|${t.account ?? '-'}`;
const byId = new Map(txns.map((t) => [t.id, t]));

function snapshot(): Snapshot {
  const out: Snapshot = { txns: {}, bills: [], scheduled: scheduled.length, months: {} };
  for (const t of txns) {
    let k = keyOfTxn(t);
    // Two payments with the same time, amount and account: keep both.
    while (out.txns[k]) k += '+';
    const links = (t.links ?? [])
      .map((l) => {
        const other = byId.get(l.otherId);
        return `${l.kind}:${other ? keyOfTxn(other) : '?'}:${cents(l.amount)}${l.reimbursed ? ':r' : ''}`;
      })
      .sort()
      .join(',');
    out.txns[k] = { merchant: t.merchant, category: t.category, amount: cents(t.amount), netted: !!t.netted, links, maybeDuplicate: !!t.maybeDuplicateOf };
  }
  out.bills = bills.map((b) => `${b.account}|${cents(b.amountDue)}|${b.dueDate ?? '-'}`).sort();
  if (txns.length) {
    const last = monthOf(Math.max(...txns.map((t) => t.timestamp)));
    let m: Month = monthOf(Math.min(...txns.map((t) => t.timestamp)));
    for (let guard = 0; guard < 24 && monthKey(m) <= monthKey(last); guard++, m = addMonths(m, 1)) {
      const s = summarize(txns, m);
      out.months[monthKey(m)] = { spent: cents(s.spent), received: cents(s.received), invested: cents(s.invested), saved: cents(s.saved) };
    }
  }
  return out;
}

/*
 * The kept-messages cache (lib/smsCache.ts) must give exactly what a full read gives:
 * 1. the kept messages alone, read again;
 * 2. an older full read plus a later "only new messages" read.
 */
function cacheChecks(): boolean {
  const stable = withStableIds(inbox.messages).messages;
  const read = (messages: RawSms[]): InboxRead => ({ messages, personalSkipped: 0, promoSkipped: 0, limitReached: false, oldest: null });
  const sig = (d: InboxData) =>
    JSON.stringify([
      d.txns.map((t) => [t.id, t.timestamp, t.type, t.amount, t.merchant, t.category, t.account]),
      d.bills.map((b) => [b.id, b.account, b.amountDue, b.dueDate]),
      d.scheduled.map((s) => [s.id, s.amount, s.date]),
      [...d.funds].sort(),
    ]);
  const at = Math.max(...stable.map((m) => m.date));
  const full = fromFullRead(read(stable), at);
  const kept = full.cache.messages.length;
  const again = fromCache(full.cache);
  const cut = at - 20 * 86_400_000;
  const first = fromFullRead(read(stable.filter((m) => m.date <= cut)), cut);
  const later = fromCache(mergeRead(first.cache, read(stable.filter((m) => m.date >= cut - OVERLAP_MS)), at));
  const ok1 = sig(again) === sig(full.data);
  const ok2 = sig(later) === sig(full.data);
  console.log(`${ok1 ? 'PASS' : 'FAIL'} cache: ${kept} kept messages give the same result as all ${stable.length}`);
  console.log(`${ok2 ? 'PASS' : 'FAIL'} cache: an older read plus "only new messages" gives the same result as one full read`);
  return ok1 && ok2;
}
const cacheOk = cacheChecks();

const now = snapshot();
console.log(`${inbox.messages.length} messages → ${txns.length} payments, ${bills.length} card bills (pipeline ${(t1 - t0).toFixed(0)} ms, linking ${(t2 - t1).toFixed(0)} ms)`);

if (update || !existsSync(GOLDEN)) {
  writeFileSync(GOLDEN, JSON.stringify(now));
  console.log(`Saved ${GOLDEN}. Run \`npm run golden\` after a change to compare.`);
  process.exit(cacheOk ? 0 : 1);
}

const before = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Snapshot;
const changes: string[] = [];
const moved = new Map<string, number>();
let added = 0;
let lost = 0;
let renamed = 0;
let relinked = 0;
for (const [k, b] of Object.entries(before.txns)) {
  const a = now.txns[k];
  if (!a) {
    lost++;
    changes.push(`LOST    ${k}  ${b.merchant} (${b.category})`);
    continue;
  }
  if (a.category !== b.category) {
    moved.set(`${b.category} → ${a.category}`, (moved.get(`${b.category} → ${a.category}`) ?? 0) + 1);
    changes.push(`MOVED   ${k}  ${b.merchant}: ${b.category} → ${a.category}`);
  }
  if (a.merchant !== b.merchant) {
    renamed++;
    changes.push(`NAME    ${k}  ${b.merchant} → ${a.merchant}`);
  }
  if (a.links !== b.links || a.netted !== b.netted || a.amount !== b.amount || a.maybeDuplicate !== b.maybeDuplicate) {
    relinked++;
    changes.push(`LINKS   ${k}  ${a.merchant}: [${b.links}] → [${a.links}]`);
  }
}
for (const [k, a] of Object.entries(now.txns)) {
  if (!before.txns[k]) {
    added++;
    changes.push(`NEW     ${k}  ${a.merchant} (${a.category})`);
  }
}
const monthDiffs: string[] = [];
for (const [m, a] of Object.entries(now.months)) {
  const b = before.months[m];
  if (!b) continue;
  for (const f of ['spent', 'received', 'invested', 'saved'] as const) {
    if (a[f] !== b[f]) monthDiffs.push(`${m} ${f}: ${(b[f] / 100).toFixed(2)} → ${(a[f] / 100).toFixed(2)}`);
  }
}
const billsChanged = JSON.stringify(before.bills) !== JSON.stringify(now.bills);
const schedChanged = before.scheduled !== now.scheduled;

if (!changes.length && !monthDiffs.length && !billsChanged && !schedChanged) {
  console.log('PASS same result as the saved run');
  process.exit(cacheOk ? 0 : 1);
}
console.log(`CHANGED  new ${added} · lost ${lost} · category moves ${[...moved.values()].reduce((a, b) => a + b, 0)} · renamed ${renamed} · links ${relinked}`);
for (const [k, v] of [...moved].sort((a, b) => b[1] - a[1])) console.log(`  ${v}× ${k}`);
if (billsChanged) console.log(`  card bills: ${before.bills.length} → ${now.bills.length}`);
if (schedChanged) console.log(`  scheduled payments: ${before.scheduled} → ${now.scheduled}`);
for (const d of monthDiffs) console.log(`  ${d}`);
const shown = details ? changes : changes.slice(0, 40);
for (const c of shown) console.log(`  ${c}`);
if (shown.length < changes.length) console.log(`  … ${changes.length - shown.length} more (add --details)`);
process.exit(1);
