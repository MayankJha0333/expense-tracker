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
  | 'house_help'
  | 'family'
  | 'software'
  | 'loans'
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
  c('house_help', 'Cook & house help', '#C9824A', 'chef-hat'),
  c('family', 'Family', '#D46F8C', 'account-heart-outline'),
  c('software', 'Software & online', '#5B7FD6', 'cloud-outline'),
  c('investments', 'Investments & SIPs', '#2F7C9E', 'chart-line', 'saving'),
  c('emi', 'EMI & loans', '#8E5A9E', 'bank-outline'),
  c('cash', 'Cash', '#7D8A93', 'cash'),
  c('people', 'Sent to people', '#5C9BB8', 'account-multiple-outline'),
  c('other', 'Other', '#B0A48E', 'dots-horizontal-circle-outline'),
  c('card_bill', 'Card bill payment', '#9AA3A9', 'credit-card-check-outline', 'neutral'),
  c('self_transfer', 'Self transfer', '#8C979E', 'swap-horizontal', 'neutral'),
  // Money lent or borrowed between people: it comes back, so it is neither spending nor income.
  c('loans', 'Loans & lending', '#A08C5B', 'handshake-outline', 'neutral'),
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
  (x) => x.isIncome || x.id === 'card_bill' || x.id === 'self_transfer' || x.id === 'loans',
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
  /** How this payment relates to others (see lib/flows.ts). Set after your corrections are applied. */
  links?: TxnLink[];
  /** The amount in the message, when a refund brought part of it back. `amount` is then what you really spent. */
  grossAmount?: number;
  /** Already counted somewhere else: a refund taken off its purchase, or a purchase refunded in full. */
  netted?: boolean;
  /** What you told us this person is paid for ("Cook", "Room rent"). See lib/purposes.ts. */
  purpose?: PurposeId;
  /** Another payment of the same amount to the same place, the same day, from another account: maybe paid twice. */
  maybeDuplicateOf?: string;
};

/** What a payment to a person is for. Picking one moves every payment to them into its category. */
export type PurposeId =
  // Money out
  | 'rent' | 'cook' | 'maid' | 'driver' | 'milk' | 'family' | 'lend' | 'loan_repay' | 'interest_paid' | 'friend' | 'own' | 'other'
  // Money in
  | 'salary_in' | 'lend_back' | 'borrow' | 'interest_in' | 'family_in' | 'friend_back' | 'own_in' | 'other_in';

/**
 * - transfer: the same money moved between your own accounts (or paid your own card bill).
 * - refund: money that came back for an earlier purchase.
 */
export type LinkKind = 'transfer' | 'refund';

export type TxnLink = {
  kind: LinkKind;
  /** The payment on the other side. */
  otherId: string;
  /** auto = Kharcha found it; user = you linked it. */
  source: 'auto' | 'user';
  /** How much of this payment the link covers (a refund can be part of a purchase). */
  amount: number;
  /** A refund that is really someone paying you back for it (a company reimbursing a work expense). */
  reimbursed?: boolean;
};

/** What you see for a payment: the full amount in the message, even after a refund is taken off. */
export const shownAmount = (t: Txn) => t.grossAmount ?? t.amount;

// Totals only add up payments in the home currency (no exchange rates offline).
// A netted payment is already counted through the payment it is linked to (see lib/flows.ts).
export const countsAsSpend = (t: Txn) => t.type === 'debit' && cat(t.category).countsAsSpend && !t.excluded && !t.netted && inHome(t);
export const countsAsIncome = (t: Txn) => t.type === 'credit' && cat(t.category).isIncome && !t.excluded && !t.netted && inHome(t);
export const countsAsSaving = (t: Txn) => t.type === 'debit' && cat(t.category).isSaving && !t.excluded && !t.netted && inHome(t);
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
/**
 * A payment the bank said it will take soon: a SIP by UPI AutoPay, or a mandate
 * ("E-Mandate! Rs.199 will be deducted on 21/10/26 For Netflix").
 */
export type ScheduledDebit = {
  id: string;
  /** Who the money goes to ("Indian Clearing Corporation", "Netflix"). */
  name: string;
  amount: number;
  /** Midnight at the start of the day it will be taken. */
  date: number;
  bank: string | null;
  /** When the message arrived. */
  notifiedAt: number;
};

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
  /** When later messages about this same bill arrived (app reminders, a second statement SMS). */
  reminders?: number[];
};
