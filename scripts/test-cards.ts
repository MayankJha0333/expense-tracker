/* Run: npx tsx scripts/test-cards.ts — credit card bills, card payments and where the money went. */
import { cardOverview, cardPaymentsToCheck, instrumentKey } from '../src/lib/accounts';
import { resolveFlows } from '../src/lib/flows';
import { moneyFlow } from '../src/lib/moneyflow';
import { processInbox } from '../src/lib/pipeline';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
}
const eq = (name: string, got: unknown, want: unknown) => check(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

const DAY = 86_400_000;
const at = (m: number, d: number, h = 10) => new Date(2026, m, d, h).getTime();
let n = 0;
const sms = (sender: string, body: string, date: number) => ({ id: String(n++), sender, body, date });

const inbox = [
  // September bill, new HDFC style: no amount in the statement, amount in an app reminder.
  sms('AD-HDFCBK-S', 'Statement Generated: For HDFC Bank Credit Card XX8429. View: https://x Pay: https://y', at(9, 2, 9)),
  sms('JK-TNBPAY-S', 'Your HDFC Credit Card bill of Rs.49243.00 is due on 2026-10-21. Pay by 2026-10-21 to avoid late charges: https://m.tneu.in - Tata Neu', at(9, 18)),
  sms('JX-TNBPAY-P', 'Your HDFC Credit Card bill of Rs.49243.00 is due on 2026-10-21. Pay by 2026-10-21 to avoid late charges: https://m.tneu.in - Tata Neu', at(9, 20)),
  // An EMI offer is not a bill.
  sms('VM-HDFCBN-P', 'Convert recent HDFC Bank Credit Card x8429 spends of Rs.2714 into EMIs with SmartEMI.', at(9, 2, 12)),
  // Paid through CRED on the 3rd: the bank sent 49,238, the card got 49,243.
  sms('VM-HDFCBK-S', 'Sent Rs.49238.00\nFrom HDFC Bank A/C *7175\nTo CRED Club\nOn 03/10/26\nRef 664204197654\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', at(9, 3)),
  sms('AD-HDFCBK-S', 'DEAR HDFCBANK CARDMEMBER, PAYMENT OF Rs. 49243.00 RECEIVED TOWARDS YOUR CREDIT CARD ENDING WITH 8429 ON 3-10-2026.YOUR AVAILABLE LIMIT IS RS. 72649.28', at(9, 3, 11)),
  // Salary, spending from the bank, spending on the card through UPI, and a move to slice.
  sms('VM-HDFCBK-S', 'Update! INR 1,16,932.00 deposited in HDFC Bank A/c XX7175 on 03-OCT-26 for NEFT Cr-ICIC0SF0002-SPLITX SOLUTIONS PRIVATE LIMITED-MAYANK JHA-ICICN52026100300012345.Avl bal INR 1,20,000.00', at(9, 3, 8)),
  sms('VM-HDFCBK-S', 'Sent Rs.250.00\nFrom HDFC Bank A/C *7175\nTo SWIGGY\nOn 05/10/26\nRef 628512345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', at(9, 5)),
  sms('JM-HDFCBK-S', 'Txn Rs.1200.00 On HDFC Bank Card 8429 At blinkit.payu@hdfcbank by UPI 123799215443 On 10-10 Not You? Call 18002586161/SMS BLOCK CC 8429 to 7308080808', at(9, 10)),
  sms('VM-HDFCBK-S', 'Sent Rs.55000.00\nFrom HDFC Bank A/C *7175\nTo slice small finance bank\nOn 06/10/26\nRef 627947562244\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', at(9, 6)),
  sms('AX-SLCEIT-T', 'Rs. 1,000 received in slice A/c xx5043 on 01-Sep-26 from Tarun Jha via UPI (Ref ID: 605906098403). Avl. Bal. Rs. 1,031.00 - slice', at(8, 1)),
  // A card payment from somewhere we can't see.
  sms('AD-KOTAKB-S', 'Payment of Rs 3,000.00 received towards your Kotak Credit Card xx0821 on 15-Oct-26. Thank you.', at(9, 15)),
];

const now = at(9, 29);
const r = processInbox(inbox);
const txns = resolveFlows(r.txns);

const hdfc = r.bills.filter((b) => b.account === '8429');
eq('one bill from statement + 2 reminders', hdfc.length, 1);
eq('bill amount from the reminder', hdfc[0]?.amountDue, 49243);
eq('bill starts on the statement day', new Date(hdfc[0]?.statementDate ?? 0).getDate(), 2);
eq('due date read from 2026-10-21', new Date(hdfc[0]?.dueDate ?? 0).toDateString(), new Date(2026, 9, 21).toDateString());
eq('two reminders kept', hdfc[0]?.reminders?.length, 2);
check('EMI offer is not a bill', !r.bills.some((b) => b.amountDue === 2714));

const cred = txns.find((t) => t.merchant === 'CRED Club');
eq('CRED payment linked to the card credit despite ₹5 difference', cred?.links?.[0]?.kind, 'transfer');
const cardUpi = txns.find((t) => t.amount === 1200);
eq('card used over UPI belongs to the card', cardUpi ? instrumentKey(cardUpi) : null, 'card:hdfc-bank:8429');

const ov = cardOverview(r.bills, txns, new Set(), now);
const card = ov.cards.find((c) => c.key === 'card:hdfc-bank:8429');
eq('bill is paid', card?.due?.status, 'paid');
eq('paid on the 3rd', new Date(card?.due?.paidOn ?? 0).getDate(), 3);
eq('both sides of the payment shown', card?.due?.paidBy.length, 2);
eq('reminders after paying are flagged', card?.due?.remindersAfterPaid, 2);
eq('unbilled = card spending since statement', card?.unbilled, 1200);
eq('owed now = unbilled', ov.totalOutstanding, 1200);

const toCheck = cardPaymentsToCheck(txns, ov.cards.flatMap((c) => (c.due ? [c.due] : [])), new Set(), now);
eq('unmatched Kotak card payment to check', toCheck.map((t) => t.amount), [3000]);
eq('checked payments are not asked again', cardPaymentsToCheck(txns, [], new Set(toCheck.map((t) => t.id)), now).length, 0);

const oct = txns.filter((t) => t.timestamp >= at(9, 2, 0) && t.timestamp < at(10, 2, 0));
const f = moneyFlow(oct, txns, r.bills);
eq('income', f.income, 116932);
eq('spent (bank + card)', f.spent, 1450);
eq('spent on cards', f.spentOnCards, 1200);
eq('card bills paid from the bank', f.cardBillsPaid, 49238);
eq('moved to own accounts', f.movedOut, 55000);
const acct = f.accounts.find((a) => a.key.includes('7175'));
eq('HDFC balance change = in - out', acct?.change, 116932 - 49238 - 250 - 55000);

console.log(`${passed} / ${passed + failed} passed`);
if (failed) process.exit(1);
