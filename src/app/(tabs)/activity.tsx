import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarSpace } from '../../components/tabBarSpace';
import { AnimatedAmount } from '../../components/AnimatedAmount';
import { MonthSwitcher, TxnRow } from '../../components/finance';
import { enterFade } from '../../components/motion';
import { Chip, Empty, Icon, Txt } from '../../components/ui';
import { needsReview, payGroupOf, payLabel } from '../../lib/accounts';
import { dateKey, dayLabel, monthKey, monthOf, monthShort, sameMonth } from '../../lib/analytics';
import { currencyOf, inHome, type CurrencyCode } from '../../lib/currency';
import { money } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, countsAsIncome, countsAsSaving, countsAsSpend, isForeign, type Txn } from '../../lib/types';
import { fonts, radius, space, usePalette } from '../../theme';

type Filter = 'all' | 'spent' | 'income' | 'upi' | 'card' | 'cash' | 'review' | 'not_counted' | 'foreign';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'spent', label: 'Spent' },
  { id: 'income', label: 'Income' },
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Cards' },
  { id: 'cash', label: 'Cash' },
  { id: 'review', label: 'Needs a look' },
  { id: 'not_counted', label: 'Not counted' },
  // Only shown when the month has payments in another currency.
  { id: 'foreign', label: 'Other currencies' },
];

/** "$1,314.99 · €12.50", biggest count first. Never adds different currencies together. */
function perCurrency(list: Txn[]): string {
  const sums = new Map<CurrencyCode, number>();
  for (const t of list) sums.set(currencyOf(t), (sums.get(currencyOf(t)) ?? 0) + t.amount);
  return [...sums].map(([c, v]) => money(v, { currency: c })).join(' · ');
}

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
      // Other currencies have their own filter; here it means "left out on purpose".
      if (isForeign(t)) return false;
      return t.type === 'debit' ? !countsAsSpend(t) && !countsAsSaving(t) : !countsAsIncome(t);
    case 'foreign':
      return isForeign(t);
    default:
      return true;
  }
}

/** Every payment, newest first, grouped by day. Filters answer "what did I put on my card?" in one tap. */
export default function Activity() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
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
    // Only add up payments in the home currency; other currencies get their own line.
    const counted = list.filter(incomeView ? countsAsIncome : filter === 'not_counted' || filter === 'review' ? inHome : countsAsSpend);
    const foreign = list.filter(isForeign);
    return {
      amount: counted.reduce((a, t) => a + t.amount, 0),
      count: list.length,
      text: filter === 'foreign' ? perCurrency(foreign) : money(counted.reduce((a, t) => a + t.amount, 0)),
    };
  }, [list, filter]);
  const hasForeign = useMemo(() => inMonth.some(isForeign), [inMonth]);
  // Hide filters that can't match anything this month (no UPI in the US, no foreign payments...).
  const filters = FILTERS.filter((f) => {
    if (f.id === filter || f.id === 'all' || f.id === 'spent' || f.id === 'income') return true;
    if (f.id === 'foreign') return hasForeign;
    return inMonth.some((t) => matches(t, f.id));
  });
  // A filter opened from another screen can sit off-screen in the chip row; bring it next to "All".
  if (filter !== 'all') {
    const i = filters.findIndex((f) => f.id === filter);
    if (i > 1) filters.splice(1, 0, ...filters.splice(i, 1));
  }

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
          {filters.map((f) => (
            <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>
      </View>

      {/* A new filter or month swaps the list with a quick crossfade instead of a hard cut. */}
      <Animated.View key={`${filter}-${monthKey(month)}`} entering={enterFade} style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: tabSpace }}
        refreshControl={
          permission === 'granted' ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accent} colors={[p.accent]} /> : undefined
        }
        ListHeaderComponent={
          list.length > 0 ? (
            <View style={[styles.total, { backgroundColor: p.surface, borderColor: p.line }]} accessible accessibilityLabel={`${totalTitle}: ${total.text}, ${total.count} ${total.count === 1 ? 'payment' : 'payments'}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="small" color={p.muted}>
                  {totalTitle}
                </Txt>
                <Txt variant="smallStrong">
                  {total.count} {total.count === 1 ? 'payment' : 'payments'}
                </Txt>
              </View>
              <Txt
                variant="amount"
                tabular
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                color={filter === 'income' ? p.income : p.ink}
                style={{ flexShrink: 1, maxWidth: '62%', textAlign: 'right' }}
              >
                {filter === 'foreign' ? total.text : <AnimatedAmount value={total.amount} format={(v) => money(v)} variant="amount" tabular />}
              </Txt>
            </View>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.dayHeader, { backgroundColor: p.bg, borderBottomColor: p.line }]}>
            <Txt variant="smallStrong">{section.title}</Txt>
            {section.spent > 0 ? (
              <Txt variant="small" color={p.muted} tabular>
                {money(section.spent)} spent
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
      </Animated.View>
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
