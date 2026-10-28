import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ring } from '../components/charts';
import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, Button, Card, Empty, Icon, SectionHeader, ShareBar, Txt } from '../components/ui';
import { budgetPace, summarize, thisMonth } from '../lib/analytics';
import { inr, inrCompact, percent } from '../lib/money';
import { goalPlan } from '../lib/goals';
import { useStore } from '../lib/store';
import type { Goal } from '../lib/types';
import { radius, space, usePalette } from '../theme';

export default function Goals() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { goals, budget, txns } = useStore();
  const now = useMemo(() => summarize(txns, thisMonth()), [txns]);
  const pace = budget ? budgetPace(now, budget) : null;
  const saved = goals.reduce((a, g) => a + g.saved, 0);
  const target = goals.reduce((a, g) => a + g.target, 0);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <ScreenHeader />
        <Txt variant="title" accessibilityRole="header">
          Goals and budget
        </Txt>

        {goals.length > 0 ? (
          <View style={[styles.summary, { backgroundColor: p.card }]}>
            <Ring progress={target > 0 ? saved / target : 0} size={84} thickness={9} color={p.cardAccent} track={p.cardLine}>
              <Txt variant="bodyStrong" color={p.cardText} tabular>
                {percent(target > 0 ? saved / target : 0)}
              </Txt>
            </Ring>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label" color={p.cardMuted}>
                Put aside
              </Txt>
              <Txt variant="title" color={p.cardText} tabular numberOfLines={1} adjustsFontSizeToFit>
                {inr(saved)}
              </Txt>
              <Txt variant="small" color={p.cardMuted}>
                of {inr(target)} across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
              </Txt>
            </View>
          </View>
        ) : null}

        <View>
          <SectionHeader title="Monthly budget" />
          <Pressable onPress={() => router.push('/budget')} accessibilityRole="button" accessibilityLabel="Edit monthly budget">
            <Card style={{ gap: space.sm }}>
              {pace && budget ? (
                <>
                  <View style={styles.between}>
                    <Txt variant="bodyStrong">{inr(budget)} a month</Txt>
                    <Txt variant="smallStrong" color={pace.used > 1 ? p.danger : p.muted} tabular>
                      {inr(now.spent)} spent
                    </Txt>
                  </View>
                  <ShareBar share={pace.used} color={pace.used > 1 ? p.danger : pace.onTrack ? p.income : p.accent} height={10} />
                  <Txt variant="small" color={p.muted}>
                    {pace.left >= 0 ? `${inr(pace.left)} left this month.` : `${inr(-pace.left)} over this month.`}{' '}
                    {pace.onTrack ? 'On track.' : `On pace for ${inr(pace.projected)}.`}
                  </Txt>
                </>
              ) : (
                <View style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">No budget yet</Txt>
                    <Txt variant="small" color={p.muted}>
                      Set a spending limit for each month.
                    </Txt>
                  </View>
                  <Icon name="chevron-right" size={20} color={p.muted} />
                </View>
              )}
            </Card>
          </Pressable>
        </View>

        <View>
          <SectionHeader title="Savings goals" action={goals.length ? 'New goal' : undefined} onAction={() => router.push('/goal')} />
          {goals.length === 0 ? (
            <Card>
              <Empty icon="flag-checkered" title="Save for something" body="An emergency fund, a trip, a new phone. Add a goal and track how close you are.">
                <Button label="Add a goal" icon="plus" onPress={() => router.push('/goal')} />
              </Empty>
            </Card>
          ) : (
            <View style={{ gap: space.md }}>
              {goals.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </View>
          )}
        </View>

        <Txt variant="small" color={p.muted}>
          Goals are a plan you keep here. Kharcha never moves money; add to a goal when you put money aside.
        </Txt>
      </ScrollView>
    </View>
  );
}

function GoalCard({ goal: g }: { goal: Goal }) {
  const p = usePalette();
  const share = g.target > 0 ? g.saved / g.target : 0;
  return (
    <Pressable onPress={() => router.push(`/goal?id=${g.id}`)} accessibilityRole="button" accessibilityLabel={`${g.name}, ${inr(g.saved)} of ${inr(g.target)}`}>
      <Card style={{ gap: space.md }}>
        <View style={styles.goalHead}>
          <Badge icon={g.icon} color={g.color} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {g.name}
            </Txt>
            <Txt variant="small" color={p.muted} numberOfLines={2}>
              {goalPlan(g)}
            </Txt>
          </View>
          <Txt variant="heading" tabular color={share >= 1 ? p.income : p.ink}>
            {percent(share)}
          </Txt>
        </View>
        <ShareBar share={share} color={g.color} height={10} />
        <View style={styles.between}>
          <Txt variant="smallStrong" tabular>
            {inr(g.saved)}
          </Txt>
          <Txt variant="small" color={p.muted} tabular>
            of {inrCompact(g.target)}
          </Txt>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.lg, borderRadius: radius.lg, padding: space.xl },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
