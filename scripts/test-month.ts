/** Checks months that start on a day other than the 1st (Settings → Your month). */
import { cashflow, dayOfMonth, daysInMonth, monthName, monthOf, monthRange, monthTitle, setMonthStart, summarize, type Month } from '../src/lib/analytics';
import type { Txn } from '../src/lib/types';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
}
const eq = (name: string, got: unknown, want: unknown) => check(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
const oct: Month = { year: 2026, month: 9 };
let n = 0;
const txn = (ts: number, amount: number, type: 'debit' | 'credit' = 'debit'): Txn =>
  ({ id: `t${n++}`, type, amount, timestamp: ts, merchant: type === 'credit' ? 'Salary' : 'Shop', merchantKey: '', category: type === 'credit' ? 'salary' : 'shopping', mode: 'upi', source: 'manual', isManual: true }) as unknown as Txn;

// Calendar months (the default).
setMonthStart(1);
eq('1st: 6 Oct is October', monthOf(at(2026, 9, 6)), oct);
eq('1st: October has 31 days', daysInMonth(oct), 31);
eq('1st: name', monthName(oct), 'October 2026');
eq('1st: title', monthTitle(oct), 'October');

// Months that start on the 7th.
setMonthStart(7);
eq('7th: 7 Oct is October', monthOf(at(2026, 9, 7, 0)), oct);
eq('7th: 6 Nov 23:59 is still October', monthOf(new Date(2026, 10, 6, 23, 59).getTime()), oct);
eq('7th: 6 Oct is September', monthOf(at(2026, 9, 6)), { year: 2026, month: 8 });
eq('7th: 3 Jan 2027 is December 2026', monthOf(at(2027, 0, 3)), { year: 2026, month: 11 });
eq('7th: 7 Oct is day 1', dayOfMonth(at(2026, 9, 7)), 1);
eq('7th: 1 Nov is day 26', dayOfMonth(at(2026, 10, 1)), 26);
eq('7th: October runs 31 days (7 Oct to 6 Nov)', daysInMonth(oct), 31);
eq('7th: February runs 28 days in 2027', daysInMonth({ year: 2027, month: 1 }), 28);
eq('7th: range', monthRange(oct), '7 Oct – 6 Nov');
eq('7th: December range crosses the year', monthRange({ year: 2026, month: 11 }), '7 Dec – 6 Jan');

// Salary on the 7th and the spending it pays for land in the same month.
const all = [txn(at(2026, 9, 7), 100000, 'credit'), txn(at(2026, 9, 20), 3000), txn(at(2026, 10, 5), 2000), txn(at(2026, 10, 7), 500)];
const s = summarize(all, oct);
eq('7th: salary counted in October', s.received, 100000);
eq('7th: spending to 6 Nov counted, 7 Nov not', s.spent, 5000);
eq('7th: 5 Nov is day 30 on the calendar', s.byDay[30], 2000);
const flow = cashflow(all, { year: 2026, month: 10 }, 2);
eq('7th: cash flow splits at the 7th', flow.map((f) => f.spent), [5000, 500]);

// Out of range values are clamped.
setMonthStart(31);
eq('31 is clamped to 28', monthOf(at(2026, 9, 27)), { year: 2026, month: 8 });
setMonthStart(0);
eq('0 is clamped to 1', monthOf(at(2026, 9, 1, 0)), oct);

console.log(`${passed} / ${passed + failed} passed`);
if (failed) process.exit(1);
