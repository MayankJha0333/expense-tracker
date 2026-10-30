/* Run: npx vitest run tests/review-fixes.test.ts — rules on made-up names, stable ids, keywords, cache, Sort screen. */
import { describe, expect, test } from 'vitest';

import { categoryFromMerchant } from '../src/lib/categorize';
import { demoInbox } from '../src/lib/demo';
import { isPlaceholderName, PARSER_VERSION, type RawSms } from '../src/lib/parser';
import { isRelevant, processInbox, stableSmsId, withStableIds } from '../src/lib/pipeline';
import { canHavePurpose } from '../src/lib/purposes';
import { applyPrefs, EMPTY_PREFS, hasOldIds, migrateIds, prunePrefs, type Prefs } from '../src/lib/prefs';
import {
  CACHE_VERSION,
  countAfter,
  FULL_READ_EVERY_MS,
  fromCache,
  fromFullRead,
  mergeRead,
  needsFullRead,
  OVERLAP_MS,
  parseCache,
  readSince,
  windowStart,
  type InboxData,
  type InboxRead,
} from '../src/lib/smsCache';
import { guessFromName, otherGroups, rankPicks, SORT_PICKS, usedMost } from '../src/lib/sortOther';
import type { CategoryId, Txn } from '../src/lib/types';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 28, 12).getTime();

let n = 0;
function txn(p: Partial<Txn> & { merchant: string; category: CategoryId }): Txn {
  n++;
  return {
    id: `sms-h${n}`,
    amount: 100,
    type: 'debit',
    merchantKey: p.merchant.toLowerCase().replace(/[^a-z0-9]/g, ''),
    mode: 'upi',
    bank: 'HDFC Bank',
    account: '4321',
    timestamp: NOW - n * 60_000,
    isManual: false,
    excluded: false,
    categorySource: 'auto',
    ...p,
  };
}

/* ---------- #1 made-up names never get a rule ---------- */

describe('made-up names', () => {
  test.each(['UPI payment', 'Card payment', 'Payment', 'Money received', 'HDFC Bank debit', 'Credit to SBI', 'QR payment', 'Paytm QR payment', 'ATM withdrawal', 'Cash deposit', 'HDFC Bank card bill paid', 'Payment reversed'])(
    '%s is made up',
    (name) => expect(isPlaceholderName(name)).toBe(true),
  );
  test.each(['Swiggy', 'Ramesh Kumar', 'Google Play', 'SBI interest', 'Payment Gateway Services'])('%s is a real name', (name) => expect(isPlaceholderName(name)).toBe(false));

  test('a rule saved for "UPI payment" is ignored, a rule for a real shop applies', () => {
    const unknownA = txn({ merchant: 'UPI payment', category: 'other' });
    const unknownB = txn({ merchant: 'UPI payment', category: 'other' });
    const swiggy = txn({ merchant: 'Swiggy', category: 'other' });
    const prefs: Prefs = { ...EMPTY_PREFS, rules: { upipayment: 'food', swiggy: 'food' } };
    const out = applyPrefs([unknownA, unknownB, swiggy], prefs);
    const by = new Map(out.map((t) => [t.id, t]));
    expect(by.get(unknownA.id)!.category).toBe('other');
    expect(by.get(unknownB.id)!.category).toBe('other');
    expect(by.get(swiggy.id)!.category).toBe('food');
    expect(by.get(swiggy.id)!.categorySource).toBe('rule');
  });

  test('no "what is this for?" tag on a made-up name', () => {
    expect(canHavePurpose(txn({ merchant: 'Money received', category: 'received', type: 'credit' }))).toBe(false);
    expect(canHavePurpose(txn({ merchant: 'UPI payment', category: 'people' }))).toBe(false);
    expect(canHavePurpose(txn({ merchant: 'Ramesh Kumar', category: 'people' }))).toBe(true);
  });

  test('a one-off change on a made-up name still applies to that payment', () => {
    const t = txn({ merchant: 'UPI payment', category: 'other' });
    const out = applyPrefs([t], { ...EMPTY_PREFS, overrides: { [t.id]: 'home' } });
    expect(out[0].category).toBe('home');
  });
});

