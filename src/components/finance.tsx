import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { addMonths, daysInMonth, isAfter, monthName, monthShort, sameMonth, thisMonth, timeLabel, type Month } from '../lib/analytics';
import { inr, inrCompact, percent } from '../lib/money';
import { cat, PAY_MODE_LABEL, type CategoryId, type Txn } from '../lib/types';
import { alpha, radius, space, usePalette } from '../theme';
import { Badge, Icon, ShareBar, Txt } from './ui';

/** One payment in a list. Tap opens its details. */
export function TxnRow({ txn, showDate }: { txn: Txn; showDate?: boolean }) {
  const p = usePalette();
  const c = cat(txn.category);
  const credit = txn.type === 'credit';
  const when = showDate
    ? new Date(txn.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : timeLabel(txn.timestamp);
  const sub = [c.label, txn.isManual ? 'Cash' : PAY_MODE_LABEL[txn.mode], when].join(', ');
  return (
    <Pressable
      onPress={() => router.push(`/txn/${txn.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${txn.merchant}, ${inr(txn.amount)}, ${c.label}`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Badge icon={c.icon} color={c.color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" numberOfLines={1} color={txn.excluded ? p.muted : p.ink}>
          {txn.merchant}
        </Txt>
        <Txt variant="small" color={p.muted} numberOfLines={1}>
          {sub}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt
          variant="bodyStrong"
          tabular
          color={txn.excluded ? p.muted : credit ? p.leaf : p.ink}
          style={txn.excluded ? { textDecorationLine: 'line-through' } : null}
        >
          {credit ? '+' : ''}
          {inr(txn.amount, { decimals: txn.amount < 100 })}
        </Txt>
        {txn.excluded ? (
          <Txt variant="tiny" color={p.muted}>
            Not counted
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** "‹  October 2026  ›" — the next arrow stops at the current month. */
export function MonthSwitcher({ month, onChange, light }: { month: Month; onChange: (m: Month) => void; light?: boolean }) {
  const p = usePalette();
  const color = light ? p.cardText : p.ink;
  const canNext = isAfter(thisMonth(), month);
  return (
    <View style={styles.switcher}>
      <Pressable onPress={() => onChange(addMonths(month, -1))} hitSlop={12} accessibilityLabel="Previous month">
        <Icon name="chevron-left" size={24} color={color} />
      </Pressable>
      <Txt variant="bodyStrong" color={color} style={{ minWidth: 140, textAlign: 'center' }}>
        {monthName(month)}
      </Txt>
      <Pressable
        onPress={() => canNext && onChange(addMonths(month, 1))}
        hitSlop={12}
        disabled={!canNext}
        accessibilityLabel="Next month"
        style={{ opacity: canNext ? 1 : 0.25 }}
      >
        <Icon name="chevron-right" size={24} color={color} />
      </Pressable>
    </View>
  );
}

/** One bar split into category colours, widest first. */
export function StackedBar({ slices, height = 12 }: { slices: { category: CategoryId; share: number }[]; height?: number }) {
  const shown = slices.filter((s) => s.share > 0.004);
  if (shown.length === 0) return <View style={{ height }} />;
  return (
    <View style={{ flexDirection: 'row', height, gap: 3 }}>
      {shown.map((s, i) => (
        <View
          key={s.category}
          style={{
            flex: s.share,
            backgroundColor: cat(s.category).color,
            borderTopLeftRadius: i === 0 ? height / 2 : 2,
            borderBottomLeftRadius: i === 0 ? height / 2 : 2,
            borderTopRightRadius: i === shown.length - 1 ? height / 2 : 2,
            borderBottomRightRadius: i === shown.length - 1 ? height / 2 : 2,
          }}
        />
      ))}
    </View>
  );
}

/**
 * The month as a calendar. Each day is shaded by how much you spent:
 * darker marigold = bigger day. Tap a day to see its payments.
 */
export function HeatCalendar({ month, byDay }: { month: Month; byDay: Record<number, number> }) {
  const p = usePalette();
  const total = daysInMonth(month);
  const firstWeekday = (new Date(month.year, month.month, 1).getDay() + 6) % 7; // Monday = 0
  const max = Math.max(0, ...Object.values(byDay));
  const today = new Date();
  const isCurrent = sameMonth(month, thisMonth());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const level = (amt: number) => {
    if (amt <= 0 || max <= 0) return 0;
    // Square root keeps one huge day from washing out all the others.
    return 0.18 + 0.82 * Math.sqrt(amt / max);
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.weekRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Txt key={i} variant="tiny" color={p.muted} style={styles.weekLabel}>
            {d}
          </Txt>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={styles.cell} />;
            const amt = byDay[day] ?? 0;
            const lv = level(amt);
            const future = isCurrent && day > today.getDate();
            const isToday = isCurrent && day === today.getDate();
            const dateKey = `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return (
              <Pressable
                key={di}
                disabled={future}
                onPress={() => router.push(`/day/${dateKey}`)}
                accessibilityLabel={`${day} ${monthShort(month)}, ${amt > 0 ? inr(amt) + ' spent' : 'no spending'}`}
                style={[
                  styles.cell,
                  styles.cellBox,
                  {
                    backgroundColor: lv > 0 ? alpha(p.marigold, lv) : p.heatEmpty,
                    opacity: future ? 0.35 : 1,
                    borderWidth: isToday ? 2 : 0,
                    borderColor: p.ink,
                  },
                ]}
              >
                <Txt variant="tiny" color={lv > 0.62 ? '#13232E' : lv > 0 ? p.ink : p.muted}>
                  {day}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <Txt variant="tiny" color={p.muted}>
          Less
        </Txt>
        {[0, 0.3, 0.55, 0.8, 1].map((lv) => (
          <View
            key={lv}
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: lv === 0 ? p.heatEmpty : alpha(p.marigold, lv),
            }}
          />
        ))}
        <Txt variant="tiny" color={p.muted}>
          More
        </Txt>
      </View>
    </View>
  );
}

/** Category with amount, share bar and optional change vs last month. */
export function CategoryRow({
  category,
  amount,
  share,
  count,
  change,
  onPress,
}: {
  category: CategoryId;
  amount: number;
  share: number;
  count: number;
  change?: number | null;
  onPress?: () => void;
}) {
  const p = usePalette();
  const c = cat(category);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.catRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Badge icon={c.icon} color={c.color} size={36} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.between}>
          <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {c.label}
          </Txt>
          <Txt variant="bodyStrong" tabular>
            {inr(amount)}
          </Txt>
        </View>
        <ShareBar share={share} color={c.color} />
        <View style={styles.between}>
          <Txt variant="tiny" color={p.muted}>
            {percent(share)} of spending, {count} {count === 1 ? 'payment' : 'payments'}
          </Txt>
          {change != null && Math.abs(change) >= 1 ? (
            <Txt variant="tiny" color={change > 0 ? p.chili : p.leaf}>
              {change > 0 ? '↑ ' : '↓ '}
              {inrCompact(Math.abs(change))} vs last month
            </Txt>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Simple vertical bars. The selected bar is marigold, the rest are quiet. */
export function Bars({
  data,
  selected,
  onSelect,
  height = 120,
}: {
  data: { label: string; value: number }[];
  selected?: number;
  onSelect?: (index: number) => void;
  height?: number;
}) {
  const p = usePalette();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {data.map((d, i) => {
        const active = selected === i;
        const h = d.value > 0 ? Math.max(4, (d.value / max) * height) : 2;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect?.(i)}
            disabled={!onSelect}
            style={{ flex: 1, alignItems: 'center', gap: 6 }}
            accessibilityLabel={`${d.label}: ${inr(d.value)}`}
          >
            <Txt variant="tiny" color={active ? p.ink : p.muted} numberOfLines={1}>
              {d.value > 0 ? inrCompact(d.value) : ''}
            </Txt>
            <View
              style={{
                width: '100%',
                height: h,
                borderRadius: 6,
                backgroundColor: active ? p.marigold : alpha(p.muted, 0.28),
              }}
            />
            <Txt variant="tiny" color={active ? p.ink : p.muted}>
              {d.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  weekRow: { flexDirection: 'row', gap: 6 },
  weekLabel: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, aspectRatio: 1.3 },
  cellBox: { borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  catRow: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
});
