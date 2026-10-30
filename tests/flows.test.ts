/* Run: npx vitest run tests/flows.test.ts — checks how related payments are linked (lib/flows.ts). */
import { summarize, monthOf } from '../src/lib/analytics';
import { linkCandidates, pairKey, resolveFlows, type FlowPrefs } from '../src/lib/flows';
import { countsAsIncome, countsAsSpend, type CategoryId, type PayMode, type Txn } from '../src/lib/types';

import { check } from './check';

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 10, 12).getTime();
let n = 0;
function txn(p: Partial<Txn> & { amount: number; type: Txn['type']; merchant: string; category: CategoryId }): Txn {
  n++;
  return {
    id: `t${n}`,
    merchantKey: p.merchant.toLowerCase().replace(/[^a-z0-9]/g, ''),
    mode: 'upi' as PayMode,
    bank: 'HDFC Bank',
    account: '4321',
    timestamp: T0,
    isManual: false,
    excluded: false,
    categorySource: 'auto',
    rawSms: '',
    ...p,
  };
}
// Your salary alert tells the app your name.
const salary = txn({ type: 'credit', amount: 105500, merchant: 'Acme Software', category: 'received', mode: 'netbanking', timestamp: T0 - 7 * DAY,
  rawSms: 'Update! INR 1,05,500.00 deposited in HDFC Bank A/c XX4321 on 03-OCT-26 for NEFT Cr-ICIC0SF0002-ACME SOFTWARE PRIVATE LIMITED-RAVISHARMA-INXXXX1234.Avl bal INR 1,20,000.00' });

const get = (list: Txn[], t: Txn) => list.find((x) => x.id === t.id)!;
const month = monthOf(T0);

// 1. Slice → HDFC to yourself: one move, not spending, not income.
{
  const out = txn({ type: 'debit', amount: 700, merchant: 'Ravi Sharma', category: 'people', bank: 'slice', account: '9087' });
  const inn = txn({ type: 'credit', amount: 700, merchant: '0073@slc', category: 'received', timestamp: T0 + 60_000 });
  const r = resolveFlows([salary, out, inn]);
  const o = get(r, out), i = get(r, inn);
  check('own-account move is linked both ways', o.links?.[0]?.otherId === inn.id && i.links?.[0]?.otherId === out.id);
  check('own-account move is neither spending nor income', !countsAsSpend(o) && !countsAsIncome(i) && o.category === 'self_transfer');
  const s = summarize(r, month);
  check('totals leave the move out', s.spent === 0 && s.received === 105500, `spent ${s.spent} received ${s.received}`);
}

// 2. A friend pays you ₹500 and you pay another friend ₹500 the same day: no sign it's you, so no link.
{
  const out = txn({ type: 'debit', amount: 500, merchant: 'Ravi Kumar', category: 'people', bank: 'slice', account: '9087' });
  const inn = txn({ type: 'credit', amount: 500, merchant: 'Priya Singh', category: 'received', timestamp: T0 + 3600_000 });
  const r = resolveFlows([salary, out, inn]);
  check('same amount between two people is not a transfer', !get(r, out).links && !get(r, inn).links && countsAsSpend(get(r, out)));
}

// 3. Topping up your own Slice account from HDFC, with no Slice SMS for it: still your money.
{
  const sliceUse = txn({ type: 'debit', amount: 515, merchant: 'Zepto', category: 'groceries', bank: 'slice', account: '9087', timestamp: T0 - DAY });
  const top = txn({ type: 'debit', amount: 55000, merchant: 'Slice Small Finance Bank', category: 'other' });
  const r = resolveFlows([salary, sliceUse, top]);
  check('top-up of your own bank is a self transfer', get(r, top).category === 'self_transfer' && !countsAsSpend(get(r, top)));
  check('a shop is never taken for your bank', get(r, sliceUse).category === 'groceries');
}

// 4. Myntra order ₹2,788, two items returned: ₹988.89 and ₹396.16 come back.
{
  const buy = txn({ type: 'debit', amount: 2788, merchant: 'Myntra', category: 'shopping', mode: 'card', account: '6655', timestamp: T0 });
  const r1 = txn({ type: 'credit', amount: 988.89, merchant: 'Myntra', category: 'refund', mode: 'card', account: '6655', timestamp: T0 + 11 * DAY, rawSms: 'Refund of Rs.988.89 from MYNTRA credited to card ending 6655' });
  const r2 = txn({ type: 'credit', amount: 396.16, merchant: 'Myntra', category: 'refund', mode: 'card', account: '6655', timestamp: T0 + 11 * DAY + 1000, rawSms: 'Refund of Rs.396.16 from MYNTRA credited to card ending 6655' });
  const r = resolveFlows([buy, r1, r2]);
  const b = get(r, buy);
  check('both refunds link to the order', b.links?.length === 2 && get(r, r1).netted === true && get(r, r2).netted === true);
  check('order now costs what you kept', Math.abs(b.amount - 1402.95) < 0.01 && b.grossAmount === 2788, `amount ${b.amount}`);
  const s = summarize(r, month);
  check('refunds are not income; spending is net', Math.abs(s.spent - 1402.95) < 0.01 && s.received === 0, `spent ${s.spent} received ${s.received}`);
}