/* ---------- #3 ids that survive a new phone ---------- */

describe('stable ids', () => {
  const sms: RawSms = { id: '1234', sender: 'VM-HDFCBK-S', body: 'Sent Rs.120.00 From HDFC Bank A/C *4321 To SWIGGY', date: NOW };

  test('same message, different Android id → same stable id', () => {
    const moved: RawSms = { ...sms, id: '99999' };
    expect(stableSmsId(sms)).toBe(stableSmsId(moved));
  });
  test('milliseconds lost in a backup restore → same id', () => {
    expect(stableSmsId({ ...sms, date: Math.floor(NOW / 1000) * 1000 })).toBe(stableSmsId({ ...sms, date: Math.floor(NOW / 1000) * 1000 + 999 }));
  });
  test('different text, time or sender → different id', () => {
    const base = stableSmsId(sms);
    expect(stableSmsId({ ...sms, body: sms.body + '.' })).not.toBe(base);
    expect(stableSmsId({ ...sms, date: NOW + 1000 })).not.toBe(base);
    expect(stableSmsId({ ...sms, sender: 'AD-HDFCBK-S' })).not.toBe(base);
  });
  test('ids start with "h" and withStableIds leaves them alone the second time', () => {
    const once = withStableIds([sms]);
    expect(once.messages[0].id.startsWith('h')).toBe(true);
    expect(once.idMap['1234']).toBe(once.messages[0].id);
    const twice = withStableIds(once.messages);
    expect(twice.messages[0].id).toBe(once.messages[0].id);
    expect(Object.keys(twice.idMap)).toHaveLength(0);
  });
  test('the demo inbox gives one id per message', () => {
    const inbox = demoInbox(NOW);
    expect(new Set(withStableIds(inbox).messages.map((m) => m.id)).size).toBe(inbox.length);
  });

  const old: Prefs = {
    ...EMPTY_PREFS,
    rules: { swiggy: 'food' },
    overrides: { 'sms-11': 'home', 'sms-12': 'food', 'cash-1': 'cash' },
    excluded: ['sms-11', 'cash-1'],
    paidBills: ['bill-13'],
    checkedCardPayments: ['sms-12'],
    ignoredSchedules: ['sched-14'],
    links: [{ kind: 'transfer', outId: 'sms-11', inId: 'sms-12' }],
    unlinked: ['sms-12>sms-11'],
  };
  const idMap = { '11': 'hA', '12': 'hB', '13': 'hC', '14': 'hD' };

  test('old corrections move to stable ids; cash entries are untouched', () => {
    expect(hasOldIds(old)).toBe(true);
    const m = migrateIds(old, idMap);
    expect(m.overrides).toEqual({ 'sms-hA': 'home', 'sms-hB': 'food', 'cash-1': 'cash' });
    expect(m.excluded).toEqual(['sms-hA', 'cash-1']);
    expect(m.paidBills).toEqual(['bill-hC']);
    expect(m.checkedCardPayments).toEqual(['sms-hB']);
    expect(m.ignoredSchedules).toEqual(['sched-hD']);
    expect(m.links).toEqual([{ kind: 'transfer', outId: 'sms-hA', inId: 'sms-hB' }]);
    expect(m.unlinked).toEqual(['sms-hB>sms-hA']);
    expect(m.rules).toEqual({ swiggy: 'food' });
    expect(hasOldIds(m)).toBe(false);
  });
  test('moving ids twice changes nothing', () => {
    const m = migrateIds(old, idMap);
    expect(migrateIds(m, idMap)).toEqual(m);
  });

  /* ---------- #9 old corrections are cleaned up ---------- */
  test('corrections for messages that are gone are dropped; cash entries and rules stay', () => {
    const m = migrateIds(old, idMap);
    const pruned = prunePrefs(m, new Set(['sms-hA', 'bill-hC']));
    expect(pruned.overrides).toEqual({ 'sms-hA': 'home', 'cash-1': 'cash' });
    expect(pruned.excluded).toEqual(['sms-hA', 'cash-1']);
    expect(pruned.paidBills).toEqual(['bill-hC']);
    expect(pruned.checkedCardPayments).toEqual([]);
    expect(pruned.ignoredSchedules).toEqual([]);
    // A link needs both sides.
    expect(pruned.links).toEqual([]);
    expect(pruned.unlinked).toEqual([]);
    expect(pruned.rules).toEqual({ swiggy: 'food' });
  });
});

