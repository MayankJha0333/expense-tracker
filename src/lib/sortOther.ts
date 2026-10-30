import { isPlaceholderName } from './parser';
import { DEBIT_CATEGORIES, type CategoryId, type Txn } from './types';

/** One shop whose payments are all in "Other". */
export type OtherGroup = { key: string; name: string; count: number; total: number; latest: Txn };

/** A payment Kharcha filed under "Other" on its own, that you haven't looked at yet. */
const unsortedOther = (t: Txn) => t.type === 'debit' && t.category === 'other' && t.categorySource === 'auto' && !t.excluded && !t.isManual;

/**
 * Payments in "Other" grouped by shop, biggest total first (for the Sort screen).
 * Made-up names ("UPI payment") are not one shop, so they come back one by one in [unnamed], newest first.
 */
export function otherGroups(txns: Txn[]): { groups: OtherGroup[]; unnamed: Txn[] } {
  const map = new Map<string, OtherGroup>();
  const unnamed: Txn[] = [];
  for (const t of txns) {
    if (!unsortedOther(t)) continue;
    if (!t.merchantKey || isPlaceholderName(t.merchant)) {
      unnamed.push(t);
      continue;
    }
    const g = map.get(t.merchantKey);
    if (g) {
      g.count += 1;
      g.total += t.amount;
      if (t.timestamp > g.latest.timestamp) g.latest = t;
    } else {
      map.set(t.merchantKey, { key: t.merchantKey, name: t.merchant, count: 1, total: t.amount, latest: t });
    }
  }
  return {
    groups: [...map.values()].sort((a, b) => b.total - a.total),
    unnamed: unnamed.sort((a, b) => b.timestamp - a.timestamp),
  };
}

/** Categories you can pick on the Sort screen. "Other" is where these payments already are. */
export const SORT_PICKS = DEBIT_CATEGORIES.filter((c) => c.id !== 'other' && c.id !== 'card_bill' && c.id !== 'self_transfer').map((c) => c.id);

/*
 * Loose hints from words in a shop's name. Only used to put the likeliest chip first on the Sort
 * screen; nothing is moved until you tap. Wider than the keywords in categorize.ts on purpose
 * ("food", "mart", "rent" anywhere in the name), because a wrong guess here costs nothing.
 */
const HINTS: [RegExp, CategoryId][] = [
  [/google|cursor|openai|chatgpt|github|microsoft|adobe|notion|figma|canva|software|cloud|hosting|domain|digital ?serv|data ?impulse|techmash|vercel/i, 'software'],
  [/kie?raya|\brent|\bpg\b|hostel|apartment|society|maintenance|nobroker|housing|\bflat\b/i, 'home'],
  [/snabbi|pronto|urban ?company|\bmaid|\bcook\b|cleaning|laundry/i, 'house_help'],
  [/caf(e|é)?\b|restaurant|kitchen|food|bistro|baker|sweet|dosa|dose\b|biryani|pizza|waffle|chai\b|coffee|dhaba|rasod|eternal|jubilant|swiggy|zomato|pani ?puri|polar ?bear|f ?and ?b\b|munch/i, 'food'],
  [/mart\b|market|kirana|grocer|fresh|vegetable|dairy|\bmilk|supermarket|hyper/i, 'groceries'],
  [/paytm|mobikwik|phonepe|recharge|airtel|\bjio\b|vodafone|electricity|bescom|broadband|\bbill/i, 'bills'],
  [/cbse|school|college|academy|institute|classes|coaching|universit|tuition/i, 'education'],
  [/playo|bookmyshow|\bpvr|inox|cinema|netflix|spotify|hotstar|\bgame|astrotalk/i, 'entertainment'],
  [/\bekart|amazon|flipkart|myntra|meesho|ajio|retail|fashion|^max$|trends\b/i, 'shopping'],
  [/rental|\buber\b|\bola\b|rapido|\bmetro\b|parking|fastag|\btoll\b/i, 'transport'],
  [/irctc|makemytrip|goibibo|airline|indigo|\boyo\b|cleartrip|redbus/i, 'travel'],
  [/pharma|medical|hospital|clinic|chemist|diagnostic|\bgym\b|fitness|health/i, 'health'],
  [/petrol|\bfuel|filling ?station|petroleum/i, 'fuel'],
  [/zerodha|groww|upstox|mutual ?fund|kuvera/i, 'investments'],
  // A person's name: "Mr ...", or "Ramesh S O Suresh" (son of / wife of / daughter of).
  [/^(mr|mrs|ms)\.? |\b[sdw] ?\/? ?o\b/i, 'people'],
];

/** Likely categories for a shop, from words in its name. Usually none or one. */
export function guessFromName(name: string): CategoryId[] {
  const out: CategoryId[] = [];
  for (const [re, id] of HINTS) if (re.test(name) && !out.includes(id)) out.push(id);
  return out;
}

/** Categories you already use most (by number of payments), most first. Only ones offered on the Sort screen. */
export function usedMost(txns: Txn[]): CategoryId[] {
  const counts = new Map<CategoryId, number>();
  for (const t of txns) {
    if (t.type !== 'debit' || t.excluded || !SORT_PICKS.includes(t.category)) continue;
    counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/**
 * Every category for one shop, best first: guesses from its name, then the ones you use most,
 * then the rest in the usual order. The screen shows the first few and hides the rest behind "More".
 */
export function rankPicks(name: string, mostUsed: CategoryId[]): { order: CategoryId[]; guessed: number } {
  const guesses = guessFromName(name);
  const order = [...new Set([...guesses, ...mostUsed, ...SORT_PICKS])].filter((id) => SORT_PICKS.includes(id));
  return { order, guessed: guesses.filter((id) => SORT_PICKS.includes(id)).length };
}
