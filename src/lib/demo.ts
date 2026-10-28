import type { RawSms } from './parser';
import type { Goal, Txn } from './types';

/*
 * Sample data for "Explore with sample data" (and EXPO_PUBLIC_DEMO=1).
 * It is made of real-looking bank SMS that go through the real parser, so the
 * sample also shows the reader at work, including the OTPs and offers it drops.
 * A fixed seed keeps the numbers the same on every launch.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const yy = (d: Date) => pad(d.getFullYear() % 100);
const dmy = (d: Date, sep = '-') => `${pad(d.getDate())}${sep}${pad(d.getMonth() + 1)}${sep}${yy(d)}`;
const dMonY = (d: Date, sep = '-') => `${pad(d.getDate())}${sep}${MONTHS[d.getMonth()]}${sep}${yy(d)}`;
const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const rs = (n: number) => n.toFixed(2);
const grouped = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Small, fast, seeded random numbers (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p: number) => next() < p,
    int: (min: number, max: number) => Math.round(min + next() * (max - min)),
    pick: <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    digits: (n: number) => Array.from({ length: n }, () => Math.floor(next() * 10)).join(''),
  };
}

type Rng = ReturnType<typeof seeded>;
type Template = (amt: number, who: string, d: Date, r: Rng) => { sender: string; body: string };

const SMS: Record<string, Template> = {
  hdfcUpi: (amt, to, d, r) => ({
    sender: 'VM-HDFCBK-S',
    body: `Sent Rs.${rs(amt)}\nFrom HDFC Bank A/C *4521\nTo ${to}\nOn ${dmy(d, '/')}\nRef ${r.digits(12)}\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808`,
  }),
  hdfcCard: (amt, at, d) => ({
    sender: 'AD-HDFCBK',
    body: `Spent Rs.${rs(amt)} On HDFC Bank Card 7788 At ${at} On ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}:${hms(d)}.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 7788 to 7308080808`,
  }),
  hdfcStatement: (amt, _who, d) => {
    const due = new Date(d.getFullYear(), d.getMonth() + 1, 5);
    return {
      sender: 'AD-HDFCBK',
      body: `Your HDFC Bank Credit Card XX7788 statement is generated. Total amount due Rs ${grouped(amt)}. Minimum due Rs ${grouped(Math.round(amt * 0.05))}. Due date ${dMonY(due)}.`,
    };
  },
  hdfcCardPaid: (amt, _who, d) => ({
    sender: 'AD-HDFCBK',
    body: `Dear Customer, Payment of INR ${grouped(amt)} has been received on your HDFC Bank Credit Card Account XX7788 on ${dMonY(d)}. Thank you.`,
  }),
  axisCard: (amt, at, d) => ({
    sender: 'AX-AXISBK-T',
    body: `Spent INR ${grouped(amt)}\nAxis Bank Card no. XX8899\n${dmy(d)} ${hms(d)} IST\n${at}\nAvl Limit: INR 1,20,000.00\nNot you? SMS BLOCK 8899 to 919951860002`,
  }),
  axisStatement: (amt, _who, d) => {
    const due = new Date(d.getFullYear(), d.getMonth() + 1, 10);
    return {
      sender: 'AX-AXISBK',
      body: `Axis Bank Credit Card XX8899 statement generated. Total amount due INR ${grouped(amt)}. Min amount due INR ${grouped(Math.round(amt * 0.05))}. Pay by ${dmy(due)}.`,
    };
  },
  axisCardPaid: (amt, _who, d) => ({
    sender: 'AX-AXISBK',
    body: `Payment of INR ${grouped(amt)} received towards your Axis Bank Credit Card XX8899 on ${dmy(d)}. Thank you.`,
  }),
  iciciUpi: (amt, to, d, r) => ({
    sender: 'JD-ICICIT-S',
    body: `ICICI Bank Acct XX123 debited for Rs ${rs(amt)} on ${dMonY(d)}; ${to} credited. UPI:${r.digits(12)}. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.`,
  }),
  sbiUpi: (amt, to, d, r) => ({
    sender: 'AX-SBIUPI',
    body: `Dear UPI user A/C X9876 debited by ${amt.toFixed(1)} on date ${dMonY(d, '')} trf to ${to} Refno ${r.digits(12)}. If not u? call 1800111109. -SBI`,
  }),
  axisUpi: (amt, to, d, r) => ({
    sender: 'VK-AXISBK',
    body: `INR ${rs(amt)} debited\nA/c no. XX3344\n${dmy(d)}, ${hms(d)}\nUPI/P2M/${r.digits(12)}/${to}\nNot you? SMS BLOCKALL 3344 to 919951860002\nAxis Bank`,
  }),
  kotakSent: (amt, vpa, d, r) => ({
    sender: 'BZ-KOTAKB-S',
    body: `Sent Rs.${rs(amt)} from Kotak Bank AC X5566 to ${vpa} on ${dmy(d)}.UPI Ref ${r.digits(12)}. Not you, kotak.com/KBANKT/Fraud`,
  }),
  kotakReceived: (amt, vpa, d, r) => ({
    sender: 'BZ-KOTAKB-S',
    body: `Received Rs.${rs(amt)} in your Kotak Bank AC X5566 from ${vpa} on ${dmy(d)}.UPI Ref:${r.digits(12)}.`,
  }),
  atm: (amt, _who, d) => ({
    sender: 'VM-SBIINB',
    body: `Dear Customer, Rs.${rs(amt)} withdrawn at SBI ATM S1BW000123 from A/c X9876 on ${dMonY(d, '')}. Avl Bal Rs.42,345.00. -SBI`,
  }),
  salary: (amt, _who, d) => ({
    sender: 'AD-HDFCBK',
    body: `Money Received - INR ${grouped(amt)} in your HDFC Bank A/c xx4521 on ${dmy(d)} by NEFT from ACME TECHNOLOGIES PVT LTD SALARY. Avl bal: INR 1,61,234.00`,
  }),
  freelance: (amt, from, d, r) => ({
    sender: 'VM-HDFCBK',
    body: `INR ${grouped(amt)} credited to HDFC Bank A/c XX4521 on ${dmy(d)} from ${from} via IMPS. Ref ${r.digits(10)}. Avl bal INR 1,84,120.00 -HDFC Bank`,
  }),
  interest: (amt, _who, d) => ({
    sender: 'VM-SBIINB',
    body: `Dear Customer, interest of Rs ${rs(amt)} has been credited to your A/c X9876 on ${dMonY(d, '')}. -SBI`,
  }),
  refund: (amt, from, d) => ({
    sender: 'VM-ICICIT',
    body: `Dear Customer, Acct XX123 is credited with INR ${rs(amt)} on ${dMonY(d)} from ${from}. Refund ref 8812. -ICICI Bank`,
  }),
};

/** Things that happen most days. [chance per day, template, payees, min, max] */
const DAILY: [number, keyof typeof SMS, string[], number, number][] = [
  [0.42, 'hdfcUpi', ['SWIGGY', 'ZOMATO LIMITED'], 180, 680],
  [0.3, 'sbiUpi', ['THIRD WAVE COFFEE', 'CHAI POINT', 'BLUE TOKAI COFFEE'], 60, 320],
  [0.5, 'sbiUpi', ['UBER INDIA SYSTEMS', 'RAPIDO', 'OLA CABS'], 70, 420],
  [0.24, 'axisUpi', ['BLINKIT', 'ZEPTO MARKETPLACE', 'BIGBASKET'], 250, 1900],
  [0.07, 'hdfcCard', ['AMAZON PAY INDIA', 'MYNTRA', 'NYKAA', 'DECATHLON'], 399, 4500],
  [0.05, 'axisCard', ['IKEA INDIA', 'CROMA RETAIL', 'DECATHLON SPORTS'], 600, 5200],
  [0.05, 'iciciUpi', ['BOOKMYSHOW', 'PVR INOX'], 300, 1200],
  [0.04, 'iciciUpi', ['APOLLO PHARMACY'], 150, 1400],
  [0.06, 'kotakSent', ['rahul.m@okaxis', 'priya.sharma@ybl', 'ramesh.kumar@okaxis'], 200, 2500],
  [0.03, 'kotakReceived', ['ananya.r@okhdfcbank', 'rahul.m@okaxis'], 300, 1500],
  [0.025, 'atm', [''], 2000, 3000],
  [0.025, 'refund', ['AMAZON', 'MYNTRA'], 199, 1499],
];

