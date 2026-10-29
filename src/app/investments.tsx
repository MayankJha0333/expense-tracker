import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bars, MonthSwitcher, TxnRow } from '../components/finance';
import { HeroCard } from '../components/HeroCard';
import { Stagger } from '../components/motion';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Empty, Icon, SectionHeader, Tag, Txt } from '../components/ui';
import { monthShort, sameMonth, shortDay } from '../lib/analytics';
import { investmentOverview, type SipPlan } from '../lib/investments';
import { money } from '../lib/money';
import { useStore } from '../lib/store';
import type { ScheduledDebit } from '../lib/types';
import { space, usePalette } from '../theme';

/** "around the 11th" */
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;

/**
 * Your SIPs and investments: what went in, month by month, each SIP with its usual day
 * and the next one, and SIPs the bank scheduled but never confirmed by message.
 */
export default function InvestmentsScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, scheduled, funds, month, setMonth, ignoredSchedules, ignoreSchedule, addEntry } = useStore();
  const o = useMemo(
    () => investmentOverview(txns, scheduled, funds, month, new Set(ignoredSchedules)),
    [txns, scheduled, funds, month, ignoredSchedules],
  );
  const missing = o.noDebitSeen.reduce((a, s) => a + s.amount, 0);
  // A long list of SIPs to check would push everything else down: show a few first.
  const [showAll, setShowAll] = useState(false);
  const toCheck = showAll ? o.noDebitSeen : o.noDebitSeen.slice(0, 3);

  const addPaid = (s: ScheduledDebit) => {
    Haptics.selectionAsync().catch(() => {});
    addEntry({
      type: 'debit',
      amount: s.amount,
      merchant: s.name,
      category: 'investments',
      // Midday, so the day never shifts.
      timestamp: s.date + 12 * 3_600_000,
      mode: 'upi',
      note: `SIP by autopay${s.bank ? ` from ${s.bank}` : ''}. The bank sent no payment message.`,
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <Stagger>
        <ScreenHeader />
        <View style={{ gap: space.sm }}>
          <Txt variant="title" accessibilityRole="header">
            Investments
          </Txt>
          <MonthSwitcher month={month} onChange={setMonth} compact />
        </View>

        <HeroCard accessibilityLabel={`Invested ${money(o.last12)} in the last 12 months, ${money(o.thisMonth)} in ${monthShort(month)}.`}>
          <Txt variant="smallStrong" color={p.heroMuted}>
            Invested in the last 12 months
          </Txt>
          <Txt variant="display" tabular color={p.heroValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(o.last12)}
          </Txt>
          <Txt variant="small" color={p.heroMuted}>
            {money(o.thisMonth)} in {monthShort(month)} · you invested in {o.monthsInvested} of 12 months
          </Txt>
          <Txt variant="small" color={p.heroMuted}>
            SIPs are money you kept, so they count as savings, not spending.
          </Txt>
        </HeroCard>

        {o.noDebitSeen.length ? (
          <View>
            <SectionHeader title="SIPs with no payment message" subtitle={`${money(missing)} the bank said it would take, but never confirmed`} />
            <View style={{ gap: space.md }}>
              {toCheck.map((s) => (
                <Card key={s.id} style={{ gap: space.sm }}>
                  <View style={styles.between}>
                    <Txt variant="bodyStrong" style={{ flex: 1 }}>
                      {money(s.amount)} · {shortDay(s.date)}
                    </Txt>
                    {s.bank ? <Tag label={s.bank} color={p.muted} /> : null}
                  </View>
                  <Txt variant="small" color={p.muted}>
                    {s.bank ?? 'Your bank'} said this SIP to {s.name} would be taken on {shortDay(s.date)}, but sent no message after it. If it was paid, add it so
                    it counts in your savings.
                  </Txt>
                  <View style={styles.actions}>
                    <Button label="It was paid, add it" icon="plus" kind="secondary" compact onPress={() => addPaid(s)} />
                    <Button label="It didn't happen" kind="quiet" compact onPress={() => ignoreSchedule(s.id)} />
                  </View>
                </Card>
              ))}
              {o.noDebitSeen.length > toCheck.length ? (
                <Button label={`Show ${o.noDebitSeen.length - toCheck.length} more`} kind="quiet" compact onPress={() => setShowAll(true)} />
              ) : null}
            </View>
          </View>
        ) : null}

        <View>
          <SectionHeader title="Month by month" />
          <Card>
            <Bars
              data={o.byMonth.map((b) => ({ label: monthShort(b.month).slice(0, 1), value: b.amount }))}
              selected={o.byMonth.findIndex((b) => sameMonth(b.month, month))}
              onSelect={(i) => setMonth(o.byMonth[i].month)}
              height={96}
              color={p.savings}
              values="selected"
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="Your SIPs" subtitle="The same amount to the same place, month after month" />
          {o.sips.length ? (
            <View style={{ gap: space.md }}>
              {o.sips.map((s) => (
                <SipRow key={s.key} sip={s} />
              ))}
            </View>
          ) : (
            <Card>
              <Empty icon="chart-line" title="No SIP found yet" body="A payment to the same fund or app two months in a row shows up here." />
            </Card>
          )}
        </View>

        {o.upcoming.length ? (
          <View>
            <SectionHeader title="Coming up" subtitle="Your bank said it will take these" />
            <Card style={{ gap: space.md }}>
              {o.upcoming.map((s) => (
                <View key={s.id} style={styles.between}>
                  <Txt variant="body" style={{ flex: 1 }}>
                    {s.name}
                  </Txt>
                  <Txt variant="bodyStrong" tabular>
                    {money(s.amount)} · {shortDay(s.date)}
                  </Txt>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {o.platforms.length || o.funds.length ? (
          <View>
            <SectionHeader title="Where it goes" />
            <Card style={{ gap: space.md }}>
              {o.platforms.map((pl) => (
                <View key={pl.name} style={styles.between}>
                  <Txt variant="body" style={{ flex: 1 }}>
                    {pl.name}
                  </Txt>
                  <Txt variant="bodyStrong" tabular>
                    {money(pl.amount)}
                  </Txt>
                </View>
              ))}
              {o.funds.length ? (
                <View style={{ gap: space.sm }}>
                  <Txt variant="small" color={p.muted}>
                    Funds named in your SIP messages
                  </Txt>
                  <View style={styles.actions}>
                    {o.funds.map((f) => (
                      <Tag key={f} label={f} icon="chart-areaspline" color={p.savings} />
                    ))}
                  </View>
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}

        {o.payments.length ? (
          <View>
            <SectionHeader title="Payments" subtitle="Last 12 months" />
            <Card style={{ paddingVertical: space.xs }}>
              {o.payments.map((t) => (
                <TxnRow key={t.id} txn={t} showDate />
              ))}
            </Card>
          </View>
        ) : null}
      </Stagger>
    </ScrollView>
  );
}

function SipRow({ sip: s }: { sip: SipPlan }) {
  const p = usePalette();
  return (
    <View style={[styles.sip, { backgroundColor: p.surface, borderColor: p.line, opacity: s.active ? 1 : 0.6 }]}>
      <View style={[styles.icon, { backgroundColor: p.surfaceAlt }]}>
        <Icon name="chart-line" size={20} color={p.savings} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">
          {money(s.amount)}
          {s.perMonth > 1 ? ` × ${s.perMonth}` : ''} a month
        </Txt>
        <Txt variant="small" color={p.muted}>
          {s.name} · around the {ordinal(s.day)}
          {s.from ? ` · ${s.from}` : ''}
        </Txt>
        <Txt variant="small" color={s.active ? p.ink : p.muted}>
          {s.active ? `Next: about ${shortDay(s.next)}` : `Stopped? Last one on ${shortDay(s.last)}`}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sip: { flexDirection: 'row', gap: space.md, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
