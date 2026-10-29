import { creditCardKeys, instrumentKey, instruments, isCardTxn } from './accounts';
import { inHome } from './currency';
import { cat, countsAsIncome, countsAsSaving, countsAsSpend, shownAmount, type CardBill, type Txn } from './types';

/*
 * Where the money went, in a way that matches your bank balance.
 *
 * "Money out" on Home is what you bought this month. Your bank balance moves for more reasons:
 * - card bills: paying last month's card shopping (already counted when you bought it);
 * - moving money to your own accounts (slice, a savings account): still yours;
 * - lending, investing, and money you told us to leave out.
 * And some of this month's shopping was on credit cards, so it leaves the bank only when
 * the card bill is paid. This puts all of it side by side, without counting anything twice.
 */

export type FlowLine = { id: string; label: string; amount: number; note?: string };

export type AccountFlow = {
  key: string;
  name: string;
  moneyIn: number;
  moneyOut: number;
  /** moneyIn - moneyOut: how much this account's balance changed. */
  change: number;
  ins: FlowLine[];
  outs: FlowLine[];
};

export type MoneyFlow = {
  income: number;
  spent: number;
  /** Part of `spent` that was on credit cards: leaves your bank when you pay the card bill. */
  spentOnCards: number;
  /**
   * How much more cash you have than at the start of the month (across accounts, before SIPs):
   * income − spending − invested − card bills paid + credit card spending not yet paid.
   */
  cashLeft: number;
  invested: number;
  /** Card bills paid from your bank accounts. */
  cardBillsPaid: number;
  /** Sent to your own accounts, and received from them. */
  movedOut: number;
  movedIn: number;
  /** Money lent or loan repaid, and lent money back or borrowed. */
  loansOut: number;
  loansIn: number;
  /** Refunds taken off purchases (money that came back). */
  refunds: number;
  /** Payments you turned off. */
  leftOut: number;
  /** Bank accounts and wallets, biggest change first. */
  accounts: AccountFlow[];
};

const sum = (list: Txn[], f: (t: Txn) => number = shownAmount) => list.reduce((a, t) => a + f(t), 0);

/** Why a payment moved money, in a few words. */
function lineFor(t: Txn): { id: string; label: string } {
  if (t.excluded) return { id: 'left_out', label: 'Left out by you' };
  if (t.category === 'card_bill') return { id: 'card_bill', label: t.type === 'debit' ? 'Card bills paid' : 'Card bill payments' };
  if (t.category === 'self_transfer') return { id: 'own', label: t.type === 'debit' ? 'To your own accounts' : 'From your own accounts' };
  if (t.category === 'loans') return { id: 'loans', label: t.type === 'debit' ? 'Lent or loan repaid' : 'Lent money back or borrowed' };
  if (t.type === 'debit') {
    if (cat(t.category).isSaving) return { id: 'invested', label: 'Investments & SIPs' };
    return { id: 'spent', label: 'Spending' };
  }
  if (t.netted || t.category === 'refund') return { id: 'refunds', label: 'Refunds' };
  if (cat(t.category).isIncome) return { id: 'income', label: 'Income' };
  return { id: 'other_in', label: 'Other money in' };
}

function lines(list: Txn[]): FlowLine[] {
  const map = new Map<string, FlowLine>();
  for (const t of list) {
    const { id, label } = lineFor(t);
    const row = map.get(id) ?? { id, label, amount: 0 };
    row.amount += shownAmount(t);
    map.set(id, row);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/** [txns] = one month of payments (after your corrections and linking). */
export function moneyFlow(txns: Txn[], allTxns: Txn[], bills: CardBill[]): MoneyFlow {
  const home = txns.filter(inHome);
  const spends = home.filter(countsAsSpend);
  const debits = home.filter((t) => t.type === 'debit');
  const credits = home.filter((t) => t.type === 'credit');
  const notExcluded = (t: Txn) => !t.excluded;

  const credit = creditCardKeys(allTxns, bills);
  const accounts: AccountFlow[] = instruments(home, credit)
    // Debit cards take money straight from a bank account, so they are listed with the accounts.
    .filter((i) => i.kind === 'bank' || i.kind === 'wallet' || i.kind === 'debit_card' || i.kind === 'card')
    .map((i) => {
      const ins = i.txns.filter((t) => t.type === 'credit');
      const outs = i.txns.filter((t) => t.type === 'debit');
      const moneyIn = sum(ins);
      const moneyOut = sum(outs);
      return { key: i.key, name: i.name, moneyIn, moneyOut, change: moneyIn - moneyOut, ins: lines(ins), outs: lines(outs) };
    })
    .filter((a) => a.moneyIn > 0 || a.moneyOut > 0)
    .sort((a, b) => b.moneyIn + b.moneyOut - (a.moneyIn + a.moneyOut));

  const income = sum(home.filter(countsAsIncome), (t) => t.amount);
  const spent = sum(spends, (t) => t.amount);
  // Only credit cards: a debit card takes the money from your bank the same day.
  const spentOnCards = sum(spends.filter((t) => isCardTxn(t) && credit.has(instrumentKey(t))), (t) => t.amount);
  const invested = sum(home.filter(countsAsSaving), (t) => t.amount);
  const cardBillsPaid = sum(debits.filter((t) => notExcluded(t) && t.category === 'card_bill' && !isCardTxn(t)));
  return {
    income,
    spent,
    spentOnCards,
    cashLeft: income - spent - invested - cardBillsPaid + spentOnCards,
    invested,
    cardBillsPaid,
    movedOut: sum(debits.filter((t) => notExcluded(t) && t.category === 'self_transfer')),
    movedIn: sum(credits.filter((t) => notExcluded(t) && t.category === 'self_transfer')),
    loansOut: sum(debits.filter((t) => notExcluded(t) && t.category === 'loans')),
    loansIn: sum(credits.filter((t) => notExcluded(t) && t.category === 'loans')),
    refunds: sum(credits.filter((t) => notExcluded(t) && t.netted)),
    leftOut: sum(home.filter((t) => t.excluded)),
    accounts,
  };
}