/** Bills and income on a fixed day of the month. [day, template, payee, min, max] */
const MONTHLY: [number, keyof typeof SMS, string, number, number][] = [
  [3, 'hdfcUpi', 'NOBROKER RENT', 22000, 22000],
  [5, 'hdfcUpi', 'GROWW SIP', 10000, 10000],
  [9, 'hdfcUpi', 'BESCOM', 1100, 2100],
  [10, 'iciciUpi', 'AIRTEL POSTPAID', 599, 599],
  [12, 'axisUpi', 'ACT FIBERNET', 1060, 1060],
  [14, 'hdfcCard', 'NETFLIX', 649, 649],
  [15, 'hdfcCard', 'SPOTIFY', 119, 119],
  [18, 'hdfcCard', 'CULT.FIT', 1499, 1499],
  [25, 'hdfcCard', 'HPCL FUEL STATION', 1800, 2600],
  [20, 'axisCard', 'AMAZON PRIME', 1499, 1499],
  // A shop the categoriser can't place, so "Needs a look" has something to show.
  [24, 'sbiUpi', 'SHRI GANESH ENTERPRISES', 450, 1800],
];

/* Messages the parser must throw away. */
const NOISE: { sender: string; body: string }[] = [
  { sender: 'AD-HDFCBK', body: 'OTP is 482913 for txn of INR 1499.00 at AMAZON on card ending 7788. Do not share OTP for security reasons.' },
  { sender: 'VM-ICICIB', body: '123456 is your OTP to login to iMobile. Do not share it with anyone.' },
  { sender: 'VM-HDFCBK-P', body: 'Get up to 10% cashback on your HDFC Bank Credit Card. Apply now!' },
  { sender: 'AD-KOTAKB', body: 'Congratulations! You are eligible for a pre-approved personal loan of Rs 5,00,000. Click here to avail.' },
  { sender: 'AX-SBIUPI', body: 'Rahul has requested money of Rs 250 from you on UPI.' },
];

