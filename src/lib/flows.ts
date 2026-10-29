import { instrumentKey } from './accounts';
import { keyOf } from './parser';
import { cat, type CategoryId, type LinkKind, type Txn, type TxnLink } from './types';

/*
 * Money flow: how payments relate to each other.
 *
 * Every payment is read from its own SMS, so on its own the app would count:
 *  - moving ₹700 from your Slice account to your HDFC account as ₹700 spent AND ₹700 earned;
 *  - a ₹1,999 Myntra order you returned as ₹1,999 spent plus ₹1,999 of "income".
 * This step finds those pairs and links them, so totals show what really happened:
 *  - transfer: both sides stop counting as spending or income (the money is still yours);
 *  - refund: the refund is taken off the purchase it belongs to, and is not income.
 *
 * Your corrections always win: a category you picked by hand is never changed here,
 * links you removed stay removed, and links you made are applied first.
 *
 * Pure functions, no React: runs after your category corrections, before any totals.
 */

const DAY = 86_400_000;
/** Same money usually lands within minutes; allow a bank holiday weekend. */
const TRANSFER_WINDOW = 3 * DAY;
/** The credit SMS sometimes arrives a little before the debit SMS. */
const EARLY_SLACK = 30 * 60_000;
/** Returns can take months (warranty, slow refunds). */
const REFUND_WINDOW = 120 * DAY;
/** A failed UPI payment is reversed within days, to the same account. */
const REVERSAL_WINDOW = 10 * DAY;
const CENT = 0.005;

/** What you told the app. Stored with your other corrections. */
export type FlowPrefs = {
  /** Links you made by hand. */
  links: { kind: LinkKind; outId: string; inId: string }[];
  /** Links you removed ("these are not the same money"), as pairKey(outId, inId). */
  unlinked: string[];
  /** Extra names your banks use for you, added by you. */
  ownNames: string[];
};

export const EMPTY_FLOW_PREFS: FlowPrefs = { links: [], unlinked: [], ownNames: [] };
export const pairKey = (outId: string, inId: string) => `${outId}>${inId}`;

/* ---------- who you are ---------- */

// HDFC NEFT credits name the account holder: "NEFT Cr-ICIC0SF0002-ACME PRIVATE LIMITED-MAYANK JHA-IN..."
const NEFT_HOLDER = /\bneft\s+cr-[A-Za-z0-9]{4,11}-[^-]{2,60}-([A-Za-z][A-Za-z .]{2,40})-/i;

/** Your own name as your bank writes it, read from salary/NEFT alerts. */
export function inferOwnNames(txns: Txn[]): string[] {
  const seen = new Map<string, string>();
  for (const t of txns) {
    if (t.type !== 'credit' || !t.rawSms) continue;
    const m = NEFT_HOLDER.exec(t.rawSms.replace(/\s+/g, ' '));
    if (m) seen.set(keyOf(m[1]), m[1].trim());
  }
  return [...seen.values()];
}

/** Banks and wallets you have an account with: the ones that send you alerts. */
export function ownBanks(txns: Txn[]): string[] {
  const banks = new Set<string>();
  for (const t of txns) if (!t.isManual && t.bank) banks.add(t.bank);
  return [...banks];
}

// UPI handles that belong to one bank, so "from 98xxxx@slc" means "from a slice account".
const HANDLE_BANK: [RegExp, string][] = [
  [/^slc$/, 'slice'],
  [/^(hdfcbank|okhdfcbank|payzapp)$/, 'hdfcbank'],
  [/^(icici|okicici|ibl)$/, 'icicibank'],
  [/^(sbi|oksbi)$/, 'sbi'],
  [/^(axisbank|okaxis|axl|axisb)$/, 'axisbank'],
  [/^(kotak|kotakpay|kmbl)$/, 'kotak'],
  [/^(paytm|pty|ptyes|ptaxis|pthdfc|ptsbi)$/, 'paytm'],
  [/^(fbl|federal)$/, 'federalbank'],
  [/^(idfcbank|idfcfirst)$/, 'idfcfirst'],
  [/^(yesbank|yesbankltd)$/, 'yesbank'],
];

function handleBank(merchant: string): string | null {
  const at = merchant.lastIndexOf('@');
  if (at < 0) return null;
  const handle = merchant.slice(at + 1).toLowerCase();
  return HANDLE_BANK.find(([rx]) => rx.test(handle))?.[1] ?? null;
}

type Identity = { names: Set<string>; banks: string[] };

function identity(txns: Txn[], prefs: FlowPrefs): Identity {
  const names = new Set([...inferOwnNames(txns), ...prefs.ownNames].map(keyOf).filter((k) => k.length >= 5));
  return { names, banks: ownBanks(txns).map(keyOf) };
}

/** "Mayank Jha" when the bank calls you "MAYANKJHA". */
function isOwnName(name: string, me: Identity): boolean {
  const k = keyOf(name);
  if (k.length < 5) return false;
  for (const n of me.names) if (k === n || (k.length >= 8 && n.startsWith(k))) return true;
  return false;
}

