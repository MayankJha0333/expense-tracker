import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SavingsLine } from '../../components/charts';
import { Bars, CategoryRow, MonthSwitcher } from '../../components/finance';
import { AmountBar, Badge, Card, Divider, Empty, MixBar, NoticeRow, SectionHeader, Segmented, ShareBar, Tag, Txt } from '../../components/ui';
import { needsReview, NOT_COUNTED_LABEL, notCountedIncome, PAY_GROUP_LABEL, payGroupColorIndex, payMix } from '../../lib/accounts';
import {
  addMonths,
  byWeekday,
  cashflow,
  monthKey,
  monthName,
  monthShort,
  recurring,
  sameMonth,
  summarize,
  type FlowMonth,
  type MonthSummary,
} from '../../lib/analytics';
import { formatCount, money, moneyCompact, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, type SkipReason } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

type View_ = 'spending' | 'income' | 'savings';

const FULL_DAY: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };

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
  const { txns, month, setMonth } = useStore();
  const [view, setView] = useState<View_>('spending');

  const summary = useMemo(() => summarize(txns, month), [txns, month]);
  const previous = useMemo(() => summarize(txns, addMonths(month, -1)), [txns, month]);
  const flow = useMemo(() => cashflow(txns, month, 6), [txns, month]);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: 60, gap: space.xl }}
    >
      <View style={{ gap: space.md }}>
        <View style={styles.titleRow}>
          <Txt variant="title" accessibilityRole="header">
            Insights
          </Txt>
          <MonthSwitcher month={month} onChange={setMonth} compact />
        </View>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { id: 'spending', label: 'Spending' },
            { id: 'income', label: 'Income' },
            { id: 'savings', label: 'Savings' },
          ]}
        />
      </View>

      {view === 'spending' ? <Spending summary={summary} previous={previous} flow={flow} /> : null}
      {view === 'income' ? <Income summary={summary} flow={flow} /> : null}
      {view === 'savings' ? <Savings summary={summary} flow={flow} /> : null}
    </ScrollView>
  );
}