const DAYS_BACK = 200;

export function demoInbox(now = Date.now()): RawSms[] {
  const r = seeded(20261028);
  const out: RawSms[] = [];
  let id = 1;
  // Each credit card runs a real cycle: spends add up, a statement comes on a fixed day,
  // and the bill is paid (bank payment + "payment received" alert) a couple of days before it is due.
  const cycles = {
    hdfcCard: { spent: 0, pending: 0, statementDay: 16, payDay: 3, statement: 'hdfcStatement', paid: 'hdfcCardPaid', payFrom: 'hdfcUpi' },
    axisCard: { spent: 0, pending: 0, statementDay: 22, payDay: 8, statement: 'axisStatement', paid: 'axisCardPaid', payFrom: 'iciciUpi' },
  } as const satisfies Record<string, { spent: number; pending: number; statementDay: number; payDay: number; statement: keyof typeof SMS; paid: keyof typeof SMS; payFrom: keyof typeof SMS }>;
  const cycle = { hdfcCard: { spent: 0, pending: 0 }, axisCard: { spent: 0, pending: 0 } };
  const push = (d: Date, msg: { sender: string; body: string }, tpl?: keyof typeof SMS, amount = 0) => {
    if (d.getTime() > now) return;
    out.push({ id: String(id++), sender: msg.sender, body: msg.body, date: d.getTime() });
    if (tpl === 'hdfcCard' || tpl === 'axisCard') cycle[tpl].spent += amount;
  };
  const at = (base: Date, hour: number) => {
    const d = new Date(base);
    d.setHours(hour, r.int(0, 59), r.int(0, 59), 0);
    return d;
  };

  const today = new Date(now);
  for (let back = DAYS_BACK; back >= 0; back--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const weekend = day.getDay() === 0 || day.getDay() === 6;

    for (const [chance, tpl, payees, min, max] of DAILY) {
      const boost = weekend && (tpl === 'hdfcUpi' || tpl === 'iciciUpi') ? 1.5 : 1;
      if (r.chance(chance * boost)) {
        const amt = r.int(min, max);
        push(at(day, r.int(8, 22)), SMS[tpl](amt, r.pick(payees), day, r), tpl, amt);
      }
    }

    const dom = day.getDate();
    for (const [onDay, tpl, payee, min, max] of MONTHLY) {
      if (dom === onDay) {
        const amt = r.int(min, max);
        push(at(day, r.int(9, 20)), SMS[tpl](amt, payee, day, r), tpl, amt);
      }
    }

    for (const card of ['hdfcCard', 'axisCard'] as const) {
      const c = cycles[card];
      const state = cycle[card];
      if (dom === c.payDay && state.pending > 0) {
        push(at(day, 10), SMS[c.payFrom](state.pending, 'CRED CLUB', day, r));
        push(at(day, 11), SMS[c.paid](state.pending, '', day, r));
        state.pending = 0;
      }
      if (dom === c.statementDay && state.spent > 0) {
        // Late in the day, after that day's card spends, which belong to this statement.
        push(at(day, 23), SMS[c.statement](state.spent, '', day, r));
        state.pending = state.spent;
        state.spent = 0;
      }
    }

    // One trip, about two and a half months ago.
    if (back === 75) {
      push(at(day, 19), SMS.hdfcCard(8450, 'MAKEMYTRIP', day, r), 'hdfcCard', 8450);
      push(at(day, 20), SMS.iciciUpi(1265, 'IRCTC', day, r));
      push(at(day, 21), SMS.hdfcCard(3400, 'OYO ROOMS', day, r), 'hdfcCard', 3400);
    }

    // Salary on the 1st, with a raise three months ago.
    if (dom === 1) {
      const monthsAgo = (today.getFullYear() - day.getFullYear()) * 12 + today.getMonth() - day.getMonth();
      push(at(day, 9), SMS.salary(monthsAgo <= 3 ? 98000 : 92000, '', day, r));
    }
    // Freelance work in most months.
    if (dom === 20 && r.chance(0.7)) push(at(day, 16), SMS.freelance(r.int(12, 28) * 1000, 'PIXELCRAFT STUDIO', day, r));
    // Savings account interest at the end of each quarter.
    if (dom === 28 && day.getMonth() % 3 === 2) push(at(day, 11), SMS.interest(r.int(900, 1500), '', day, r));

    if (back % 9 === 4) push(at(day, 12), r.pick(NOISE));
  }

  return out;
}

