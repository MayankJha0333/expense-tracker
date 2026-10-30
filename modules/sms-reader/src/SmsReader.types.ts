export type InboxSms = {
  id: string;
  sender: string;
  body: string;
  /** Milliseconds since 1970, when the SMS arrived. */
  date: number;
};

export type InboxResult = {
  messages: InboxSms[];
  /** How many messages were kept (personal numbers and offers are counted apart). */
  scanned: number;
  /** Messages from personal phone numbers, dropped before reaching JS (only those newer than countAfterMs). */
  personalSkipped: number;
  /**
   * Offers from promotional senders ("AX-BRAND-P"), dropped before reaching JS so they don't use up
   * the message limit. Only those newer than countAfterMs. Missing in builds made before this was added.
   */
  promoSkipped?: number;
  /** True when a message that would have been kept was left out because [limit] was reached: older ones were not read. */
  limitReached?: boolean;
  /** When the oldest kept message arrived (ms), or null when none were kept. */
  oldest?: number | null;
};

export type InstallSource = 'store' | 'local_file' | 'downloaded_file' | 'other' | 'unspecified' | 'unknown';

export type InstallInfo = {
  sdk: number;
  /** Package that installed the app, e.g. com.android.vending for Play. */
  installer: string | null;
  source: InstallSource;
};
