import type { CategoryId, IconName, PurposeId, Txn } from './types';

/*
 * "Sent to people" hides what the money was for. A payment to a person is often
 * a regular cost: the cook, the room rent, the milkman. You pick what each person
 * is paid for once, and every payment to them (past and new) moves to the right
 * category, so totals show what you really spend on.
 */

export type Purpose = { id: PurposeId; label: string; icon: IconName; category: CategoryId };

export const PURPOSES: Purpose[] = [
  { id: 'rent', label: 'Room rent', icon: 'home-outline', category: 'home' },
  { id: 'cook', label: 'Cook', icon: 'chef-hat', category: 'house_help' },
  { id: 'maid', label: 'Maid & cleaning', icon: 'broom', category: 'house_help' },
  { id: 'driver', label: 'Driver', icon: 'steering', category: 'house_help' },
  { id: 'milk', label: 'Milk & daily needs', icon: 'cup-outline', category: 'groceries' },
  { id: 'family', label: 'Family', icon: 'account-heart-outline', category: 'family' },
  { id: 'friend', label: 'Friend or split', icon: 'account-group-outline', category: 'people' },
  { id: 'own', label: 'My own account', icon: 'swap-horizontal', category: 'self_transfer' },
  { id: 'other', label: 'Something else', icon: 'dots-horizontal-circle-outline', category: 'other' },
];

const BY_ID = Object.fromEntries(PURPOSES.map((x) => [x.id, x])) as Record<PurposeId, Purpose>;

export const purpose = (id: PurposeId): Purpose => BY_ID[id];
export const isPurposeId = (v: unknown): v is PurposeId => typeof v === 'string' && v in BY_ID;

/**
 * Worth asking "what was this for?": money you sent to a person (or something we
 * could only call "Other"), or a person you already tagged.
 */
export const canHavePurpose = (t: Txn) =>
  t.type === 'debit' && !t.isManual && !!t.merchantKey && (t.purpose !== undefined || t.category === 'people');

/** "Cook" when you tagged the person, else the category name. */
export const kindLabel = (t: Txn, categoryLabel: string) => (t.purpose ? purpose(t.purpose).label : categoryLabel);
