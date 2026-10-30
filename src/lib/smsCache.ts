import { PARSER_VERSION, parseFundName, type RawSms } from './parser';
import { isRelevant, processInbox, skipReason } from './pipeline';
import type { CardBill, ScanStats, ScheduledDebit, SkipReason, Txn } from './types';

/*
 * Bank messages never change once they arrive, so reading the whole inbox on every start is
 * wasted work. Kharcha keeps the messages it used (payments, card bills, scheduled payments) in a
 * file on the phone (lib/smsCacheFile.ts) and, on the next start, reads only messages newer than
 * the last read. OTPs, offers and chats are never kept.
 *
 * The kept messages are run through the reader again on every start, so a fix to how a message is
 * read reaches old payments too. The whole inbox is read again when:
 * - there is no cache, or it was made by an older version of this file;
 * - the reader now keeps messages it used to skip (PARSER_VERSION went up);
 * - the last full read is more than 30 days old (picks up deleted messages, trims old months).
 *
 * No React Native imports here, so the tests can run it in plain Node.
 */

export const CACHE_VERSION = 1;
export const MONTHS_BACK = 13;
export const FULL_READ_EVERY_MS = 30 * 86_400_000;
/** Start each read a day before the newest message seen, in case one arrived late. Ids stop repeats. */
export const OVERLAP_MS = 86_400_000;

/** What one read of the inbox returned, with stable ids already given (see withStableIds). */
export type InboxRead = {
  messages: RawSms[];
  /**
   * Personal numbers and offers the phone dropped. For a read of only new messages, just those newer
   * than the last read (see readInbox's countAfterMs and SmsCache.countedUntil), so nothing is counted twice.
   */
  personalSkipped: number;
  promoSkipped: number;
  limitReached: boolean;
  /** When the oldest kept message arrived, or null when none were kept. */
  oldest: number | null;
};

export type SmsCache = {
  v: number;
  parser: number;
  /** When the whole inbox was last read. */
  fullReadAt: number;
  /** When the newest message read so far arrived. The next read starts a day before this. */
  newest: number;
  /**
   * When the last read happened. Skipped messages (chats, offers, OTPs) are counted only when they
   * arrived after this, so reading the overlap again never counts them twice.
   */
  countedUntil: number;
  /** Only messages that add something (see isRelevant), oldest first, stable ids. */
  messages: RawSms[];
  /** Fund names from SIP messages. Kept as names only: they come from OTP messages, which are never kept. */
  funds: string[];
  /** What the skipped messages were, for "Kharcha skipped 312 OTPs and offers". */
  skipped: Partial<Record<SkipReason, number>>;
  scanned: number;
  /** The last full read stopped at the message limit, so months before [oldest] are missing. */
  limitReached: boolean;
  oldest: number | null;
};

export type InboxData = {
  txns: Txn[];
  stats: ScanStats;
  bills: CardBill[];
  scheduled: ScheduledDebit[];
  funds: string[];
};

/** Midnight on the 1st, 13 months back: how far the app looks. */
export function windowStart(now = Date.now()): number {
  const since = new Date(now);
  since.setMonth(since.getMonth() - MONTHS_BACK, 1);
  since.setHours(0, 0, 0, 0);
  return since.getTime();
}

export function needsFullRead(cache: SmsCache | null, now = Date.now()): boolean {
  return !cache || cache.v !== CACHE_VERSION || cache.parser !== PARSER_VERSION || now - cache.fullReadAt > FULL_READ_EVERY_MS;
}

/** Where the next read starts: 13 months back for a full read, else a day before the newest message. */
export function readSince(cache: SmsCache | null, now = Date.now()): number {
  if (needsFullRead(cache, now)) return windowStart(now);
  return Math.max(windowStart(now), cache!.newest - OVERLAP_MS);
}

/** Skipped personal and promotional messages are counted only when newer than this (0 = all, for a full read). */
export function countAfter(cache: SmsCache | null, now = Date.now()): number {
  return needsFullRead(cache, now) ? 0 : cache!.countedUntil;
}

const fundsIn = (messages: RawSms[]) => [...new Set(messages.map(parseFundName).filter((f): f is string => !!f))];
const newestOf = (messages: RawSms[], fallback: number) => messages.reduce((a, m) => Math.max(a, m.date), fallback);

