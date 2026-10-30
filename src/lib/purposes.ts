import { isPlaceholderName } from './parser';
import type { CategoryId, IconName, PurposeId, Txn, TxnType } from './types';

/*
 * "Sent to people" hides what the money was for. A payment to a person is often
 * a regular cost: the cook, the room rent, the milkman. Or a loan: money lent out,
 * borrowed, paid back, or interest on it. You pick what each person is paid for
 * once, and every payment to them (past and new) moves to the right category,
 * so totals show what you really spend and earn.
 *
 * Money out and money in have their own lists, and their own tag per person:
 * you can lend to someone ("Lent money") and get it back from them ("Lent money back").
 */

export type Purpose = { id: PurposeId; label: string; icon: IconName; category: CategoryId; side: TxnType };

export const PURPOSES: Purpose[] = [
  // Money out
  { id: 'rent', label: 'Room rent', icon: 'home-outline', category: 'home', side: 'debit' },
  { id: 'cook', label: 'Cook', icon: 'chef-hat', category: 'house_help', side: 'debit' },
  { id: 'maid', label: 'Maid & cleaning', icon: 'broom', category: 'house_help', side: 'debit' },
  { id: 'driver', label: 'Driver', icon: 'steering', category: 'house_help', side: 'debit' },
  { id: 'milk', label: 'Milk & daily needs', icon: 'cup-outline', category: 'groceries', side: 'debit' },
  { id: 'family', label: 'Family', icon: 'account-heart-outline', category: 'family', side: 'debit' },
  // Lending is not spending: the money comes back.
  { id: 'lend', label: 'Lent money', icon: 'hand-coin-outline', category: 'loans', side: 'debit' },
  // Paying back what you borrowed is not new spending either; the interest on it is.
  { id: 'loan_repay', label: 'Loan repayment', icon: 'cash-sync', category: 'loans', side: 'debit' },
  { id: 'interest_paid', label: 'Interest paid', icon: 'percent-outline', category: 'emi', side: 'debit' },
  { id: 'friend', label: 'Friend or split', icon: 'account-group-outline', category: 'people', side: 'debit' },
  { id: 'own', label: 'My own account', icon: 'swap-horizontal', category: 'self_transfer', side: 'debit' },
  { id: 'other', label: 'Something else', icon: 'dots-horizontal-circle-outline', category: 'other', side: 'debit' },
  // Money in
  { id: 'salary_in', label: 'Salary or work', icon: 'briefcase-outline', category: 'salary', side: 'credit' },
  { id: 'lend_back', label: 'Lent money back', icon: 'hand-coin-outline', category: 'loans', side: 'credit' },
  { id: 'borrow', label: 'Borrowed (loan)', icon: 'cash-sync', category: 'loans', side: 'credit' },
  { id: 'interest_in', label: 'Interest received', icon: 'percent-outline', category: 'interest', side: 'credit' },
  { id: 'family_in', label: 'From family', icon: 'account-heart-outline', category: 'received', side: 'credit' },
  { id: 'friend_back', label: 'Friend paid back', icon: 'account-group-outline', category: 'loans', side: 'credit' },
  { id: 'own_in', label: 'My own account', icon: 'swap-horizontal', category: 'self_transfer', side: 'credit' },
  { id: 'other_in', label: 'Something else', icon: 'dots-horizontal-circle-outline', category: 'received', side: 'credit' },
];

const BY_ID = Object.fromEntries(PURPOSES.map((x) => [x.id, x])) as Record<PurposeId, Purpose>;

export const purpose = (id: PurposeId): Purpose => BY_ID[id];
export const isPurposeId = (v: unknown): v is PurposeId => typeof v === 'string' && v in BY_ID;
export const purposesFor = (type: TxnType) => PURPOSES.filter((x) => x.side === type);

/**
 * Where a person's tag (and its category rule) is saved. Money in gets its own key,
 * so tagging what someone pays you never changes what you pay them.
 */
export const purposeKey = (t: Pick<Txn, 'type' | 'merchantKey'>) => (t.type === 'credit' ? `in:${t.merchantKey}` : t.merchantKey);

/**
 * Worth asking "what was this for?": money sent to a person, money a person sent
 * you, or anyone you already tagged.
 */
export const canHavePurpose = (t: Txn) =>
  !t.isManual &&
  !!t.merchantKey &&
  // "Money received", "UPI payment": no person named, so a tag would cover many unrelated payments.
  !isPlaceholderName(t.merchant) &&
  (t.purpose !== undefined || (t.type === 'debit' ? t.category === 'people' : t.category === 'received'));

/** "Cook" when you tagged the person, else the category name. */
export const kindLabel = (t: Txn, categoryLabel: string) => (t.purpose ? purpose(t.purpose).label : categoryLabel);
