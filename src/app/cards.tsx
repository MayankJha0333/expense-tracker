import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { billLine, TxnRow } from '../components/finance';
import { HeroCard } from '../components/HeroCard';
import { PressScale, Stagger } from '../components/motion';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Empty, Icon, SectionHeader, Txt } from '../components/ui';
import { cardOverview, cardPaymentsToCheck, type CardDue, type CardSummary } from '../lib/accounts';
import { shortDay } from '../lib/analytics';
import { money } from '../lib/money';
import { useStore } from '../lib/store';
import { space, usePalette, type Palette } from '../theme';

/** "Due today", "in 5 days", "3 days late". */
function whenText(days: number | null): string {
  if (days === null) return 'No due date in the message';
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} late`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `In ${days} days`;
}

function urgency(days: number | null, p: Palette) {
  if (days !== null && days < 0) return { color: p.danger, bg: p.dangerSoft };
  if (days !== null && days <= 5) return { color: p.warn, bg: p.warnSoft };
  return { color: p.ink, bg: p.surfaceAlt };
}

/** The same day next month: when the next statement or due date usually is. */
const nextMonthSameDay = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime();
};

/**
 * Every credit card in one place: what you owe now, when each bill is due, which bills are
 * already paid (and by which payment), and card payments we couldn't match.
 */
export default function CardsScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, bills, paidBills, checkedCardPayments, checkCardPayment } = useStore();
  const overview = useMemo(() => cardOverview(bills, txns, new Set(paidBills)), [bills, txns, paidBills]);
  const toCheck = useMemo(
    () => cardPaymentsToCheck(txns, overview.cards.flatMap((c) => (c.due ? [c.due] : [])), new Set(checkedCardPayments)),
    [txns, overview, checkedCardPayments],
  );
  const upcoming = overview.cards.filter((c) => c.due && !c.stale && c.due.status !== 'paid').map((c) => c.due as CardDue);
  const fresh = overview.cards.filter((c) => !c.stale);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <Stagger>
        <ScreenHeader />
        <Txt variant="title" accessibilityRole="header">
          Credit cards
        </Txt>

        {overview.cards.length === 0 ? (
          <Card>
            <Empty
              icon="credit-card-off-outline"
              title="No credit card found yet"
              body="When your bank sends a credit card alert or statement, the card shows up here with its bill and due date."
            />
          </Card>
        ) : (
          <HeroCard accessibilityLabel={`You owe ${money(overview.totalOutstanding)} on your credit cards.`}>
            <Txt variant="smallStrong" color={p.heroMuted}>
              You owe on {fresh.length} {fresh.length === 1 ? 'card' : 'cards'} right now
            </Txt>
            <Txt variant="display" tabular color={p.heroValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(overview.totalOutstanding)}
            </Txt>
            <View style={{ gap: 4 }}>
              <Txt variant="small" color={p.heroMuted}>
                {money(overview.totalBillLeft)} on bills still to pay
              </Txt>
              <Txt variant="small" color={p.heroMuted}>
                {money(overview.totalUnbilled)} spent since the last statement (on your next bill)
              </Txt>
            </View>
            {overview.next ? (
              <View style={[styles.heroChip, { backgroundColor: p.heroChip }]}>
                <Icon name="calendar-clock" size={14} color={p.heroChipText} />
                <Txt variant="smallStrong" color={p.heroChipText}>
                  Next: {money(overview.next.left)} · {whenText(overview.next.daysLeft).toLowerCase()}
                </Txt>
              </View>
            ) : (
              <View style={[styles.heroChip, { backgroundColor: p.heroChip }]}>
                <Icon name="check-circle-outline" size={14} color={p.heroChipText} />
                <Txt variant="smallStrong" color={p.heroChipText}>
                  All current bills are paid
                </Txt>
              </View>
            )}
          </HeroCard>
        )}

        {upcoming.length ? (
          <View>
            <SectionHeader title="Coming up" subtitle="Bills still to pay, soonest first" />
            <Card style={{ gap: space.md }}>
              {upcoming.map((d) => {
                const u = urgency(d.daysLeft, p);
                return (
                  <PressScale key={d.key} scaleTo={0.985} onPress={() => router.push(`/account/${encodeURIComponent(d.key)}`)} accessibilityRole="button" style={styles.between}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="bodyStrong" numberOfLines={1}>
                        {d.name}
                      </Txt>
                      <Txt variant="small" color={p.muted}>
                        {money(d.left)}
                        {d.bill.dueDate ? ` · due ${shortDay(d.bill.dueDate)}` : ''}
                        {d.bill.minDue ? ` · min ${money(d.bill.minDue)}` : ''}
                      </Txt>
                    </View>
                    <View style={[styles.pill, { backgroundColor: u.bg }]}>
                      <Txt variant="smallStrong" color={u.color}>
                        {whenText(d.daysLeft)}
                      </Txt>
                    </View>
                  </PressScale>
                );
              })}
            </Card>
          </View>
        ) : null}

        {overview.cards.length ? (
          <View>
            <SectionHeader title="Each card" />
            <View style={{ gap: space.md }}>
              {overview.cards.map((c) => (
                <CardBox key={c.key} card={c} />
              ))}
            </View>
          </View>
        ) : null}

        {toCheck.length ? (
          <View>
            <SectionHeader title="Card payments to check" subtitle="We couldn't match these to a bill or to the other side of the payment" />
            <View style={{ gap: space.md }}>
              {toCheck.map((t) => (
                <Card key={t.id} style={{ gap: space.sm }}>
                  <TxnRow txn={t} showDate />
                  <Txt variant="small" color={p.muted}>
                    {t.type === 'credit'
                      ? 'A payment reached this card, but we saw no money leave your accounts for it. It may have come from an account that sends no SMS.'
                      : 'Money left your account for a card bill, but we found no matching card or bill.'}
                  </Txt>
                  <View style={styles.actions}>
                    <Button
                      label="Yes, a card bill payment"
                      icon="check"
                      kind="secondary"
                      compact
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        checkCardPayment(t.id);
                      }}
                    />
                    <Button label="Not a card payment" kind="quiet" compact onPress={() => router.push(`/txn/${t.id}`)} />
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        <Txt variant="small" color={p.muted}>
          Bills come from your bank&apos;s statement messages and bill reminders. A bill is marked paid when your card confirms a payment, or when a card
          bill payment for about the same amount leaves your bank. What you spend on a card counts as spending the day you buy, so paying the bill is
          never counted again.
        </Txt>
      </Stagger>
    </ScrollView>
  );
}

function CardBox({ card: c }: { card: CardSummary }) {
  const p = usePalette();
  const d = c.due;
  const line = d && !c.stale ? billLine(d, p) : null;
  return (
    <View style={[styles.box, { backgroundColor: p.surface, borderColor: p.line }]}>
      <PressScale scaleTo={0.985} onPress={() => router.push(`/account/${encodeURIComponent(c.key)}`)} accessibilityRole="button" style={styles.boxHead}>
        <View style={[styles.chip, { backgroundColor: p.series[1] }]} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {c.name}
          </Txt>
          <Txt variant="small" color={p.muted}>
            {c.stale ? 'No recent statement' : `You owe ${money(c.outstanding)}`}
          </Txt>
        </View>
        <Icon name="chevron-right" size={20} color={p.muted} />
      </PressScale>

      {line ? (
        <View style={[styles.line, { backgroundColor: line.bg }]}>
          <Txt variant="smallStrong" color={line.color}>
            {line.text}
          </Txt>
        </View>
      ) : null}

      {d && !c.stale ? (
        <View style={{ gap: 6 }}>
          <Detail label="Statement" value={shortDay(d.bill.statementDate)} />
          {d.bill.dueDate ? (
            <Detail label="Due" value={`${shortDay(d.bill.dueDate)} · ${d.status === 'paid' ? 'paid' : whenText(d.daysLeft).toLowerCase()}`} />
          ) : null}
          <Detail label="Spent since statement" value={money(c.unbilled)} />
          <Detail
            label="Next bill around"
            value={`${shortDay(nextMonthSameDay(d.bill.statementDate))}${d.bill.dueDate ? `, due about ${shortDay(nextMonthSameDay(d.bill.dueDate))}` : ''}`}
          />
        </View>
      ) : (
        <Txt variant="small" color={p.muted}>
          {d
            ? `Last statement we saw was on ${shortDay(d.bill.statementDate)}. Newer bills for this card didn't come by SMS, so it isn't added to what you owe.`
            : "We haven't seen a statement for this card yet. Its bill will show here when the bank sends one."}
        </Txt>
      )}

      {d && d.paidBy.length && !c.stale ? (
        <View style={{ gap: 4 }}>
          <Txt variant="smallStrong" color={p.muted}>
            Paid by
          </Txt>
          {d.paidBy.map((t) => (
            <TxnRow key={t.id} txn={t} showDate />
          ))}
        </View>
      ) : null}

      {d && d.remindersAfterPaid > 0 && !c.stale ? (
        <View style={[styles.note, { backgroundColor: p.incomeSoft }]}>
          <Icon name="bell-check-outline" size={16} color={p.income} />
          <Txt variant="small" color={p.income} style={{ flex: 1 }}>
            {d.remindersAfterPaid} {d.remindersAfterPaid === 1 ? 'reminder' : 'reminders'} came after you paid. Nothing to do: this bill is already paid.
          </Txt>
        </View>
      ) : null}

    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={styles.between}>
      <Txt variant="small" color={p.muted}>
        {label}
      </Txt>
      <Txt variant="smallStrong" tabular>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  heroChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  box: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chip: { width: 44, height: 30, borderRadius: 6 },
  line: { borderRadius: 10, paddingHorizontal: space.md, paddingVertical: 10 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: 10, padding: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
