import type { RawSms } from './parser';

/*
 * Sample bank SMS for demo mode (EXPO_PUBLIC_DEMO=1).
 * They go through the real parser, so demo mode also shows the reader working,
 * including the OTPs and offers it throws away.
 */

const T = {
  hdfcUpi: (amt: number, to: string) =>
    `Sent Rs.${amt.toFixed(2)}\nFrom HDFC Bank A/C *4521\nTo ${to}\nOn 12/10/26\nRef 6285${rand(8)}\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808`,
  hdfcCard: (amt: number, at: string) =>
    `Spent Rs.${amt} On HDFC Bank Card 7788 At ${at} On 2026-10-11:18:22:10.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 7788 to 7308080808`,
  iciciUpi: (amt: number, to: string) =>
    `ICICI Bank Acct XX123 debited for Rs ${amt.toFixed(2)} on 10-Oct-26; ${to} credited. UPI:6284${rand(8)}. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.`,
  sbiUpi: (amt: number, to: string) =>
    `Dear UPI user A/C X9876 debited by ${amt.toFixed(1)} on date 09Oct26 trf to ${to} Refno 6282${rand(8)}. If not u? call 1800111109. -SBI`,
  axisUpi: (amt: number, to: string) =>
    `INR ${amt.toFixed(2)} debited\nA/c no. XX3344\n11-10-26, 20:14:33\nUPI/P2M/6284${rand(8)}/${to}\nNot you? SMS BLOCKALL 3344 to 919951860002\nAxis Bank`,
  kotakPerson: (amt: number, vpa: string) =>
    `Sent Rs.${amt.toFixed(2)} from Kotak Bank AC X5566 to ${vpa} on 08-10-26.UPI Ref 6283${rand(8)}. Not you, kotak.com/KBANKT/Fraud`,
  atm: (amt: number) =>
    `Dear Customer, Rs.${amt.toFixed(2)} withdrawn at SBI ATM S1BW000123 from A/c X9876 on 07Oct26. Avl Bal Rs.12,345.00. -SBI`,
  salary: (amt: number) =>
    `Money Received - INR ${amt.toLocaleString('en-IN')}.00 in your HDFC Bank A/c xx4521 on 01-10-26 by NEFT from ACME TECHNOLOGIES PVT LTD SALARY. Avl bal: INR 61,234.00`,
  refund: (amt: number, from: string) =>
    `Dear Customer, Acct XX123 is credited with INR ${amt.toFixed(2)} on 12-Oct-26 from ${from}. Refund ref 8812. -ICICI Bank`,
};

function rand(n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

type Plan = { sender: string; body: string; daysAgo: number; hour: number };

const PLAN: Omit<Plan, 'daysAgo' | 'hour'>[][] = [
  // each inner list repeats roughly weekly
  [
    { sender: 'VM-HDFCBK-S', body: T.hdfcUpi(289, 'SWIGGY') },
    { sender: 'JD-ICICIT-S', body: T.iciciUpi(412, 'ZOMATO LIMITED') },
    { sender: 'VK-AXISBK', body: T.axisUpi(845, 'BLINKIT') },
    { sender: 'AX-SBIUPI', body: T.sbiUpi(164, 'UBER INDIA SYSTEMS') },
  ],
  [
    { sender: 'VK-AXISBK', body: T.axisUpi(620, 'ZEPTO MARKETPLACE') },
    { sender: 'AX-SBIUPI', body: T.sbiUpi(96, 'RAPIDO') },
    { sender: 'VM-HDFCBK-S', body: T.hdfcUpi(40, 'CHAI POINT') },
    { sender: 'BZ-KOTAKB-S', body: T.kotakPerson(500, 'ramesh.kumar@okaxis') },
  ],
];

const MONTHLY: Omit<Plan, 'daysAgo' | 'hour'>[] = [
  { sender: 'AD-HDFCBK', body: T.hdfcCard(1499, 'AMAZON PAY INDIA') },
  { sender: 'AD-HDFCBK', body: T.hdfcCard(649, 'NETFLIX') },
  { sender: 'VM-HDFCBK-S', body: T.hdfcUpi(18500, 'NOBROKER RENT') },
  { sender: 'VM-HDFCBK-S', body: T.hdfcUpi(1840, 'BESCOM') },
  { sender: 'VM-HDFCBK-S', body: T.hdfcUpi(299, 'AIRTEL PREPAID') },
  { sender: 'AD-HDFCBK', body: T.hdfcCard(2350, 'HPCL FUEL STATION') },
  { sender: 'AD-HDFCBK', body: T.hdfcCard(3299, 'MYNTRA') },
  { sender: 'VM-SBIINB', body: T.atm(3000) },
  { sender: 'AD-HDFCBK', body: T.salary(85000) },
  { sender: 'VM-ICICIT', body: T.refund(499, 'AMAZON') },
  { sender: 'JM-ICICIT', body: T.iciciUpi(760, 'APOLLO PHARMACY') },
  { sender: 'VM-HDFCBK-S', body: T.hdfcUpi(5000, 'GROWW') },
];

// These must all be thrown away by the parser.
const NOISE: Omit<Plan, 'daysAgo' | 'hour'>[] = [
  { sender: 'AD-HDFCBK', body: 'OTP is 482913 for txn of INR 1499.00 at AMAZON on card ending 7788. Do not share OTP for security reasons.' },
  { sender: 'VM-ICICIB', body: '123456 is your OTP to login to iMobile. Do not share it with anyone.' },
  { sender: 'VM-HDFCBK-P', body: 'Get up to 10% cashback on your HDFC Bank Credit Card. Apply now!' },
  { sender: 'AD-KOTAKB', body: 'Congratulations! You are eligible for a pre-approved personal loan of Rs 5,00,000. Click here to avail.' },
  { sender: 'AD-ICICIB', body: 'Your ICICI Bank Credit Card XX1234 statement is generated. Total amount due Rs 12,450. Due date 15-Oct-26.' },
  { sender: 'AX-SBIUPI', body: 'Rahul has requested money of Rs 250 from you on UPI.' },
];

export function demoInbox(): RawSms[] {
  const out: RawSms[] = [];
  const now = Date.now();
  let id = 1;
  const push = (sender: string, body: string, daysAgo: number, hour: number) => {
    const d = new Date(now - daysAgo * 86_400_000);
    d.setHours(hour, (id * 7) % 60, 0, 0);
    if (d.getTime() > now) d.setTime(now - id * 60_000);
    out.push({ id: String(id++), sender, body, date: d.getTime() });
  };
  for (let day = 0; day < 120; day++) {
    const week = PLAN[Math.floor(day / 3) % PLAN.length];
    const pick = week[day % week.length];
    if (day % 2 === 0 || day % 5 === 0) push(pick.sender, pick.body.replace(/Ref \d+|UPI:\d+|Refno \d+|P2M\/\d+/, (m) => m + day), day, 9 + (day % 12));
  }
  for (let m = 0; m < 4; m++) {
    MONTHLY.forEach((x, i) => push(x.sender, x.body + ` ${m}`, m * 30 + 2 + i * 2, 10 + (i % 9)));
  }
  NOISE.forEach((x, i) => push(x.sender, x.body, i * 4 + 1, 12));
  return out;
}