const DAY = 86_400_000;

/** Goals, budget and a few cash expenses that go with the sample data. Never saved. */
export function demoExtras(now = Date.now()): { goals: Goal[]; budget: number; manual: Txn[] } {
  const inMonths = (m: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() + m, 1);
    return d.getTime();
  };
  const cash = (id: string, amount: number, merchant: string, category: Txn['category'], daysAgo: number, hour: number): Txn => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hour, 15, 0, 0);
    return {
      id: `demo-cash-${id}`,
      amount,
      type: 'debit',
      merchant,
      merchantKey: merchant.toLowerCase().replace(/[^a-z0-9]/g, ''),
      category,
      mode: 'cash',
      bank: null,
      account: null,
      timestamp: Math.min(d.getTime(), now - 60_000),
      isManual: true,
      excluded: false,
      categorySource: 'manual',
    };
  };
  return {
    budget: 60000,
    goals: [
      { id: 'demo-goal-1', name: 'Emergency fund', target: 300000, saved: 184000, icon: 'shield-check-outline', color: '#1F8A63', deadline: null, createdAt: now - 200 * DAY },
      { id: 'demo-goal-2', name: 'Goa trip', target: 45000, saved: 28500, icon: 'palm-tree', color: '#E8912A', deadline: inMonths(3), createdAt: now - 60 * DAY },
      { id: 'demo-goal-3', name: 'New laptop', target: 120000, saved: 36000, icon: 'laptop', color: '#2F7C9E', deadline: inMonths(8), createdAt: now - 40 * DAY },
    ],
    manual: [
      cash('1', 40, 'Chai', 'food', 0, 10),
      cash('2', 120, 'Auto to office', 'transport', 1, 9),
      cash('3', 260, 'Vegetables', 'groceries', 2, 19),
      cash('4', 500, 'Barber', 'other', 9, 18),
    ],
  };
}
