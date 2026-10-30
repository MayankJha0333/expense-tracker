/* Run: npx vitest run tests/currency.test.ts — currencies: reading them from SMS, formatting, totals, and edge cases. */
import { cardDues, notCountedIncome } from '../src/lib/accounts';
import { shortDay, summarize, monthOf } from '../src/lib/analytics';
import {
  currencyForLocale,
  currencyFromToken,
  inHome,
  mostUsedCurrency,
  parseAmountText,
  pickHomeCurrency,
  setHomeCurrency,
} from '../src/lib/currency';
import { demoExtras, demoInbox } from '../src/lib/demo';
import { goalPlan } from '../src/lib/goals';
import { formatCount, money, moneyCompact, percent } from '../src/lib/money';
import { parseCardBill, parseSms, type RawSms } from '../src/lib/parser';
import { processInbox } from '../src/lib/pipeline';
import { countsAsSpend, type CardBill, type Txn } from '../src/lib/types';

import { check, eq } from './check';


const NOW = new Date(2026, 9, 28, 12).getTime();
const sms = (sender: string, body: string, date = NOW): RawSms => ({ id: String(Math.random()), sender, body, date });
const parsed = (sender: string, body: string) => {
  const r = parseSms(sms(sender, body));
  return r.ok ? r.txn : null;
};

/* ---------- 1. Reading currencies ---------- */
console.log('# Reading currencies');
eq('₹ / Rs / INR / rupees are rupees', ['₹', 'Rs', 'Rs.', 'INR', 'rupees'].map(currencyFromToken), ['INR', 'INR', 'INR', 'INR', 'INR']);
eq('$ / USD / US$ are dollars', ['$', 'USD', 'US$'].map(currencyFromToken), ['USD', 'USD', 'USD']);
eq('€ £ AED ¥ S$ CA$ A$', ['€', '£', 'AED', '¥', 'S$', 'CA$', 'A$'].map(currencyFromToken), ['EUR', 'GBP', 'AED', 'JPY', 'SGD', 'CAD', 'AUD']);
eq('unknown sign is null', currencyFromToken('xyz'), null);

eq('1,234.56 (USD)', parseAmountText('1,234.56', 'USD'), 1234.56);
eq('1.234,56 (EUR, European style)', parseAmountText('1.234,56', 'EUR'), 1234.56);
eq('12,50 (EUR decimal comma)', parseAmountText('12,50', 'EUR'), 12.5);
eq('1,00,000 (INR lakh grouping)', parseAmountText('1,00,000', 'INR'), 100000);
eq('12,50 in rupees is never a decimal comma', parseAmountText('12,50', 'INR'), 1250);
eq('1,234 (USD thousands)', parseAmountText('1,234', 'USD'), 1234);
eq('1.234.567 (dots as thousands)', parseAmountText('1.234.567', 'EUR'), 1234567);

