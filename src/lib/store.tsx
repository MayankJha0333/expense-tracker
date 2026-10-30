import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { clampMonthStart, setMonthStart as applyMonthStart, thisMonth, type Month } from './analytics';
import {
  currencyForLocale,
  getHomeCurrency,
  isCurrencyCode,
  pickHomeCurrency,
  setHomeCurrency,
  type CurrencyCode,
  type CurrencySetting,
} from './currency';
import { demoExtras, demoInbox, SAMPLE_DATA_ENABLED, SAMPLE_KINDS, type SampleKind } from './demo';
import { deviceLocale } from './deviceLocale';
import { isPlaceholderName, keyOf } from './parser';
import { pairKey, resolveFlows } from './flows';
import { processInbox, withStableIds } from './pipeline';
import {
  applyPrefs,
  CURRENCY_KEY,
  EMPTY_PREFS,
  hasOldIds,
  LEGACY_KEY,
  migrateIds,
  MONTH_START_KEY,
  prunePrefs,
  SAMPLE_KEY,
  STORAGE_KEY,
  type Prefs,
} from './prefs';
import { purpose, purposeKey } from './purposes';
import { checkSmsPermission, devGlobals, readInbox, requestSmsPermission, usingTestInbox, type SmsPermission } from './sms';
import { countAfter, fromCache, fromFullRead, mergeRead, needsFullRead, parseCache, readSince, windowStart, type InboxData, type InboxRead, type SmsCache } from './smsCache';
import { deleteCacheFile, readCacheFile, writeCacheFile } from './smsCacheFile';
import {
  EMPTY_STATS,
  type CardBill,
  type CategoryId,
  type LinkKind,
  type DataSource,
  type Goal,
  type PayMode,
  type PurposeId,
  type ScanStats,
  type ScheduledDebit,
  type Txn,
  type TxnType,
} from './types';

export type { Prefs } from './prefs';

const AUTO_REFRESH_GAP_MS = 60_000;

export type Status = 'booting' | 'onboarding' | 'loading' | 'ready';

export type NewEntry = {
  type: TxnType;
  amount: number;
  merchant: string;
  category: CategoryId;
  timestamp: number;
  note?: string;
  mode?: PayMode;
  /** Leave out for the home currency. */
  currency?: CurrencyCode;
};
export type GoalInput = Pick<Goal, 'name' | 'target' | 'saved' | 'icon' | 'color' | 'deadline'>;

/** Set when the last full read stopped at the message limit: months before [oldest] were not read. */
export type ReadLimit = { oldest: number | null } | null;

type Store = {
  status: Status;
  source: DataSource | null;
  /** Totals are in this currency. */
  currency: CurrencyCode;
  /** What you picked in Settings ("auto" = follow your payments). */
  currencySetting: CurrencySetting;
  /** What "auto" would pick right now. */
  autoCurrency: CurrencyCode;
  setCurrencySetting: (s: CurrencySetting) => void;
  /** The day of the calendar month your month starts on, 1-28 (1 = calendar months). */
  monthStart: number;
  setMonthStart: (day: number) => void;
  /** Which sample data set is showing (when source is demo). */
  sample: SampleKind;
  setSample: (kind: SampleKind) => void;
  permission: SmsPermission;
  txns: Txn[];
  stats: ScanStats;
  /** Not null when the inbox had more messages than the app reads (see ReadLimit). */
  readLimit: ReadLimit;
  month: Month;
  lastSync: number | null;
  error: string | null;
  refreshing: boolean;
  goals: Goal[];
  budget: number | null;
  /** Credit card statements read from SMS, newest first. */
  bills: CardBill[];
  /** Payments the bank said it will take soon (SIP autopay, mandates). */
  scheduled: ScheduledDebit[];
  /** Mutual funds named in your SIP messages ("Nippon India Small"). */
  funds: string[];
  paidBills: string[];
  checkedCardPayments: string[];
  /** "Yes, this card payment is right": stops asking about it. */
  checkCardPayment: (txnId: string) => void;
  ignoredSchedules: string[];
  /** "This scheduled SIP didn't happen": stops asking about it. */
  ignoreSchedule: (id: string) => void;
  setMonth: (m: Month) => void;
  refresh: () => Promise<void>;
  requestAccess: () => Promise<SmsPermission>;
  chooseSource: (source: 'manual' | 'demo') => void;
  /**
   * Changes a payment's category. With [applyToMerchant], also makes a rule for every payment to that
   * shop or person, past and future. Never for a made-up name ("UPI payment"): that changes this payment only.
   */
  setCategory: (txn: Txn, category: CategoryId, applyToMerchant: boolean) => void;
  /** Say what you pay this person for. Moves every payment to them; null clears it. */
  setPurpose: (txn: Txn, purpose: PurposeId | null) => void;
  setExcluded: (txn: Txn, excluded: boolean) => void;
  addEntry: (input: NewEntry) => void;
  deleteManual: (id: string) => void;
  saveGoal: (input: GoalInput, id?: string) => void;
  addToGoal: (id: string, amount: number) => void;
  deleteGoal: (id: string) => void;
  setBudget: (amount: number | null) => void;
  markBillPaid: (billId: string, paid: boolean) => void;
  /** "This category is right": stops the payment showing in Needs a look. */
  confirmCategory: (txn: Txn) => void;
  /** Link two payments: the same money moved between your accounts, or a refund for a purchase. */
  linkTxns: (a: Txn, b: Txn, kind: LinkKind) => void;
  /** "These aren't related": removes a link, and Kharcha won't make it again. */
  unlinkTxns: (a: Txn, b: Txn) => void;
  /** Deletes everything Kharcha saved and returns to the welcome screen. */
  eraseAll: () => Promise<void>;
  find: (id: string) => Txn | undefined;
};

