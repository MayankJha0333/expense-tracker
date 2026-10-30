/* Insights › Savings: what was left each month. */

import { router } from 'expo-router';
import { View } from 'react-native';

import { SavingsLine } from '../charts';
import { Card, NoticeRow, SectionHeader, ShareBar, Tag, Txt } from '../ui';
import { monthKey, monthShort, sameMonth, type FlowMonth, type MonthSummary } from '../../lib/analytics';
import { money, moneyCompact, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import { space, usePalette } from '../../theme';
import { Fact, styles } from './shared';
import { InvestCard } from './InvestCard';

export function Savings({ summary, flow }: { summary: MonthSummary; flow: FlowMonth[] }) {
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

      <InvestCard />

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
