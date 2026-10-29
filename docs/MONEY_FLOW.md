# Money flow: how Kharcha links related payments

Every bank SMS describes one side of one payment. Counted one by one, they mislead:
moving your own money looks like spending plus income, and a returned order looks like
a purchase plus income. `src/lib/flows.ts` links related payments so every total
(Home, Insights, Accounts, budget) shows what really happened.

## What gets linked

| Link | Rule (all must hold) | Effect on totals |
|---|---|---|
| **Own-account transfer** | Money out + money in, same amount (to the paisa), different account, within 3 days (in may arrive up to 30 min early), out is not a card payment, **and** a sign it's you: paid to your own name, to one of your own banks ("To slice small finance bank"), or the money in comes from your other bank's UPI handle (`@slc` → slice). | Neither side is spending or income. |
| **Card bill** | Bank-side card bill payment + card-side "payment received", same amount, within 3 days. | Already neither; linked so you can see both sides. |
| **Refund** | Money in that is a refund (category or "refund/reversed/returned" in the SMS, not cashback-only), to an earlier purchase at the **same shop** within 120 days, with enough left on it. Best: exact amount, then same card/account, then latest. | Taken off the purchase (`amount` = what you kept, `grossAmount` = original). The refund is not income. A purchase refunded in full stops counting. |
| **Reversal** | "Reversed" money in, exact amount, same account, within 10 days of the payment. | Both cancel out. |
| **You, no pair found** | Money out to your own name or your own bank (or in from your own name). | Self transfer: not spending or income. |

**Who you are** is read from the data: your name from salary/NEFT alerts
("…-MAYANKJHA-…"), your banks from the banks that send you alerts.

## Your corrections always win

- A category you picked by hand is never changed by linking (except "Self transfer", which still gets its other side found).
- **Unlink** ("Not related") is remembered; that pair is never linked again.
- **Link to another payment** (payment screen) lists likely matches: opposite direction, same amount within 7 days, or a refund from the same shop.
- Stored in prefs: `links` (yours), `unlinked`, `ownNames`. SMS payments are re-read on every scan; links are rebuilt each time from the same rules plus your choices.

## Not done yet (next)

- Settings: see and edit "your names" and "your accounts" (data model is ready: `ownNames`).
- Balances from "Avl bal" in SMS, per account.
- Splitting one payment (e.g. dinner you paid for friends) and linking friends' repayments to it.
- Your own tags/labels beyond categories.

## What you pay people for

Money sent to a person lands in "Sent to people", which says nothing about what it was for.
You can tag a person once. Money out: Room rent, Cook, Maid & cleaning, Driver, Milk & daily
needs, Family, Lent money, Loan repayment, Interest paid, Friend or split, My own account,
Something else. Money in: Salary or work, Lent money back, Borrowed (loan), Interest received,
From family, Friend paid back, My own account, Something else.

Loans are in "Loans & lending", which is neither spending nor income: lent money and borrowed
money come back. Interest paid counts as spending (EMI & loans); interest received is income.
Money in has its own tag and rule per person (key `in:<merchantKey>`), so tagging what someone
pays you never changes what you pay them. The tag:

- saves `purposes[merchantKey]` and a matching category rule, so every past and future
  payment to that person moves (Cook → "Cook & house help", Room rent → "Rent & home"...);
- shows as the row label ("Cook") while the payment stays in that category;
- is cleared by tapping it again, which also removes the rule.

Where: the payment screen ("What do you pay X for?"), the "Who you pay" screen (`/people`,
everyone you paid in the last 6 months, biggest first), and a prompt on the "Sent to people"
category page.

Not counted as people any more: UPI autopay (mandates) to companies, names with company
endings (Pte, Pty, LLC, GmbH...) or shop words (Dosa, Snacks, Market...), Google Pay and
Paytm shop QR codes, and "transaction has been reversed" notices (now money back).