const StoreContext = createContext<Store | null>(null);

async function loadPrefs(): Promise<{ prefs: Prefs; ok: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return { prefs: { ...EMPTY_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }, ok: true };
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<Prefs> & { manualOnly?: boolean };
      const { manualOnly, ...rest } = old;
      return { prefs: { ...EMPTY_PREFS, ...rest, source: manualOnly ? 'manual' : null }, ok: true };
    }
    return { prefs: EMPTY_PREFS, ok: true };
  } catch {
    // Broken storage should never block the app. Don't save either,
    // so a one-off read error can't wipe your saved data.
    return { prefs: EMPTY_PREFS, ok: false };
  }
}

/** Every payment, bill and scheduled payment id the app can see now (for prunePrefs). */
const knownIds = (d: InboxData) => new Set([...d.txns.map((t) => t.id), ...d.bills.map((b) => b.id), ...d.scheduled.map((s) => s.id)]);

/** The native result → a read with stable ids, plus Android id → stable id for moving old corrections. */
function toRead(inbox: Awaited<ReturnType<typeof readInbox>>): { read: InboxRead; idMap: Record<string, string> } {
  const { messages, idMap } = withStableIds(inbox.messages);
  return {
    read: {
      messages,
      personalSkipped: inbox.personalSkipped ?? 0,
      promoSkipped: inbox.promoSkipped ?? 0,
      limitReached: inbox.limitReached === true,
      oldest: typeof inbox.oldest === 'number' ? inbox.oldest : null,
    },
    idMap,
  };
}