// Names the reader makes up when the SMS has none ("HDFC Bank debit", "UPI payment"): not a sign of anything.
const MADE_UP_NAME = /^(?:.+ debit|credit to .+|upi payment|card payment|payment|money received)$/i;

/** "To slice small finance bank", "To slice": topping up your own account. */
function isOwnBank(name: string, me: Identity): boolean {
  if (MADE_UP_NAME.test(name)) return false;
  const k = keyOf(name);
  return me.banks.some((b) => b.length >= 3 && (k === b || (k.includes(b) && k.includes('bank'))));
}

const sameBank = (bankKey: string, bank: string | null) => !!bank && keyOf(bank).startsWith(bankKey.slice(0, 4));

/* ---------- finding pairs ---------- */

/** Money out that could be you moving money: to a person, unknown, or already marked as a transfer. */
const OUT_CAN_MOVE = new Set<CategoryId>(['people', 'other', 'self_transfer', 'card_bill']);
/** Money in that could be your own money arriving. Salary, refunds and interest never are. */
const IN_CAN_MOVE = new Set<CategoryId>(['received', 'self_transfer', 'card_bill']);

const REFUND_WORDS = /\b(refund|refunded|reversal|reversed|returned|chargeback)\b/i;
const CASHBACK_ONLY = /\bcash ?back\b/i;
const sameCents = (a: number, b: number) => Math.abs(a - b) < CENT;
// A card bill is paid from a bank account to a card: different places by nature.
const differentPlace = (a: Txn, b: Txn) => instrumentKey(a) !== instrumentKey(b);

/** Why two payments look like the same money moving. Null = no sign it's you. */
function transferReason(out: Txn, inn: Txn, me: Identity): string | null {
  if (out.category === 'card_bill' && inn.category === 'card_bill') return 'card bill';
  if (out.category === 'self_transfer' || inn.category === 'self_transfer') return 'marked as transfer';
  if (isOwnName(out.merchant, me) || isOwnName(inn.merchant, me)) return 'your own name';
  if (isOwnBank(out.merchant, me)) return 'your own bank';
  const fromBank = handleBank(inn.merchant);
  if (fromBank && sameBank(fromBank, out.bank)) return 'your other bank';
  const toBank = handleBank(out.merchant);
  if (toBank && sameBank(toBank, inn.bank)) return 'your other bank';
  return null;
}

/** A category you picked yourself is never changed here. ("Self transfer" you picked still gets its other side found.) */
const userPicked = (t: Txn) => t.categorySource === 'manual' && t.category !== 'self_transfer';

type Work = Map<string, Txn>;

function addLink(work: Work, outId: string, inId: string, kind: LinkKind, source: TxnLink['source'], amount: number) {
  const out = work.get(outId);
  const inn = work.get(inId);
  if (!out || !inn) return;
  out.links = [...(out.links ?? []), { kind, otherId: inId, source, amount }];
  inn.links = [...(inn.links ?? []), { kind, otherId: outId, source, amount }];
  if (kind === 'transfer') {
    // Your own money, so neither spending nor income. A card bill already counts as neither.
    for (const t of [out, inn]) if (t.category !== 'card_bill' && !(source === 'auto' && userPicked(t))) t.category = 'self_transfer';
  } else {
    // Take the refund off the purchase; the refund itself is then not income.
    out.grossAmount = out.grossAmount ?? out.amount;
    out.amount = Math.max(0, Math.round((out.amount - amount) * 100) / 100);
    if (out.amount < CENT) out.netted = true;
    inn.netted = true;
  }
}

const isLinked = (t: Txn) => (t.links?.length ?? 0) > 0;
/** Money left on a purchase that a refund can still come back against. */
const refundable = (t: Txn) => t.amount;

/**
 * Links related payments and returns a new list (inputs are not changed).
 * `txns` must already have your category corrections applied.
 */
