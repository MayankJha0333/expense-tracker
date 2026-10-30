/* Run: npx vitest run tests/tracking.test.ts — checks card bills, payment methods, accounts, review rules and theme contrast. */
import {
  cardDues,
  creditCardKeys,
  duesSummary,
  instrumentKey,
  instruments,
  needsReview,
  notCountedIncome,
  payLabel,
  payMix,
  shortCardName,
} from '../src/lib/accounts';
import { monthOf, summarize } from '../src/lib/analytics';
import { categorize } from '../src/lib/categorize';
import { demoExtras, demoInbox } from '../src/lib/demo';
import { ELECTRIC_IDS, electricPalette, MIDNIGHT_IDS, midnightPalette, NOTICE_TONES, noticeColors, parseSavedTheme, type Palette } from '../src/lib/palette';
import { parseCardBill, parseSms } from '../src/lib/parser';
import { processInbox } from '../src/lib/pipeline';
import type { CardBill, Txn } from '../src/lib/types';

import { check } from './check';

const ymd = (ts: number | null) => {
  if (ts === null) return 'null';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

/* ---------- 1. Reading credit card statements ---------- */
console.log('\n# Card statements');
const STATEMENT_DATE = at(2026, 10, 16, 7);
const BILLS: [string, string, string | null][] = [
  // [sender, body, expected "amount|min|due|last4" or null for "not a card bill"]
  ['AD-ICICIB', 'Your ICICI Bank Credit Card XX1234 statement is generated. Total amount due Rs 12,450. Minimum due Rs 620. Due date 15-Nov-26.', '12450|620|2026-11-15|1234'],
  ['AD-HDFCBK', 'Your HDFC Bank Credit Card XX7788 statement is generated. Total amount due Rs 18,240.00. Minimum due Rs 912.00. Due date 05-Nov-26.', '18240|912|2026-11-05|7788'],
  ['AX-AXISBK', 'Axis Bank Credit Card XX8899 statement generated. Total amount due INR 6,210.00. Min amount due INR 311.00. Pay by 10-11-26.', '6210|311|2026-11-10|8899'],
  ['AD-SBICRD', 'Your SBI Card ending 4455 statement: Total Amt Due Rs.8,320.50; Min Amt Due Rs.416.00; Payment Due Date 12/11/2026.', '8320.5|416|2026-11-12|4455'],
  ['VM-KOTAKB', 'Rs 5,000.00 is due on 5th Nov for your Kotak Credit Card xx1111. Please pay on time to avoid charges.', '5000|null|2026-11-05|1111'],
  ['AD-HDFCBK', 'HDFC Bank Credit Card XX7788: amount due 12,450 by 05-Nov-26.', '12450|null|2026-11-05|7788'],
  ['AD-HDFCBK', 'Your EMI of Rs 12,000 for loan a/c XX5566 is due on 05-Nov-26.', null],
  ['VM-HDFCBK', 'Rs 499 will be debited from a/c XX4521 on 05-Nov-26 for NETFLIX autopay.', null],
  ['AD-ICICIB', 'Your ICICI Bank Credit Card XX1234 statement is generated. Total amount due Rs 0.00. No payment is required.', null],
  ['AD-HDFCBK', 'OTP 482913 for payment of credit card XX7788 due Rs 1,200. Do not share.', null],
  ['+919876543210', 'Your credit card XX1234 total amount due Rs 5000 due date 5 Nov', null],
];
BILLS.forEach(([sender, body, expect], i) => {
  const b = parseCardBill({ id: `b${i}`, sender, body, date: STATEMENT_DATE });
  const got = b ? `${b.amountDue}|${b.minDue}|${ymd(b.dueDate)}|${b.account}` : null;
  check(`statement #${i} ${sender}`, got === expect, `got ${got}, expected ${expect}`);
});

/* ---------- 2. The payments around a card bill ---------- */
console.log('\n# Card payments');
const line = (sender: string, body: string) => {
  const r = parseSms({ id: 'x', sender, body, date: 0 });
  return r.ok ? `${r.txn.type} ${categorize(r.txn, body)} ${r.txn.mode} ${r.txn.account ?? '-'}` : `skip ${r.reason}`;
};
check(
  'HDFC "payment received" alert is a card bill credit on 7788',
  line('AD-HDFCBK', 'Dear Customer, Payment of INR 18,240.00 has been received on your HDFC Bank Credit Card Account XX7788 on 03-Nov-26. Thank you.') ===
    'credit card_bill card 7788',
  line('AD-HDFCBK', 'Dear Customer, Payment of INR 18,240.00 has been received on your HDFC Bank Credit Card Account XX7788 on 03-Nov-26. Thank you.'),
);
check(
  'Axis "payment received" alert is a card bill credit on 8899',
  line('AX-AXISBK', 'Payment of INR 6,210.00 received towards your Axis Bank Credit Card XX8899 on 08-11-26. Thank you.') === 'credit card_bill card 8899',
  line('AX-AXISBK', 'Payment of INR 6,210.00 received towards your Axis Bank Credit Card XX8899 on 08-11-26. Thank you.'),
);
const credPay = line('VM-HDFCBK-S', 'Sent Rs.18240.00\nFrom HDFC Bank A/C *4521\nTo CRED CLUB\nOn 03/11/26\nRef 628512345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808');
check('Paying the bill from the bank (CRED) is a card bill debit, not spending', credPay === 'debit card_bill upi 4521', credPay);
const axisSpend = line('AX-AXISBK-T', 'Spent INR 2,345.00\nAxis Bank Card no. XX8899\n14-10-26 13:02:11 IST\nDECATHLON SPORTS\nAvl Limit: INR 1,20,000.00\nNot you? SMS BLOCK 8899 to 919951860002');
check('Axis card spend is a card debit on 8899', axisSpend === 'debit shopping card 8899', axisSpend);

/* ---------- 3. The whole sample inbox, end to end ---------- */
console.log('\n# Sample inbox, end to end');
const NOW = at(2026, 10, 28, 20);
const inbox = processInbox(demoInbox(NOW));
// Same as the app: SMS payments plus the cash entries added by hand.
const txns = [...inbox.txns, ...demoExtras(NOW).manual].sort((a, b) => b.timestamp - a.timestamp);
const bills = inbox.bills;
const oct = monthOf(NOW);
const summary = summarize(txns, oct);
const octTxns = summary.txns;

check('statements were found for both credit cards', new Set(bills.map((b) => b.account)).size === 2, `cards: ${[...new Set(bills.map((b) => b.account))].join(',')}`);
check('about one statement per card per month', bills.length >= 12 && bills.length <= 14, `bills: ${bills.length}`);

// Each statement equals the card spends since the previous statement.
let cycleOk = 0;
let cycles = 0;
for (const acct of ['7788', '8899']) {
  const list = bills.filter((b) => b.account === acct).sort((a, b) => a.statementDate - b.statementDate);
  for (let i = 1; i < list.length; i++) {
    const from = list[i - 1].statementDate;
    const to = list[i].statementDate;
    const spent = txns
      // The sample's dollar subscription (FIGMA) isn't part of the rupee cycle.
      .filter((t) => t.mode === 'card' && t.account === acct && t.type === 'debit' && t.timestamp > from && t.timestamp < to && t.currency !== 'USD')
      .reduce((a, t) => a + t.amount, 0);
    cycles++;
    if (Math.abs(spent - list[i].amountDue) < 1) cycleOk++;
  }
}
check('every statement amount equals the card spends in its cycle', cycles > 0 && cycleOk === cycles, `${cycleOk}/${cycles}`);

const dues = cardDues(bills, txns, new Set(), NOW);
const hdfc = dues.find((d) => d.last4 === '7788');
const axis = dues.find((d) => d.last4 === '8899');
check('HDFC bill from 16 Oct is due on 5 Nov, 8 days away', !!hdfc && hdfc.status === 'due' && hdfc.daysLeft === 8 && ymd(hdfc.bill.dueDate) === '2026-11-05', JSON.stringify(hdfc && { s: hdfc.status, d: hdfc.daysLeft, due: ymd(hdfc.bill.dueDate) }));
check('Axis bill from 22 Oct is due on 10 Nov, 13 days away', !!axis && axis.status === 'due' && axis.daysLeft === 13, JSON.stringify(axis && { s: axis.status, d: axis.daysLeft }));
const sumDue = duesSummary(dues);
check('total to pay = both open bills', Math.abs(sumDue.total - ((hdfc?.left ?? 0) + (axis?.left ?? 0))) < 1 && sumDue.next?.last4 === '7788', `${sumDue.total}`);

// Going back to 4 Oct: the HDFC bill (16 Sep) was paid on 3 Oct, the Axis one (22 Sep) is still due.
const EARLY = at(2026, 10, 4, 20);
const early = processInbox(demoInbox(EARLY));
const earlyDues = cardDues(early.bills, early.txns, new Set(), EARLY);
const e7788 = earlyDues.find((d) => d.last4 === '7788');
const e8899 = earlyDues.find((d) => d.last4 === '8899');
check('a bill with a "payment received" alert shows as paid', e7788?.status === 'paid' && e7788.paidVia === 'card_alert', JSON.stringify(e7788 && { s: e7788.status, via: e7788.paidVia }));
check('a bill not paid yet shows as due with days left', e8899?.status === 'due' && e8899.daysLeft === 6, JSON.stringify(e8899 && { s: e8899.status, d: e8899.daysLeft }));
check('marking a bill paid works', cardDues(early.bills, early.txns, new Set([e8899?.bill.id ?? '']), EARLY).find((d) => d.last4 === '8899')?.status === 'paid');

/* ---------- 4. Payment methods and accounts ---------- */
console.log('\n# Payment methods and accounts');
const mix = payMix(octTxns);
const mixTotal = mix.reduce((a, r) => a + r.amount, 0);
check('payment method totals add up to total spending', Math.abs(mixTotal - summary.spent) < 0.01, `${mixTotal} vs ${summary.spent}`);
check('payment method shares add up to 100%', Math.abs(mix.reduce((a, r) => a + r.share, 0) - 1) < 1e-9);
check('UPI, card and cash all show up', ['upi', 'card', 'cash'].every((g) => mix.some((r) => r.group === g)), mix.map((r) => r.group).join(','));

const credit = creditCardKeys(txns, bills);
const inst = instruments(octTxns, credit);
const instSpent = inst.reduce((a, i) => a + i.spent, 0);
check('spending split by card/account adds up to total spending', Math.abs(instSpent - summary.spent) < 0.01, `${instSpent} vs ${summary.spent}`);
const hdfcCard = inst.find((i) => i.last4 === '7788');
check('HDFC card ••7788 is recognised as a credit card', hdfcCard?.kind === 'credit_card', hdfcCard?.kind);
check('Axis card ••8899 is recognised as a credit card', inst.find((i) => i.last4 === '8899')?.kind === 'credit_card');
check('bank accounts are listed as accounts', inst.some((i) => i.kind === 'bank' && i.last4 === '4521'));
check('card label reads naturally', hdfcCard?.name === 'HDFC Bank credit card ••7788', hdfcCard?.name);
const sample = octTxns.find((t) => t.mode === 'card' && t.account === '7788');
check('payment badge for a card payment', !!sample && payLabel(sample) === 'HDFC card ••7788', sample && payLabel(sample));
check('card payments and bank payments get different keys', !!sample && instrumentKey(sample) !== instrumentKey({ ...sample, mode: 'upi' }));

/* ---------- 5. Needs a look, and money in that isn't income ---------- */
console.log('\n# Review rules and income');
const base: Txn = {
  id: 't', amount: 500, type: 'debit', merchant: 'X', merchantKey: 'x', category: 'other', mode: 'upi', bank: 'HDFC Bank', account: '4521',
  timestamp: NOW, isManual: false, excluded: false, categorySource: 'auto',
};
check('an "Other" spend sorted on its own needs a look', needsReview(base));
check('...but not once you pick a category', !needsReview({ ...base, categorySource: 'manual' }));
check('...and not if it is left out', !needsReview({ ...base, excluded: true }));
check('a known category does not need a look', !needsReview({ ...base, category: 'food' }));
check('money received from a person needs a look', needsReview({ ...base, type: 'credit', category: 'received' }));
check('salary does not need a look', !needsReview({ ...base, type: 'credit', category: 'salary' }));

const nc = notCountedIncome([
  { ...base, id: 'a', type: 'credit', category: 'self_transfer', amount: 5000 },
  { ...base, id: 'b', type: 'credit', category: 'card_bill', amount: 2000, mode: 'card' },
  { ...base, id: 'c', type: 'credit', category: 'salary', amount: 80000 },
  { ...base, id: 'd', type: 'credit', category: 'received', amount: 300, excluded: true },
]);
check('money moved between your own accounts is not income', nc.total === 7300 && nc.rows.length === 3, JSON.stringify(nc));

// Synthetic bill checks
const bill: CardBill = { id: 'bill-1', bank: 'HDFC Bank', account: '7788', amountDue: 10000, minDue: 500, dueDate: at(2026, 11, 2, 0), statementDate: at(2026, 10, 16, 7) };
const cardPay = (amount: number): Txn => ({ ...base, id: `p${amount}`, type: 'credit', category: 'card_bill', mode: 'card', account: '7788', amount, timestamp: at(2026, 10, 20) });
const one = (list: Txn[], now = NOW) => cardDues([bill], list, new Set(), now)[0];
check('part payment shows what is left', one([cardPay(4000)]).status === 'partly_paid' && one([cardPay(4000)]).left === 6000);
check('two part payments that add up mark it paid', one([cardPay(4000), cardPay(6000)]).status === 'paid');
check('paying the same amount from the bank marks it paid', one([{ ...base, id: 'bp', category: 'card_bill', amount: 10000, timestamp: at(2026, 10, 25) }]).paidVia === 'bank_payment');
check('a payment before the statement does not count', one([{ ...cardPay(10000), timestamp: at(2026, 10, 10) }]).status === 'due');
check('an unpaid bill after its due date is overdue', one([], at(2026, 11, 3)).status === 'overdue' && one([], at(2026, 11, 3)).daysLeft === -1);

// Unknown shops paid by UPI must not be filed as "Sent to people" (that hides them from review).
const sbi = (to: string) => {
  const body = `Dear UPI user A/C X9876 debited by 900.0 on date 24Oct26 trf to ${to} Refno 628212345678. If not u? call 1800111109. -SBI`;
  const r = parseSms({ id: '1', sender: 'AX-SBIUPI', body, date: 0 });
  return r.ok ? categorize(r.txn, body) : 'skip';
};
check('a UPI payment to a business name is "Other" (needs a look), not a person', sbi('RAZORPAY PAYMENTS') === 'other' && sbi('SHREE BALAJI AGENCIES') === 'other', `${sbi('RAZORPAY PAYMENTS')} ${sbi('SHREE BALAJI AGENCIES')}`);
check('a UPI payment to a person is still "Sent to people"', sbi('RAMESH KUMAR') === 'people', sbi('RAMESH KUMAR'));

/* ---------- 6. Theme: Midnight (dark) and Electric (light), every colour readable ---------- */
console.log('\n# Theme contrast');
type RGB = [number, number, number];
const parse = (c: string): { rgb: RGB; a: number } => {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  if (m) return { rgb: [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255], a: Number(m[4]) };
  const h = c.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
  return { rgb, a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
};
/** A see-through colour as it looks on top of [base]. */
const over = (top: string, base: string): RGB => {
  const t = parse(top);
  const b = parse(base).rgb;
  return [0, 1, 2].map((i) => t.rgb[i] * t.a + b[i] * (1 - t.a)) as RGB;
};
const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** Contrast of [fg] drawn on [bg], where either may be see-through over [page]. */
const cr = (fg: string, bg: string, page: string) => {
  const bgRgb = over(bg, page);
  const bgHex = '#' + bgRgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  return ratio(over(fg, bgHex), bgRgb);
};
const palettes: Palette[] = [...MIDNIGHT_IDS.map(midnightPalette), ...ELECTRIC_IDS.map(electricPalette)];
check('8 themes: 4 Midnight (dark) + 4 Electric (light)', palettes.length === 8 && palettes.filter((p) => p.scheme === 'dark').length === 4);
for (const p of palettes) {
  const tests: [string, string, string, string, number][] = [
    // [what, foreground, background, page under a see-through background, minimum ratio]
    ['text on page', p.ink, p.bg, p.bg, 7],
    ['grey text on page', p.muted, p.bg, p.bg, 4.5],
    ['grey text on cards', p.muted, p.surface, p.surface, 4.5],
    ['grey text on chips', p.muted, p.surfaceAlt, p.surfaceAlt, 4.5],
    ['accent text on page', p.accentInk, p.bg, p.bg, 4.5],
    ['accent text on cards', p.accentInk, p.surface, p.surface, 4.5],
    ['text on accent', p.onAccent, p.accent, p.accent, 4.5],
    ['hero text', p.heroText, p.hero, p.hero, 4.5],
    ['hero big number', p.heroValue, p.hero, p.hero, 4.5],
    ['hero grey text', p.heroMuted, p.hero, p.hero, 4.5],
    ['hero tile text', p.heroText, p.heroTile, p.hero, 4.5],
    ['hero chip text', p.heroChipText, p.heroChip, p.heroChip, 4.5],
    ['hero progress bar', p.heroBar, p.hero, p.hero, 3],
    ['+ button icon', p.onFab, p.fab, p.fab, 3],
    ['+ button on the tab bar', p.fab, p.bg, p.bg, 3],
    // The wallet logo: the coin must stand out on its clasp, the clasp on the wallet,
    // the front bill on the tile, and the wallet's bottom edge (its shadow) on the tile.
    ['logo coin on its clasp', p.logo.dot, p.logo.clasp, p.logo.clasp, 3],
    ['logo clasp on the wallet', p.logo.clasp, p.logo.walletBottom, p.logo.walletBottom, 3],
    ['logo bill on the tile', p.logo.billBack, p.logo.tileBottom, p.logo.tileBottom, 2],
    ['logo wallet on the tile', p.logo.walletBottom, p.logo.tileBottom, p.logo.tileBottom, 3],
    ['money in text', p.income, p.surface, p.surface, 4.5],
    ['danger text', p.danger, p.surface, p.surface, 4.5],
    ['warning text', p.warn, p.surface, p.surface, 4.5],
    ['savings text', p.savings, p.surface, p.surface, 4.5],
    ['text on warning badge', p.onWarn, p.warn, p.warn, 4.5],
    ['text on danger badge', p.onDanger, p.danger, p.danger, 4.5],
    ['icon on card-bill badge', p.onSeries, p.series[1], p.series[1], 3],
    ['slab text', p.cardText, p.card, p.card, 7],
    ['slab grey', p.cardMuted, p.card, p.card, 4.5],
    ['slab accent number', p.cardAccent, p.card, p.card, 4.5],
    ['slab money in', p.cardIncome, p.card, p.card, 4.5],
    ['chart colour 1', p.series[0], p.surface, p.surface, 3],
    ['chart colour 2', p.series[1], p.surface, p.surface, 3],
    ['chart colour 3', p.series[2], p.surface, p.surface, 3],
    ['chart colour 4', p.series[3], p.surface, p.surface, 3],
  ];
  const bad = tests.filter(([, fg, bg, page, min]) => cr(fg, bg, page) < min).map(([what, fg, bg, page]) => `${what} ${cr(fg, bg, page).toFixed(2)}`);
  check(`${p.familyName} (${p.scheme}) is readable`, bad.length === 0, bad.join('; '));
  check(`${p.familyName} has shadows for cards, hero and + button`, [p.shadowCard, p.shadowHero, p.shadowRaised].every((x) => /^0px \d+px \d+px/.test(x) && /rgba\(/.test(x)));
}

/* ---------- 7. Notices: every tone readable in every theme ---------- */
console.log('\n# Notices');
for (const p of palettes) {
  const bad: string[] = [];
  for (const tone of NOTICE_TONES) {
    const c = noticeColors(p, tone);
    // The card may be see-through over the page; tile and pill sit on that card.
    const card = '#' + over(c.cardBg, p.bg).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    const rows: [string, string, string, number][] = [
      ['title', p.ink, card, 7],
      ['grey line', p.muted, card, 4.5],
      ['icon on tile', c.tileFg, c.tileBg, 3],
      ['pill text', c.pillFg, c.pillBg, 4.5],
    ];
    for (const [what, fg, bg, min] of rows) {
      const r = cr(fg, bg, card);
      if (r < min) bad.push(`${tone} ${what} ${r.toFixed(2)}`);
    }
    if (c.tinted !== (tone === 'warn' || tone === 'danger')) bad.push(`${tone} tint`);
    if (!c.tinted && !c.shadow) bad.push(`${tone} has no shadow`);
  }
  check(`${p.familyName}: all 5 notice tones are readable`, bad.length === 0, bad.join('; '));
}
check('saved theme falls back safely on bad data', JSON.stringify(parseSavedTheme('{"mode":"weird","midnight":"neon","electric":"x"}')) === '{"mode":"system","midnight":"lime","electric":"blue"}');
check('saved theme falls back on broken JSON', parseSavedTheme('not json').mode === 'system');
check('saved theme is read back', JSON.stringify(parseSavedTheme('{"mode":"light","midnight":"aqua","electric":"emerald"}')) === '{"mode":"light","midnight":"aqua","electric":"emerald"}');
check('old one-colour setting keeps its colour and moves to Auto', JSON.stringify(parseSavedTheme(null, null, '{"accent":"mango","mode":"dark"}')) === '{"mode":"system","midnight":"mango","electric":"blue"}');
check('v2 setting keeps both colours and moves to Auto once', JSON.stringify(parseSavedTheme(null, '{"mode":"dark","midnight":"aqua","electric":"violet"}')) === '{"mode":"system","midnight":"aqua","electric":"violet"}');
check('a new choice of Dark is kept after the move', parseSavedTheme('{"mode":"dark","midnight":"aqua","electric":"violet"}', '{"mode":"light"}').mode === 'dark');
check('nothing saved → Auto', parseSavedTheme(null).mode === 'system');

check('card name is shortened for the bill row', shortCardName('HDFC Bank credit card ••7788') === 'HDFC ••7788' && shortCardName('SBI Card credit card ••1234') === 'SBI Card ••1234' && shortCardName('OneCard ••5555') === 'OneCard ••5555', shortCardName('HDFC Bank credit card ••7788'));

