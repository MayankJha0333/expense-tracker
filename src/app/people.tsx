import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurposePicker } from '../components/PurposePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import { Empty, Segmented, Tag, Txt } from '../components/ui';
import { money } from '../lib/money';
import { canHavePurpose, purpose } from '../lib/purposes';
import { useStore } from '../lib/store';
import type { Txn } from '../lib/types';
import { space, usePalette } from '../theme';

/** How far back to look for people you pay. */
const WINDOW_DAYS = 180;

type Person = { key: string; name: string; latest: Txn; count: number; total: number };

/**
 * Everyone you sent money to, biggest first, with "Room rent", "Cook", "Family"...
 * to pick from. One tap moves all their payments into the right category.
 */
export default function PeopleScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns } = useStore();
  const [show, setShow] = useState<'todo' | 'all'>('todo');
  // Fixed when the screen opens, so a person you just sorted stays in place instead of jumping away.
  const [openedAt] = useState(() => Date.now());

  const people = useMemo(() => {
    const since = openedAt - WINDOW_DAYS * 86_400_000;
    const map = new Map<string, Person>();
    for (const t of txns) {
      if (t.timestamp < since || !canHavePurpose(t)) continue;
      const hit = map.get(t.merchantKey);
      if (hit) {
        hit.count += 1;
        hit.total += t.amount;
        if (t.timestamp > hit.latest.timestamp) hit.latest = t;
      } else {
        map.set(t.merchantKey, { key: t.merchantKey, name: t.merchant, latest: t, count: 1, total: t.amount });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [txns, openedAt]);

  // Which people were still unsorted when you opened the screen: they stay listed while you sort them.
  const [todoKeys] = useState(() => new Set(people.filter((x) => !x.latest.purpose).map((x) => x.key)));
  const sorted = people.filter((x) => x.latest.purpose).length;
  const shown = show === 'todo' ? people.filter((x) => todoKeys.has(x.key)) : people;

  return (
    <FlatList
      style={{ backgroundColor: p.bg }}
      data={shown}
      keyExtractor={(x) => x.key}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.md }}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingBottom: space.sm }}>
          <ScreenHeader />
          <Txt variant="title" accessibilityRole="header">
            Who you pay
          </Txt>
          <Txt variant="small" color={p.muted}>
            Money sent to a person shows as &quot;Sent to people&quot;. Tell us what it is for, like room rent or the cook, and all their payments move to the
            right place. Last 6 months, biggest first.
          </Txt>
          <Segmented
            options={[
              { id: 'todo', label: 'To sort' },
              { id: 'all', label: `All · ${sorted} sorted` },
            ]}
            value={show}
            onChange={setShow}
          />
        </View>
      }
      ListEmptyComponent={
        <Empty
          icon="account-check-outline"
          title={show === 'todo' ? 'Everyone is sorted' : 'No payments to people'}
          body={show === 'todo' ? 'Nice. New people you pay will show up here.' : 'Money you send to a person will show up here.'}
        />
      }
      renderItem={({ item }) => <PersonRow person={item} />}
    />
  );
}

function PersonRow({ person }: { person: Person }) {
  const p = usePalette();
  const tag = person.latest.purpose ? purpose(person.latest.purpose) : null;
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Pressable
        onPress={() => router.push(`/txn/${person.latest.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${person.name}, ${person.count} ${person.count === 1 ? 'payment' : 'payments'}, ${money(person.total)}${tag ? `, ${tag.label}` : ''}. Opens the latest payment.`}
        style={styles.head}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {person.name}
          </Txt>
          <Txt variant="small" color={p.muted}>
            {person.count} {person.count === 1 ? 'payment' : 'payments'} · {money(person.total)}
          </Txt>
        </View>
        {tag ? <Tag label={tag.label} icon={tag.icon} color={p.accent} /> : null}
      </Pressable>
      <PurposePicker txn={person.latest} row />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: space.md, paddingLeft: space.md, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingRight: space.md },
});
