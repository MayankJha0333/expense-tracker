import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { inHome, type CurrencyCode } from './currency';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Money going out of your account, or coming in. */
export type TxnType = 'debit' | 'credit';

export type PayMode = 'upi' | 'card' | 'netbanking' | 'atm' | 'wallet' | 'cash' | 'other';

export const PAY_MODE_LABEL: Record<PayMode, string> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  atm: 'ATM',
  wallet: 'Wallet',
  cash: 'Cash',
  other: 'Other',
};

export type CategoryId =
  | 'food'
  | 'groceries'
  | 'shopping'
  | 'transport'
  | 'fuel'
  | 'travel'
  | 'bills'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'home'
  | 'investments'
  | 'emi'
  | 'cash'
  | 'people'
  | 'other'
  | 'card_bill'
  | 'self_transfer'
  | 'salary'
  | 'refund'
  | 'interest'
  | 'received';

export type CategoryInfo = {
  id: CategoryId;
  label: string;
  color: string;
  icon: IconName;
  /** Money coming in that counts as income. */
  isIncome: boolean;
  /** Money you put away (SIPs, investments). Counts toward savings, not spending. */
  isSaving: boolean;
  /**
   * False for money moving between your own things (like paying your credit
   * card bill), so it is not counted as spending a second time.
   */
  countsAsSpend: boolean;
};

const c = (
  id: CategoryId,
  label: string,
  color: string,
  icon: IconName,
  kind: 'spend' | 'income' | 'saving' | 'neutral' = 'spend',
): CategoryInfo => ({
  id,
  label,
  color,
  icon,
  isIncome: kind === 'income',
  isSaving: kind === 'saving',
  countsAsSpend: kind === 'spend',
});

export const CATEGORIES: CategoryInfo[] = [
  c('food', 'Food & dining', '#E8833A', 'silverware-fork-knife'),
  c('groceries', 'Groceries', '#6FAF4B', 'basket-outline'),
  c('shopping', 'Shopping', '#C75B9B', 'shopping-outline'),
  c('transport', 'Transport', '#3F8FD2', 'car-outline'),
  c('fuel', 'Fuel', '#A07A45', 'gas-station-outline'),
  c('travel', 'Travel', '#2BA5A0', 'airplane'),
  c('bills', 'Bills & recharges', '#7A6FD6', 'receipt-text-outline'),
  c('entertainment', 'Entertainment', '#E0596A', 'movie-open-outline'),
  c('health', 'Health & fitness', '#4CB38A', 'heart-pulse'),
  c('education', 'Education', '#D9A62E', 'school-outline'),
  c('home', 'Rent & home', '#9B7B5B', 'home-outline'),
  c('investments', 'Investments & SIPs', '#2F7C9E', 'chart-line', 'saving'),
  c('emi', 'EMI & loans', '#8E5A9E', 'bank-outline'),
  c('cash', 'Cash', '#7D8A93', 'cash'),
  c('people', 'Sent to people', '#5C9BB8', 'account-multiple-outline'),
  c('other', 'Other', '#B0A48E', 'dots-horizontal-circle-outline'),
  c('card_bill', 'Card bill payment', '#9AA3A9', 'credit-card-check-outline', 'neutral'),
  c('self_transfer', 'Self transfer', '#8C979E', 'swap-horizontal', 'neutral'),
  c('salary', 'Salary', '#2E8B6A', 'briefcase-outline', 'income'),
  c('refund', 'Refund & cashback', '#48A37E', 'cash-refund', 'income'),
  c('interest', 'Interest', '#5DB28F', 'percent-outline', 'income'),
  c('received', 'Money received', '#3E9C77', 'arrow-bottom-left', 'income'),
];

const BY_ID = Object.fromEntries(CATEGORIES.map((x) => [x.id, x])) as Record<CategoryId, CategoryInfo>;

export const cat = (id: CategoryId): CategoryInfo => BY_ID[id] ?? BY_ID.other;
export const isCategoryId = (v: unknown): v is CategoryId => typeof v === 'string' && v in BY_ID;

/** Categories you can pick for money going out. */
export const DEBIT_CATEGORIES = CATEGORIES.filter((x) => !x.isIncome);
/** Categories you can pick for money coming in. */
export const CREDIT_CATEGORIES = CATEGORIES.filter(
  (x) => x.isIncome || x.id === 'card_bill' || x.id === 'self_transfer',
);

/** Where a category came from: our guess, a rule you made, or a one-off change. */
export type CategorySource = 'auto' | 'rule' | 'manual';

export type Txn = {
  id: string;
  amount: number;
  type: TxnType;
  merchant: string;
  merchantKey: string;
  category: CategoryId;
  mode: PayMode;
  bank: string | null;
  account: string | null;
  timestamp: number;
  rawSms?: string;
  sender?: string;
  isManual: boolean;
  excluded: boolean;
  categorySource: CategorySource;
  note?: string;
  /** Currency read from the SMS (or picked when added by hand). Missing = the home currency. */
  currency?: CurrencyCode;
};

// Totals only add up payments in the home currency (no exchange rates offline).
export const countsAsSpend = (t: Txn) => t.type === 'debit' && cat(t.category).countsAsSpend && !t.excluded && inHome(t);
export const countsAsIncome = (t: Txn) => t.type === 'credit' && cat(t.category).isIncome && !t.excluded && inHome(t);
export const countsAsSaving = (t: Txn) => t.type === 'debit' && cat(t.category).isSaving && !t.excluded && inHome(t);
/** A payment in another currency: shown in lists, left out of totals. */
export const isForeign = (t: Txn) => !inHome(t);

/** Where the app's transactions come from. */
export type DataSource = 'sms' | 'manual' | 'demo';

export type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  icon: IconName;
  color: string;
  /** Milliseconds since 1970, or null for "no date". */
  deadline: number | null;
  createdAt: number;
};

/** Why a message was not turned into a transaction. */
export type SkipReason =
  | 'otp'
  | 'promo'
  | 'personal'
  | 'not_transaction'
  | 'failed'
  | 'reminder'
  | 'request'
  | 'duplicate';

export type ScanStats = {
  scanned: number;
  kept: number;
  skipped: Partial<Record<SkipReason, number>>;
};

export const EMPTY_STATS: ScanStats = { scanned: 0, kept: 0, skipped: {} };

/**
 * A credit card statement read from a "statement generated / amount due" SMS.
 * Not a payment: it says how much to pay and by when.
 */
export type CardBill = {
  id: string;
  bank: string | null;
  /** Last 4 digits of the card. */
  account: string;
  amountDue: number;
  /** Missing = the home currency. */
  currency?: CurrencyCode;
  minDue: number | null;
  /** Midnight at the start of the due day, or null when the SMS gave no date. */
  dueDate: number | null;
  /** When the statement SMS arrived. */
  statementDate: number;
};
