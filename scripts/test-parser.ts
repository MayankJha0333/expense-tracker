/* Run: npx tsx scripts/test-parser.ts — checks the SMS reader on real-looking bank messages. */
import { categorize } from '../src/lib/categorize';
import { money, moneyCompact } from '../src/lib/money';
import { parseSms } from '../src/lib/parser';
import { processInbox } from '../src/lib/pipeline';
import { summarize, thisMonth } from '../src/lib/analytics';

// [sender, body, expected]  expected = "skip <reason>" or "<type> <amount> <merchant|*> <category> <mode> <account|->"
const CASES: [string, string, string][] = [
  ['VM-HDFCBK-S', 'Sent Rs.250.00\nFrom HDFC Bank A/C *4521\nTo SWIGGY\nOn 12/10/26\nRef 628512345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', 'debit 250 Swiggy food upi 4521'],
  ['AD-HDFCBK', 'Spent Rs.1499 On HDFC Bank Card 7788 At AMAZON PAY INDIA On 2026-10-11:18:22:10.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 7788 to 7308080808', 'debit 1499 Amazon Pay shopping card 7788'],
  ['JD-ICICIT-S', 'ICICI Bank Acct XX123 debited for Rs 320.00 on 10-Oct-26; ZOMATO LIMITED credited. UPI:628400112233. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.', 'debit 320 Zomato food upi 123'],
  ['AX-SBIUPI', 'Dear UPI user A/C X9876 debited by 60.0 on date 09Oct26 trf to UBER INDIA SYSTEMS Refno 628212345678. If not u? call 1800111109. -SBI', 'debit 60 Uber India Systems transport upi 9876'],
  ['VK-AXISBK', 'INR 845.00 debited\nA/c no. XX3344\n11-10-26, 20:14:33\nUPI/P2M/628498765432/BLINKIT\nNot you? SMS BLOCKALL 3344 to 919951860002\nAxis Bank', 'debit 845 Blinkit groceries upi 3344'],
  ['BZ-KOTAKB-S', 'Sent Rs.500.00 from Kotak Bank AC X5566 to ramesh.kumar@okaxis on 08-10-26.UPI Ref 628311112222. Not you, kotak.com/KBANKT/Fraud', 'debit 500 Ramesh Kumar people upi 5566'],
  ['AD-HDFCBK', 'Money Received - INR 52,000.00 in your HDFC Bank A/c xx4521 on 01-10-26 by NEFT from ACME TECHNOLOGIES PVT LTD SALARY OCT. Avl bal: INR 61,234.00', 'credit 52000 * salary netbanking 4521'],
  ['VM-SBIINB', 'Dear Customer, Rs.5,000.00 withdrawn at SBI ATM S1BW000123 from A/c X9876 on 07Oct26. Avl Bal Rs.12,345.00. -SBI', 'debit 5000 * cash atm 9876'],
  ['AD-ICICIB', 'Dear Customer, Payment of INR 12,450.00 has been received on your ICICI Bank Credit Card Account 4XXX1234 on 05-Oct-26. Thank you.', 'credit 12450 * card_bill card 1234'],
  ['VM-HDFCBK', 'Rs.2000.00 debited from a/c **4521 on 04-10-26 to VPA cred.club@axisb (UPI Ref No 628001122334). Not you? Call on 18002586161 to report', 'debit 2000 Cred Club card_bill upi 4521'],
  ['AD-SBICRD', 'Thank you for using your SBI Credit Card ending 4455 for Rs 899.00 at NETFLIX on 03/10/26. Not you? Report at https://sbicard.com/Dispute', 'debit 899 Netflix entertainment card 4455'],
  ['JM-ICICIT', 'INR 1,234.50 spent using ICICI Bank Card XX9012 on 02-Oct-26 on IND*APOLLO PHARMACY. Avl Limit: INR 45,678.00. If not you, call 1800 2662/SMS BLOCK 9012 to 9215676766', 'debit 1234.5 * health card 9012'],
  ['VM-HDFCBK', 'Rs.150.00 credited to a/c XXXXXX4521 on 30-09-26 by a/c linked to VPA 9876543210@ybl (UPI Ref No 627912345678).', 'credit 150 9876543210@ybl received upi 4521'],
  ['AD-AMAZON', 'Refund of Rs.499 for your order has been credited to your card ending 7788.', 'credit 499 * refund card 7788'],
  ['VM-PAYTMB', 'Paid Rs.120 to Chai Point from Paytm Balance. Updated Balance: Paytm Wallet- Rs 340.', 'debit 120 Chai Point food wallet -'],
  ['BP-IDFCFB-S', 'Your A/C XXXXXXX1122 is debited by INR 3,500.00 on 28/09/26 for FASTAG Recharge. New balance INR 8,000.00', 'debit 3500 * transport other 1122'],
  ['AD-HDFCBK', 'OTP is 482913 for txn of INR 1499.00 at AMAZON on card ending 7788. Valid till 18:30. Do not share OTP for security reasons.', 'skip otp'],
  ['VM-ICICIB', '123456 is your OTP to login to iMobile. Do not share it with anyone.', 'skip otp'],
  ['JD-SBIINB', 'Dear Customer, use OTP 7781 to complete your transaction of Rs 2,000.00. Never share OTP with anyone.', 'skip otp'],
  ['VM-HDFCBK-P', 'Get up to 10% cashback on your HDFC Bank Credit Card. Apply now!', 'skip promo'],
  ['AD-KOTAKB', 'Congratulations! You are eligible for a pre-approved personal loan of Rs 5,00,000. Click here to avail.', 'skip promo'],
  ['+919876543210', 'Bhai sent you Rs 500 for dinner, check', 'skip personal'],
  ['AD-ICICIB', 'Your ICICI Bank Credit Card XX1234 statement is generated. Total amount due Rs 12,450. Minimum due Rs 620. Due date 15-Oct-26.', 'skip reminder'],
  ['VM-HDFCBK', 'Txn of Rs.300.00 on HDFC Bank Card 7788 at MYNTRA failed due to incorrect PIN.', 'skip failed'],
  ['AX-SBIUPI', "Rahul has requested money of Rs 250 from you on UPI. Ignore if you don't know him.", 'skip request'],
  ['AD-SWIGGY', 'Your order of Rs 350 from Meghana Foods is on its way!', 'skip not_transaction'],
  ['VM-HDFCBK', 'Your A/C XX4521 balance is Rs 61,234.00 as on 12-10-26.', 'skip not_transaction'],
  ['BZ-KOTAKB', 'Received Rs.1,200.00 in your Kotak Bank AC X5566 from priya.s@okicici on 15-10-26.UPI Ref:628900001111.', 'credit 1200 Priya S received upi 5566'],
  ['AX-AXISBK-T', 'Spent INR 2,345.00\nAxis Bank Card no. XX8899\n14-10-26 13:02:11 IST\nDECATHLON SPORTS\nAvl Limit: INR 1,20,000.00\nNot you? SMS BLOCK 8899 to 919951860002', 'debit 2345 Decathlon Sports shopping card 8899'],
  ['VM-HDFCBK', 'Rs 1,840.00 debited from A/c XX4521 towards BESCOM via BBPS on 16-10-26. Ref 77881234', 'debit 1840 * bills other 4521'],
  ['AD-HDFCBK', 'Get Rs 500 cashback on spends of Rs 5000 with your HDFC Bank Card XX7788. Offer valid till 31 Oct. T&C apply', 'skip promo'],
  ['JD-SBIINB', 'Your a/c no. XXXXXXXX9876 is credited by Rs.25.00 on 30Sep26 as interest. -SBI', 'credit 25 * interest other 9876'],
  ['VM-ICICIT', 'Dear Customer, Acct XX123 is credited with INR 1,999.00 on 12-Oct-26 from MYNTRA. Refund ref 8812. -ICICI Bank', 'credit 1999 Myntra refund other 123'],
];

