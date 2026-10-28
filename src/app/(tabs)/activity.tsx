import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthSwitcher, TxnRow } from '../../components/finance';
import { Chip, Empty, Icon, Txt } from '../../components/ui';
import { needsReview, payGroupOf, payLabel } from '../../lib/accounts';
import { dateKey, dayLabel, monthOf, monthShort, sameMonth } from '../../lib/analytics';
import { inr } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, countsAsIncome, countsAsSaving, countsAsSpend, type Txn } from '../../lib/types';
import { fonts, radius, space, usePalette } from '../../theme';

type Filter = 'all' | 'spent' | 'income' | 'upi' | 'card' | 'cash' | 'review' | 'not_counted';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'spent', label: 'Spent' },
  { id: 'income', label: 'Income' },
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Cards' },
  { id: 'cash', label: 'Cash' },
  { id: 'review', label: 'Needs a look' },
  { id: 'not_counted', label: 'Not counted' },
];

const isFilter = (v: unknown): v is Filter => FILTERS.some((f) => f.id === v);

function matches(t: Txn, f: Filter): boolean {
  switch (f) {
    case 'spent':
      return countsAsSpend(t);
    case 'income':
      return countsAsIncome(t);
    case 'upi':
    case 'card':
    case 'cash':
      return payGroupOf(t) === f && t.type === 'debit';
    case 'review':
      return needsReview(t);
    case 'not_counted':
      return t.type === 'debit' ? !countsAsSpend(t) && !countsAsSaving(t) : !countsAsIncome(t);
    default:
      return true;
  }
}

/** Every payment, newest first, grouped by day. Filters answer "what did I put on my card?" in one tap. */
export default function Activity() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { txns, refresh, refreshing, permission, month, setMonth } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(isFilter(params.filter) ? params.filter : 'all');

  // Home's "Needs a look" (and Insights) open this tab with a filter. Follow it when it changes.
  const [seenParam, setSeenParam] = useState(params.filter);
  if (params.filter !== seenParam) {
    setSeenParam(params.filter);
    if (isFilter(params.filter)) setFilter(params.filter);
  }

  const inMonth = useMemo(() => txns.filter((t) => sameMonth(monthOf(t.timestamp), month)), [txns, month]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inMonth.filter((t) => {
      if (!matches(t, filter)) return false;
      if (!q) return true;
      return (
        t.merchant.toLowerCase().includes(q) ||
        cat(t.category).label.toLowerCase().includes(q) ||
        String(Math.round(t.amount)).includes(q) ||
        payLabel(t).toLowerCase().includes(q) ||
        (t.note ?? '').toLowerCase().includes(q) ||
        (t.bank ?? '').toLowerCase().includes(q)
      );
    });
  }, [inMonth, query, filter]);

  const sections = useMemo(() => {
    const groups = new Map<string, Txn[]>();
    for (const t of list) {
      const k = dateKey(t.timestamp);
      const g = groups.get(k);
      if (g) g.push(t);
      else groups.set(k, [t]);
    }
    return [...groups.entries()].map(([key, data]) => ({
      key,
      title: dayLabel(data[0].timestamp),
      spent: data.filter(countsAsSpend).reduce((a, t) => a + t.amount, 0),
      data,
    }));
  }, [list]);

  const total = useMemo(() => {
    const incomeView = filter === 'income';
    const counted = list.filter(incomeView ? countsAsIncome : filter === 'not_counted' || filter === 'review' ? () => true : countsAsSpend);
    return { amount: counted.reduce((a, t) => a + t.amount, 0), count: list.length };
  }, [list, filter]);

  const label = FILTERS.find((f) => f.id === filter)?.label ?? 'All';
  const totalTitle =
    filter === 'all' || filter === 'spent' ? `Spent in ${monthShort(month)}` : filter === 'income' ? `Income in ${monthShort(month)}` : `${label} in ${monthShort(month)}`;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + space.md }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm }}>
        <View style={styles.titleRow}>
          <Txt variant="title" accessibilityRole="header">
            Activity
          </Txt>
          <MonthSwitcher month={month} onChange={setMonth} compact />
        </View>
        <View style={[styles.search, { backgroundColor: p.surface, borderColor: p.line }]}>
          <Icon name="magnify" size={20} color={p.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search shop, amount, card or note"
            accessibilityLabel="Search payments"
            placeholderTextColor={p.muted}
            style={[styles.input, { color: p.ink }]}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close" size={18} color={p.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
        refreshControl={
          permission === 'granted' ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accent} colors={[p.accent]} /> : undefined
        }
        ListHeaderComponent={
          list.length > 0 ? (
            <View style={[styles.total, { backgroundColor: p.surface, borderColor: p.line }]} accessible accessibilityLabel={`${totalTitle}: ${inr(total.amount)}, ${total.count} payments`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="small" color={p.muted}>
                  {totalTitle}
                </Txt>
                <Txt variant="smallStrong">
                  {total.count} {total.count === 1 ? 'payment' : 'payments'}
                </Txt>
              </View>
              <Txt variant="amount" tabular color={filter === 'income' ? p.income : p.ink}>
                {inr(total.amount)}
              </Txt>
            </View>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.dayHeader, { backgroundColor: p.bg, borderBottomColor: p.line }]}>
            <Txt variant="smallStrong">{section.title}</Txt>
            {section.spent > 0 ? (
              <Txt variant="small" color={p.muted} tabular>
                {inr(section.spent)} spent
              </Txt>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => <TxnRow txn={item} />}
        renderSectionFooter={({ section }) =>
          section.data.some((t) => t.category === 'card_bill' && t.type === 'debit') && filter !== 'spent' ? (
            <Txt variant="tiny" color={p.muted} style={{ paddingBottom: space.sm }}>
              Card bills aren&apos;t counted again, because each card spend already was.
            </Txt>
          ) : null
        }
        ListEmptyComponent={
          <Empty
            icon={filter === 'review' ? 'check-decagram-outline' : 'magnify'}
            title={filter === 'review' ? 'All sorted' : query || filter !== 'all' ? 'No matches' : 'No payments yet'}
            body={
              filter === 'review'
                ? `Nothing to check for ${monthShort(month)}.`
                : query || filter !== 'all'
                  ? 'Try another word, another filter or another month.'
                  : 'Bank alerts will show up here as they arrive.'
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    height: 46,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
  chips: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md + 2,
    marginTop: space.xs,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
