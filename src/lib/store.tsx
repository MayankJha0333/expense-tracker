import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { thisMonth, type Month } from './analytics';
import { demoInbox } from './demo';
import { keyOf } from './parser';
import { processInbox } from './pipeline';
import { checkSmsPermission, readInbox, requestSmsPermission, type SmsPermission } from './sms';
import {
  CREDIT_CATEGORIES,
  DEBIT_CATEGORIES,
  EMPTY_STATS,
  type CategoryId,
  type ScanStats,
  type Txn,
} from './types';

/** Your own choices, saved on the phone. */
type Prefs = {
  /** merchantKey → category. "Always put Swiggy in Food". */
  rules: Record<string, CategoryId>;
  /** txn id → category. A one-off change for a single payment. */
  overrides: Record<string, CategoryId>;
  /** Payments you said should not count. */
  excluded: string[];
  /** Cash expenses you added by hand. */
  manual: Txn[];
  /** You chose to use the app without SMS reading. */
  manualOnly: boolean;
};

const EMPTY_PREFS: Prefs = { rules: {}, overrides: {}, excluded: [], manual: [], manualOnly: false };
const STORAGE_KEY = 'kharcha:prefs:v1';
const AUTO_REFRESH_GAP_MS = 60_000;
/** Start with `EXPO_PUBLIC_DEMO=1 npx expo start` to see the app with sample data. */
const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export type Status = 'booting' | 'needs_permission' | 'loading' | 'ready';

type Store = {
  status: Status;
  permission: SmsPermission;
  txns: Txn[];
  stats: ScanStats;
  month: Month;
  lastSync: number | null;
  error: string | null;
  refreshing: boolean;
  manualOnly: boolean;
  setMonth: (m: Month) => void;
  refresh: () => Promise<void>;
  requestAccess: () => Promise<SmsPermission>;
  continueWithoutSms: () => void;
  setCategory: (txn: Txn, category: CategoryId, applyToMerchant: boolean) => void;
  setExcluded: (txn: Txn, excluded: boolean) => void;
  addManual: (input: { amount: number; merchant: string; category: CategoryId; timestamp: number; note?: string }) => void;
  deleteManual: (id: string) => void;
  find: (id: string) => Txn | undefined;
};

const StoreContext = createContext<Store | null>(null);

const allowedFor = (t: Txn, c: CategoryId) =>
  (t.type === 'debit' ? DEBIT_CATEGORIES : CREDIT_CATEGORIES).some((x) => x.id === c);