/* ---------- 2. US and foreign SMS ---------- */
console.log('\n# US and foreign SMS');
const chase = parsed('24273', 'Chase: A $25.67 transaction was made on your Sapphire card ending in 4417 at STARBUCKS on 10/27/26. Not you? Call 1-800-432-3117.');
eq('Chase card alert', chase && [chase.amount, chase.currency, chase.type, chase.merchant, chase.account, chase.mode, chase.bank], [25.67, 'USD', 'debit', 'Starbucks', '4417', 'card', 'Chase']);
const bofa = parsed('73981', "BofA: Purchase of $128.40 at TRADER JOE'S on debit card ending in 2210 on 10/26/26.");
eq('BofA debit card purchase', bofa && [bofa.amount, bofa.currency, bofa.merchant, bofa.account], [128.4, 'USD', "Trader Joe's", '2210']);
const amex = parsed('263966', 'Amex: Your card ending in 1009 was charged $34.99 at LYFT on 10/25/26.');
eq('Amex charge (and LYFT reads "Lyft")', amex && [amex.amount, amex.merchant, amex.bank], [34.99, 'Lyft', 'Amex']);
const zelleOut = parsed('73981', 'BofA: You sent $80.00 to Maya Chen via Zelle from checking account ending in 2210.');
eq('Zelle sent', zelleOut && [zelleOut.type, zelleOut.merchant, zelleOut.amount], ['debit', 'Maya Chen', 80]);
const zelleIn = parsed('73981', 'BofA: Zelle payment of $45.00 received from Jordan Lee. Checking account ending in 2210.');
eq('Zelle received is money in', zelleIn && [zelleIn.type, zelleIn.merchant], ['credit', 'Jordan Lee']);
const pay = parsed('73981', 'BofA: Direct deposit of $3,250.00 received from ACME CORP PAYROLL on 10/15/26. Checking account ending in 2210.');
eq('US payroll', pay && [pay.type, pay.amount, pay.merchant], ['credit', 3250, 'Acme Corp']);
const cardServices = parsed('73981', 'BofA: Online payment of $650.84 to CHASE CARD SERVICES from checking account ending in 2210.');
eq('"Card services" bill payment is not a card spend', cardServices?.mode, 'other');
const figma = parsed('AD-HDFCBK', 'Spent USD 15.00 On HDFC Bank Card 7788 At FIGMA On 2026-10-07:07:30:00.Not You? To Block+Reissue Call 18002586161');
eq('Indian card used abroad keeps its currency', figma && [figma.amount, figma.currency, figma.merchant], [15, 'USD', 'Figma']);
const codeAfter = parsed('AD-HDFCBK', 'Your HDFC Bank Card 7788 was used for 12.50 EUR at CAFE DE FLORE on 10-10-26.');
eq('"12.50 EUR" (code after the number)', codeAfter && [codeAfter.amount, codeAfter.currency], [12.5, 'EUR']);
const noSign = parsed('VM-HDFCBK', 'Your A/c XX4521 is debited by 500.00 on 12-10-26 towards UPI/123456789012/SWIGGY.');
eq('Indian bank with no currency sign → rupees', noSign?.currency, 'INR');
const balance = parsed('AD-SBIBNK', 'INR 500.00 debited from A/c XX1234 on 12-10-26 to VPA swiggy@icici. Avl Bal INR 10,000.00');
eq('Balance is never read as the amount', balance?.amount, 500);
eq('Declined US alert is skipped', parseSms(sms('24273', 'Chase: A $54.20 transaction at BEST BUY was declined on your card ending in 4417.')).ok, false);
eq('US OTP is skipped', parseSms(sms('24273', 'Your Chase verification code is 482913. Never share it.')).ok, false);

const usBill = parseCardBill(sms('24273', 'Chase: Your Sapphire credit card ending in 4417 statement balance is $1,234.56. Minimum due $35.00. Payment due by Nov 15, 2026.', new Date(2026, 9, 18).getTime()));
eq('US statement: total, minimum, currency', usBill && [usBill.amountDue, usBill.minDue, usBill.currency, usBill.bank], [1234.56, 35, 'USD', 'Chase']);
eq('US statement: "Nov 15, 2026" due date', usBill?.dueDate && new Date(usBill.dueDate).toDateString(), new Date(2026, 10, 15).toDateString());
const inBill = parseCardBill(sms('AD-HDFCBK', 'Your HDFC Bank Credit Card XX7788 statement is generated. Total amount due Rs 16,764.00. Minimum due Rs 838.00. Due date 05-Nov-26.', new Date(2026, 9, 16).getTime()));
eq('Indian statement still reads day-first dates and rupees', inBill && [inBill.amountDue, inBill.currency, new Date(inBill.dueDate ?? 0).toDateString()], [16764, 'INR', new Date(2026, 10, 5).toDateString()]);