/* ---------- #4 keywords that matched the wrong shops ---------- */

describe('keywords', () => {
  test.each([
    ['District Hospital', 'health'],
    ['Spencer Dsouza', null],
    ['Steam Iron Repairs', null],
    ['Canvas Shoes', 'shopping'],
    ['Kitchen World Appliances', 'shopping'],
  ] as const)('%s → %s', (name, want) => expect(categoryFromMerchant(name)).toBe(want));

  // Names that must keep working.
  test.each([
    ['District', 'entertainment'],
    ['Spencers Retail', 'groceries'],
    ['Spencer', 'groceries'],
    ['Steam', 'entertainment'],
    ['Steampowered', 'entertainment'],
    ['Canva', 'software'],
    ['Biryani Kitchen', 'food'],
    ['Swiggy Instamart', 'groceries'],
    ['swiggyinstamart', 'groceries'],
    ['Avenuesupermartsltd 27325', 'groceries'],
    ['Zeptoonline YBL', 'groceries'],
    ['Airtelpaymentsbanklimi 11', 'bills'],
    ['Dominos Pizza', 'food'],
    ["McDonald's", 'food'],
    ['Burgerking', 'food'],
    ['Google Cloud', 'software'],
    ['Amazon Web Services', 'software'],
    ['Apollo Pharmacy', 'health'],
    ['Uber India', 'transport'],
    ['STEAMGAMES.COM 4259522985', 'entertainment'],
    ['WWW.STEAMPOWERED.COM', 'entertainment'],
    ['Spencers Retail Ltd', 'groceries'],
  ] as const)('%s → %s', (name, want) => expect(categoryFromMerchant(name)).toBe(want));
});

/* ---------- #5 the kept-messages cache ---------- */