let pass = 0;
CASES.forEach(([sender, body, expect], i) => {
  const r = parseSms({ id: String(i), sender, body, date: 0 });
  const got = r.ok
    ? `${r.txn.type} ${r.txn.amount} ${r.txn.merchant} ${categorize(r.txn, body)} ${r.txn.mode} ${r.txn.account ?? '-'}`
    : `skip ${r.reason}`;
  const exp = expect.split(' ');
  let ok: boolean;
  if (exp[0] === 'skip') ok = got === expect;
  else {
    const g = got.split(' ');
    const merchant = g.slice(2, -3).join(' ');
    const expMerchant = exp.slice(2, -3).join(' ');
    ok =
      g[0] === exp[0] &&
      g[1] === exp[1] &&
      g.slice(-3).join(' ') === exp.slice(-3).join(' ') &&
      (expMerchant === '*' || expMerchant === merchant);
  }
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'} #${i} got=[${got}]${ok ? '' : `  expected=[${expect}]`}`);
});
console.log(`\n${pass} / ${CASES.length} passed`);

const now = Date.now();
const { txns, stats } = processInbox(CASES.map(([sender, body], i) => ({ id: String(i), sender, body, date: now - i * 3_600_000 })));
console.log('pipeline', stats);
const s = summarize(txns, thisMonth());
console.log('spent', money(s.spent), 'received', money(s.received), s.byCategory.map((c) => `${c.category}:${money(c.amount)}`).join(' '));
console.log(money(1234567), money(999.5, { decimals: true }), moneyCompact(152000), moneyCompact(45230));
if (pass !== CASES.length) process.exit(1);
