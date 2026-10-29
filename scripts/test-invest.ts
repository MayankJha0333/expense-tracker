/* Run: npx tsx scripts/test-invest.ts — SIPs, scheduled autopays and fund names. */
import { investmentOverview } from '../src/lib/investments';
import { parseFundName, parseScheduledDebit } from '../src/lib/parser';
import { processInbox } from '../src/lib/pipeline';

let passed = 0;
let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const at = (m: number, d: number, h = 10) => new Date(2026, m, d, h).getTime();
let n = 0;
const sms = (sender: string, body: string, date: number) => ({ id: String(n++), sender, body, date });

const sbi = parseScheduledDebit(sms('JD-SBIUPI-S', 'Dear UPI User, UPI AutoPay for Indian Clearing Corporation debit of Rs.5000.00 is scheduled on .07/10/26, 9b93d8@yesg. Please maintain balance', at(9, 5)));
eq('SBI autopay: amount', sbi?.amount, 5000);
eq('SBI autopay: date', new Date(sbi?.date ?? 0).toDateString(), new Date(2026, 9, 7).toDateString());
eq('SBI autopay: bank', sbi?.bank, 'SBI');
const hdfc = parseScheduledDebit(sms('JM-HDFCBK-S', 'E-Mandate! Rs.199.00 will be deducted on 21/10/26, 00:00:00 For NETFLIX mandate UMN 5a43@okhdfcbank Maintain Balance -HDFC Bank', at(9, 19)));
eq('HDFC mandate: name and amount', [hdfc?.name, hdfc?.amount], ['Netflix', 199]);
eq('not a schedule', parseScheduledDebit(sms('VM-HDFCBK-S', 'Sent Rs.250.00 From HDFC Bank A/C *4321 To SWIGGY On 05/10/26', at(9, 5))), null);
eq('fund name, repeated word dropped', parseFundName(sms('JM-GROWWO-S', '886179 is the OTP to edit your SIP in Nippon Nippon India Small.. on Groww. Valid for 15 minutes.', at(7, 19))), 'Nippon India Small');

const inbox = [
  // July and August: scheduled from SBI, no debit message. September: scheduled and paid. October: paid from HDFC.
  sms('JD-SBIUPI-S', 'Dear UPI User, UPI AutoPay for Indian Clearing Corporation debit of Rs.5000.00 is scheduled on .11/07/26, x@yesg.', at(6, 9)),
  sms('JD-SBIUPI-S', 'Dear UPI User, UPI AutoPay for Indian Clearing Corporation debit of Rs.5000.00 is scheduled on .11/08/26, x@yesg.', at(7, 9)),
  sms('JD-SBIUPI-S', 'Dear UPI User, UPI AutoPay for Indian Clearing Corporation debit of Rs.5000.00 is scheduled on .11/09/26, x@yesg.', at(8, 9)),
  sms('JD-SBIUPI-S', 'Dear UPI user A/C X1346 debited by 5000.00 on date 11Sep26 trf to Indian Clearing Refno 109993668710 If not u? call-1800111109 -SBI', at(8, 11)),
  sms('AD-HDFCBK-S', 'Sent Rs.5000.00 From HDFC Bank A/C *4321 To MUTUAL FUNDS ICCL On 09/10/26 Ref 628218863507 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808', at(9, 9)),
  sms('JD-SBIUPI-S', 'Dear UPI User, UPI AutoPay for Indian Clearing Corporation debit of Rs.5000.00 is scheduled on .11/11/26, x@yesg.', at(10, 9)),
  sms('JM-GROWWO-S', '337124 is the OTP to edit your SIP in Aditya Aditya Birla Sun PSU.. on Groww. Valid for 15 minutes.', at(7, 19)),
];
const r = processInbox(inbox);
const o = investmentOverview(r.txns, r.scheduled, r.funds, { year: 2026, month: 9 }, new Set(), at(9, 29));
eq('invested this month', o.thisMonth, 5000);
eq('invested in 12 months (paid only)', o.last12, 10000);
eq('scheduled with no payment message', o.noDebitSeen.map((s) => new Date(s.date).getMonth() + 1), [8, 7]);
eq('upcoming SIP', o.upcoming.map((s) => new Date(s.date).getDate()), [11]);
eq('one SIP plan found', o.sips.map((s) => [s.amount, s.active, s.months]), [[5000, true, 4]]);
eq('next SIP is the scheduled one', new Date(o.sips[0]?.next ?? 0).toDateString(), new Date(2026, 10, 11).toDateString());
eq('fund names', r.funds, ['Aditya Birla Sun PSU']);
const ignored = investmentOverview(r.txns, r.scheduled, r.funds, { year: 2026, month: 9 }, new Set(o.noDebitSeen.map((s) => s.id)), at(9, 29));
eq('ignored ones are not asked again', ignored.noDebitSeen.length, 0);

console.log(`${passed} / ${passed + failed} passed`);
if (failed) process.exit(1);
