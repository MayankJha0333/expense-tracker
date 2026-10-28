import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { billLine, MonthSwitcher, TxnRow } from '../../components/finance';
import { ScreenHeader } from '../../components/ScreenHeader';
import { AmountBar, Button, Card, Empty, SectionHeader, Txt } from '../../components/ui';
import { cardDues, categoryTotals, creditCardKeys, instrumentFor, type InstrumentKind } from '../../lib/accounts';
import { monthName, monthShort } from '../../lib/analytics';
import { inr, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

const KIND_LABEL: Record<InstrumentKind, string> = {
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  card: 'Card',
  bank: 'Bank account',
  wallet: 'Wallet',
  cash: 'Cash',
};

const longDate = (ts: number) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });

/** One card, bank account, wallet or cash: its bill (for credit cards), where the money went, and every payment. */
export default function AccountScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key: string }>();
  const key = decodeURIComponent(params.key ?? '');
  const { txns, bills, paidBills, month, setMonth, markBillPaid } = useStore();

  const credit = useMemo(() => creditCardKeys(txns, bills), [txns, bills]);
  const item = useMemo(() => instrumentFor(key, txns, credit, month), [key, txns, credit, month]);
  const ever = useMemo(() => instrumentFor(key, txns, credit, null), [key, txns, credit]);
  const due = useMemo(() => cardDues(bills, txns, new Set(paidBills)).find((d) => d.key === key), [bills, txns, paidBills, key]);
  const cats = useMemo(() => (item ? categoryTotals(item.txns) : []), [item]);

  const name = item?.name ?? ever?.name ?? due?.name ?? 'Account';
  const kind: InstrumentKind = item?.kind ?? ever?.kind ?? (due ? 'credit_card' : 'bank');
  const line = due ? billLine(due, p) : null;
  const maxCat = cats[0]?.amount ?? 1;

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <ScreenHeader />
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="small" color={p.muted}>
            {KIND_LABEL[kind]}
          </Txt>
          <Txt variant="heading" accessibilityRole="header" numberOfLines={2}>
            {name}
          </Txt>
        </View>
        <MonthSwitcher month={month} onChange={setMonth} compact />
      </View>

      <View style={[styles.hero, { backgroundColor: p.card }]}>
        <Txt variant="small" color={p.cardMuted}>
          {kind === 'bank' ? `Spent from this account in ${monthName(month)}` : `Spent in ${monthName(month)}`}
        </Txt>
        <Txt variant="display" color={p.cardAccent} tabular adjustsFontSizeToFit numberOfLines={1}>
          {inr(item?.spent ?? 0)}
        </Txt>
        <Txt variant="small" color={p.cardMuted}>
          {item ? `${item.spendCount} ${item.spendCount === 1 ? 'payment' : 'payments'}` : 'No payments this month'}
          {item && item.received > 0 ? ` · ${inr(item.received)} came in` : ''}
        </Txt>
        {due && due.status !== 'paid' && due.spentSince > 0 ? (
          <Txt variant="small" color={p.cardMuted}>
            {inr(due.spentSince)} spent since the last statement, which goes on the next bill.
          </Txt>
        ) : null}
      </View>

      {due && line ? (
        <View>
          <SectionHeader title="Bill" />
          <Card style={{ gap: space.md }}>
            <View style={[styles.billLine, { backgroundColor: line.bg }]}>
              <Txt variant="bodyStrong" color={line.color}>
                {line.text}
              </Txt>
            </View>
            <Row label="Statement" value={longDate(due.bill.statementDate)} />
            <Row label="Total due" value={inr(due.bill.amountDue, { decimals: true })} />
            {due.bill.minDue !== null ? <Row label="Minimum due" value={inr(due.bill.minDue, { decimals: true })} /> : null}
            {due.bill.dueDate ? <Row label="Due date" value={longDate(due.bill.dueDate)} /> : null}
            {due.paid > 0 && due.status !== 'paid' ? <Row label="Paid so far" value={inr(due.paid)} /> : null}
            {due.status === 'paid' ? (
              <Txt variant="small" color={p.muted}>
                {due.paidVia === 'card_alert'
                  ? 'Your bank sent a payment received alert for this card.'
                  : due.paidVia === 'bank_payment'
                    ? 'A card bill payment for this amount left your bank account.'
                    : 'You marked this bill as paid.'}
              </Txt>
            ) : (
              <Txt variant="small" color={p.muted}>
                Paying only the minimum leaves the rest to grow with interest. Kharcha marks the bill paid when your bank&apos;s payment alert arrives.
              </Txt>
            )}
            {due.status !== 'paid' || due.paidVia === 'marked' ? (
              <Button
                label={due.paidVia === 'marked' ? 'Mark as not paid' : 'I paid this bill'}
                icon={due.paidVia === 'marked' ? 'undo' : 'check'}
                kind="secondary"
                compact
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  markBillPaid(due.bill.id, due.paidVia !== 'marked');
                }}
              />
            ) : null}
          </Card>
        </View>
      ) : null}

      {cats.length > 0 ? (
        <View>
          <SectionHeader title={`Where it went in ${monthShort(month)}`} />
          <Card style={{ gap: space.lg }}>
            {cats.map((c) => (
              <AmountBar
                key={c.category}
                label={cat(c.category).label}
                amount={inr(c.amount)}
                share={percent(c.share)}
                fill={c.amount / maxCat}
                color={kind === 'credit_card' ? p.series[1] : p.accent}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <View>
        <SectionHeader title="Payments" subtitle={item ? `${item.txns.length} in ${monthName(month)}` : undefined} />
        {item && item.txns.length > 0 ? (
          <Card style={{ paddingVertical: space.xs }}>
            {item.txns.slice(0, 40).map((t) => (
              <TxnRow key={t.id} txn={t} showDate />
            ))}
            {item.txns.length > 40 ? (
              <Button label="See all in Activity" kind="quiet" compact onPress={() => router.navigate('/activity')} />
            ) : null}
          </Card>
        ) : (
          <Card>
            <Empty icon="calendar-blank-outline" title={`Nothing in ${monthShort(month)}`} body="Try another month with the arrows." />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={styles.row}>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hero: { borderRadius: radius.lg, padding: space.xl, gap: 4 },
  billLine: { borderRadius: radius.sm + 2, paddingHorizontal: space.md, paddingVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
