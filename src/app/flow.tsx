import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthSwitcher } from '../components/finance';
import { PressScale, Stagger } from '../components/motion';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, Icon, SectionHeader, Txt } from '../components/ui';
import { monthName, monthOf, sameMonth } from '../lib/analytics';
import { money } from '../lib/money';
import { moneyFlow, type AccountFlow } from '../lib/moneyflow';
import { useStore } from '../lib/store';
import type { IconName } from '../lib/types';
import { space, usePalette } from '../theme';

/**
 * Where all the money went this month, so it lines up with your bank balance.
 * Home's "Money out" counts only what you bought; this adds card bills, moves between
 * your own accounts, loans and refunds, and shows each bank account's change.
 */
export default function FlowScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, bills, month, setMonth } = useStore();
  const flow = useMemo(() => moneyFlow(txns.filter((t) => sameMonth(monthOf(t.timestamp), month)), txns, bills), [txns, bills, month]);
  const leftOver = flow.income - flow.spent - flow.invested;

  const moved: { icon: IconName; label: string; amount: string; note: string }[] = [];
  if (flow.cardBillsPaid > 0)
    moved.push({
      icon: 'credit-card-check-outline',
      label: 'Card bills paid',
      amount: money(flow.cardBillsPaid),
      note: 'Pays for card shopping from earlier months. That shopping was counted when you bought it, so it is not counted again.',
    });
  if (flow.movedOut > 0 || flow.movedIn > 0)
    moved.push({
      icon: 'swap-horizontal',
      label: 'Between your own accounts',
      amount: `${money(flow.movedOut)} out · ${money(flow.movedIn)} back`,
      note: 'Still your money. What you spend from the other account is counted there.',
    });
  if (flow.loansOut > 0 || flow.loansIn > 0)
    moved.push({
      icon: 'handshake-outline',
      label: 'Loans and lending',
      amount: `${money(flow.loansOut)} out · ${money(flow.loansIn)} in`,
      note: 'Money lent or borrowed comes back, so it is neither spending nor income.',
    });
  if (flow.refunds > 0)
    moved.push({ icon: 'cash-refund', label: 'Refunds', amount: money(flow.refunds), note: 'Taken off what you bought, so your spending shows what you kept.' });
  if (flow.leftOut > 0) moved.push({ icon: 'eye-off-outline', label: 'Left out by you', amount: money(flow.leftOut), note: 'Payments you turned off.' });

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <Stagger>
        <ScreenHeader />
        <View style={{ gap: space.sm }}>
          <Txt variant="title" accessibilityRole="header">
            Where your money went
          </Txt>
          <Txt variant="small" color={p.muted}>
            &quot;Money out&quot; counts only what you bought. Your bank balance also moves when you pay a card bill, move money to your own account, lend or
            invest. Here is all of it for {monthName(month)}.
          </Txt>
          <MonthSwitcher month={month} onChange={setMonth} compact />
        </View>

        <View>
          <SectionHeader title="This month" />
          <Card style={{ gap: space.md }}>
            <Row label="Money in (income)" value={`+${money(flow.income)}`} color={p.income} />
            <Row
              label="Spent"
              value={`−${money(flow.spent)}`}
              note={
                flow.spentOnCards > 0
                  ? `${money(flow.spentOnCards)} of this was on credit cards. It leaves your bank when you pay the card bill.`
                  : undefined
              }
            />
            {flow.invested > 0 ? <Row label="Invested (SIPs and more)" value={`−${money(flow.invested)}`} /> : null}
            <View style={[styles.rule, { backgroundColor: p.line }]} />
            <Row label={leftOver >= 0 ? 'Left over' : 'Short by'} value={money(Math.abs(leftOver))} strong color={leftOver >= 0 ? p.income : p.danger} />
          </Card>
        </View>

        {moved.length ? (
          <View>
            <SectionHeader title="Moved, but not spending" subtitle="This is why your bank balance can drop more than Money out" />
            <Card style={{ gap: space.lg }}>
              {moved.map((m) => (
                <View key={m.label} style={styles.movedRow}>
                  <View style={[styles.icon, { backgroundColor: p.surfaceAlt }]}>
                    <Icon name={m.icon} size={18} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    {/* Two amounts ("₹70,650 out · ₹15,650 back") don't fit beside the label, so they go under it. */}
                    {m.amount.includes('·') ? (
                      <>
                        <Txt variant="bodyStrong">{m.label}</Txt>
                        <Txt variant="bodyStrong" tabular>
                          {m.amount}
                        </Txt>
                      </>
                    ) : (
                      <View style={styles.between}>
                        <Txt variant="bodyStrong" style={{ flexShrink: 1 }}>
                          {m.label}
                        </Txt>
                        <Txt variant="bodyStrong" tabular>
                          {m.amount}
                        </Txt>
                      </View>
                    )}
                    <Txt variant="small" color={p.muted}>
                      {m.note}
                    </Txt>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {flow.accounts.length ? (
          <View>
            <SectionHeader title="Your bank accounts" subtitle="Money in minus money out = how much the balance changed" />
            <View style={{ gap: space.md }}>
              {flow.accounts.map((a) => (
                <AccountCard key={a.key} account={a} />
              ))}
            </View>
            <Txt variant="small" color={p.muted} style={{ marginTop: space.md }}>
              If an account shows only money going out, its bank may not send an SMS when money arrives. The money is still there.
            </Txt>
          </View>
        ) : null}
      </Stagger>
    </ScrollView>
  );
}

function Row({ label, value, note, color, strong }: { label: string; value: string; note?: string; color?: string; strong?: boolean }) {
  const p = usePalette();
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.between}>
        <Txt variant={strong ? 'bodyStrong' : 'body'}>{label}</Txt>
        <Txt variant="bodyStrong" tabular color={color}>
          {value}
        </Txt>
      </View>
      {note ? (
        <Txt variant="small" color={p.muted}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

function AccountCard({ account: a }: { account: AccountFlow }) {
  const p = usePalette();
  const up = a.change >= 0;
  return (
    <PressScale
      scaleTo={0.985}
      onPress={() => router.push(`/account/${encodeURIComponent(a.key)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${a.name}. In ${money(a.moneyIn)}, out ${money(a.moneyOut)}, balance ${up ? 'up' : 'down'} ${money(Math.abs(a.change))}.`}
      style={[styles.accCard, { backgroundColor: p.surface, borderColor: p.line }]}
    >
      <View style={styles.between}>
        <Txt variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {a.name}
        </Txt>
        <Txt variant="bodyStrong" tabular color={up ? p.income : p.danger}>
          {up ? '+' : '−'}
          {money(Math.abs(a.change))}
        </Txt>
      </View>
      <View style={{ gap: 4 }}>
        {a.ins.map((l) => (
          <View key={`in-${l.id}`} style={styles.between}>
            <Txt variant="small" color={p.muted}>
              {l.label}
            </Txt>
            <Txt variant="small" tabular color={p.income}>
              +{money(l.amount)}
            </Txt>
          </View>
        ))}
        {a.outs.map((l) => (
          <View key={`out-${l.id}`} style={styles.between}>
            <Txt variant="small" color={p.muted}>
              {l.label}
            </Txt>
            <Txt variant="small" tabular>
              −{money(l.amount)}
            </Txt>
          </View>
        ))}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  rule: { height: StyleSheet.hairlineWidth },
  movedRow: { flexDirection: 'row', gap: space.md },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
});
