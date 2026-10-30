import type { FlowPrefs } from './flows';
import { isPlaceholderName } from './parser';
import { isPurposeId, purpose, purposeKey } from './purposes';
import { CREDIT_CATEGORIES, DEBIT_CATEGORIES, type CategoryId, type DataSource, type Goal, type PurposeId, type Txn } from './types';

/**
 * Everything you create, saved only in this app's private storage on the phone.
 * Payments read from SMS are not part of it (see lib/smsCache.ts).
 * No React Native imports here, so the tests can run it in plain Node.
 */
export type Prefs = {
  /** null until you finish the welcome screen. */
  source: DataSource | null;
  /** merchantKey → category. "Always put Swiggy in Food". */
  rules: Record<string, CategoryId>;
  /** txn id → category. A one-off change for a single payment. */
  overrides: Record<string, CategoryId>;
  /** Payments you said should not count. */
  excluded: string[];
  /** Cash expenses and income you added by hand. */
  manual: Txn[];
  goals: Goal[];
  /** Monthly spending limit, or null for none. */
  budget: number | null;
  /** Credit card statements you marked as paid (bill ids). */
  paidBills: string[];
  /** Card bill payments you looked at and said are fine (Credit cards › Payments to check). */
  checkedCardPayments: string[];
  /** Scheduled SIPs with no payment message that you said to ignore (Investments). */
  ignoredSchedules: string[];
  /** Links between payments you made by hand (see lib/flows.ts). */
  links: FlowPrefs['links'];
  /** Links Kharcha found that you removed. */
  unlinked: string[];
  /** Other names your banks use for you. */
  ownNames: string[];
  /** merchantKey → what you pay this person for ("cook", "rent"). Comes with a matching rule. */
  purposes: Record<string, PurposeId>;
};

export const EMPTY_PREFS: Prefs = {
  source: null,
  rules: {},
  overrides: {},
  excluded: [],
  manual: [],
  goals: [],
  budget: null,
  paidBills: [],
  checkedCardPayments: [],
  ignoredSchedules: [],
  links: [],
  unlinked: [],
  ownNames: [],
  purposes: {},
};

export const STORAGE_KEY = 'kharcha:prefs:v2';
export const LEGACY_KEY = 'kharcha:prefs:v1';
/** Kept apart from prefs so the choice also holds while you look at sample data. */
export const CURRENCY_KEY = 'kharcha:currency:v1';
export const SAMPLE_KEY = 'kharcha:sample:v1';
/** The day your month starts on (1-28). */
export const MONTH_START_KEY = 'kharcha:monthStart:v1';

export const allowedFor = (t: Txn, c: CategoryId) => (t.type === 'debit' ? DEBIT_CATEGORIES : CREDIT_CATEGORIES).some((x) => x.id === c);

/**
 * Layer your corrections on top of what the SMS reader guessed.
 * A rule never applies to a made-up name ("UPI payment"): those are many different shops.
 */
export function applyPrefs(auto: Txn[], prefs: Prefs): Txn[] {
  const excluded = new Set(prefs.excluded);
  const fromSms = auto.map((t): Txn => {
    const override = prefs.overrides[t.id];
    const placeholder = isPlaceholderName(t.merchant);
    // Money in can have its own rule (from tagging who pays you), else the shop's rule.
    const rule = placeholder ? undefined : ((t.type === 'credit' ? prefs.rules[purposeKey(t)] : undefined) ?? prefs.rules[t.merchantKey]);
    const tag = placeholder ? undefined : prefs.purposes?.[purposeKey(t)];
    let next = t;
    if (override && allowedFor(t, override)) next = { ...t, category: override, categorySource: 'manual' };
    else if (rule && allowedFor(t, rule)) next = { ...t, category: rule, categorySource: 'rule' };
    // The tag only shows while the payment is still in the category it gave.
    if (tag && isPurposeId(tag) && purpose(tag).side === t.type && next.category === purpose(tag).category) next = { ...next, purpose: tag };
    return excluded.has(t.id) ? { ...next, excluded: true } : next;
  });
  const manual = prefs.manual.map((t) => (excluded.has(t.id) ? { ...t, excluded: true } : t));
  return [...fromSms, ...manual].sort((a, b) => b.timestamp - a.timestamp);
}

/** Ids that point at an SMS (a payment, a card bill or a scheduled payment). Cash entries and goals are never touched. */
const SMS_ID = /^(sms|bill|sched)-(.+)$/;

/** Rewrites every id in prefs with [fn]. [fn] returns null to drop the entry. */
function mapIds(p: Prefs, fn: (id: string) => string | null): Prefs {
  const one = (id: string) => (SMS_ID.test(id) ? fn(id) : id);
  const list = (ids: string[] | undefined) => [...new Set((ids ?? []).map(one).filter((x): x is string => x !== null))];
  const overrides: Record<string, CategoryId> = {};
  for (const [id, c] of Object.entries(p.overrides)) {
    const n = one(id);
    if (n !== null) overrides[n] = c;
  }
  const links = (p.links ?? []).flatMap((l) => {
    const outId = one(l.outId);
    const inId = one(l.inId);
    return outId !== null && inId !== null ? [{ ...l, outId, inId }] : [];
  });
  const unlinked = (p.unlinked ?? []).flatMap((k) => {
    const [a, b] = k.split('>');
    const outId = a ? one(a) : null;
    const inId = b ? one(b) : null;
    return outId !== null && inId !== null ? [`${outId}>${inId}`] : [];
  });
  return {
    ...p,
    overrides,
    excluded: list(p.excluded),
    paidBills: list(p.paidBills),
    checkedCardPayments: list(p.checkedCardPayments),
    ignoredSchedules: list(p.ignoredSchedules),
    links,
    unlinked: [...new Set(unlinked)],
  };
}

/** True when prefs still hold ids made from Android's row numbers ("sms-1234"). */
export function hasOldIds(p: Prefs): boolean {
  let found = false;
  mapIds(p, (id) => {
    if (/^(?:sms|bill|sched)-\d+$/.test(id)) found = true;
    return id;
  });
  return found;
}

/**
 * Moves corrections from Android's row numbers to stable ids (see stableSmsId), so they survive
 * a new phone or a restored SMS backup. [idMap] is Android id → stable id, from a full inbox read.
 * Ids not in the map are left alone; they are cleaned up by prunePrefs if their message is gone.
 */
export function migrateIds(p: Prefs, idMap: Record<string, string>): Prefs {
  return mapIds(p, (id) => {
    const m = SMS_ID.exec(id)!;
    const stable = idMap[m[2]];
    return stable ? `${m[1]}-${stable}` : id;
  });
}

/**
 * Drops corrections for messages that are no longer read (older than 13 months, or deleted),
 * so prefs don't grow forever. Only call this after a complete read of the inbox: [known] must
 * hold every payment, bill and scheduled payment id the app can see.
 */
export function prunePrefs(p: Prefs, known: ReadonlySet<string>): Prefs {
  return mapIds(p, (id) => (known.has(id) ? id : null));
}