export function resolveFlows(txns: Txn[], prefs: FlowPrefs = EMPTY_FLOW_PREFS): Txn[] {
  const work: Work = new Map(txns.map((t) => [t.id, { ...t, links: undefined, grossAmount: undefined, netted: undefined }]));
  const me = identity(txns, prefs);
  const blocked = new Set(prefs.unlinked);

  // 1. Links you made by hand come first.
  for (const l of prefs.links) {
    const out = work.get(l.outId);
    const inn = work.get(l.inId);
    if (!out || !inn || out.type !== 'debit' || inn.type !== 'credit' || isLinked(out) || isLinked(inn)) continue;
    if (blocked.has(pairKey(l.outId, l.inId))) continue;
    const amount = l.kind === 'refund' ? Math.min(inn.amount, refundable(out)) : out.amount;
    addLink(work, out.id, inn.id, l.kind, 'user', amount);
  }

  const list = [...work.values()].filter((t) => !t.isManual);
  const outs = list.filter((t) => t.type === 'debit').sort((a, b) => a.timestamp - b.timestamp);
  const ins = list.filter((t) => t.type === 'credit').sort((a, b) => a.timestamp - b.timestamp);

  // 2. Same money moving between your own accounts: same amount, different account, within days, and a sign it's you.
  type Pair = { out: Txn; inn: Txn; gap: number };
  const pairs: Pair[] = [];
  for (const inn of ins) {
    if (isLinked(inn) || !IN_CAN_MOVE.has(inn.category) || userPicked(inn)) continue;
    for (const out of outs) {
      const gap = inn.timestamp - out.timestamp;
      if (gap > TRANSFER_WINDOW) continue;
      if (gap < -EARLY_SLACK) break;
      if (isLinked(out) || !OUT_CAN_MOVE.has(out.category) || userPicked(out) || out.mode === 'card') continue;
      if (!sameCents(out.amount, inn.amount) || !differentPlace(out, inn)) continue;
      if (blocked.has(pairKey(out.id, inn.id)) || !transferReason(out, inn, me)) continue;
      pairs.push({ out, inn, gap: Math.abs(gap) });
    }
  }
  // Closest in time wins, each payment used once.
  pairs.sort((a, b) => a.gap - b.gap);
  for (const { out, inn } of pairs) {
    if (isLinked(out) || isLinked(inn)) continue;
    addLink(work, out.id, inn.id, 'transfer', 'auto', out.amount);
  }

  // 3. Refunds back to the purchase they belong to.
  for (const inn of ins) {
    if (isLinked(inn) || userPicked(inn) || !inn.rawSms) continue;
    const isRefund = inn.category === 'refund' || REFUND_WORDS.test(inn.rawSms);
    if (!isRefund || (CASHBACK_ONLY.test(inn.rawSms) && !REFUND_WORDS.test(inn.rawSms))) continue;
    const reversal = /\b(revers|chargeback)/i.test(inn.rawSms);
    let best: Txn | null = null;
    let bestScore = -1;
    for (const out of outs) {
      const gap = inn.timestamp - out.timestamp;
      if (gap <= 0) break;
      if (gap > REFUND_WINDOW || out.netted || (out.links ?? []).some((l) => l.kind === 'transfer')) continue;
      if (!cat(out.category).countsAsSpend && !cat(out.category).isSaving) continue;
      if (refundable(out) + CENT < inn.amount || blocked.has(pairKey(out.id, inn.id))) continue;
      const shop = out.merchantKey === inn.merchantKey || (inn.merchantKey.length >= 4 && out.merchantKey.includes(inn.merchantKey));
      const sameAccount = !!out.account && out.account === inn.account;
      const exact = sameCents(refundable(out), inn.amount);
      // A reversal names no shop, so it needs the same account, the exact amount and only a few days.
      const reversed = reversal && sameAccount && exact && gap <= REVERSAL_WINDOW;
      if (!shop && !reversed) continue;
      // Exact amount, then same card/account, then the most recent purchase.
      const score = (exact ? 4 : 0) + (sameAccount ? 2 : 0) + out.timestamp / 1e15;
      if (score > bestScore) {
        best = out;
        bestScore = score;
      }
    }
    if (best) addLink(work, best.id, inn.id, 'refund', 'auto', inn.amount);
  }

  // 4. No pair found, but clearly you: paying yourself or topping up your own account.
  for (const t of list) {
    if (isLinked(t) || t.categorySource !== 'auto' || t.mode === 'card') continue;
    const own = isOwnName(t.merchant, me) || (t.type === 'debit' && isOwnBank(t.merchant, me));
    if (own && (t.type === 'debit' ? OUT_CAN_MOVE : IN_CAN_MOVE).has(t.category)) t.category = 'self_transfer';
  }

  return txns.map((t) => work.get(t.id) ?? t);
}

/* ---------- linking by hand ---------- */

export type LinkCandidate = { txn: Txn; kind: LinkKind; why: string };

/** Payments you could link this one to, best first. */
export function linkCandidates(txn: Txn, all: Txn[]): LinkCandidate[] {
  const out: LinkCandidate[] = [];
  const debit = txn.type === 'debit';
  for (const o of all) {
    if (o.id === txn.id || o.type === txn.type || isLinked(o)) continue;
    const gap = Math.abs(o.timestamp - txn.timestamp);
    const shown = o.grossAmount ?? o.amount;
    const transferLike = sameCents(shown, txn.grossAmount ?? txn.amount) && gap <= 7 * DAY;
    const purchase = debit ? txn : o;
    const refund = debit ? o : txn;
    const refundLike =
      refund.timestamp > purchase.timestamp &&
      refund.timestamp - purchase.timestamp <= REFUND_WINDOW &&
      (purchase.merchantKey === refund.merchantKey || REFUND_WORDS.test(refund.rawSms ?? '')) &&
      refund.amount <= (purchase.grossAmount ?? purchase.amount) + CENT;
    if (refundLike) out.push({ txn: o, kind: 'refund', why: purchase.merchantKey === refund.merchantKey ? 'Same shop' : 'Refund' });
    else if (transferLike) out.push({ txn: o, kind: 'transfer', why: 'Same amount' });
  }
  return out
    .sort((a, b) => Math.abs(a.txn.timestamp - txn.timestamp) - Math.abs(b.txn.timestamp - txn.timestamp))
    .slice(0, 30);
}
