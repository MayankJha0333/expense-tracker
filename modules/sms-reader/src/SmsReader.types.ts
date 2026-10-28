export type InboxSms = {
  id: string;
  sender: string;
  body: string;
  /** Milliseconds since 1970, when the SMS arrived. */
  date: number;
};

export type InboxResult = {
  messages: InboxSms[];
  /** How many inbox messages were looked at. */
  scanned: number;
  /** Messages from personal phone numbers, dropped before reaching JS. */
  personalSkipped: number;
};

export type InstallSource = 'store' | 'local_file' | 'downloaded_file' | 'other' | 'unspecified' | 'unknown';

export type InstallInfo = {
  sdk: number;
  /** Package that installed the app, e.g. com.android.vending for Play. */
  installer: string | null;
  source: InstallSource;
};
