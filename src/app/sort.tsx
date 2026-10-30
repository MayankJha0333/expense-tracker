import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroCard } from '../components/HeroCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { TxnRow } from '../components/finance';
import { Badge, Card, Chip, Empty, Icon, SectionHeader, ShareBar, Txt } from '../components/ui';
import { shortDay } from '../lib/analytics';
import { formatCount, money } from '../lib/money';
import { otherGroups, rankPicks, usedMost, type OtherGroup } from '../lib/sortOther';
import { useStore } from '../lib/store';
import { cat, type CategoryId } from '../lib/types';
import { alpha, radius, space, usePalette } from '../theme';

/** Chips shown before "More". */
const FIRST_PICKS = 3;
/** Payments with no shop name listed here; the rest are in Activity. */
const UNNAMED_SHOWN = 30;

/**
 * Payments Kharcha could only file under "Other", grouped by shop. Pick a category once and every
 * payment to that shop moves, now and from then on. The likeliest categories come first: a guess
 * from the shop's name, then the ones you use most. Payments with no shop name in the SMS
 * ("UPI payment") are listed one by one at the end: a rule can't tell them apart.
 */
export default function SortOtherScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, setCategory } = useStore();
  // The shops as they were when the screen opened. A shop you sort stays in place with its new
  // category instead of jumping out of the list.
  const [opened] = useState(() => otherGroups(txns));
  const [mostUsed] = useState(() => usedMost(txns));
  const { unnamed } = useMemo(() => otherGroups(txns), [txns]);
  const listed = opened.groups;
  const [done, setDone] = useState<Record<string, CategoryId>>({});

  const total = useMemo(() => listed.reduce((a, g) => a + g.total, 0), [listed]);
  const payments = useMemo(() => listed.reduce((a, g) => a + g.count, 0), [listed]);
  const sortedCount = Object.keys(done).length;
  const sortedTotal = listed.reduce((a, g) => (done[g.key] ? a + g.total : a), 0);

  const pick = (g: OtherGroup, c: CategoryId) => {
    Haptics.selectionAsync().catch(() => {});
    setDone((d) => ({ ...d, [g.key]: c }));
    setCategory(g.latest, c, true);
  };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.xs }}>
      <View style={styles.topRow}>
        <ScreenHeader />
        {listed.length ? (
          <View style={[styles.countPill, { backgroundColor: sortedCount ? alpha(p.income, 0.14) : p.surface, borderColor: sortedCount ? 'transparent' : p.line }]}>
            <Icon name={sortedCount ? 'check-circle' : 'tray-full'} size={16} color={sortedCount ? p.income : p.muted} />
            <Txt variant="smallStrong" color={sortedCount ? p.income : p.inkSoft} tabular>
              {formatCount(sortedCount)} of {formatCount(listed.length)} sorted
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={{ gap: space.xs }}>
        <Txt variant="title" accessibilityRole="header">
          Sort &ldquo;Other&rdquo;
        </Txt>
        <Txt variant="small" color={p.muted}>
          Pick a category once. Every payment to that shop moves, and new ones go there too.
        </Txt>
      </View>

      {listed.length ? (
        <HeroCard
          accessibilityLabel={`${money(total - sortedTotal)} left in Other across ${listed.length} shops and ${payments} payments. ${money(sortedTotal)} sorted so far.`}
          style={{ marginTop: space.xs }}
        >
          <Txt variant="smallStrong" color={p.heroText}>
            {sortedTotal ? 'Left in Other' : 'Waiting in Other'}
          </Txt>
          <Txt variant="display" color={p.heroValue} tabular>
            {money(total - sortedTotal)}
          </Txt>
          <Txt variant="small" color={p.heroMuted}>
            {formatCount(listed.length)} {listed.length === 1 ? 'shop' : 'shops'} · {formatCount(payments)} {payments === 1 ? 'payment' : 'payments'}
            {unnamed.length ? ` · ${formatCount(unnamed.length)} with no shop name` : ''}
          </Txt>
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            <ShareBar share={total ? sortedTotal / total : 0} color={p.heroBar} track={p.heroTrack} height={8} />
            <Txt variant="small" color={p.heroMuted}>
              {sortedTotal ? `${money(sortedTotal)} sorted so far` : 'Biggest shops are at the top. Start there.'}
            </Txt>
          </View>
        </HeroCard>
      ) : null}

      {listed.length ? <SectionHeader title="Shops" subtitle="Tap a shop to see its latest payment" /> : null}
    </View>
  );

  const footer =
    unnamed.length > 0 ? (
      <View style={{ paddingTop: listed.length ? space.lg : 0 }}>
        <SectionHeader
          title={`No shop name · ${formatCount(unnamed.length)}`}
          subtitle="The bank SMS didn't say who was paid, so sort these one at a time."
          action={unnamed.length > UNNAMED_SHOWN ? 'See all' : undefined}
          onAction={() => router.navigate({ pathname: '/activity', params: { filter: 'review' } })}
        />
        <Card style={{ paddingVertical: space.xs }}>
          {unnamed.slice(0, UNNAMED_SHOWN).map((t) => (
            <TxnRow key={t.id} txn={t} showDate />
          ))}
        </Card>
      </View>
    ) : undefined;

  return (
    <FlatList
      style={{ backgroundColor: p.bg }}
      data={listed}
      keyExtractor={(g) => g.key}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.md }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        unnamed.length === 0 ? <Empty icon="check-decagram-outline" title="All sorted" body="Nothing is left in Other. New shops will show up here." /> : undefined
      }
      renderItem={({ item }) => <ShopRow group={item} share={total ? item.total / total : 0} mostUsed={mostUsed} picked={done[item.key]} onPick={(c) => pick(item, c)} />}
      ListFooterComponent={footer}
      initialNumToRender={8}
      windowSize={7}
    />
  );
}