/** A whole inbox read → what the screens show, and the cache to save. */
export function fromFullRead(read: InboxRead, now = Date.now()): { data: InboxData; cache: SmsCache } {
  const extra: Partial<Record<SkipReason, number>> = {};
  if (read.personalSkipped) extra.personal = read.personalSkipped;
  if (read.promoSkipped) extra.promo = read.promoSkipped;
  const r = processInbox(read.messages, extra);
  const scanned = read.messages.length + read.personalSkipped + read.promoSkipped;
  const stats: ScanStats = { ...r.stats, scanned };
  const cache: SmsCache = {
    v: CACHE_VERSION,
    parser: PARSER_VERSION,
    fullReadAt: now,
    newest: newestOf(read.messages, 0),
    countedUntil: now,
    messages: read.messages.filter(isRelevant).sort((a, b) => a.date - b.date),
    funds: r.funds,
    skipped: stats.skipped,
    scanned,
    limitReached: read.limitReached,
    oldest: read.oldest,
  };
  return { data: { txns: r.txns, stats, bills: r.bills, scheduled: r.scheduled, funds: r.funds }, cache };
}

/** Adds a read of only the newest messages to the cache. Messages already kept (same id) are not added twice. */
export function mergeRead(cache: SmsCache, read: InboxRead, now = Date.now()): SmsCache {
  const start = windowStart(now);
  const known = new Set(cache.messages.map((m) => m.id));
  const skipped = { ...cache.skipped };
  let scanned = cache.scanned;
  // Count only messages that arrived after the last read; older ones in the overlap were counted then.
  const fresh = read.messages.filter((m) => m.date > cache.countedUntil);
  for (const m of fresh) {
    const reason = skipReason(m);
    if (reason) skipped[reason] = (skipped[reason] ?? 0) + 1;
  }
  scanned += fresh.length;
  if (read.personalSkipped) {
    skipped.personal = (skipped.personal ?? 0) + read.personalSkipped;
    scanned += read.personalSkipped;
  }
  if (read.promoSkipped) {
    skipped.promo = (skipped.promo ?? 0) + read.promoSkipped;
    scanned += read.promoSkipped;
  }
  const added = read.messages.filter((m) => !known.has(m.id) && isRelevant(m));
  const messages = [...cache.messages, ...added].filter((m) => m.date >= start).sort((a, b) => a.date - b.date);
  return {
    ...cache,
    newest: newestOf(read.messages, cache.newest),
    countedUntil: Math.max(cache.countedUntil, now),
    messages,
    funds: [...new Set([...cache.funds, ...fundsIn(read.messages)])],
    skipped,
    scanned,
  };
}

/** The cache → what the screens show. Kept messages are read again with today's reader. */
export function fromCache(cache: SmsCache): InboxData {
  const r = processInbox(cache.messages);
  const funds = [...new Set([...cache.funds, ...r.funds])];
  const stats: ScanStats = { scanned: cache.scanned, kept: r.txns.length, skipped: { ...cache.skipped } };
  return { txns: r.txns, stats, bills: r.bills, scheduled: r.scheduled, funds };
}

/** Reads a saved cache; null when it is missing, broken or from another version. */
export function parseCache(text: string | null): SmsCache | null {
  if (!text) return null;
  try {
    const c = JSON.parse(text) as Partial<SmsCache>;
    if (c.v !== CACHE_VERSION || !Array.isArray(c.messages) || typeof c.newest !== 'number' || typeof c.fullReadAt !== 'number') return null;
    const ok = c.messages.every((m) => m && typeof m.id === 'string' && typeof m.sender === 'string' && typeof m.body === 'string' && typeof m.date === 'number');
    if (!ok) return null;
    return {
      v: c.v,
      parser: typeof c.parser === 'number' ? c.parser : 0,
      fullReadAt: c.fullReadAt,
      newest: c.newest,
      countedUntil: typeof c.countedUntil === 'number' ? c.countedUntil : c.newest,
      messages: c.messages,
      funds: Array.isArray(c.funds) ? c.funds.filter((f): f is string => typeof f === 'string') : [],
      skipped: c.skipped && typeof c.skipped === 'object' ? c.skipped : {},
      scanned: typeof c.scanned === 'number' ? c.scanned : c.messages.length,
      limitReached: c.limitReached === true,
      oldest: typeof c.oldest === 'number' ? c.oldest : null,
    };
  } catch {
    return null;
  }
}
