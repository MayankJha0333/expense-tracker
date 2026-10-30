/* Insights › Spending: where the money went this month. */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Bars, CategoryRow } from '../finance';
import { AnimatedAmount } from '../AnimatedAmount';
import { AmountBar, Badge, Card, Divider, Empty, MixBar, SectionHeader, Txt } from '../ui';
import { PAY_GROUP_LABEL, payGroupColorIndex, payMix } from '../../lib/accounts';
import {
  byWeekday,
  monthKey,
  monthName,
  monthShort,
  recurring,
  sameMonth,
  type FlowMonth,
  type MonthSummary,
} from '../../lib/analytics';
import { formatCount, money, moneyCompact, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, type SkipReason } from '../../lib/types';
import { space, usePalette } from '../../theme';
import { FULL_DAY, SKIP_LABEL, Fact, styles } from './shared';

export function Spending({ summary, previous, flow }: { summary: MonthSummary; previous: MonthSummary; flow: FlowMonth[] }) {
  const p = usePalette();
  const { txns, month, setMonth, stats, source, permission } = useStore();
  const weekdays = useMemo(() => byWeekday(summary.txns), [summary]);
  const regular = useMemo(() => recurring(txns, month), [txns, month]);
  const prevByCat = useMemo(() => new Map(previous.byCategory.map((c) => [c.category, c.amount])), [previous]);
  const withSpend = flow.filter((m) => m.spent > 0);
  const avg = withSpend.length ? withSpend.reduce((a, m) => a + m.spent, 0) / withSpend.length : 0;
  const busiest = weekdays.reduce((best, d) => (d.amount > best.amount ? d : best), weekdays[0]);
  const name = monthShort(month);
  const mix = useMemo(() => payMix(summary.txns), [summary]);
  const change = previous.spent > 0 ? (summary.spent - previous.spent) / previous.spent : null;

  return (
    <>
      <View style={{ gap: 4 }}>
        <Txt variant="small" color={p.muted}>
          Spent in {monthName(month)}
        </Txt>
        <AnimatedAmount value={summary.spent} format={(v) => money(v)} variant="display" tabular adjustsFontSizeToFit numberOfLines={1} />
        {change !== null ? (
          <Txt variant="smallStrong" color={change > 0.05 ? p.warn : change < -0.05 ? p.income : p.muted}>
            {change > 0 ? 'Up' : 'Down'} {percent(Math.abs(change))} from {monthShort(previous.month)} ({money(previous.spent)})
          </Txt>
        ) : null}
      </View>

      <View>
        <SectionHeader title="Last 6 months" subtitle="Tap a bar to open that month" />
        <Card>
          <Bars
            data={flow.map((m) => ({ label: monthShort(m.month), value: m.spent }))}
            selected={flow.findIndex((m) => sameMonth(m.month, month))}
            onSelect={(i) => setMonth(flow[i].month)}
          />
          {avg > 0 ? (
            <Txt variant="small" color={p.muted} style={{ marginTop: space.md }}>
              Your usual month is about {money(avg)}.{' '}
              {summary.spent > avg * 1.1
                ? `${name} is ${money(summary.spent - avg)} above that.`
                : summary.spent < avg * 0.9 && summary.spent > 0
                  ? `${name} is ${money(avg - summary.spent)} below that.`
                  : `${name} is close to normal.`}
            </Txt>
          ) : null}
        </Card>
      </View>

      {summary.spendCount === 0 ? (
        <Empty icon="chart-donut" title={`No spending in ${name}`} body="Pick another month with the arrows or the bars above." />
      ) : (
        <>
          <View style={styles.facts}>
            <Fact label="Per day" value={money(summary.avgPerDay)} />
            <Fact label="Payments" value={String(summary.spendCount)} />
            <Fact label="Biggest" value={summary.biggest ? moneyCompact(summary.biggest.amount) : '—'} hint={summary.biggest?.merchant} />
          </View>

          <View>
            <SectionHeader title="By category" subtitle={`${money(summary.spent)} in ${name}`} />
            <Card style={{ paddingVertical: space.sm }}>
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
            </Card>
          </View>

          {regular.length > 0 ? (
            <View>
              <SectionHeader title="Regular payments" subtitle="Rent, bills and subscriptions seen most months" />
              <Card style={{ paddingVertical: space.xs }}>
                {regular.slice(0, 8).map((r, i) => {
                  const c = cat(r.category);
                  return (
                    <View key={r.key}>
                      {i > 0 ? <Divider inset={48} /> : null}
                      <View style={styles.line}>
                        <Badge icon={c.icon} color={c.color} size={36} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt variant="bodyStrong" numberOfLines={1}>
                            {r.name}
                          </Txt>
                          <Txt variant="tiny" color={p.muted}>
                            {c.label} · {r.months} of the last 4 months
                          </Txt>
                        </View>
                        <Txt variant="bodyStrong" tabular>
                          {money(r.amount)}
                        </Txt>
                      </View>
                    </View>
                  );
                })}
                <Divider />
                <View style={[styles.line, { justifyContent: 'space-between' }]}>
                  <Txt variant="small" color={p.muted}>
                    About every month
                  </Txt>
                  <Txt variant="smallStrong" tabular>
                    {money(regular.reduce((a, r) => a + r.amount, 0))}
                  </Txt>
                </View>
              </Card>
            </View>
          ) : null}

          <View>
            <SectionHeader title="Where you spend most" />
            <Card style={{ paddingVertical: space.xs }}>
              {summary.topMerchants.map((m, i) => {
                const c = cat(m.category);
                return (
                  <View key={m.key}>
                    {i > 0 ? <Divider inset={76} /> : null}
                    <View style={styles.line}>
                      <Txt variant="smallStrong" color={p.muted} style={{ width: 18 }}>
                        {i + 1}
                      </Txt>
                      <Badge icon={c.icon} color={c.color} size={36} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt variant="bodyStrong" numberOfLines={1}>
                          {m.name}
                        </Txt>
                        <Txt variant="tiny" color={p.muted}>
                          {m.count} {m.count === 1 ? 'time' : 'times'}
                        </Txt>
                      </View>
                      <Txt variant="bodyStrong" tabular>
                        {money(m.amount)}
                      </Txt>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>

          <View>
            <SectionHeader title="How you paid" action="Accounts" onAction={() => router.push('/accounts')} />
            <Card style={{ gap: space.lg }}>
              <MixBar
                parts={mix.map((m) => ({ share: m.share, color: p.series[payGroupColorIndex(m.group)] }))}
                label={mix.map((m) => `${PAY_GROUP_LABEL[m.group]} ${percent(m.share)}`).join(', ')}
              />
              {mix.map((m) => (
                <AmountBar
                  key={m.group}
                  label={`${PAY_GROUP_LABEL[m.group]} · ${m.count} ${m.count === 1 ? 'payment' : 'payments'}`}
                  amount={money(m.amount)}
                  share={percent(m.share)}
                  fill={m.share / Math.max(0.0001, mix[0].share)}
                  color={p.series[payGroupColorIndex(m.group)]}
                  onPress={m.group === 'upi' || m.group === 'card' || m.group === 'cash' ? () => router.navigate({ pathname: '/activity', params: { filter: m.group } }) : undefined}
                />
              ))}
            </Card>
          </View>

          <View>
            <SectionHeader title="By day of the week" />
            <Card>
              <Bars data={weekdays.map((d) => ({ label: d.label, value: d.amount }))} selected={weekdays.indexOf(busiest)} height={90} />
              {busiest.amount > 0 ? (
                <Txt variant="small" color={p.muted} style={{ marginTop: space.md }}>
                  {busiest.label === 'Sat' || busiest.label === 'Sun'
                    ? 'Weekends are your biggest spending days.'
                    : `${FULL_DAY[busiest.label] ?? busiest.label}s are your biggest spending day this month.`}
                </Txt>
              ) : null}
            </Card>
          </View>
        </>
      )}

      {(source === 'demo' || permission === 'granted') && stats.scanned > 0 ? (
        <Card style={{ gap: space.sm }}>
          <Txt variant="heading">What the SMS reader skipped</Txt>
          <Txt variant="small" color={p.muted}>
            Out of {formatCount(stats.scanned)} messages, {formatCount(stats.kept)} were payments. These were left out:
          </Txt>
          {(Object.keys(SKIP_LABEL) as SkipReason[])
            .filter((r) => (stats.skipped[r] ?? 0) > 0)
            .map((r) => (
              <View key={r} style={styles.between}>
                <Txt variant="small">{SKIP_LABEL[r]}</Txt>
                <Txt variant="smallStrong" tabular>
                  {formatCount((stats.skipped[r] ?? 0))}
                </Txt>
              </View>
            ))}
        </Card>
      ) : null}
    </>
  );
}
