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
