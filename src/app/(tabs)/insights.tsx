import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bars, CategoryRow, MonthSwitcher } from '../../components/finance';
import { Badge, Empty, SectionHeader, ShareBar, Txt } from '../../components/ui';
import { addMonths, byWeekday, monthKey, monthShort, sameMonth, summarize, trend } from '../../lib/analytics';
import { inr, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, PAY_MODE_LABEL, type SkipReason } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

const FULL_DAY: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
};

const SKIP_LABEL: Record<SkipReason, string> = {
  otp: 'OTPs and codes',
  promo: 'Offers and promos',
  personal: 'Chats from people',
  not_transaction: 'Other messages',
  failed: 'Failed payments',
  reminder: 'Bills due and statements',
  request: 'Money requests',
  duplicate: 'Repeated alerts',
};

export default function Insights() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, month, setMonth, stats, permission } = useStore();

  const summary = useMemo(() => summarize(txns, month), [txns, month]);
  const previous = useMemo(() => summarize(txns, addMonths(month, -1)), [txns, month]);
  const sixMonths = useMemo(() => trend(txns, month, 6), [txns, month]);
  const weekdays = useMemo(() => byWeekday(summary.txns), [summary]);
  const prevByCat = useMemo(() => new Map(previous.byCategory.map((c) => [c.category, c.amount])), [previous]);

  const avgSix = sixMonths.filter((m) => m.spent > 0);
  const avg = avgSix.length ? avgSix.reduce((a, m) => a + m.spent, 0) / avgSix.length : 0;
  const busiest = weekdays.reduce((best, d) => (d.amount > best.amount ? d : best), weekdays[0]);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: 60, gap: space.xl }}
    >
      <View style={{ gap: space.sm }}>
        <Txt variant="title">Insights</Txt>
        <View style={{ alignItems: 'flex-start' }}>
          <MonthSwitcher month={month} onChange={setMonth} />
        </View>
      </View>

      {/* Six months, tap a bar to jump to that month */}
      <View>
        <SectionHeader title="Last 6 months" />
        <Bars
          data={sixMonths.map((m) => ({ label: monthShort(m.month), value: m.spent }))}
          selected={sixMonths.findIndex((m) => sameMonth(m.month, month))}
          onSelect={(i) => setMonth(sixMonths[i].month)}
        />
        {avg > 0 ? (
          <Txt variant="small" color={p.muted} style={{ marginTop: space.md }}>
            Your usual month is about {inr(avg)}.{' '}
            {summary.spent > avg * 1.1
              ? `${monthShort(month)} is ${inr(summary.spent - avg)} above that.`
              : summary.spent < avg * 0.9 && summary.spent > 0
                ? `${monthShort(month)} is ${inr(avg - summary.spent)} below that.`
                : `${monthShort(month)} is close to normal.`}
          </Txt>
        ) : null}
      </View>

      {summary.spendCount === 0 ? (
        <Empty icon="chart-box-outline" title={`No spending in ${monthShort(month)}`} body="Pick another month with the arrows or the bars above." />
      ) : (
        <>
          {/* Three quick facts */}
          <View style={styles.facts}>
            <Fact label="Per day" value={inr(summary.avgPerDay)} />
            <Fact label="Payments" value={String(summary.spendCount)} />
            <Fact label="Biggest" value={summary.biggest ? inr(summary.biggest.amount) : '—'} hint={summary.biggest?.merchant} />
          </View>

          <View>
            <SectionHeader title="By category" />
            {summary.byCategory.map((s) => (
              <CategoryRow
                key={s.category}
                category={s.category}
                amount={s.amount}
                share={s.share}
                count={s.count}
                change={previous.spent > 0 ? s.amount - (prevByCat.get(s.category) ?? 0) : null}
                onPress={() => router.push(`/category/${s.category}?month=${monthKey(month)}`)}
              />
            ))}
          </View>

          <View>
            <SectionHeader title="Where you spend most" />
            {summary.topMerchants.map((m, i) => {
              const c = cat(m.category);
              return (
                <View key={m.key} style={styles.merchant}>
                  <Txt variant="smallStrong" color={p.muted} style={{ width: 18 }}>
                    {i + 1}
                  </Txt>
                  <Badge icon={c.icon} color={c.color} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {m.name}
                    </Txt>
                    <Txt variant="tiny" color={p.muted}>
                      {m.count} {m.count === 1 ? 'time' : 'times'}
                    </Txt>
                  </View>
                  <Txt variant="bodyStrong" tabular>
                    {inr(m.amount)}
                  </Txt>
                </View>
              );
            })}
          </View>

          <View>
            <SectionHeader title="How you paid" />
            <View style={{ gap: space.md }}>
              {summary.byMode.map((m) => (
                <View key={m.mode} style={{ gap: 6 }}>
                  <View style={styles.between}>
                    <Txt variant="bodyStrong">{PAY_MODE_LABEL[m.mode]}</Txt>
                    <Txt variant="small" color={p.muted} tabular>
                      {inr(m.amount)}, {percent(m.share)}
                    </Txt>
                  </View>
                  <ShareBar share={m.share} color={p.ink} height={8} />
                </View>
              ))}
            </View>
          </View>

          <View>
            <SectionHeader title="By day of the week" />
            <Bars
              data={weekdays.map((d) => ({ label: d.label, value: d.amount }))}
              selected={weekdays.indexOf(busiest)}
              height={90}
            />
            {busiest.amount > 0 ? (
              <Txt variant="small" color={p.muted} style={{ marginTop: space.md }}>
                {busiest.label === 'Sat' || busiest.label === 'Sun'
                  ? 'Weekends are your biggest spending days.'
                  : `${FULL_DAY[busiest.label] ?? busiest.label}s are your biggest spending day this month.`}
              </Txt>
            ) : null}
          </View>
        </>
      )}

      {permission === 'granted' && stats.scanned > 0 ? (
        <View style={[styles.skipBox, { borderColor: p.line }]}>
          <Txt variant="heading">What was skipped</Txt>
          <Txt variant="small" color={p.muted}>
            Out of {stats.scanned.toLocaleString('en-IN')} messages, {stats.kept.toLocaleString('en-IN')} were payments. These were left out:
          </Txt>
          {(Object.keys(SKIP_LABEL) as SkipReason[])
            .filter((r) => (stats.skipped[r] ?? 0) > 0)
            .map((r) => (
              <View key={r} style={styles.between}>
                <Txt variant="small">{SKIP_LABEL[r]}</Txt>
                <Txt variant="smallStrong" tabular>
                  {(stats.skipped[r] ?? 0).toLocaleString('en-IN')}
                </Txt>
              </View>
            ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const p = usePalette();
  return (
    <View style={[styles.fact, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Txt variant="tiny" color={p.muted}>
        {label}
      </Txt>
      <Txt variant="amount" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="tiny" color={p.muted} numberOfLines={1}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: 4 },
  merchant: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  skipBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.lg, gap: space.sm },
});