/* ---------- 3. Formatting ---------- */
console.log('\n# Formatting');
setHomeCurrency('INR');
eq('rupees: Indian grouping, no paise by default', money(1234567.4), '₹12,34,567');
eq('rupees: paise when asked', money(0.5, { decimals: true }), '₹0.50');
eq('dollars: cents when there are some', money(1234567.4, { currency: 'USD' }), '$1,234,567.40');
eq('dollars: no ".00" on whole amounts', money(20, { currency: 'USD' }), '$20');
eq('yen never has decimals', money(1200.7, { currency: 'JPY', decimals: true }), '¥1,201');
eq('AED keeps its code together with the number', money(99, { currency: 'AED' }), 'AED 99');
eq('negative', money(-250, { currency: 'USD' }), '-$250');
eq('NaN / Infinity show as 0', [money(NaN), money(Infinity)], ['₹0', '₹0']);
eq('-0 and tiny negatives never show "-₹0"', [money(-0), money(-0.2)], ['₹0', '₹0']);
eq('$0.995 rounds to $1', money(0.995, { currency: 'USD' }), '$1');
eq('compact rupees: k / L / Cr', [moneyCompact(950), moneyCompact(45230), moneyCompact(152000), moneyCompact(98765432)], ['₹950', '₹45.2k', '₹1.5L', '₹9.9Cr']);
eq('compact dollars: K / M / B', [moneyCompact(950, 'USD'), moneyCompact(45230, 'USD'), moneyCompact(1520000, 'USD'), moneyCompact(2.5e9, 'USD')], ['$950', '$45.2K', '$1.5M', '$2.5B']);
eq('percent edge cases', [percent(0.004), percent(1.04), percent(NaN), percent(250)], ['<1%', '104%', '0%', '>9,999%']);
eq('counts use the home grouping', formatCount(123456), '1,23,456');
setHomeCurrency('USD');
eq('… and western grouping for dollars', formatCount(123456), '123,456');
eq('US dates put the month first', shortDay(new Date(2026, 10, 15).getTime()), 'Nov 15');
setHomeCurrency('INR');
eq('Indian dates put the day first', shortDay(new Date(2026, 10, 15).getTime()), '15 Nov');

/* ---------- 4. Picking the home currency ---------- */
console.log('\n# Home currency');
eq('phone region → currency', ['en-US', 'en_US', 'hi-IN', 'en-GB', 'de-DE', 'en', null].map(currencyForLocale), ['USD', 'USD', 'INR', 'GBP', 'EUR', null, null]);
const mk = (currency: string | undefined, daysAgo = 1) => ({ currency, timestamp: NOW - daysAgo * 86_400_000 });
eq('auto follows most payments', pickHomeCurrency('auto', [mk('USD'), mk('USD'), mk('INR')], 'en-IN', NOW), 'USD');
eq('your choice in Settings wins', pickHomeCurrency('EUR', [mk('USD'), mk('USD')], 'en-US', NOW), 'EUR');
eq('no payments yet → phone region', pickHomeCurrency('auto', [], 'en-US', NOW), 'USD');
eq('no payments, unknown region → rupees', pickHomeCurrency('auto', [], null, NOW), 'INR');
eq('old payments (4+ months) do not decide', mostUsedCurrency([mk('USD', 200), mk('INR', 2)], NOW), 'INR');
eq('payments with no currency are ignored when picking', mostUsedCurrency([mk(undefined), mk(undefined), mk('USD')], NOW), 'USD');

