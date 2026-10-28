import {
  CURRENCY_CODE_AFTER_SOURCE,
  CURRENCY_TOKEN_SOURCE,
  currencyFromToken,
  parseAmountText,
  type CurrencyCode,
} from './currency';
import type { CardBill, PayMode, SkipReason, TxnType } from './types';

/** One SMS as it comes from the phone's inbox. */
export type RawSms = { id: string; sender: string; body: string; date: number };

/** What we could read out of one bank SMS. */
export type ParsedTxn = {
  amount: number;
  /** Null when the SMS gave a number with no currency sign or code. */
  currency: CurrencyCode | null;
  type: TxnType;
  merchant: string;
  merchantKey: string;
  mode: PayMode;
  bank: string | null;
  account: string | null;
  /** True when the other side looks like a person (P2A UPI, phone-number VPA). */
  personLike: boolean;
};

export type ParseResult = { ok: true; txn: ParsedTxn } | { ok: false; reason: SkipReason };

/*
 * Turns bank / card / UPI SMS into transactions. Built for Indian banks; also reads
 * plain card alerts in other currencies ("A $25.00 transaction ... card ending in 1234").
 *
 * Order of checks (cheapest and safest first):
 * 1. Personal numbers (+91...) are never read.
 * 2. OTP / verification messages are dropped before anything else.
 * 3. Failed, reminder, request and promo messages are dropped.
 * 4. Only messages with an amount AND a "debited / credited" style word are kept.
 */

// ---------- sender ----------
const PERSONAL_SENDER = /^\+?\d{10,}$/;
const HEADER_PREFIX = /^[A-Z0-9]{2}-/;
const HEADER_SUFFIX = /-([SPTG])$/;

const BANKS: [string, string][] = [
  ['HDFC', 'HDFC Bank'], ['SBI', 'SBI'], ['ICICI', 'ICICI Bank'], ['AXIS', 'Axis Bank'],
  ['KOTAK', 'Kotak'], ['PNB', 'PNB'], ['BOIIND', 'Bank of India'], ['CANBNK', 'Canara Bank'],
  ['CANARA', 'Canara Bank'], ['UNIONB', 'Union Bank'], ['YESBNK', 'Yes Bank'], ['YESBANK', 'Yes Bank'],
  ['IDFC', 'IDFC First'], ['INDUS', 'IndusInd'], ['PAYTM', 'Paytm'], ['AIRBNK', 'Airtel Payments Bank'],
  ['FEDBNK', 'Federal Bank'], ['FEDERAL', 'Federal Bank'], ['AUBANK', 'AU Bank'], ['AUSFB', 'AU Bank'],
  ['RBL', 'RBL Bank'], ['BOBTXN', 'Bank of Baroda'], ['BOBSMS', 'Bank of Baroda'], ['BARODA', 'Bank of Baroda'],
  ['CITI', 'Citi'], ['SCBANK', 'Standard Chartered'], ['HSBC', 'HSBC'], ['AMEX', 'Amex'],
  ['ONECRD', 'OneCard'], ['IOBCHN', 'IOB'], ['IOBBNK', 'IOB'], ['CENTBK', 'Central Bank'],
  ['INDBNK', 'Indian Bank'], ['UCOBNK', 'UCO Bank'], ['JUPITR', 'Jupiter'], ['FIMONY', 'Fi'],
  ['SLICE', 'slice'], ['DBSBNK', 'DBS'], ['IDBI', 'IDBI Bank'], ['KVBANK', 'Karur Vysya'],
  ['SIBSMS', 'South Indian Bank'], ['AMZPAY', 'Amazon Pay'], ['AMAZONPAY', 'Amazon Pay'],
  ['PHONPE', 'PhonePe'], ['MOBIKW', 'MobiKwik'], ['EQUITAS', 'Equitas'], ['BANDHN', 'Bandhan Bank'],
];

