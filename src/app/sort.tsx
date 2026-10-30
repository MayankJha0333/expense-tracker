import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { TxnRow } from '../components/finance';
import { Card, Chip, Empty, Tag, Txt } from '../components/ui';
import { otherGroups, type OtherGroup } from '../lib/sortOther';
import { money } from '../lib/money';
import { useStore } from '../lib/store';
import { cat, DEBIT_CATEGORIES, type CategoryId } from '../lib/types';
import { space, usePalette } from '../theme';

/** Categories offered for a shop, most common first. "Other" is where these payments already are. */
const PICKS = DEBIT_CATEGORIES.filter((c) => c.id !== 'other' && c.id !== 'card_bill' && c.id !== 'self_transfer');

/**
 * Payments Kharcha could only file under "Other", grouped by shop. Pick a category once and every
 * payment to that shop moves, now and from then on. Payments with no shop name in the SMS
 * ("UPI payment") are listed one by one at the end: a rule can't tell them apart.
 */
export default function SortOtherScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, setCategory } = useStore();
  const { groups, unnamed } = useMemo(() => otherGroups(txns), [txns]);
  // The shops as they were when the screen opened. A shop you sort stays in place with its new
  // category instead of jumping out of the list.
  const [listed] = useState(groups);
  const [done, setDone] = useState<Record<string, CategoryId>>({});
  const sortedHere = Object.keys(done).length;
  const pick = (g: OtherGroup, c: CategoryId) => {
    Haptics.selectionAsync().catch(() => {});
    setDone((d) => ({ ...d, [g.key]: c }));
    setCategory(g.latest, c, true);
  };

  return (
    <FlatList
      style={{ backgroundColor: p.bg }}
      data={listed}
      keyExtractor={(g) => g.key}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.md }}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingBottom: space.sm }}>
          <ScreenHeader />
          <Txt variant="title" accessibilityRole="header">
            Sort &ldquo;Other&rdquo;
          </Txt>
          <Txt variant="small" color={p.muted}>
            Shops Kharcha couldn&apos;t place, biggest first. Pick a category once: every payment to that shop moves, and new ones go there too.
          </Txt>
          {sortedHere > 0 ? (
            <Txt variant="smallStrong" color={p.income}>
              {sortedHere} {sortedHere === 1 ? 'shop' : 'shops'} sorted
            </Txt>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        unnamed.length === 0 ? <Empty icon="check-decagram-outline" title="All sorted" body="Nothing is left in Other. New shops will show up here." /> : undefined
      }
      renderItem={({ item }) => <ShopRow group={item} picked={done[item.key]} onPick={(c) => pick(item, c)} />}
      ListFooterComponent={
        unnamed.length > 0 ? (
          <View style={{ gap: space.md, paddingTop: listed.length ? space.lg : 0 }}>
            <Txt variant="heading">No shop name ({unnamed.length})</Txt>
            <Txt variant="small" color={p.muted}>
              The bank message didn&apos;t say who was paid, so these have to be sorted one at a time. Tap one to open it.
            </Txt>
            <Card style={{ paddingVertical: space.xs }}>
              {unnamed.slice(0, 50).map((t) => (
                <TxnRow key={t.id} txn={t} showDate />
              ))}
            </Card>
            {unnamed.length > 50 ? (
              <Pressable onPress={() => router.navigate({ pathname: '/activity', params: { filter: 'review' } })} accessibilityRole="button">
                <Txt variant="smallStrong" color={p.accentInk}>
                  See all {unnamed.length} in Activity
                </Txt>
              </Pressable>
            ) : null}
          </View>
        ) : undefined
      }
    />
  );
}

function ShopRow({ group, picked, onPick }: { group: OtherGroup; picked?: CategoryId; onPick: (c: CategoryId) => void }) {
  const p = usePalette();
  const lastTap = useRef(0);
  const c = picked ? cat(picked) : null;
  const pick = (id: CategoryId) => {
    // Moving every payment takes a moment on big inboxes; ignore a quick second tap.
    const now = new Date().getTime();
    if (now - lastTap.current < 800) return;
    lastTap.current = now;
    onPick(id);
  };
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Pressable
        onPress={() => router.push(`/txn/${group.latest.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, ${group.count} ${group.count === 1 ? 'payment' : 'payments'}, ${money(group.total)}${c ? `, now ${c.label}` : ''}. Opens the latest payment.`}
        style={styles.head}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {group.name}
          </Txt>
          <Txt variant="small" color={p.muted}>
            {group.count} {group.count === 1 ? 'payment' : 'payments'} · {money(group.total)}
          </Txt>
        </View>
        {c ? <Tag label={c.label} icon={c.icon} color={c.color} /> : null}
      </Pressable>
      {picked ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {PICKS.map((x) => (
            <Chip key={x.id} label={x.label} icon={x.icon} color={x.color} selected={false} onPress={() => pick(x.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: space.md, paddingLeft: space.md, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingRight: space.md },
  row: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
});