/* ---------- 5. Totals never mix currencies ---------- */
console.log('\n# Totals');
const t = (id: string, amount: number, currency: string | undefined, type: 'debit' | 'credit' = 'debit', category: Txn['category'] = 'shopping'): Txn => ({
  id, amount, currency: currency as Txn['currency'], type, category, merchant: id, merchantKey: id, mode: 'card', bank: null, account: '1111',
  timestamp: NOW, isManual: true, excluded: false, categorySource: 'manual',
});
setHomeCurrency('INR');
const mixed = [t('a', 1000, 'INR'), t('b', 50, 'USD'), t('c', 200, undefined), t('d', 5000, 'INR', 'credit', 'salary'), t('e', 99, 'EUR', 'credit', 'received')];
const s = summarize(mixed, monthOf(NOW));
eq('spent adds only home-currency payments (old ones without a currency count as home)', s.spent, 1200);
eq('money in adds only home currency', s.received, 5000);
eq('a dollar payment is not "spend" in a rupee app', countsAsSpend(mixed[1]), false);
eq('"money in that isn\'t income" skips other currencies', notCountedIncome(mixed).total, 0);
setHomeCurrency('USD');
eq('switch home to USD: the dollar payment counts, rupee ones drop out', summarize(mixed, monthOf(NOW)).spent, 250);
eq('…and old payments without a currency follow the home currency', inHome(mixed[2]), true);
setHomeCurrency('INR');
const bills: CardBill[] = [
  { id: 'b1', bank: 'HDFC Bank', account: '1111', amountDue: 5000, minDue: 250, dueDate: NOW + 5 * 86_400_000, statementDate: NOW - 86_400_000, currency: 'INR' },
  { id: 'b2', bank: 'Chase', account: '4417', amountDue: 300, minDue: 35, dueDate: NOW + 5 * 86_400_000, statementDate: NOW - 86_400_000, currency: 'USD' },
];
eq('card bills in another currency stay out of "to pay"', cardDues(bills, mixed, new Set(), NOW).map((d) => d.bill.id), ['b1']);

/* ---------- 6. Sample data ---------- */
console.log('\n# Sample data');
setHomeCurrency('USD');
const us = processInbox(demoInbox(NOW, 'us'));
check('US sample: every payment is in dollars', us.txns.length > 300 && us.txns.every((x) => x.currency === 'USD'), `${us.txns.length} payments`);
check('US sample: both cards have statements in dollars', new Set(us.bills.map((b) => b.account)).size === 2 && us.bills.every((b) => b.currency === 'USD'));
const usOther = us.txns.filter((x) => x.category === 'other').length;
check('US sample: shops are recognised (few "Other")', usOther / us.txns.length < 0.05, `${usOther} of ${us.txns.length}`);
let ok = 0;
let cycles = 0;
for (const acct of ['4417', '1009']) {
  const list = us.bills.filter((b) => b.account === acct).sort((a, b) => a.statementDate - b.statementDate);
  for (let i = 1; i < list.length; i++) {
    const spent = us.txns
      .filter((x) => x.mode === 'card' && x.account === acct && x.type === 'debit' && x.timestamp > list[i - 1].statementDate && x.timestamp < list[i].statementDate)
      .reduce((a, x) => a + x.amount, 0);
    cycles++;
    if (Math.abs(spent - list[i].amountDue) < 0.01) ok++;
  }
}
check('US sample: each statement equals the card spends in its cycle (to the cent)', cycles > 0 && ok === cycles, `${ok}/${cycles}`);
setHomeCurrency('INR');
const india = processInbox(demoInbox(NOW, 'india'));
check('India sample: one dollar subscription a month, rest in rupees', india.txns.filter((x) => x.currency === 'USD').every((x) => x.merchant === 'Figma') && india.txns.filter((x) => x.currency === 'INR').length > 400);
const stress = demoExtras(NOW, 'stress');
check('stress sample: 5 other currencies, huge and tiny amounts', new Set(stress.manual.map((x) => x.currency).filter((c) => c !== 'INR')).size === 5 && stress.manual.some((x) => x.amount > 1e8) && stress.manual.some((x) => x.amount < 1));

/* ---------- 7. Goals ---------- */
console.log('\n# Goals');
const goal = { id: 'g', name: 'x', target: 1000, saved: 100, icon: 'star' as const, color: '#000', createdAt: NOW };
check('a goal whose date has passed says so', /date passed/.test(goalPlan({ ...goal, deadline: Date.now() - 40 * 86_400_000 })));
eq('an overfilled goal is "Reached"', goalPlan({ ...goal, saved: 2500, deadline: null }), 'Reached. Well done!');