// ---------- skip filters ----------
const OTP_PATTERNS = [
  /\b(otp|one[\s-]?time[\s-]?pass(word|code)?|verification code|security code|passcode|login code|auth(entication)? code)\b\s*(is|:|for|-|of)/gi,
  /\bis\s+(your|the)\s+(otp|one[\s-]?time[\s-]?password|verification code|security code|code|pin)\b/gi,
  /\b(use|enter)\s+(the\s+)?(otp|code)\b/gi,
  /\b\d{4,8}\s+is\s+(your|the)\b/gi,
];
/** "Never share OTP for..." is a safety line inside real alerts, not an OTP. */
const OTP_NEGATION = /(share|never|not|don't|dont|do not)\W*\s*(your\s+)?$/i;

const FAILED = /\b(failed|declined|unsuccessful|not successful|could not be (processed|completed)|rejected|was not processed)\b/i;
const REMINDER = /\b(will be debited|will be deducted|is due|are due|due on|due date|due by|payment due|scheduled (for|on)|will be auto|upcoming|reminder|min(imum)? (amount )?due|total (amount )?due|bill (is )?generated|statement (is|for|generated)|e-?statement|please pay|pay now|overdue)\b/i;
const REQUEST = /\b(has requested|have requested|requested (money|rs|inr|payment)|collect request|is requesting|payment request)\b/i;
const PROMO = /\b(offer|offers|apply now|pre-?approved|click here|t&c|limited (time|period)|congratulations|you have won|you've won|voucher|coupon|discount|get up ?to|lucky|eligible for|avail now|insta ?loan|personal loan|credit limit|upgrade now|hurry|exclusive|kyc)\b|\d+% off/i;

// ---------- transaction signals ----------
const DEBIT_VERB = /\b(debited|debit of|debit by|spent|paid|sent|withdrawn|withdrawal|purchase|purchased|deducted|charged|txn of|transaction of|transaction was made|used for|used at|for using|transferred|transfer of|payment of)\b/i;
const CREDIT_VERB = /payment of.{0,50}?\b(received|credited)\b|\b(credited|received|deposited|refund|refunded|reversed|reversal|cashback|added to)\b/i;

const MONEY_MOVED = /\b(debited|credited|spent|sent|received|withdrawn|paid|deducted|transferred|refunded)\b/i;

/** A number as banks write it: 1,234.56 · 1,00,000 · 1.234,56 · 12,50. */
const NUMBER = String.raw`[0-9](?:[0-9.,]*[0-9])?`;
/** "Rs.500", "INR 1,234.00", "$25.00", "US$ 12", "€12,50". */
const AMOUNT = new RegExp(String.raw`(${CURRENCY_TOKEN_SOURCE})\s*:?\s*(${NUMBER})`, 'gi');
/** "12.50 USD", "1,234.00 INR". */
const AMOUNT_CODE_AFTER = new RegExp(String.raw`\b(${NUMBER})\s*(${CURRENCY_CODE_AFTER_SOURCE})`, 'gi');
const AMOUNT_AFTER_VERB = /\b(?:debited|credited|deducted)\s+(?:by|with|for)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b/i;
const BALANCE_CONTEXT = /(bal|avl|available|limit|lmt|outstanding|due)/i;

const MASKED_ACCT = /[xX*]{2,}\s?(\d{3,6})\b/;
const NAMED_ACCT = /\b(?:a\/?c|acct|account|card)\b(?:\s*no\.?)?(?:\s*ending(?:\s*(?:with|in))?)?\s*[:.\-]?\s*[xX*]*\s?(\d{3,6})\b/i;

const ATM = /\b(atm|cash withdrawal|withdrawn|cash wdl)\b/i;
const UPI = /\b(upi|vpa)\b|[a-z0-9._-]+@[a-z]{2,}/i;
const CARD = /\bcard\b(?!\s+services)/i;
const NET = /\b(neft|imps|rtgs|net ?banking|nach|ecs)\b/i;
const WALLET = /\b(wallet|paytm balance|amazon pay balance)\b/i;
const P2A = /\bp2a\b/i;

// ---------- merchant ----------
const STOP = String.raw`(?:[,;(]|\.(?:\s|$))`;
const UPI_INFO = /\bupi\/(?:p2[am]\/|dr\/|cr\/)?\d{6,}\/([^/]{2,40}?)(?:\/|\s+not\b|\s+if\b|\.\s|$)/gi;
const ICICI_CREDITED = /;\s*([A-Za-z0-9][A-Za-z0-9 .&@'_-]{1,40}?)\s+credited\b/gi;
const CARD_DATE_ON = new RegExp(
  String.raw`\bon\s+\d{1,2}[-/ ][A-Za-z0-9]{2,3}[-/ ]\d{2,4}\s+(?:on|at)\s+([A-Za-z][A-Za-z0-9 .&'*_-]{1,40}?)(?=${STOP}|\s+avl\b|\s+ref\b|$)`,
  'gi',
);
const AT = new RegExp(
  String.raw`\bat\s+([A-Za-z][A-Za-z0-9 .&'*_/-]{1,40}?)(?=\s+(?:on|via|using|for|ref|txn|dated|at|by|from)\b|${STOP}|\s+\d{1,2}[-/:]|\s+avl\b|$)`,
  'gi',
);
const TO = new RegExp(
  String.raw`\b(?:trf to|transferred to|paid to|sent to|to)\s+(?:vpa\s+|a/c\s+|beneficiary\s+)?([A-Za-z0-9][A-Za-z0-9 .&@'_-]{1,50}?)(?=\s+(?:on|via|ref|refno|upi|from|dated|using|txn|thru|through|avl|not|if|for)\b|${STOP}|$)`,
  'gi',
);
const FROM = new RegExp(
  String.raw`\b(?:from|by)\s+(?:vpa\s+|a/c\s+linked\s+to\s+vpa\s+|a/c\s+|upi\s+)?([A-Za-z0-9][A-Za-z0-9 .&@'_-]{1,50}?)(?=\s+(?:on|via|ref|upi|to|dated|avl|info|in|thru|through|for|from|by)\b|${STOP}|$)`,
  'gi',
);

const BAD_MERCHANT = new Set([
  'your', 'you', 'a/c', 'ac', 'acct', 'account', 'card', 'the', 'bank', 'upi', 'vpa', 'neft', 'imps',
  'rtgs', 'transfer', 'self', 'beneficiary', 'mobile', 'net banking', 'netbanking', 'ref', 'linked',
]);
const MERCHANT_PREFIX = /^(upi[-/ ]|pos[ /]|ecom[ /]|vps[ /]|pg[ /]|iap[ /]|mps[ /]|[a-z]{2,4}\*)/i;
const MERCHANT_SUFFIX = /\s+(pvt|private|ltd|limited|llp|inc|india|technologies|retail|co)\.?$/i;
// Payroll credits often end with "SALARY" ("ACME PVT LTD SALARY"), which hides the company suffix.
const PAYROLL_SUFFIX = /\s+(salary|sal|payroll|wages)$/i;

// ---------- helpers ----------

function* matchAll(rx: RegExp, text: string): Generator<RegExpExecArray> {
  const g = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) {
    yield m;
    if (m[0].length === 0) g.lastIndex++;
  }
}

const trimChars = (s: string, chars: string) => {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
};

export const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function coreHeader(sender: string): string | null {
  let s = sender.trim().toUpperCase();
  if (PERSONAL_SENDER.test(s.replace(/[\s-]/g, ''))) return null;
  s = s.replace(HEADER_PREFIX, '').replace(HEADER_SUFFIX, '');
  return s;
}

export function bankFor(sender: string): string | null {
  const core = coreHeader(sender);
  if (!core) return null;
  const hit = BANKS.find(([code]) => core.includes(code));
  return hit ? hit[1] : null;
}

/** Banks that send from short codes (US) start the message with their name: "Chase: A $25.00 …". */
const TEXT_BANKS: [RegExp, string][] = [
  [/^chase\b/i, 'Chase'], [/^(bofa|bank of america)\b/i, 'Bank of America'], [/^wells fargo\b/i, 'Wells Fargo'],
  [/^capital ?one\b/i, 'Capital One'], [/^(amex|american express)\b/i, 'Amex'], [/^discover\b/i, 'Discover'],
  [/^citi(bank)?\b/i, 'Citi'], [/^us ?bank\b/i, 'US Bank'],
];

export function bankFromText(text: string): string | null {
  return TEXT_BANKS.find(([rx]) => rx.test(text.trim()))?.[1] ?? null;
}

export function isOtp(text: string): boolean {
  for (const rx of OTP_PATTERNS) {
    for (const m of matchAll(rx, text)) {
      const before = text.slice(Math.max(0, m.index - 24), m.index);
      if (OTP_NEGATION.test(before)) continue;
      return true;
    }
  }
  return false;
}

export type FoundMoney = { amount: number; currency: CurrencyCode | null };

/** The paid amount and its currency. Skips balances and limits ("Avl Bal Rs 5,000"). */
export function findMoney(text: string): FoundMoney | null {
  const hits: { index: number; end: number; num: string; cur: CurrencyCode | null }[] = [];
  for (const m of matchAll(AMOUNT, text)) hits.push({ index: m.index, end: m.index + m[0].length, num: m[2], cur: currencyFromToken(m[1]) });
  for (const m of matchAll(AMOUNT_CODE_AFTER, text)) hits.push({ index: m.index, end: m.index + m[0].length, num: m[1], cur: currencyFromToken(m[2]) });
  hits.sort((a, b) => a.index - b.index);
  let prevEnd = 0;
  for (const h of hits) {
    if (h.index < prevEnd) continue; // overlaps the one before ("Rs 500 INR")
    const before = text.slice(Math.max(prevEnd, h.index - 28), h.index);
    prevEnd = h.end;
    if (BALANCE_CONTEXT.test(before)) continue;
    const value = parseAmountText(h.num, h.cur);
    if (Number.isFinite(value) && value > 0) return { amount: value, currency: h.cur };
  }
  const v = AMOUNT_AFTER_VERB.exec(text);
  if (v) {
    const value = parseFloat(v[1].replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) return { amount: value, currency: null };
  }
  return null;
}

export function findAmount(text: string): number | null {
  return findMoney(text)?.amount ?? null;
}

export function findAccount(text: string): string | null {
  const m = MASKED_ACCT.exec(text) ?? NAMED_ACCT.exec(text);
  return m ? m[1].slice(-4) : null;
}

export function findMode(text: string): PayMode {
  if (ATM.test(text)) return 'atm';
  if (UPI.test(text)) return 'upi';
  if (CARD.test(text)) return 'card';
  if (NET.test(text)) return 'netbanking';
  if (WALLET.test(text)) return 'wallet';
  return 'other';
}

function isValidMerchant(raw: string): boolean {
  const s = trimChars(raw.trim(), '.,-:*/').toLowerCase();
  if (s.length < 2) return false;
  if (BAD_MERCHANT.has(s)) return false;
  if (s.startsWith('your ') || s.startsWith('you ') || s.startsWith('a/c') || s.startsWith('xx')) return false;
  if (/^[x*]*\d+$/.test(s)) return false;
  if (/^(rs\.?|inr)\s*\d/.test(s)) return false;
  return true;
}

export function findMerchant(text: string, type: TxnType): string | null {
  const patterns = type === 'debit' ? [UPI_INFO, ICICI_CREDITED, CARD_DATE_ON, AT, TO] : [UPI_INFO, FROM];
  for (const rx of patterns) {
    for (const m of matchAll(rx, text)) {
      const candidate = (m[1] ?? '').trim();
      if (isValidMerchant(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Some banks (Axis cards) put the shop on its own line, right after the time:
 * "14-10-26 13:02:11 IST\nDECATHLON SPORTS\nAvl Limit..."
 */
function merchantFromLines(body: string): string | null {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\d{1,2}:\d{2}(:\d{2})?(\s*(IST|hrs))?$/i.test(lines[i])) {
      const next = lines[i + 1];
      if (/^[A-Za-z]/.test(next) && !/\b(avl|bal|limit|not you|call|sms)\b/i.test(next) && isValidMerchant(next)) {
        return next;
      }
    }
  }
  return null;
}

function titleCase(s: string): string {
  const hasUpper = /[A-Z]/.test(s);
  const hasLower = /[a-z]/.test(s);
  if (hasUpper && hasLower) return s; // already has its own casing, keep it
  return s
    .split(' ')
    .map((w) =>
      // Short codes without vowels stay in capitals: KFC, PVR, SBI. "PAY" becomes "Pay".
      // "Y" counts as a vowel in 4-letter words, so LYFT reads "Lyft" but KFC stays KFC.
      w.length <= 4 && /^[A-Za-z]+$/.test(w) && !/[aeiou]/i.test(w) && !(w.length === 4 && /y/i.test(w))
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
}

/** Returns the display name and whether it looks like a person. */
export function cleanMerchant(raw: string): { name: string; personLike: boolean } {
  let s = trimChars(raw.trim(), '.,-:*/ ');
  let personLike = false;
  if (s.includes('@')) {
    const [local, handleRaw = ''] = s.split('@');
    const handle = handleRaw.toLowerCase();
    if (handle.startsWith('ok')) personLike = true;
    if (/^\d{8,}$/.test(local)) return { name: s.toLowerCase(), personLike: true };
    const readable = local
      .replace(/[._-]+/g, ' ')
      .replace(/\d{4,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (readable.length < 3) return { name: s.toLowerCase(), personLike };
    s = readable;
  }
  s = s.replace(MERCHANT_PREFIX, '').replace(PAYROLL_SUFFIX, '');
  for (let i = 0; i < 3; i++) s = s.replace(MERCHANT_SUFFIX, '').trim();
  s = trimChars(s.replace(/\s+/g, ' ').trim(), '.,-*');
  if (s.length > 32) s = s.slice(0, 32).trim();
  if (!s) s = raw.trim();
  return { name: titleCase(s), personLike };
}

function fallbackName(type: TxnType, mode: PayMode, bank: string | null): string {
  if (mode === 'atm') return 'ATM withdrawal';
  if (type === 'credit') return bank ? `Credit to ${bank}` : 'Money received';
  if (mode === 'upi') return 'UPI payment';
  if (mode === 'card') return 'Card payment';
  if (bank) return `${bank} debit`;
  return 'Payment';
}

export function normalize(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

export function parseSms(sms: RawSms): ParseResult {
  const sender = sms.sender.trim().toUpperCase();
  if (PERSONAL_SENDER.test(sender.replace(/[\s-]/g, ''))) return { ok: false, reason: 'personal' };
  if (HEADER_SUFFIX.exec(sender)?.[1] === 'P') return { ok: false, reason: 'promo' };

  const text = normalize(sms.body);
  if (!text) return { ok: false, reason: 'not_transaction' };

  if (isOtp(text)) return { ok: false, reason: 'otp' };
  if (REQUEST.test(text)) return { ok: false, reason: 'request' };
  if (FAILED.test(text)) return { ok: false, reason: 'failed' };
  if (REMINDER.test(text)) return { ok: false, reason: 'reminder' };

  const account = findAccount(text);
  // An Indian sender header ("AD-HDFCBK") also tells us the money is in rupees.
  const senderBank = bankFor(sender);
  const bank = senderBank ?? bankFromText(text);
  // Offers often mention your card too, so a promo word is enough unless money clearly moved.
  if (PROMO.test(text) && (account === null || !MONEY_MOVED.test(text))) return { ok: false, reason: 'promo' };

  const debitAt = DEBIT_VERB.exec(text)?.index ?? Infinity;
  const creditAt = CREDIT_VERB.exec(text)?.index ?? Infinity;
  if (debitAt === Infinity && creditAt === Infinity) return { ok: false, reason: 'not_transaction' };
  const type: TxnType = creditAt <= debitAt ? 'credit' : 'debit';

  // A real bank alert names an account / card, or comes from a known bank or wallet.
  if (account === null && bank === null) return { ok: false, reason: 'not_transaction' };

  const found = findMoney(text);
  if (found === null || found.amount <= 0) return { ok: false, reason: 'not_transaction' };
  const amount = found.amount;
  // No sign or code in the SMS: an Indian bank means rupees, anything else uses the home currency.
  const currency = found.currency ?? (senderBank ? 'INR' : null);

  const mode = findMode(text);
  const raw = findMerchant(text, type) ?? merchantFromLines(sms.body);
  const cleaned = raw ? cleanMerchant(raw) : null;
  // ATM text is full of machine IDs, so use a plain name instead.
  const merchant = mode === 'atm' ? fallbackName(type, mode, bank) : cleaned?.name ?? fallbackName(type, mode, bank);
  const personLike = (cleaned?.personLike ?? false) || P2A.test(text);

  return {
    ok: true,
    txn: { amount, currency, type, merchant, merchantKey: keyOf(merchant), mode, bank, account, personLike },
  };
}

// ---------- credit card statements ----------
const CREDIT_CARD = /\bcredit\s*card\b|\bcc\b|\bsbi\s*card\b|\bonecard\b/i;
const NUM = String.raw`([0-9](?:[0-9.,]*[0-9])?)`;
const CUR = CURRENCY_TOKEN_SOURCE;
const BILL_TOTAL = [
  new RegExp(String.raw`\b(?:total\s+(?:amount\s+|amt\.?\s+)?due|total\s+amt\.?\s+due|amount\s+due|amt\.?\s+due|statement\s+(?:balance|amount)|total\s+outstanding|outstanding\s+amount)\b[^0-9₹$€£¥]{0,24}?(?:${CUR})?\s*:?\s*${NUM}`, 'i'),
  new RegExp(String.raw`${CUR}\s*${NUM}\s+(?:is\s+)?(?:due|payable)\b`, 'i'),
];
const BILL_MIN = new RegExp(String.raw`\bmin(?:imum)?\.?\s+(?:amount\s+|amt\.?\s+)?due\b[^0-9₹$€£¥]{0,16}?(?:${CUR})?\s*:?\s*${NUM}`, 'i');
const BILL_DATE =
  /\b(?:due\s+(?:date|by|on)|pay(?:able)?\s+by|due|by)\b\s*(?:is|:|-|of)?\s*(?:on\s+)?(\d{1,2})(?![0-9,])(?:st|nd|rd|th)?[\s\-/.]*([A-Za-z]{3,9}|\d{1,2})(?:[\s\-/.,]+(\d{2,4}))?/i;
const MONTH_INDEX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** The first currency named in a message, or null. */
export function currencyIn(text: string): CurrencyCode | null {
  const m = new RegExp(String.raw`(${CURRENCY_TOKEN_SOURCE})\s*:?\s*${NUMBER}`, 'i').exec(text) ?? new RegExp(String.raw`${NUMBER}\s*(${CURRENCY_CODE_AFTER_SOURCE})`, 'i').exec(text);
  return m ? currencyFromToken(m[1]) : null;
}

/** "15-Oct-26", "05/11/2026", "5th Nov" → midnight of that day. A missing year means the next one after the statement. */
/** "due by Nov 15, 2026", "Payment due date Nov 15" (month first). */
const BILL_DATE_MONTH_FIRST =
  /\b(?:due\s+(?:date|by|on)|pay(?:able)?\s+by|due|by)\b\s*(?:is|:|-|of)?\s*(?:on\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?![0-9])(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i;

export function parseDueDate(text: string, statementDate: number): number | null {
  let m = BILL_DATE.exec(text);
  const mf = m ? null : BILL_DATE_MONTH_FIRST.exec(text);
  if (mf && MONTH_INDEX[mf[1].toLowerCase().slice(0, 3)] !== undefined) m = [mf[0], mf[2], mf[1], mf[3]] as unknown as RegExpExecArray;
  if (!m) return null;
  const day = Number(m[1]);
  const monthRaw = m[2].toLowerCase();
  const month = /^\d+$/.test(monthRaw) ? Number(monthRaw) - 1 : MONTH_INDEX[monthRaw.slice(0, 3)];
  if (month === undefined || month < 0 || month > 11 || day < 1 || day > 31) return null;
  const base = new Date(statementDate);
  let year: number;
  if (m[3]) {
    year = Number(m[3]);
    if (year < 100) year += 2000;
  } else {
    year = base.getFullYear();
    if (new Date(year, month, day).getTime() < new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()) year += 1;
  }
  const d = new Date(year, month, day);
  // Reject impossible dates like 31 Feb (Date would roll them over).
  if (d.getDate() !== day || d.getMonth() !== month) return null;
  return d.getTime();
}

/**
 * Reads a credit card statement SMS: how much is due and by when.
 * Returns null for anything else (OTPs, offers, loan reminders, debit card texts).
 */
export function parseCardBill(sms: RawSms): CardBill | null {
  const sender = sms.sender.trim().toUpperCase();
  if (PERSONAL_SENDER.test(sender.replace(/[\s-]/g, ''))) return null;
  const text = normalize(sms.body);
  if (!text || isOtp(text) || !CREDIT_CARD.test(text)) return null;
  const senderBank = bankFor(sender);
  const bank = senderBank ?? bankFromText(text);
  const currency = currencyIn(text) ?? (senderBank ? 'INR' : null);
  const toNumber = (raw: string) => parseAmountText(raw, currency);
  let total: number | null = null;
  for (const rx of BILL_TOTAL) {
    const m = rx.exec(text);
    if (m) {
      total = toNumber(m[1]);
      break;
    }
  }
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  const account = findAccount(text);
  if (!account) return null;
  const min = BILL_MIN.exec(text);
  const minDue = min ? toNumber(min[1]) : null;
  return {
    id: `bill-${sms.id}`,
    bank,
    account,
    amountDue: total,
    ...(currency ? { currency } : {}),
    minDue: minDue !== null && Number.isFinite(minDue) ? minDue : null,
    dueDate: parseDueDate(text, sms.date),
    statementDate: sms.date,
  };
}