// 5. Full return: the purchase drops out of spending.
{
  const buy = txn({ type: 'debit', amount: 1999, merchant: 'Amazon', category: 'shopping', timestamp: T0 });
  const back = txn({ type: 'credit', amount: 1999, merchant: 'Amazon', category: 'refund', timestamp: T0 + 5 * DAY, rawSms: 'Refund of Rs 1999 from Amazon credited' });
  const r = resolveFlows([buy, back]);
  check('fully refunded purchase is not spending', get(r, buy).netted === true && summarize(r, month).spent === 0);
}

// 6. A failed UPI payment reversed to the same account.
{
  const pay = txn({ type: 'debit', amount: 640, merchant: 'UPI payment', category: 'other', timestamp: T0 });
  const rev = txn({ type: 'credit', amount: 640, merchant: 'Credit to HDFC Bank', category: 'received', timestamp: T0 + 2 * DAY, rawSms: 'Rs 640.00 reversed to your HDFC Bank A/c XX4321 for failed UPI txn' });
  const r = resolveFlows([pay, rev]);
  check('reversal cancels the failed payment', get(r, pay).netted === true && get(r, rev).netted === true);
}

// 7. Your corrections win.
{
  const out = txn({ type: 'debit', amount: 700, merchant: 'Ravi Sharma', category: 'people', bank: 'slice', account: '9087' });
  const inn = txn({ type: 'credit', amount: 700, merchant: '0073@slc', category: 'received', timestamp: T0 + 60_000 });
  const unlinked: FlowPrefs = { links: [], unlinked: [pairKey(out.id, inn.id)], ownNames: [] };
  const r1 = resolveFlows([out, inn], unlinked);
  check('a link you removed stays removed', !get(r1, out).links && !get(r1, inn).links);
  const picked = { ...out, category: 'people' as CategoryId, categorySource: 'manual' as const };
  const r2 = resolveFlows([salary, picked, inn]);
  check('a category you picked is not changed', get(r2, picked).category === 'people' && !get(r2, picked).links);
}

// 8. A link you make by hand.
{
  const out = txn({ type: 'debit', amount: 3000, merchant: 'Rahul', category: 'people' });
  const inn = txn({ type: 'credit', amount: 3000, merchant: 'Rahul', category: 'received', timestamp: T0 + 9 * DAY });
  const r = resolveFlows([out, inn], { links: [{ kind: 'refund', outId: out.id, inId: inn.id }], unlinked: [], ownNames: [] });
  check('a refund you linked by hand is applied', get(r, out).netted === true && get(r, inn).links?.[0]?.source === 'user');
  check('the other payment is offered when linking', linkCandidates(out, [out, inn]).some((c) => c.txn.id === inn.id));
}

// 9. Cashback is a reward, not a refund of one purchase.
{
  const buy = txn({ type: 'debit', amount: 500, merchant: 'Paytm', category: 'shopping', timestamp: T0 });
  const cb = txn({ type: 'credit', amount: 25, merchant: 'Paytm', category: 'refund', timestamp: T0 + DAY, rawSms: 'Cashback of Rs 25 received in your Paytm wallet' });
  const r = resolveFlows([buy, cb]);
  check('cashback stays as money in', !get(r, cb).links && countsAsIncome(get(r, cb)));
}

// 10. Paying your own card bill links the bank side and the card side.
{
  const pay = txn({ type: 'debit', amount: 39913, merchant: 'CRED Club', category: 'card_bill', timestamp: T0 });
  const got = txn({ type: 'credit', amount: 39913, merchant: 'HDFC Bank card bill paid', category: 'card_bill', mode: 'card', account: '6655', timestamp: T0 + DAY });
  const r = resolveFlows([pay, got]);
  check('card bill payment is linked to the card', get(r, pay).links?.[0]?.otherId === got.id && get(r, pay).category === 'card_bill');
}