function initials(name: string): string {
  const words = name.replace(/^(mr|mrs|ms|shri|smt)\.?\s+/i, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

function ShopRow({
  group,
  share,
  mostUsed,
  picked,
  onPick,
}: {
  group: OtherGroup;
  /** This shop's part of everything in Other, 0..1. */
  share: number;
  mostUsed: CategoryId[];
  picked?: CategoryId;
  onPick: (c: CategoryId) => void;
}) {
  const p = usePalette();
  const lastTap = useRef(0);
  const [more, setMore] = useState(false);
  const [changing, setChanging] = useState(false);
  const { order, guessed } = useMemo(() => rankPicks(group.name, mostUsed), [group.name, mostUsed]);
  const guess = guessed ? cat(order[0]) : null;
  const c = picked ? cat(picked) : null;
  const choose = (id: CategoryId) => {
    // Moving every payment takes a moment on big inboxes; ignore a quick second tap.
    const now = new Date().getTime();
    if (now - lastTap.current < 800) return;
    lastTap.current = now;
    setMore(false);
    setChanging(false);
    onPick(id);
  };
  const showPicker = !c || changing;
  const shown = more ? order : order.slice(0, FIRST_PICKS);
  const plural = group.count === 1 ? 'payment' : 'payments';

  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: c ? alpha(c.color, 0.45) : p.line, boxShadow: p.shadowCard }]}>
      <Pressable
        onPress={() => router.push(`/txn/${group.latest.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, ${group.count} ${plural}, ${money(group.total)}${c ? `, moved to ${c.label}` : ''}. Opens the latest payment.`}
        style={({ pressed }) => [styles.head, { opacity: pressed ? 0.7 : 1 }]}
      >
        {c ? (
          <Badge icon={c.icon} color={c.color} size={42} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: guess ? alpha(guess.color, 0.14) : p.surfaceAlt }]}>
            <Txt variant="smallStrong" color={guess ? guess.color : p.inkSoft}>
              {initials(group.name)}
            </Txt>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {group.name}
          </Txt>
          <Txt variant="small" color={c ? c.color : p.muted} numberOfLines={1}>
            {c ? `Now in ${c.label}` : `${group.count} ${plural} · last ${shortDay(group.latest.timestamp)}`}
          </Txt>
        </View>
        <Txt variant="bodyStrong" tabular style={{ flexShrink: 0 }}>
          {money(group.total)}
        </Txt>
      </Pressable>

      {!c ? <ShareBar share={share} color={guess ? guess.color : p.muted} height={4} /> : null}

      {showPicker ? (
        <View style={{ gap: space.sm }}>
          {guess && !changing ? (
            <Txt variant="tiny" color={p.muted}>
              Looks like {guess.label.toLowerCase()}
            </Txt>
          ) : null}
          <View style={styles.chips}>
            {shown.map((id, i) => {
              const x = cat(id);
              return (
                <Chip
                  key={id}
                  label={x.label}
                  icon={x.icon}
                  color={x.color}
                  selected={(i < guessed && !changing) || id === picked}
                  onPress={() => choose(id)}
                  a11y={`Move every ${group.name} payment to ${x.label}`}
                />
              );
            })}
            <Pressable
              onPress={() => setMore((m) => !m)}
              accessibilityRole="button"
              accessibilityLabel={more ? 'Show fewer categories' : `Show all ${order.length} categories`}
              style={[styles.moreChip, { borderColor: p.line }]}
            >
              <Txt variant="smallStrong" color={p.accentInk}>
                {more ? 'Less' : `More · ${order.length - FIRST_PICKS}`}
              </Txt>
              <Icon name={more ? 'chevron-up' : 'chevron-down'} size={16} color={p.accentInk} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setChanging(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Change category for ${group.name}`} style={styles.change}>
          <Icon name="pencil-outline" size={14} color={p.accentInk} />
          <Txt variant="smallStrong" color={p.accentInk}>
            Change
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { borderRadius: radius.md + 4, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 42, height: 42, borderRadius: 42 * 0.32, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  moreChip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed' },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
});
