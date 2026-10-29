import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarSpace } from '../../components/tabBarSpace';
import { billLine, MonthSwitcher } from '../../components/finance';
import { Card, Divider, Empty, Icon, MixBar, SectionHeader, Txt } from '../../components/ui';
import { PressScale, Stagger } from '../../components/motion';
import {
  cardDues,
  creditCardKeys,
  instruments,
  PAY_GROUP_LABEL,
  payGroupColorIndex,
  payMix,
  type CardDue,
  type Instrument,
} from '../../lib/accounts';
import { monthOf, monthShort, sameMonth } from '../../lib/analytics';
import { money, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import type { IconName } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

/** "How did I pay, and what do I owe?" Payment methods, credit cards with their bills, bank accounts and cash. */
export default function Accounts() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { txns, month, setMonth, bills, paidBills } = useStore();

  const inMonth = useMemo(() => txns.filter((t) => sameMonth(monthOf(t.timestamp), month)), [txns, month]);
  const mix = useMemo(() => payMix(inMonth), [inMonth]);
  const credit = useMemo(() => creditCardKeys(txns, bills), [txns, bills]);
  const list = useMemo(() => instruments(inMonth, credit), [inMonth, credit]);
  const dues = useMemo(() => cardDues(bills, txns, new Set(paidBills)), [bills, txns, paidBills]);
  const dueByKey = useMemo(() => new Map(dues.map((d) => [d.key, d])), [dues]);

  // Credit cards: used this month, or with a bill to show.
  const creditCards = useMemo(() => {
    const used = list.filter((i) => i.kind === 'credit_card');
    const seen = new Set(used.map((i) => i.key));
    const billOnly = dues
      .filter((d) => !seen.has(d.key))
      .map(
        (d): Instrument => ({ key: d.key, kind: 'credit_card', bank: d.bank, last4: d.last4, name: d.name, spent: 0, spendCount: 0, received: 0, receivedCount: 0, txns: [] }),
      );
    return [...used, ...billOnly];
  }, [list, dues]);
  const otherCards = list.filter((i) => i.kind === 'debit_card' || i.kind === 'card');
  const banks = list.filter((i) => i.kind === 'bank');
  const cashLike = list.filter((i) => i.kind === 'cash' || i.kind === 'wallet');
  const toPay = dues.filter((d) => d.status !== 'paid').reduce((a, d) => a + d.left, 0);
  const total = mix.reduce((a, m) => a + m.amount, 0);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: tabSpace, gap: space.xl }}
    >
      <Stagger>
      <View style={styles.titleRow}>
        <Txt variant="title" accessibilityRole="header">
          Accounts
        </Txt>
        <MonthSwitcher month={month} onChange={setMonth} compact />
      </View>

      <View>
        <SectionHeader title="How you paid" subtitle={total > 0 ? `${money(total)} spent in ${monthShort(month)}` : undefined} />
        {mix.length === 0 ? (
          <Card>
            <Empty icon="credit-card-off-outline" title={`No spending in ${monthShort(month)}`} body="Pick another month with the arrows." />
          </Card>
        ) : (
          <Card style={{ gap: space.md }}>
            <MixBar
              parts={mix.map((m) => ({ share: m.share, color: p.series[payGroupColorIndex(m.group)] }))}
              label={mix.map((m) => `${PAY_GROUP_LABEL[m.group]} ${percent(m.share)}`).join(', ')}
            />
            <View style={[styles.tableHead, { borderBottomColor: p.line }]}>
              <Txt variant="tiny" color={p.muted} style={{ flex: 1 }}>
                Method
              </Txt>
              <Txt variant="tiny" color={p.muted} style={styles.cAmount}>
                Amount
              </Txt>
              <Txt variant="tiny" color={p.muted} style={styles.cSmall}>
                Share
              </Txt>
              <Txt variant="tiny" color={p.muted} style={styles.cSmall}>
                Count
              </Txt>
            </View>
            {mix.map((m, i) => (
              <Pressable
                key={m.group}
                disabled={!(m.group === 'upi' || m.group === 'card' || m.group === 'cash')}
                onPress={() => router.navigate({ pathname: '/activity', params: { filter: m.group } })}
                accessibilityRole="button"
                accessibilityLabel={`${PAY_GROUP_LABEL[m.group]}: ${money(m.amount)}, ${percent(m.share)}, ${m.count} payments`}
                style={[styles.tableRow, i < mix.length - 1 && { borderBottomColor: p.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <View style={styles.methodCell}>
                  <View style={[styles.swatch, { backgroundColor: p.series[payGroupColorIndex(m.group)] }]} />
                  <Txt variant="bodyStrong">{PAY_GROUP_LABEL[m.group]}</Txt>
                </View>
                <Txt variant="bodyStrong" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.cAmount}>
                  {money(m.amount)}
                </Txt>
                <Txt variant="small" color={p.muted} tabular style={styles.cSmall}>
                  {percent(m.share)}
                </Txt>
                <Txt variant="small" color={p.muted} tabular style={styles.cSmall}>
                  {m.count}
                </Txt>
              </Pressable>
            ))}
          </Card>
        )}
      </View>

      <View>
        <SectionHeader
          title="Credit cards"
          subtitle={toPay > 0 ? `${money(toPay)} to pay` : creditCards.length ? 'All bills paid' : undefined}
          action={creditCards.length ? 'Overview' : undefined}
          onAction={() => router.push('/cards')}
        />
        {creditCards.length === 0 ? (
          <Card>
            <Txt variant="small" color={p.muted}>
              No credit card found yet. When your bank sends a credit card alert or statement, the card shows up here with its bill and due date.
            </Txt>
          </Card>
        ) : (
          <View style={{ gap: space.md }}>
            {creditCards.map((c) => (
              <InstrumentCard key={c.key} item={c} due={dueByKey.get(c.key)} monthLabel={monthShort(month)} />
            ))}
          </View>
        )}
      </View>

      {otherCards.length > 0 ? (
        <View>
          <SectionHeader title="Debit and other cards" />
          <Card padded={false}>
            {otherCards.map((c, i) => (
              <View key={c.key}>
                {i > 0 ? <Divider inset={68} /> : null}
                <InstrumentRow item={c} icon="credit-card-outline" />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {banks.length > 0 ? (
        <View>
          <SectionHeader title="Bank accounts" subtitle="Money in and spent, from bank SMS" />
          <Card padded={false}>
            {banks.map((b, i) => (
              <View key={b.key}>
                {i > 0 ? <Divider inset={68} /> : null}
                <InstrumentRow item={b} icon="bank-outline" />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {cashLike.length > 0 ? (
        <View>
          <SectionHeader title="Cash and wallets" />
          <Card padded={false}>
            {cashLike.map((b, i) => (
              <View key={b.key}>
                {i > 0 ? <Divider inset={68} /> : null}
                <InstrumentRow item={b} icon={b.kind === 'cash' ? 'cash' : 'wallet-outline'} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <Txt variant="small" color={p.muted}>
        Cards and accounts are matched by the last 4 digits in your bank messages. Bills come from your card&apos;s statement SMS and are marked paid when a
        payment alert arrives.
      </Txt>
      </Stagger>
    </ScrollView>
  );
}

function InstrumentCard({ item, due, monthLabel }: { item: Instrument; due?: CardDue; monthLabel: string }) {
  const p = usePalette();
  const line = due ? billLine(due, p) : null;
  return (
    <PressScale
      scaleTo={0.98}
      onPress={() => router.push(`/account/${encodeURIComponent(item.key)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. Spent ${money(item.spent)} in ${monthLabel}.${line ? ` ${line.text}.` : ''}`}
      style={[styles.cardBox, { backgroundColor: p.surface, borderColor: p.line }]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.cardChip, { backgroundColor: p.series[1] }]} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {item.name}
          </Txt>
          <Txt variant="small" color={p.muted}>
            Spent in {monthLabel}: {money(item.spent)}
            {item.spendCount ? ` · ${item.spendCount} ${item.spendCount === 1 ? 'payment' : 'payments'}` : ''}
          </Txt>
        </View>
        <Icon name="chevron-right" size={20} color={p.muted} />
      </View>
      {line ? (
        <View style={[styles.billLine, { backgroundColor: line.bg }]}>
          <Txt variant="smallStrong" color={line.color} numberOfLines={1}>
            {line.text}
          </Txt>
        </View>
      ) : null}
    </PressScale>
  );
}

function InstrumentRow({ item, icon }: { item: Instrument; icon: IconName }) {
  const p = usePalette();
  return (
    <PressScale
      scaleTo={0.985}
      onPress={() => router.push(`/account/${encodeURIComponent(item.key)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. In ${money(item.received)}, spent ${money(item.spent)}.`}
      style={styles.instRow}
    >
      <View style={[styles.instIcon, { backgroundColor: p.surfaceAlt }]}>
        <Icon name={icon} size={20} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {item.name}
        </Txt>
        <Txt variant="small" color={p.muted}>
          {item.spendCount + item.receivedCount} {item.spendCount + item.receivedCount === 1 ? 'payment' : 'payments'}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {item.received > 0 ? (
          <Txt variant="smallStrong" color={p.income} tabular>
            In {money(item.received)}
          </Txt>
        ) : null}
        <Txt variant="small" color={p.muted} tabular>
          Spent {money(item.spent)}
        </Txt>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  tableHead: { flexDirection: 'row', gap: space.sm, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, minHeight: 44 },
  methodCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cAmount: { width: 92, textAlign: 'right' },
  cSmall: { width: 44, textAlign: 'right' },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  cardBox: { borderRadius: radius.md + 4, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardChip: { width: 44, height: 30, borderRadius: 6 },
  billLine: { borderRadius: radius.sm + 2, paddingHorizontal: space.md, paddingVertical: 10 },
  instRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 },
  instIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
