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
import type { Txn, TxnType } from '../lib/types';
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
  const [side, setSide] = useState<TxnType>('debit');
  // Fixed when the screen opens, so a person you just sorted stays in place instead of jumping away.
  const [openedAt] = useState(() => Date.now());

  const people = useMemo(() => {
    const since = openedAt - WINDOW_DAYS * 86_400_000;
    const map = new Map<string, Person>();
    for (const t of txns) {
      if (t.timestamp < since || !canHavePurpose(t)) continue;
      // Money in and money out are tagged apart (you lend to someone, they pay you back).
      const key = `${t.type}:${t.merchantKey}`;
      const hit = map.get(key);
      if (hit) {
        hit.count += 1;
        hit.total += t.amount;
        if (t.timestamp > hit.latest.timestamp) hit.latest = t;
      } else {
        map.set(key, { key, name: t.merchant, latest: t, count: 1, total: t.amount });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [txns, openedAt]);

  // Which people were still unsorted when you opened the screen: they stay listed while you sort them.
  const [todoKeys] = useState(() => new Set(people.filter((x) => !x.latest.purpose).map((x) => x.key)));
  const onSide = people.filter((x) => x.latest.type === side);
  const sorted = onSide.filter((x) => x.latest.purpose).length;
  const shown = show === 'todo' ? onSide.filter((x) => todoKeys.has(x.key)) : onSide;
  const paying = side === 'debit';

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
            {paying ? 'Who you pay' : 'Who pays you'}
          </Txt>
          <Txt variant="small" color={p.muted}>
            {paying
              ? 'Tell us what you pay each person for, like room rent, the cook, or money you lent. All their payments move to the right place. Lent money and loan repayments are not counted as spending.'
              : 'Tell us why each person paid you, like lent money coming back, a loan, or interest. Only real income is counted as money in.'}{' '}
            Last 6 months, biggest first.
          </Txt>
          <Segmented
            options={[
              { id: 'debit', label: 'You paid' },
              { id: 'credit', label: 'Paid you' },
            ]}
            value={side}
            onChange={setSide}
          />
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
          title={show === 'todo' ? 'Everyone is sorted' : paying ? 'No payments to people' : 'No money from people'}
          body={show === 'todo' ? 'Nice. New people will show up here.' : paying ? 'Money you send to a person will show up here.' : 'Money a person sends you will show up here.'}
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
