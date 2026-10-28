import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryRow, HeatCalendar, MonthSwitcher, StackedBar, TxnRow } from '../../components/finance';
import { Button, Empty, Icon, SectionHeader, Txt } from '../../components/ui';
import { addMonths, monthKey, monthShort, percentChange, summarize } from '../../lib/analytics';
import { inr, percent } from '../../lib/money';
import { openAppSettings } from '../../lib/sms';
import { useStore } from '../../lib/store';
import { cat } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

export default function Home() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, month, setMonth, refresh, refreshing, stats, permission, manualOnly, requestAccess, error } = useStore();

  const summary = useMemo(() => summarize(txns, month), [txns, month]);
  const previous = useMemo(() => summarize(txns, addMonths(month, -1)), [txns, month]);
  const change = percentChange(summary.spent, previous.spent);
  const smsOn = permission === 'granted';

  const skippedNoise = (stats.skipped.otp ?? 0) + (stats.skipped.promo ?? 0) + (stats.skipped.reminder ?? 0) + (stats.skipped.failed ?? 0) + (stats.skipped.request ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: 120, gap: space.xl }}
        refreshControl={smsOn ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.marigold} colors={[p.marigold]} /> : undefined}
      >
        <View style={styles.topBar}>
          <Txt variant="title" style={{ fontSize: 24, lineHeight: 30 }}>
            Kharcha
          </Txt>
          {smsOn ? (
            <Pressable onPress={refresh} hitSlop={12} accessibilityLabel="Read new messages">
              <Icon name="refresh" size={22} color={p.muted} />
            </Pressable>
          ) : null}
        </View>

        {!smsOn ? (
          <View style={[styles.notice, { backgroundColor: p.marigoldSoft }]}>
            <Txt variant="bodyStrong">Bank SMS reading is off</Txt>
            <Txt variant="small" color={p.inkSoft}>
              {manualOnly ? 'You are adding expenses by hand. ' : ''}
              Turn it on to track UPI, card and ATM spends on their own.
            </Txt>
            <View style={{ alignItems: 'flex-start' }}>
              <Button
                label={permission === 'blocked' ? 'Open settings' : permission === 'unavailable' ? 'Needs a development build' : 'Turn on'}
                onPress={permission === 'blocked' ? openAppSettings : requestAccess}
                disabled={permission === 'unavailable'}
              />
            </View>
          </View>
        ) : null}

        {error ? (
          <Txt variant="small" color={p.chili}>
            {`Couldn't read messages: ${error}`}
          </Txt>
        ) : null}

        {/* The month card */}
        <View style={[styles.hero, { backgroundColor: p.card }]}>
          <MonthSwitcher month={month} onChange={setMonth} light />
          <View style={{ gap: 2, marginTop: space.md }}>
            <Txt variant="small" color={p.cardMuted}>
              Spent in {monthShort(month)}
            </Txt>
            <Txt variant="display" color={p.cardText} tabular adjustsFontSizeToFit numberOfLines={1}>
              {inr(summary.spent)}
            </Txt>
          </View>
          <View style={styles.heroMeta}>
            <Txt variant="small" color={change == null ? p.cardMuted : change > 0 ? '#F08C80' : '#7FD3B0'} style={{ flex: 1 }}>
              {change == null
                ? `${summary.spendCount} payments`
                : `${change > 0 ? '↑' : '↓'} ${Math.abs(Math.round(change))}% ${change > 0 ? 'more' : 'less'} than ${monthShort(addMonths(month, -1))}`}
            </Txt>
            {summary.received > 0 ? (
              <Txt variant="small" color={p.cardMuted}>
                {inr(summary.received)} came in
              </Txt>
            ) : null}
          </View>
          <View style={{ marginTop: space.lg }}>
            <StackedBar slices={summary.byCategory} />
          </View>
          {summary.byCategory.length > 0 ? (
            <View style={styles.legendWrap}>
              {summary.byCategory.slice(0, 4).map((s) => (
                <View key={s.category} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: cat(s.category).color }]} />
                  <Txt variant="tiny" color={p.cardText}>
                    {cat(s.category).label} {percent(s.share)}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {summary.txns.length === 0 ? (
          <Empty
            icon="tray-arrow-down"
            title={`Nothing for ${monthShort(month)} yet`}
            body={smsOn ? 'No bank or card alerts were found for this month. Pull down to check again.' : 'Add a cash expense with the + button.'}
          />
        ) : (
          <>
            <View>
              <SectionHeader title="Day by day" />
              <HeatCalendar month={month} byDay={summary.byDay} />
              {summary.avgPerDay > 0 ? (
                <Txt variant="small" color={p.muted} style={{ marginTop: space.sm }}>
                  You spend about {inr(summary.avgPerDay)} a day this month.
                </Txt>
              ) : null}
            </View>

            {summary.byCategory.length > 0 ? (
              <View>
                <SectionHeader title="Where it went" action="All insights" onAction={() => router.push('/insights')} />
                {summary.byCategory.slice(0, 5).map((s) => (
                  <CategoryRow
                    key={s.category}
                    category={s.category}
                    amount={s.amount}
                    share={s.share}
                    count={s.count}
                    onPress={() => router.push(`/category/${s.category}?month=${monthKey(month)}`)}
                  />
                ))}
              </View>
            ) : null}

            <View>
              <SectionHeader title="Latest" action="See all" onAction={() => router.push('/activity')} />
              {summary.txns.slice(0, 6).map((t) => (
                <TxnRow key={t.id} txn={t} showDate />
              ))}
            </View>
          </>
        )}

        {smsOn && stats.scanned > 0 ? (
          <View style={styles.trust}>
            <Icon name="shield-check-outline" size={18} color={p.leaf} />
            <Txt variant="small" color={p.muted} style={{ flex: 1 }}>
              Checked {stats.scanned.toLocaleString('en-IN')} messages and found {stats.kept.toLocaleString('en-IN')} payments.
              Skipped {skippedNoise.toLocaleString('en-IN')} OTPs, offers and reminders
              {stats.skipped.personal ? `, and ${stats.skipped.personal.toLocaleString('en-IN')} chats from people` : ''}.
            </Txt>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/add')}
        accessibilityRole="button"
        accessibilityLabel="Add a cash expense"
        style={({ pressed }) => [styles.fab, { backgroundColor: p.marigold, bottom: space.lg, opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon name="plus" size={28} color="#13232E" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notice: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  hero: { borderRadius: radius.lg, padding: space.xl, paddingTop: space.lg },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trust: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  fab: {
    position: 'absolute',
    right: space.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