function Spending({ summary, previous, flow }: { summary: MonthSummary; previous: MonthSummary; flow: FlowMonth[] }) {
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
        <Txt variant="display" tabular adjustsFontSizeToFit numberOfLines={1}>
          {money(summary.spent)}
        </Txt>
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

function Income({ summary, flow }: { summary: MonthSummary; flow: FlowMonth[] }) {
  const p = usePalette();
  const { month, setMonth } = useStore();
  const notCounted = useMemo(() => notCountedIncome(summary.txns), [summary]);
  const toCheck = useMemo(() => summary.txns.filter((t) => t.type === 'credit' && needsReview(t)), [summary]);
  const maxIncomeCat = summary.incomeByCategory[0]?.amount ?? 1;
  const withIncome = flow.filter((m) => m.income > 0);
  const avg = withIncome.length ? withIncome.reduce((a, m) => a + m.income, 0) / withIncome.length : 0;
  const name = monthShort(month);

  return (
    <>
      <View style={styles.facts}>
        <Fact label={`In ${name}`} value={moneyCompact(summary.received)} tone={p.income} />
        <Fact label="Usual month" value={avg > 0 ? moneyCompact(avg) : '—'} />
        <Fact label="Sources" value={String(summary.incomeSources.length)} />
      </View>

      <View>
        <SectionHeader title="Last 6 months" subtitle="Tap a bar to open that month" />
        <Card>
          <Bars
            data={flow.map((m) => ({ label: monthShort(m.month), value: m.income }))}
            selected={flow.findIndex((m) => sameMonth(m.month, month))}
            onSelect={(i) => setMonth(flow[i].month)}
            color={p.income}
          />
        </Card>
      </View>

      {summary.incomeCount === 0 ? (
        <Empty
          icon="cash-plus"
          title={`No income found for ${name}`}
          body="Salary, transfers in, refunds and interest from bank SMS show up here. You can also add cash income with the + button."
        />
      ) : (
        <>
          <View>
            <SectionHeader title="Where it came from" subtitle={`${money(summary.received)} counted as income`} />
            <Card style={{ gap: space.lg }}>
              {summary.incomeByCategory.map((c) => (
                <AmountBar
                  key={c.category}
                  label={cat(c.category).label}
                  amount={money(c.amount)}
                  share={percent(c.share)}
                  fill={c.amount / maxIncomeCat}
                  color={p.income}
                  sub={`${c.count} ${c.count === 1 ? 'payment' : 'payments'}`}
                />
              ))}
            </Card>
          </View>

          {toCheck.length > 0 ? (
            <NoticeRow
              tone="warn"
              icon="account-question-outline"
              title={`${toCheck.length} ${toCheck.length === 1 ? 'payment' : 'payments'} from people to check`}
              body="If a friend paid you back, it isn't really income. Mark it as left out."
              pill="Check"
              onPress={() => router.navigate({ pathname: '/activity', params: { filter: 'review' } })}
            />
          ) : null}

          {notCounted.total > 0 ? (
            <View>
              <SectionHeader title="Not counted as income" subtitle="Money that came in but isn't new money" />
              <Card style={{ gap: space.md }}>
                {notCounted.rows.map((r) => (
                  <View key={r.reason} style={styles.between}>
                    <Txt variant="small" style={{ flex: 1 }}>
                      {NOT_COUNTED_LABEL[r.reason]}
                      <Txt variant="small" color={p.muted}>
                        {' '}
                        · {r.count}
                      </Txt>
                    </Txt>
                    <Txt variant="smallStrong" tabular color={p.muted}>
                      {money(r.amount)}
                    </Txt>
                  </View>
                ))}
                <Divider />
                <Txt variant="small" color={p.muted}>
                  Leaving these out keeps your income number honest: moving your own money around doesn&apos;t make you richer.
                </Txt>
              </Card>
            </View>
          ) : null}

          <View>
            <SectionHeader title="Sources" subtitle="Who paid you this month" />
            <Card style={{ paddingVertical: space.xs }}>
              {summary.incomeSources.map((s, i) => {
                const c = cat(s.category);
                return (
                  <View key={s.key}>
                    {i > 0 ? <Divider inset={48} /> : null}
                    <View style={[styles.line, { alignItems: 'flex-start' }]}>
                      <Badge icon={c.icon} color={c.color} size={36} />
                      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                        <View style={styles.between}>
                          <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                            {s.name}
                          </Txt>
                          <Txt variant="bodyStrong" tabular color={p.income}>
                            +{money(s.amount)}
                          </Txt>
                        </View>
                        <ShareBar share={s.share} color={c.color} />
                        <Txt variant="tiny" color={p.muted}>
                          {c.label} · {percent(s.share)} of income{s.count > 1 ? ` · ${s.count} payments` : ''}
                        </Txt>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        </>
      )}
    </>
  );
}

function Savings({ summary, flow }: { summary: MonthSummary; flow: FlowMonth[] }) {
  const p = usePalette();
  const { goals, budget } = useStore();
  const name = monthShort(summary.month);
  const months = flow.filter((f) => f.income > 0 || f.spent > 0);
  const totalSaved = months.reduce((a, f) => a + f.saved, 0);
  const totalIn = months.reduce((a, f) => a + f.income, 0);
  const avgRate = totalIn > 0 ? totalSaved / totalIn : null;
  const goalSaved = goals.reduce((a, g) => a + g.saved, 0);
  const goalTarget = goals.reduce((a, g) => a + g.target, 0);

  return (
    <>
      <View style={styles.facts}>
        <Fact label={`Saved in ${name}`} value={moneyCompact(summary.saved)} tone={summary.saved < 0 ? p.danger : p.savings} />
        <Fact label="Savings rate" value={summary.savingsRate === null ? '—' : percent(Math.max(0, summary.savingsRate))} />
        <Fact label="6-month rate" value={avgRate === null ? '—' : percent(Math.max(0, avgRate))} />
      </View>

      <View>
        <SectionHeader title="Left over each month" subtitle="Money in minus money out" />
        <Card>
          <SavingsLine data={flow} />
          <View style={[styles.between, { marginTop: space.sm }]}>
            {flow.map((f) => (
              <Txt key={monthKey(f.month)} variant="tiny" color={sameMonth(f.month, summary.month) ? p.ink : p.muted} style={{ flex: 1, textAlign: 'center' }}>
                {monthShort(f.month)}
              </Txt>
            ))}
          </View>
        </Card>
      </View>

      <View>
        <SectionHeader title="Month by month" />
        <Card style={{ paddingVertical: space.xs }}>
          <View style={[styles.tableRow, { borderBottomColor: p.line }]}>
            <Txt variant="tiny" color={p.muted} style={styles.cMonth}>
              Month
            </Txt>
            <Txt variant="tiny" color={p.muted} style={styles.cNum}>
              In
            </Txt>
            <Txt variant="tiny" color={p.muted} style={styles.cNum}>
              Out
            </Txt>
            <Txt variant="tiny" color={p.muted} style={styles.cNum}>
              Saved
            </Txt>
          </View>
          {[...flow].reverse().map((f) => (
            <View key={monthKey(f.month)} style={[styles.tableRow, { borderBottomColor: p.line }]}>
              <Txt variant="smallStrong" style={styles.cMonth}>
                {monthShort(f.month)}
              </Txt>
              <Txt variant="small" tabular style={styles.cNum}>
                {moneyCompact(f.income)}
              </Txt>
              <Txt variant="small" tabular style={styles.cNum}>
                {moneyCompact(f.spent)}
              </Txt>
              <Txt variant="smallStrong" tabular color={f.saved < 0 ? p.danger : p.savings} style={styles.cNum}>
                {moneyCompact(f.saved)}
              </Txt>
            </View>
          ))}
        </Card>
      </View>

      {summary.invested > 0 ? (
        <Card style={styles.line}>
          <Badge icon="chart-line" color={p.savings} size={40} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{money(summary.invested)} invested in {name}</Txt>
            <Txt variant="small" color={p.muted}>
              SIPs and investments are part of what you saved, so they are not counted as spending.
            </Txt>
          </View>
        </Card>
      ) : null}

      <NoticeRow
        tone="accent"
        icon="target"
        title={budget ? `Budget: ${money(budget)} a month` : 'Set a monthly budget'}
        body={budget ? 'Your spending limit for each month.' : 'See how much is left each day.'}
        pill={budget ? 'Change' : 'Set'}
        onPress={() => router.push('/budget')}
      />

      <View>
        <SectionHeader title="Goals" action={goals.length ? 'Open goals' : 'Add a goal'} onAction={() => router.push(goals.length ? '/goals' : '/goal')} />
        {goals.length ? (
          <Card style={{ gap: space.sm }}>
            <View style={styles.between}>
              <Txt variant="bodyStrong">
                {money(goalSaved)} of {money(goalTarget)}
              </Txt>
              <Tag label={percent(goalTarget > 0 ? goalSaved / goalTarget : 0)} color={p.savings} />
            </View>
            <ShareBar share={goalTarget > 0 ? goalSaved / goalTarget : 0} color={p.savings} height={10} />
            <Txt variant="small" color={p.muted}>
              Put aside across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}.
            </Txt>
          </Card>
        ) : (
          <Txt variant="small" color={p.muted}>
            Set a goal, like an emergency fund or a trip, and track how close you are.
          </Txt>
        )}
      </View>
    </>
  );
}

function Fact({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  const p = usePalette();
  return (
    <View style={[styles.fact, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Txt variant="tiny" color={p.muted} numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="amount" tabular numberOfLines={1} adjustsFontSizeToFit color={tone ?? p.ink}>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  donutCard: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  legendLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  cMonth: { flex: 1 },
  cNum: { flex: 1.3, textAlign: 'right' },
});