/** Layer your corrections on top of what the SMS reader guessed. */
function applyPrefs(auto: Txn[], prefs: Prefs): Txn[] {
  const excluded = new Set(prefs.excluded);
  const fromSms = auto.map((t): Txn => {
    const override = prefs.overrides[t.id];
    const rule = prefs.rules[t.merchantKey];
    let next = t;
    if (override && allowedFor(t, override)) next = { ...t, category: override, categorySource: 'manual' };
    else if (rule && allowedFor(t, rule)) next = { ...t, category: rule, categorySource: 'rule' };
    return excluded.has(t.id) ? { ...next, excluded: true } : next;
  });
  const manual = prefs.manual.map((t) => (excluded.has(t.id) ? { ...t, excluded: true } : t));
  return [...fromSms, ...manual].sort((a, b) => b.timestamp - a.timestamp);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('booting');
  const [permission, setPermission] = useState<SmsPermission>('denied');
  const [autoTxns, setAutoTxns] = useState<Txn[]>([]);
  const [stats, setStats] = useState<ScanStats>(EMPTY_STATS);
  const [prefs, setPrefs] = useState<Prefs>(EMPTY_PREFS);
  const [month, setMonth] = useState<Month>(thisMonth());
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const prefsLoaded = useRef(false);
  const statusRef = useRef<Status>('booting');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Save your choices whenever they change.
  useEffect(() => {
    if (!prefsLoaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [prefs]);

  const scan = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const inbox = await readInbox();
      // Let the spinner paint before the parsing work starts.
      await new Promise((r) => setTimeout(r, 0));
      const { txns, stats: s } = processInbox(inbox.messages, { personal: inbox.personalSkipped });
      setAutoTxns(txns);
      setStats(s);
      setLastSync(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read messages');
    } finally {
      busy.current = false;
      setRefreshing(false);
      setStatus('ready');
    }
  }, []);

  // First start: load saved choices, then check the permission.
  useEffect(() => {
    (async () => {
      let saved = EMPTY_PREFS;
      let readOk = true;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) saved = { ...EMPTY_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
      } catch {
        // Broken storage should never block the app. Don't save either,
        // so a one-off read error can't wipe your saved rules.
        readOk = false;
      }
      prefsLoaded.current = readOk;
      setPrefs(saved);

      if (DEMO) {
        // Demo mode: sample bank SMS through the real parser, no permission needed.
        const { txns, stats: s } = processInbox(demoInbox());
        setAutoTxns(txns);
        setStats(s);
        setPermission('granted');
        setLastSync(Date.now());
        setStatus('ready');
        return;
      }

      const p = await checkSmsPermission();
      setPermission(p);
      if (p === 'granted') {
        setStatus('loading');
        await scan();
      } else if (saved.manualOnly) {
        setStatus('ready');
      } else {
        setStatus('needs_permission');
      }
    })();
  }, [scan]);

  // Coming back to the app picks up new bank SMS.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || DEMO) return;
      const p = await checkSmsPermission();
      setPermission(p);
      if (p !== 'granted') return;
      // You may have just allowed SMS in Settings.
      if (statusRef.current === 'needs_permission') {
        setStatus('loading');
        scan();
      } else if (!lastSync || Date.now() - lastSync > AUTO_REFRESH_GAP_MS) {
        scan();
      }
    });
    return () => sub.remove();
  }, [lastSync, scan]);

  const refresh = useCallback(async () => {
    if (DEMO) return;
    const p = await checkSmsPermission();
    setPermission(p);
    if (p === 'granted') await scan();
  }, [scan]);

  const requestAccess = useCallback(async () => {
    const p = await requestSmsPermission();
    setPermission(p);
    if (p === 'granted') {
      // Only show the full-screen loader on first setup, not from Home.
      if (statusRef.current === 'needs_permission') setStatus('loading');
      await scan();
    }
    return p;
  }, [scan]);

  const continueWithoutSms = useCallback(() => {
    setPrefs((x) => ({ ...x, manualOnly: true }));
    setStatus('ready');
  }, []);

  const setCategory = useCallback((txn: Txn, category: CategoryId, applyToMerchant: boolean) => {
    setPrefs((x) => {
      if (txn.isManual) {
        return { ...x, manual: x.manual.map((t) => (t.id === txn.id ? { ...t, category } : t)) };
      }
      const overrides = { ...x.overrides };
      if (applyToMerchant && txn.merchantKey) {
        delete overrides[txn.id];
        return { ...x, overrides, rules: { ...x.rules, [txn.merchantKey]: category } };
      }
      overrides[txn.id] = category;
      return { ...x, overrides };
    });
  }, []);

  const setExcluded = useCallback((txn: Txn, value: boolean) => {
    setPrefs((x) => {
      const set = new Set(x.excluded);
      if (value) set.add(txn.id);
      else set.delete(txn.id);
      return { ...x, excluded: [...set] };
    });
  }, []);

  const addManual: Store['addManual'] = useCallback((input) => {
    const merchant = input.merchant.trim() || 'Cash expense';
    const txn: Txn = {
      id: `cash-${Date.now()}`,
      amount: input.amount,
      type: 'debit',
      merchant,
      merchantKey: keyOf(merchant),
      category: input.category,
      mode: 'cash',
      bank: null,
      account: null,
      timestamp: input.timestamp,
      isManual: true,
      excluded: false,
      categorySource: 'manual',
      note: input.note,
    };
    setPrefs((x) => ({ ...x, manual: [txn, ...x.manual] }));
  }, []);

  const deleteManual = useCallback((id: string) => {
    setPrefs((x) => ({
      ...x,
      manual: x.manual.filter((t) => t.id !== id),
      excluded: x.excluded.filter((e) => e !== id),
    }));
  }, []);

  const txns = useMemo(() => applyPrefs(autoTxns, prefs), [autoTxns, prefs]);
  const byId = useMemo(() => new Map(txns.map((t) => [t.id, t])), [txns]);
  const find = useCallback((id: string) => byId.get(id), [byId]);

  const value: Store = {
    status,
    permission,
    txns,
    stats,
    month,
    lastSync,
    error,
    refreshing,
    manualOnly: prefs.manualOnly,
    setMonth,
    refresh,
    requestAccess,
    continueWithoutSms,
    setCategory,
    setExcluded,
    addManual,
    deleteManual,
    find,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
