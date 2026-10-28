import { keyOf, type ParsedTxn } from './parser';
import type { CategoryId } from './types';

/*
 * Guesses a category from the merchant name (and a few words in the SMS).
 * Your own corrections always win over this guess (see store.tsx).
 */

/** Checked in this order, so "Swiggy Instamart" becomes Groceries before Food. */
const KEYWORDS: [CategoryId, string[]][] = [
  ['card_bill', ['cred club', 'credclub', 'cred']],
  ['groceries', [
    'blinkit', 'zepto', 'instamart', 'bigbasket', 'bbnow', 'dmart', 'avenue supermarts', 'jiomart',
    'grofers', 'reliance fresh', 'smart bazaar', 'smartbazaar', 'naturesbasket', 'spencer', 'milkbasket',
    'country delight', 'licious', 'freshtohome', 'kirana', 'supermarket', 'grocery', 'groceries',
    'provision', 'dunzo', 'swiggy genie',
  ]],
  ['food', [
    'swiggy', 'zomato', 'dominos', 'domino', 'pizza', 'mcdonald', 'kfc', 'burger', 'starbucks', 'cafe',
    'coffee', 'restaurant', 'chai', 'bakery', 'sweets', 'haldiram', 'biryani', 'dunkin', 'subway',
    'eatsure', 'faasos', 'behrouz', 'box8', 'barbeque', 'food', 'kitchen', 'dhaba', 'eatclub', 'chaayos',
    'third wave', 'blue tokai', 'theobroma', 'wow momo', 'momo', 'canteen', 'juice',
  ]],
  ['entertainment', [
    'netflix', 'spotify', 'hotstar', 'disney', 'prime video', 'primevideo', 'amazon prime', 'youtube',
    'bookmyshow', 'pvr', 'inox', 'cinepolis', 'sonyliv', 'zee5', 'jiocinema', 'google play', 'playstore',
    'apple.com', 'itunes', 'steam', 'playstation', 'xbox', 'district', 'paytm insider', 'gaana', 'wynk',
    'audible', 'dream11', 'mpl', 'cinema', 'movies',
  ]],
  ['travel', [
    'irctc', 'makemytrip', 'goibibo', 'cleartrip', 'indigo', 'interglobe', 'air india', 'airindia',
    'vistara', 'akasa', 'spicejet', 'oyo', 'airbnb', 'booking.com', 'agoda', 'redbus', 'ixigo', 'yatra',
    'abhibus', 'airport', 'airline', 'travels', 'zoomcar', 'treebo', 'fabhotels',
  ]],
  ['transport', [
    'uber', 'ola', 'olacabs', 'rapido', 'metro', 'dmrc', 'mmrc', 'bmrcl', 'namma yatri', 'blusmart',
    'fastag', 'parking', 'toll', 'auto', 'cab', 'taxi', 'bmtc',
  ]],
  ['fuel', [
    'petrol', 'fuel', 'hpcl', 'bpcl', 'iocl', 'indian oil', 'indianoil', 'bharat petroleum', 'hp pay',
    'shell', 'nayara', 'filling station', 'petroleum', 'service station',
  ]],
  ['health', [
    'pharmacy', 'pharma', 'chemist', 'medical', 'apollo', 'medplus', '1mg', 'pharmeasy', 'netmeds',
    'hospital', 'clinic', 'diagnostic', 'pathlab', 'lal path', 'thyrocare', 'practo', 'cult.fit',
    'cultfit', 'curefit', 'healthkart', 'gym', 'fitness', 'dental', 'doctor', 'star health',
  ]],
  ['education', [
    'udemy', 'coursera', 'byju', 'unacademy', 'school', 'college', 'university', 'academy', 'institute',
    'tuition', 'vedantu', 'upgrad', 'simplilearn', 'physicswallah', 'books',
  ]],
  ['investments', [
    'zerodha', 'groww', 'upstox', 'kuvera', 'mutual fund', 'mutualfund', 'sip', 'nps', 'ppf',
    'indmoney', 'smallcase', 'angel one', 'angelone', 'paytm money', 'kite', 'iccl', 'nsdl', 'cdsl',
  ]],
  ['emi', [
    'emi', 'loan', 'bajaj fin', 'bajajfinance', 'finserv', 'lazypay', 'simpl', 'kreditbee',
    'moneyview', 'navi', 'home credit', 'tata capital', 'hdb fin',
  ]],
  ['home', [
    'rent', 'nobroker', 'housing.com', 'maintenance', 'society', 'urban company', 'urbanclap',
    'furlenco', 'rentomojo', 'nestaway', 'mygate', 'electrician', 'plumber',
  ]],
  ['bills', [
    'electricity', 'bescom', 'msedcl', 'mahadiscom', 'tata power', 'tatapower', 'adani electricity',
    'bses', 'tneb', 'kseb', 'torrent power', 'mahanagar gas', 'indraprastha gas', 'indane',
    'bharat gas', 'hp gas', 'broadband', 'act fibernet', 'fibernet', 'jio', 'airtel', 'vodafone',
    'bsnl', 'recharge', 'tata play', 'tataplay', 'sun direct', 'postpaid', 'prepaid', 'billdesk',
    'bbps', 'insurance', 'lic', 'policybazaar', 'acko',
  ]],
  ['shopping', [
    'amazon', 'amzn', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq', 'tata cliq', 'croma',
    'reliance digital', 'vijay sales', 'decathlon', 'ikea', 'lenskart', 'firstcry', 'snapdeal',
    'shoppers stop', 'lifestyle', 'westside', 'zara', 'uniqlo', 'pantaloons', 'max fashion', 'trends',
    'boat', 'mall', 'store', 'mart', 'shop', 'fashion',
  ]],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Matcher = { category: CategoryId; long: string[]; short: RegExp | null };

/**
 * Long keywords (5+ letters) match anywhere in the squashed name ("swiggyinstamart").
 * Short ones need word edges, so "ola" does not match "Coca Cola".
 */
const MATCHERS: Matcher[] = KEYWORDS.map(([category, words]) => {
  const long = words.filter((w) => keyOf(w).length >= 5).map(keyOf);
  const shortWords = words.filter((w) => keyOf(w).length < 5);
  const short = shortWords.length ? new RegExp(`\\b(${shortWords.map(escape).join('|')})\\b`, 'i') : null;
  return { category, long, short };
});

const CARD_BILL = /(credit ?card|card ?bill|cc bill).{0,60}?(payment|bill|towards|received)|(payment|bill|towards).{0,60}?(credit ?card)/i;
const CARD_SPEND = /\b(spent|purchase|for using|used at|txn at)\b/i;
const SALARY = /\b(salary|sal cr|payroll)\b/i;
const REFUND = /\b(refund|refunded|reversal|reversed|cashback|cash back)\b/i;
const INTEREST = /\b(interest|int\.? ?pd|int credit)\b/i;
const P2A = /\bp2a\b/i;

const BODY_HINTS: [RegExp, CategoryId][] = [
  [/\bfastag\b/i, 'transport'],
  [/\b(electricity|bbps|billdesk|recharge|broadband|dth|postpaid|insurance premium)\b/i, 'bills'],
  [/\b(emi|loan|nach)\b/i, 'emi'],
  [/\b(sip|mutual fund)\b/i, 'investments'],
  [/\brent\b/i, 'home'],
];

/** Match only on the merchant text. Returns null when nothing fits. */
export function categoryFromMerchant(merchant: string): CategoryId | null {
  const lower = merchant.toLowerCase();
  const key = keyOf(merchant);
  for (const m of MATCHERS) {
    if (m.long.some((w) => key.includes(w))) return m.category;
    if (m.short?.test(lower)) return m.category;
  }
  return null;
}

/** "Ramesh Kumar" style: 2-3 plain words, letters only. */
/** Words that mark a shop or company, never a person ("Shree Balaji Agencies", "Razorpay Payments"). */
const BUSINESS_WORD = new Set([
  'payments', 'payment', 'pay', 'pvt', 'private', 'ltd', 'limited', 'llp', 'inc', 'corp', 'co', 'company', 'agencies', 'agency',
  'enterprises', 'enterprise', 'traders', 'trading', 'store', 'stores', 'mart', 'merchant', 'merchants', 'services', 'service',
  'technologies', 'technology', 'tech', 'solutions', 'industries', 'foods', 'food', 'restaurant', 'cafe', 'hotel', 'medical',
  'medicals', 'pharma', 'pharmacy', 'chemist', 'hospital', 'clinic', 'retail', 'india', 'centre', 'center', 'shop', 'bazaar',
  'bazar', 'collections', 'motors', 'electronics', 'mobiles', 'garments', 'textiles', 'sweets', 'bakery', 'kirana', 'general',
  'provisions', 'automobiles', 'station', 'petroleum', 'fuels', 'jewellers', 'opticals', 'salon', 'studio', 'academy', 'school',
]);

function looksLikePersonName(name: string): boolean {
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 3) return false;
  if (words.some((w) => BUSINESS_WORD.has(w.toLowerCase()))) return false;
  return words.every((w) => w.length >= 2 && w.length <= 14 && /^[A-Za-z]+$/.test(w));
}

export function categorize(p: ParsedTxn, body: string): CategoryId {
  const text = body.replace(/\s+/g, ' ');
  if (p.type === 'credit') {
    if (CARD_BILL.test(text)) return 'card_bill';
    if (SALARY.test(text)) return 'salary';
    if (REFUND.test(text)) return 'refund';
    if (INTEREST.test(text)) return 'interest';
    return 'received';
  }
  if (CARD_BILL.test(text) && !CARD_SPEND.test(text)) return 'card_bill';
  if (p.mode === 'atm') return 'cash';

  const fromName = categoryFromMerchant(p.merchant);
  if (fromName) return fromName;

  for (const [rx, id] of BODY_HINTS) if (rx.test(text)) return id;

  if (P2A.test(text) || p.personLike) return 'people';
  if (p.mode === 'upi' && looksLikePersonName(p.merchant)) return 'people';
  return 'other';
}
