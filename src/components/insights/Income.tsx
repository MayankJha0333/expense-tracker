/* Insights › Income: money that came in this month. */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Bars } from '../finance';
import { AmountBar, Badge, Card, Divider, Empty, NoticeRow, SectionHeader, ShareBar, Txt } from '../ui';
import { needsReview, NOT_COUNTED_LABEL, notCountedIncome } from '../../lib/accounts';
import { monthKey, monthShort, sameMonth, type FlowMonth, type MonthSummary } from '../../lib/analytics';
import { money, moneyCompact, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat } from '../../lib/types';
import { space, usePalette } from '../../theme';
import { Fact, styles } from './shared';

export function Income({ summary, flow }: { summary: MonthSummary; flow: FlowMonth[] }) {
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
                  onPress={() => router.push(`/category/${c.category}?month=${monthKey(month)}`)}
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
                    <Pressable
                      onPress={() =>
                        router.push(`/category/${s.category}?month=${monthKey(month)}&from=${encodeURIComponent(s.key)}`)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name}, received ${money(s.amount)}${s.count > 1 ? `, ${s.count} payments` : ''}. Opens the payments.`}
                      style={({ pressed }) => [styles.line, { alignItems: 'flex-start', opacity: pressed ? 0.6 : 1 }]}
                    >
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
                    </Pressable>
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

/** SIPs at a glance: this month, last 12 months, the next SIP, and SIPs to check. Opens Investments. */