describe('cache', () => {
  const inbox = withStableIds(demoInbox(NOW)).messages;
  const read = (messages: RawSms[], extra: Partial<InboxRead> = {}): InboxRead => ({ messages, personalSkipped: 0, promoSkipped: 0, limitReached: false, oldest: null, ...extra });
  const sig = (d: InboxData) =>
    JSON.stringify([
      d.txns.map((t) => [t.id, t.timestamp, t.amount, t.merchant, t.category, t.account]),
      d.bills.map((b) => [b.id, b.amountDue, b.dueDate]),
      d.scheduled.map((s) => [s.id, s.amount, s.date]),
      [...d.funds].sort(),
    ]);

  test('only messages that add something are kept, and OTPs and offers are not', () => {
    const { cache } = fromFullRead(read(inbox), NOW);
    expect(cache.messages.length).toBeGreaterThan(0);
    expect(cache.messages.length).toBeLessThan(inbox.length);
    expect(cache.messages.every(isRelevant)).toBe(true);
    expect(cache.messages.some((m) => /\botp\b/i.test(m.body))).toBe(false);
  });

  test('the kept messages alone give the same payments, bills and SIPs as the whole inbox', () => {
    const full = fromFullRead(read(inbox), NOW);
    expect(sig(fromCache(full.cache))).toBe(sig(full.data));
    expect(fromCache(full.cache).stats).toEqual(full.data.stats);
  });

  test('an older full read plus "only new messages" gives the same result as one full read', () => {
    const cut = NOW - 10 * DAY;
    const first = fromFullRead(read(inbox.filter((m) => m.date <= cut)), cut);
    const later = mergeRead(first.cache, read(inbox.filter((m) => m.date >= cut - OVERLAP_MS)), NOW);
    expect(sig(fromCache(later))).toBe(sig(fromFullRead(read(inbox), NOW).data));
  });

  test('reading the same messages again adds nothing and counts nothing twice', () => {
    const full = fromFullRead(read(inbox), NOW);
    const again = mergeRead(full.cache, read(inbox.filter((m) => m.date >= full.cache.newest - OVERLAP_MS)), NOW);
    expect(again.messages).toHaveLength(full.cache.messages.length);
    expect(again.scanned).toBe(full.cache.scanned);
    expect(again.skipped).toEqual(full.cache.skipped);
  });

  test('a read of new messages adds the phone\'s skip counts once (the phone counts only messages newer than the last read)', () => {
    const cut = NOW - 10 * DAY;
    const first = fromFullRead(read(inbox.filter((m) => m.date <= cut), { personalSkipped: 4, promoSkipped: 6 }), cut);
    expect(countAfter(first.cache, cut + DAY)).toBe(cut);
    expect(countAfter(null, cut)).toBe(0);
    const fresh = inbox.filter((m) => m.date >= cut - OVERLAP_MS);
    const later = mergeRead(first.cache, read(fresh, { personalSkipped: 2, promoSkipped: 3 }), NOW);
    expect(later.skipped.personal).toBe(6);
    expect((later.skipped.promo ?? 0) - (first.cache.skipped.promo ?? 0)).toBeGreaterThanOrEqual(3);
    const newer = fresh.filter((m) => m.date > first.cache.newest).length;
    expect(later.scanned).toBe(first.cache.scanned + newer + 5);
  });

  test('a chat or OTP newer than the last bank message is counted once, not on every open', () => {
    const bank = inbox.filter((m) => isRelevant(m));
    const lastBank = bank[bank.length - 1];
    const { cache } = fromFullRead(read(bank), lastBank.date + 60 * 60_000);
    const otp: RawSms = { id: 'hotp', sender: 'AD-HDFCBK-S', body: '123456 is your OTP for login. Do not share it.', date: lastBank.date + 2 * 60 * 60_000 };
    const open1 = mergeRead(cache, read([otp]), otp.date + 60 * 60_000);
    const open2 = mergeRead(open1, read([otp]), otp.date + 2 * 60 * 60_000);
    expect(open1.skipped.otp ?? 0).toBe((cache.skipped.otp ?? 0) + 1);
    expect(open2.skipped.otp).toBe(open1.skipped.otp);
    expect(open2.scanned).toBe(open1.scanned);
    expect(countAfter(open1, otp.date + 2 * 60 * 60_000)).toBe(otp.date + 60 * 60_000);
  });

  test('personal numbers and offers dropped by the phone are counted', () => {
    const { data } = fromFullRead(read(inbox, { personalSkipped: 5, promoSkipped: 7 }), NOW);
    expect(data.stats.skipped.personal).toBe(5);
    expect((data.stats.skipped.promo ?? 0) >= 7).toBe(true);
    expect(data.stats.scanned).toBe(inbox.length + 12);
  });

  test('messages older than 13 months fall out of the cache', () => {
    const full = fromFullRead(read(inbox), NOW);
    const muchLater = NOW + 400 * DAY;
    const merged = mergeRead(full.cache, read([]), muchLater);
    expect(merged.messages.every((m) => m.date >= windowStart(muchLater))).toBe(true);
    expect(merged.messages.length).toBeLessThan(full.cache.messages.length);
  });

  test('when to read the whole inbox again', () => {
    const { cache } = fromFullRead(read(inbox), NOW);
    expect(needsFullRead(null, NOW)).toBe(true);
    expect(needsFullRead(cache, NOW + DAY)).toBe(false);
    expect(needsFullRead(cache, NOW + FULL_READ_EVERY_MS + 1)).toBe(true);
    expect(needsFullRead({ ...cache, parser: PARSER_VERSION - 1 }, NOW)).toBe(true);
    expect(needsFullRead({ ...cache, v: CACHE_VERSION + 1 }, NOW)).toBe(true);
    expect(readSince(null, NOW)).toBe(windowStart(NOW));
    expect(readSince(cache, NOW + DAY)).toBe(cache.newest - OVERLAP_MS);
  });

  test('a saved cache reads back the same; a broken one is ignored', () => {
    const { cache } = fromFullRead(read(inbox, { limitReached: true, oldest: NOW - 90 * DAY }), NOW);
    expect(parseCache(JSON.stringify(cache))).toEqual(cache);
    expect(parseCache(null)).toBeNull();
    expect(parseCache('{not json')).toBeNull();
    expect(parseCache(JSON.stringify({ ...cache, v: 99 }))).toBeNull();
    expect(parseCache(JSON.stringify({ ...cache, messages: [{ id: 1 }] }))).toBeNull();
  });

  test('the cache gives the same result as reading with processInbox directly', () => {
    const direct = processInbox(inbox);
    const viaCache = fromCache(fromFullRead(read(inbox), NOW).cache);
    expect(viaCache.txns.map((t) => t.id)).toEqual(direct.txns.map((t) => t.id));
  });
});