function demoState(kind: SampleKind) {
  const now = Date.now();
  const { txns, stats, bills, scheduled, funds } = processInbox(demoInbox(now, kind));
  const extras = demoExtras(now, kind);
  const prefs: Prefs = { ...EMPTY_PREFS, source: 'demo', manual: extras.manual, goals: extras.goals, budget: extras.budget };
  return { txns, stats, bills, scheduled, funds, prefs };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('booting');
  const [permission, setPermission] = useState<SmsPermission>('denied');
  const [autoTxns, setAutoTxns] = useState<Txn[]>([]);
  const [stats, setStats] = useState<ScanStats>(EMPTY_STATS);
  const [bills, setBills] = useState<CardBill[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledDebit[]>([]);
  const [funds, setFunds] = useState<string[]>([]);
  const [saved, setSaved] = useState<Prefs>(EMPTY_PREFS);
  // Sample data lives only in memory, so it can never mix with your own.
  const [demo, setDemo] = useState<Prefs | null>(null);
  const [month, setMonth] = useState<Month>(thisMonth());
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [readLimit, setReadLimit] = useState<ReadLimit>(null);
  const [currencySetting, setCurrencySettingState] = useState<CurrencySetting>('auto');
  const [monthStart, setMonthStartState] = useState(1);
  const locale = useMemo(() => deviceLocale(), []);
  // Sample data follows the phone's region: dollars in the US, rupees elsewhere.
  const [sample, setSampleState] = useState<SampleKind>(() => (currencyForLocale(locale) === 'USD' ? 'us' : 'india'));
  const sampleRef = useRef(sample);
  const busy = useRef(false);
  const canSave = useRef(false);
  const statusRef = useRef<Status>('booting');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const prefs = demo ?? saved;
  const source = prefs.source;
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  /** Applies a change to whichever data set is showing. */
  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    if (sourceRef.current === 'demo') setDemo((d) => (d ? fn(d) : d));
    else setSaved(fn);
  }, []);

  useEffect(() => {
    if (!canSave.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved]);

  /** The kept bank messages (see lib/smsCache.ts). undefined = not loaded from the file yet. */
  const cacheRef = useRef<SmsCache | null | undefined>(undefined);

  const showData = useCallback((d: InboxData) => {
    setAutoTxns(d.txns);
    setStats(d.stats);
    setBills(d.bills);
    setScheduled(d.scheduled);
    setFunds(d.funds);
  }, []);

  /**
   * Goes up whenever the kept messages are thrown away. A read that started before that must not
   * show or save what it read (Delete all tapped while the inbox was being read).
   */
  const epoch = useRef(0);

  /** Forgets the kept bank messages, on the phone and in memory (SMS access turned off, or Delete all). */
  const dropCache = useCallback(() => {
    epoch.current += 1;
    cacheRef.current = null;
    deleteCacheFile();
    setReadLimit(null);
  }, []);

  /**
   * Reads bank SMS. The first time, the kept messages from last time show straight away; then only
   * messages newer than the last read are read (or the whole inbox, see needsFullRead).
   */
  const scan = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    const started = epoch.current;
    const stale = () => epoch.current !== started;
    try {
      const now = Date.now();
      if (usingTestInbox()) {
        // A development build's test inbox: read as it is, never kept.
        const { read } = toRead(await readInbox(windowStart(now)));
        if (stale()) return;
        showData(fromFullRead(read, now).data);
      } else {
        if (cacheRef.current === undefined) {
          const saved = parseCache(await readCacheFile());
          if (stale()) return;
          cacheRef.current = saved;
          if (cacheRef.current) {
            showData(fromCache(cacheRef.current));
            setReadLimit(cacheRef.current.limitReached ? { oldest: cacheRef.current.oldest } : null);
            setStatus('ready');
          }
        }
        const cache = cacheRef.current;
        const full = needsFullRead(cache, now);
        const inbox = await readInbox(readSince(cache, now), countAfter(cache, now));
        // Let the spinner paint before the parsing work starts.
        await new Promise((r) => setTimeout(r, 0));
        if (stale()) return;
        const { read, idMap } = toRead(inbox);
        let data: InboxData;
        let next: SmsCache;
        if (full || !cache) {
          ({ data, cache: next } = fromFullRead(read, now));
        } else {
          next = mergeRead(cache, read, now);
          data = fromCache(next);
        }
        cacheRef.current = next;
        showData(data);
        setReadLimit(next.limitReached ? { oldest: next.oldest } : null);
        // If Delete all comes while this is being written, don't leave the file behind.
        writeCacheFile(JSON.stringify(next)).then(() => {
          // Only when nothing newer has been kept since (a later read writes its own file).
          if (stale() && cacheRef.current === null) deleteCacheFile();
        });
        if (full) {
          // Move corrections from Android's ids to stable ones, then drop those for messages that are
          // gone. Only after a complete read: a read cut short by the limit would drop real ones.
          const known = knownIds(data);
          const complete = !next.limitReached && data.txns.length > 0;
          setSaved((p) => {
            let n = Object.keys(idMap).length && hasOldIds(p) ? migrateIds(p, idMap) : p;
            if (complete) n = prunePrefs(n, known);
            return JSON.stringify(n) === JSON.stringify(p) ? p : n;
          });
        }
      }
      setLastSync(Date.now());
      setError(null);
    } catch (e) {
      if (!stale()) setError(e instanceof Error ? e.message : 'Could not read messages');
    } finally {
      busy.current = false;
      setRefreshing(false);
      // After Delete all, the welcome screen stays.
      if (!stale()) setStatus('ready');
    }
  }, [showData]);

  // Development builds only: lets a test inbox be re-read from the debugger (see scripts/scan-sms.ts).
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) devGlobals.__KHARCHA_RESCAN__ = scan;
  }, [scan]);

  const startDemo = useCallback(() => {
    const d = demoState(sampleRef.current);
    setAutoTxns(d.txns);
    setStats(d.stats);
    setBills(d.bills);
    setScheduled(d.scheduled);
    setFunds(d.funds);
    setDemo(d.prefs);
    setLastSync(Date.now());
    setStatus('ready');
  }, []);

  // First start: load saved data, then decide where transactions come from.
  useEffect(() => {
    (async () => {
      const { prefs: stored, ok } = await loadPrefs();
      // A release build never opens sample data, even if a development build saved that choice.
      const loaded = !SAMPLE_DATA_ENABLED && stored.source === 'demo' ? { ...stored, source: null } : stored;
      canSave.current = ok;
      setSaved(loaded);
      try {
        const [[, cur], [, smp], [, start]] = await AsyncStorage.multiGet([CURRENCY_KEY, SAMPLE_KEY, MONTH_START_KEY]);
        if (cur === 'auto' || isCurrencyCode(cur)) setCurrencySettingState(cur);
        if (start) {
          const day = clampMonthStart(Number(start));
          applyMonthStart(day);
          setMonthStartState(day);
          setMonth(thisMonth());
        }
        if (smp && (SAMPLE_KINDS as string[]).includes(smp)) {
          sampleRef.current = smp as SampleKind;
          setSampleState(smp as SampleKind);
        }
      } catch {
        // Keep the defaults.
      }

      if (loaded.source === 'demo') {
        startDemo();
        return;
      }
      const p = await checkSmsPermission();
      setPermission(p);
      if (p === 'granted') {
        if (loaded.source !== 'sms') setSaved((x) => ({ ...x, source: 'sms' }));
        setStatus('loading');
        await scan();
      } else {
        // No SMS access: nothing read from SMS may stay on the phone.
        dropCache();
        // SMS was turned off in Settings, or you chose manual entry. Home explains.
        setStatus(loaded.source ? 'ready' : 'onboarding');
      }
    })();
  }, [scan, startDemo, dropCache]);

  // Coming back to the app picks up new bank SMS.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || sourceRef.current === 'demo') return;
      const p = await checkSmsPermission();
      setPermission((prev) => (p === 'denied' && (prev === 'blocked' || prev === 'restricted') ? prev : p));
      if (p !== 'granted') {
        if (p !== 'unavailable') dropCache();
        return;
      }
      // You may have just allowed SMS in Settings.
      if (sourceRef.current !== 'sms') setSaved((x) => ({ ...x, source: 'sms' }));
      if (statusRef.current === 'onboarding') {
        setStatus('loading');
        scan();
      } else if (!lastSync || Date.now() - lastSync > AUTO_REFRESH_GAP_MS) {
        scan();
      }
    });
    return () => sub.remove();
  }, [lastSync, scan, dropCache]);

  const refresh = useCallback(async () => {
    if (sourceRef.current === 'demo') return;
    const p = await checkSmsPermission();
    setPermission(p);
    if (p === 'granted') await scan();
    else if (p !== 'unavailable') dropCache();
  }, [scan, dropCache]);

  const requestAccess = useCallback(async () => {
    const p = await requestSmsPermission();
    setPermission(p);
    if (p === 'granted') {
      setDemo(null);
      setSaved((x) => ({ ...x, source: 'sms' }));
      // Only show the full-screen loader during setup, not from Home.
      if (statusRef.current === 'onboarding') setStatus('loading');
      await scan();
    }
    return p;
  }, [scan]);

  const chooseSource = useCallback(
    (next: 'manual' | 'demo') => {
      if (next === 'demo') {
        if (!SAMPLE_DATA_ENABLED) return;
        // Remember the choice so the next launch opens the sample again.
        setSaved((x) => ({ ...x, source: 'demo' }));
        startDemo();
        return;
      }
      setDemo(null);
      setAutoTxns([]);
      setStats(EMPTY_STATS);
      setBills([]);
      setScheduled([]);
      setFunds([]);
      // Adding payments by hand only: no SMS is used, so none is kept.
      dropCache();
      setSaved((x) => ({ ...x, source: 'manual' }));
      setStatus('ready');
    },
    [startDemo, dropCache],
  );

  const setPurpose = useCallback(
    (txn: Txn, next: PurposeId | null) => {
      if (!txn.merchantKey) return;
      const key = purposeKey(txn);
      update((x) => {
        const purposes = { ...(x.purposes ?? {}) };
        const rules = { ...x.rules };
        const overrides = { ...x.overrides };
        // A one-off change on this payment would hide the new tag, so drop it.
        delete overrides[txn.id];
        if (next === null) {
          delete purposes[key];
          delete rules[key];
        } else {
          purposes[key] = next;
          rules[key] = purpose(next).category;
        }
        return { ...x, purposes, rules, overrides };
      });
    },
    [update],
  );

  const setCategory = useCallback(
    (txn: Txn, category: CategoryId, applyToMerchant: boolean) => {
      update((x) => {
        if (txn.isManual) {
          return { ...x, manual: x.manual.map((t) => (t.id === txn.id ? { ...t, category } : t)) };
        }
        const overrides = { ...x.overrides };
        if (applyToMerchant && txn.merchantKey && !isPlaceholderName(txn.merchant)) {
          delete overrides[txn.id];
          return { ...x, overrides, rules: { ...x.rules, [txn.merchantKey]: category } };
        }
        overrides[txn.id] = category;
        return { ...x, overrides };
      });
    },
    [update],
  );

  const setExcluded = useCallback(
    (txn: Txn, value: boolean) => {
      update((x) => {
        const set = new Set(x.excluded);
        if (value) set.add(txn.id);
        else set.delete(txn.id);
        return { ...x, excluded: [...set] };
      });
    },
    [update],
  );

  const addEntry: Store['addEntry'] = useCallback(
    (input) => {
      const merchant = input.merchant.trim() || (input.type === 'credit' ? 'Cash received' : 'Cash expense');
      const txn: Txn = {
        id: `cash-${Date.now()}`,
        amount: input.amount,
        type: input.type,
        merchant,
        merchantKey: keyOf(merchant),
        category: input.category,
        mode: input.mode ?? 'cash',
        bank: null,
        account: null,
        timestamp: input.timestamp,
        isManual: true,
        excluded: false,
        categorySource: 'manual',
        note: input.note,
        currency: input.currency ?? getHomeCurrency(),
      };
      update((x) => ({ ...x, manual: [txn, ...x.manual] }));
    },
    [update],
  );

  const deleteManual = useCallback(
    (id: string) => {
      update((x) => ({ ...x, manual: x.manual.filter((t) => t.id !== id), excluded: x.excluded.filter((e) => e !== id) }));
    },
    [update],
  );

  const saveGoal = useCallback(
    (input: GoalInput, id?: string) => {
      update((x) => {
        if (id) return { ...x, goals: x.goals.map((g) => (g.id === id ? { ...g, ...input } : g)) };
        return { ...x, goals: [...x.goals, { ...input, id: `goal-${Date.now()}`, createdAt: Date.now() }] };
      });
    },
    [update],
  );

  const addToGoal = useCallback(
    (id: string, amount: number) => {
      update((x) => ({ ...x, goals: x.goals.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g)) }));
    },
    [update],
  );

  const deleteGoal = useCallback(
    (id: string) => {
      update((x) => ({ ...x, goals: x.goals.filter((g) => g.id !== id) }));
    },
    [update],
  );

  const setBudget = useCallback(
    (amount: number | null) => {
      update((x) => ({ ...x, budget: amount && amount > 0 ? amount : null }));
    },
    [update],
  );

  const checkCardPayment = useCallback(
    (txnId: string) => update((x) => ({ ...x, checkedCardPayments: [...new Set([...(x.checkedCardPayments ?? []), txnId])] })),
    [update],
  );

  const ignoreSchedule = useCallback(
    (id: string) => update((x) => ({ ...x, ignoredSchedules: [...new Set([...(x.ignoredSchedules ?? []), id])] })),
    [update],
  );

  const markBillPaid = useCallback(
    (billId: string, paid: boolean) => {
      update((x) => {
        const set = new Set(x.paidBills ?? []);
        if (paid) set.add(billId);
        else set.delete(billId);
        return { ...x, paidBills: [...set] };
      });
    },
    [update],
  );

  const confirmCategory = useCallback(
    (txn: Txn) => {
      if (txn.isManual) return;
      update((x) => ({ ...x, overrides: { ...x.overrides, [txn.id]: txn.category } }));
    },
    [update],
  );

  const linkTxns = useCallback(
    (a: Txn, b: Txn, kind: LinkKind) => {
      if (a.type === b.type) return;
      const [out, inn] = a.type === 'debit' ? [a, b] : [b, a];
      const key = pairKey(out.id, inn.id);
      update((x) => ({
        ...x,
        links: [...(x.links ?? []).filter((l) => l.outId !== out.id && l.inId !== inn.id), { kind, outId: out.id, inId: inn.id }],
        unlinked: (x.unlinked ?? []).filter((k) => k !== key),
      }));
    },
    [update],
  );

  const unlinkTxns = useCallback(
    (a: Txn, b: Txn) => {
      const [out, inn] = a.type === 'debit' ? [a, b] : [b, a];
      const key = pairKey(out.id, inn.id);
      update((x) => ({
        ...x,
        links: (x.links ?? []).filter((l) => pairKey(l.outId, l.inId) !== key),
        unlinked: [...new Set([...(x.unlinked ?? []), key])],
      }));
    },
    [update],
  );

  const eraseAll = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEY, LEGACY_KEY, CURRENCY_KEY, SAMPLE_KEY, MONTH_START_KEY]).catch(() => {});
    dropCache();
    setCurrencySettingState('auto');
    applyMonthStart(1);
    setMonthStartState(1);
    canSave.current = true;
    setDemo(null);
    setSaved(EMPTY_PREFS);
    setAutoTxns([]);
    setStats(EMPTY_STATS);
    setBills([]);
    setScheduled([]);
    setFunds([]);
    setLastSync(null);
    setError(null);
    setMonth(thisMonth());
    setStatus('onboarding');
  }, [dropCache]);

  // Your corrections first, then how payments relate (transfers, refunds), then every total.
  const txns = useMemo(
    () => resolveFlows(applyPrefs(autoTxns, prefs), { links: prefs.links ?? [], unlinked: prefs.unlinked ?? [], ownNames: prefs.ownNames ?? [] }),
    [autoTxns, prefs],
  );
  const autoCurrency = useMemo(() => pickHomeCurrency('auto', txns, locale), [txns, locale]);
  const currency: CurrencyCode = currencySetting === 'auto' ? autoCurrency : currencySetting;
  // Formatting and totals read these; set them before any screen renders.
  setHomeCurrency(currency);
  applyMonthStart(monthStart);

  const setCurrencySetting = useCallback((next: CurrencySetting) => {
    setCurrencySettingState(next);
    AsyncStorage.setItem(CURRENCY_KEY, next).catch(() => {});
  }, []);

  const setMonthStart = useCallback((day: number) => {
    const next = clampMonthStart(day);
    applyMonthStart(next);
    setMonthStartState(next);
    // Months change shape, so jump back to the one you are in now.
    setMonth(thisMonth());
    AsyncStorage.setItem(MONTH_START_KEY, String(next)).catch(() => {});
  }, []);

  const setSample = useCallback(
    (kind: SampleKind) => {
      sampleRef.current = kind;
      setSampleState(kind);
      AsyncStorage.setItem(SAMPLE_KEY, kind).catch(() => {});
      if (sourceRef.current === 'demo') startDemo();
    },
    [startDemo],
  );
  const byId = useMemo(() => new Map(txns.map((t) => [t.id, t])), [txns]);
  const find = useCallback((id: string) => byId.get(id), [byId]);

  // One object for every screen, rebuilt only when something in it changes.
  const value = useMemo<Store>(
    () => ({
      status,
      source,
      currency,
      currencySetting,
      autoCurrency,
      setCurrencySetting,
      monthStart,
      setMonthStart,
      sample,
      setSample,
      permission,
      txns,
      stats,
      readLimit,
      month,
      lastSync,
      error,
      refreshing,
      goals: prefs.goals,
      budget: prefs.budget,
      bills,
      scheduled,
      funds,
      paidBills: prefs.paidBills ?? [],
      checkedCardPayments: prefs.checkedCardPayments ?? [],
      checkCardPayment,
      ignoredSchedules: prefs.ignoredSchedules ?? [],
      ignoreSchedule,
      setMonth,
      refresh,
      requestAccess,
      chooseSource,
      setCategory,
      setPurpose,
      setExcluded,
      addEntry,
      deleteManual,
      saveGoal,
      addToGoal,
      deleteGoal,
      setBudget,
      markBillPaid,
      confirmCategory,
      linkTxns,
      unlinkTxns,
      eraseAll,
      find,
    }),
    [
      status,
      source,
      currency,
      currencySetting,
      autoCurrency,
      setCurrencySetting,
      monthStart,
      setMonthStart,
      sample,
      setSample,
      permission,
      txns,
      stats,
      readLimit,
      month,
      lastSync,
      error,
      refreshing,
      prefs,
      bills,
      scheduled,
      funds,
      checkCardPayment,
      ignoreSchedule,
      setMonth,
      refresh,
      requestAccess,
      chooseSource,
      setCategory,
      setPurpose,
      setExcluded,
      addEntry,
      deleteManual,
      saveGoal,
      addToGoal,
      deleteGoal,
      setBudget,
      markBillPaid,
      confirmCategory,
      linkTxns,
      unlinkTxns,
      eraseAll,
      find,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
