import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TxnRow } from '../../components/finance';
import { Chip, Empty, Icon, Txt } from '../../components/ui';
import { dateKey, dayLabel } from '../../lib/analytics';
import { inr } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, countsAsIncome, countsAsSpend, type Txn } from '../../lib/types';
import { fonts, radius, space, usePalette } from '../../theme';

type Filter = 'all' | 'spent' | 'received' | 'not_counted';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'spent', label: 'Spent' },
  { id: 'received', label: 'Received' },
  { id: 'not_counted', label: 'Not counted' },
];

export default function Activity() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, refresh, refreshing, permission } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = txns.filter((t) => {
      if (filter === 'spent' && t.type !== 'debit') return false;
      if (filter === 'received' && t.type !== 'credit') return false;
      if (filter === 'not_counted' && (t.type === 'debit' ? countsAsSpend(t) : countsAsIncome(t))) return false;
      if (!q) return true;
      return (
        t.merchant.toLowerCase().includes(q) ||
        cat(t.category).label.toLowerCase().includes(q) ||
        String(Math.round(t.amount)).includes(q) ||
        (t.bank ?? '').toLowerCase().includes(q)
      );
    });
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
  }, [txns, query, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + space.md }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm }}>
        <Txt variant="title">Activity</Txt>
        <View style={[styles.search, { backgroundColor: p.surface, borderColor: p.line }]}>
          <Icon name="magnify" size={20} color={p.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search shop, category or amount"
            placeholderTextColor={p.muted}
            style={[styles.input, { color: p.ink }]}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <Icon name="close" size={18} color={p.muted} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 100 }}
        refreshControl={
          permission === 'granted' ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.marigold} colors={[p.marigold]} />
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.dayHeader, { backgroundColor: p.bg, borderBottomColor: p.line }]}>
            <Txt variant="smallStrong" color={p.inkSoft}>
              {section.title}
            </Txt>
            {section.spent > 0 ? (
              <Txt variant="smallStrong" color={p.muted} tabular>
                {inr(section.spent)}
              </Txt>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => <TxnRow txn={item} />}
        ListEmptyComponent={
          <Empty
            icon="magnify"
            title={query || filter !== 'all' ? 'No matches' : 'No payments yet'}
            body={query || filter !== 'all' ? 'Try another word or clear the filter.' : 'Bank alerts will show up here as they arrive.'}
          />
        }
      />

      <Pressable
        onPress={() => router.push('/add')}
        accessibilityRole="button"
        accessibilityLabel="Add a cash expense"
        style={({ pressed }) => [styles.fab, { backgroundColor: p.marigold, opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon name="plus" size={28} color="#13232E" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    height: 46,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 0 },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