/* ---------- #7 the Sort screen ---------- */

describe('Sort "Other"', () => {
  test('shops are grouped, biggest first; made-up names and sorted ones are not', () => {
    const list = [
      txn({ merchant: 'Shree Balaji Agencies', category: 'other', amount: 200 }),
      txn({ merchant: 'Shree Balaji Agencies', category: 'other', amount: 300 }),
      txn({ merchant: 'Tiny Shop', category: 'other', amount: 50 }),
      txn({ merchant: 'UPI payment', category: 'other', amount: 999 }),
      txn({ merchant: 'Picked Shop', category: 'other', categorySource: 'manual' }),
      txn({ merchant: 'Left Out', category: 'other', excluded: true }),
      txn({ merchant: 'Swiggy', category: 'food' }),
      txn({ merchant: 'Refund', category: 'other', type: 'credit' }),
    ];
    const { groups, unnamed } = otherGroups(list);
    expect(groups.map((g) => [g.name, g.count, g.total])).toEqual([
      ['Shree Balaji Agencies', 2, 500],
      ['Tiny Shop', 1, 50],
    ]);
    expect(unnamed.map((t) => t.merchant)).toEqual(['UPI payment']);
  });
});

describe('Sort screen: likeliest category first', () => {
  test('guesses from words in real shop names', () => {
    expect(guessFromName('Google India Digital Serv')).toEqual(['software']);
    expect(guessFromName('Cursor')).toEqual(['software']);
    expect(guessFromName('Houseofkierayalimited')).toEqual(['home']);
    expect(guessFromName('Snabbit')).toEqual(['house_help']);
    expect(guessFromName('Kapoorscafe')).toEqual(['food']);
    expect(guessFromName('Davanagere Benne Dose Ruchi')).toEqual(['food']);
    expect(guessFromName('Ayush Hyper Market 1')).toEqual(['groceries']);
    expect(guessFromName('Secretary Cbse Revalua')).toEqual(['education']);
    expect(guessFromName('RoyalBison AutoRentals India P')).toEqual(['transport']);
    expect(guessFromName('Mr VIVEK KUMAR SINGH')).toEqual(['people']);
    expect(guessFromName('Amodh Kumar S O Ajay Lal')).toEqual(['people']);
    // No clue in the name: no guess, rather than a wrong one.
    expect(guessFromName('Sanjeeva')).toEqual([]);
    expect(guessFromName('Shyamlalgayarisobhagwanlal')).toEqual([]);
    expect(guessFromName('Bistro')).toEqual(['food']);
    expect(guessFromName('Donatekart')).toEqual([]);
    expect(guessFromName('Shri Ram Enterprises')).toEqual([]);
  });

  test('then the categories you use most, then the rest; never Other or card bills', () => {
    const list = [
      txn({ merchant: 'A', category: 'groceries' }),
      txn({ merchant: 'B', category: 'groceries' }),
      txn({ merchant: 'C', category: 'food' }),
      txn({ merchant: 'D', category: 'other' }),
      txn({ merchant: 'E', category: 'card_bill' }),
      txn({ merchant: 'F', category: 'salary', type: 'credit' }),
    ];
    const most = usedMost(list);
    expect(most).toEqual(['groceries', 'food']);
    const r = rankPicks('Cursor', most);
    expect(r.guessed).toBe(1);
    expect(r.order.slice(0, 3)).toEqual(['software', 'groceries', 'food']);
    expect([...r.order].sort()).toEqual([...SORT_PICKS].sort());
    expect(r.order).not.toContain('other');
    const none = rankPicks('Sanjeeva', most);
    expect(none.guessed).toBe(0);
    expect(none.order.slice(0, 2)).toEqual(['groceries', 'food']);
  });
});
