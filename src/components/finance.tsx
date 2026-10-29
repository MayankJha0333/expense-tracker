import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { needsReview, payLabel, type CardDue } from '../lib/accounts';
import { kindLabel } from '../lib/purposes';
import { addMonths, dateKey as toDateKey, dayOfMonth, daysInMonth, getMonthStart, isAfter, monthKey, monthName, monthShort, monthStartDate, sameMonth, shortDay, thisMonth, timeLabel, type Month } from '../lib/analytics';
import { currencyOf } from '../lib/currency';
import { money, moneyCompact, percent } from '../lib/money';
import { cat, countsAsIncome, countsAsSaving, countsAsSpend, isForeign, shownAmount, type CategoryId, type Txn } from '../lib/types';
import { alpha, radius, space, usePalette, type Palette } from '../theme';
import { GrowBar } from './charts';
import { enterFade, PressScale } from './motion';
import { Badge, Icon, MixBar, PayBadge, ShareBar, Txt } from './ui';

const shortDate = (ts: number) => shortDay(ts);

/** One line about a credit card bill: what's left, when it's due, or that it's paid. */
export function billLine(due: CardDue, p: Palette): { text: string; color: string; bg: string } {
  const dateText = due.bill.dueDate ? shortDate(due.bill.dueDate) : null;
  if (due.status === 'paid') {
    return { text: `Bill of ${money(due.bill.amountDue)} paid`, color: p.income, bg: p.incomeSoft };
  }
  if (due.status === 'overdue') {
    const late = due.daysLeft !== null ? -due.daysLeft : 0;
    return { text: `${money(due.left)} overdue · ${late} ${late === 1 ? 'day' : 'days'} late`, color: p.danger, bg: p.dangerSoft };
  }
  const days = due.daysLeft;
  const when = dateText ? ` · due ${dateText}${days !== null ? (days === 0 ? ' · today' : ` · ${days} ${days === 1 ? 'day' : 'days'}`) : ''}` : '';
  const soon = days !== null && days <= 3;
  return {
    text: `${due.status === 'partly_paid' ? `${money(due.left)} left of ${money(due.bill.amountDue)}` : `Bill ${money(due.left)}`}${when}`,
    color: soon ? p.warn : p.ink,
    bg: soon ? p.warnSoft : p.surfaceAlt,
  };
}

/** One payment in a list. Tap opens its details. */
export function TxnRow({ txn, showDate }: { txn: Txn; showDate?: boolean }) {
  const p = usePalette();
  const c = cat(txn.category);
  const credit = txn.type === 'credit';
  // Another currency: shown as it is, but not added to totals (that's not the same as "left out").
  const foreign = isForeign(txn);
  const code = currencyOf(txn);
  const counted = foreign ? !txn.excluded : countsAsSpend(txn) || countsAsIncome(txn) || countsAsSaving(txn);
  const review = needsReview(txn);
  const full = shownAmount(txn);
  const amountText = money(full, { currency: code, decimals: full < 100 ? true : undefined });
  const flow = flowLabel(txn);
  // Part of it came back: show what you really spent under the amount.
  const kept = !txn.netted && txn.grossAmount !== undefined ? money(txn.amount, { currency: code }) : null;
  const when = showDate
    ? shortDay(txn.timestamp)
    : timeLabel(txn.timestamp);
  const pay = payLabel(txn);
  const label = flow ?? (txn.purpose ? kindLabel(txn, c.label) : counted ? c.label : 'Not counted');
  return (
    <PressScale
      onPress={() => router.push(`/txn/${txn.id}`)}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${txn.merchant}, ${credit ? 'received' : 'paid'} ${amountText}${foreign ? `, in ${code}, not in totals` : ''}, ${label}, ${pay}${review ? ', needs a look' : ''}`}
      style={[styles.row, { opacity: counted ? 1 : 0.62 }]}
    >
      <Badge icon={counted ? c.icon : 'swap-horizontal'} color={counted ? c.color : p.muted} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {txn.merchant}
        </Txt>
        <View style={styles.subRow}>
          {review ? <View style={[styles.reviewDot, { backgroundColor: p.warn }]} /> : null}
          <Txt variant="small" color={p.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Txt>
          <PayBadge label={pay} dashed={!counted} />
          {foreign ? <PayBadge label={code} dashed /> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3, maxWidth: '48%', flexShrink: 0 }}>
        <Txt
          variant="bodyStrong"
          tabular
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          color={!counted ? p.muted : credit ? p.income : p.ink}
          style={!counted ? { textDecorationLine: 'line-through' } : null}
        >
          {credit ? '+' : ''}
          {amountText}
        </Txt>
        <Txt variant="tiny" color={p.muted} numberOfLines={1}>
          {kept ? `${kept} after refund · ${when}` : when}
        </Txt>
      </View>
    </PressScale>
  );
}

/** What a linked payment is, in a few words. Null when it isn't linked. */
export function flowLabel(txn: Txn): string | null {
  const credit = txn.type === 'credit';
  const links = txn.links ?? [];
  if (links.some((l) => l.kind === 'transfer')) {
    if (txn.category === 'card_bill') return credit ? 'Card bill paid' : 'Paid your card bill';
    return credit ? 'From your own account' : 'To your own account';
  }
  if (links.some((l) => l.kind === 'refund')) {
    if (credit) return 'Refund, taken off the purchase';
    return txn.netted ? 'Refunded in full' : `${cat(txn.category).label} · part refunded`;
  }
  if (txn.category === 'self_transfer') return 'Your own money moved';
  return null;
}

/** "‹  October 2026  ›" — the next arrow stops at the current month. [compact] = small pill. */
export function MonthSwitcher({ month, onChange, light, compact }: { month: Month; onChange: (m: Month) => void; light?: boolean; compact?: boolean }) {
  const p = usePalette();
  const color = light ? p.cardText : p.ink;
  const canNext = isAfter(thisMonth(), month);
  if (compact) {
    return (
      <View style={[styles.pill, { borderColor: p.line, backgroundColor: p.surface }]}>
        <Pressable onPress={() => onChange(addMonths(month, -1))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.pillBtn}>
          <Icon name="chevron-left" size={20} color={p.ink} />
        </Pressable>
        <Animated.View key={monthKey(month)} entering={enterFade}>
          <Txt variant="smallStrong" style={{ minWidth: 70, textAlign: 'center' }}>
            {getMonthStart() === 1 ? `${monthShort(month)} ${month.year}` : monthName(month)}
          </Txt>
        </Animated.View>
        <Pressable
          onPress={() => canNext && onChange(addMonths(month, 1))}
          hitSlop={10}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={[styles.pillBtn, { opacity: canNext ? 1 : 0.25 }]}
        >
          <Icon name="chevron-right" size={20} color={p.ink} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.switcher}>
      <Pressable onPress={() => onChange(addMonths(month, -1))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous month">
        <Icon name="chevron-left" size={24} color={color} />
      </Pressable>
      <Animated.View key={monthKey(month)} entering={enterFade}>
        <Txt variant="bodyStrong" color={color} style={{ minWidth: 132, textAlign: 'center' }}>
          {monthName(month)}
        </Txt>
      </Animated.View>
      <Pressable
        onPress={() => canNext && onChange(addMonths(month, 1))}
        hitSlop={12}
        disabled={!canNext}
        accessibilityRole="button"
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
  return (
    <MixBar
      height={height}
      parts={shown.map((s) => ({ share: s.share, color: cat(s.category).color }))}
      label={shown.map((s) => `${cat(s.category).label} ${percent(s.share)}`).join(', ')}
    />
  );
}

/**
 * The month as a calendar. Each day is shaded by how much you spent:
 * darker saffron = bigger day. Tap a day to see its payments.
 */
export function HeatCalendar({ month, byDay }: { month: Month; byDay: Record<number, number> }) {
  const p = usePalette();
  const total = daysInMonth(month);
  const start = monthStartDate(month);
  const firstWeekday = (start.getDay() + 6) % 7; // Monday = 0
  const max = Math.max(0, ...Object.values(byDay));
  const isCurrent = sameMonth(month, thisMonth());
  const todayIndex = isCurrent ? dayOfMonth(new Date().getTime()) : 0;

  // Cells hold the day's place in the month (1 = first day), which is what byDay is keyed by.
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const dateAt = (index: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index - 1);

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
            const date = dateAt(day);
            const future = isCurrent && day > todayIndex;
            const isToday = isCurrent && day === todayIndex;
            const dateKey = toDateKey(date.getTime());
            return (
              <Pressable
                key={di}
                disabled={future}
                onPress={() => router.push(`/day/${dateKey}`)}
                accessibilityLabel={`${shortDay(date.getTime(), true)}, ${amt > 0 ? money(amt) + ' spent' : 'no spending'}`}
                style={[
                  styles.cell,
                  styles.cellBox,
                  {
                    backgroundColor: lv > 0 ? alpha(p.accent, lv) : p.track,
                    opacity: future ? 0.35 : 1,
                    borderWidth: isToday ? 2 : 0,
                    borderColor: p.ink,
                  },
                ]}
              >
                <Txt variant="tiny" color={lv > 0.62 ? p.onAccent : lv > 0 ? p.ink : p.muted}>
                  {date.getDate()}
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
              backgroundColor: lv === 0 ? p.track : alpha(p.accent, lv),
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
    <PressScale onPress={onPress} disabled={!onPress} scaleTo={0.985} accessibilityRole="button" style={styles.catRow}>
      <Badge icon={c.icon} color={c.color} size={36} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.between}>
          <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {c.label}
          </Txt>
          <Txt variant="bodyStrong" tabular>
            {money(amount)}
          </Txt>
        </View>
        <ShareBar share={share} color={c.color} />
        <View style={styles.between}>
          <Txt variant="tiny" color={p.muted}>
            {percent(share)} of spending, {count} {count === 1 ? 'payment' : 'payments'}
          </Txt>
          {change != null && Math.abs(change) >= 1 ? (
            <Txt variant="tiny" color={change > 0 ? p.danger : p.income}>
              {change > 0 ? '↑ ' : '↓ '}
              {moneyCompact(Math.abs(change))} vs last month
            </Txt>
          ) : null}
        </View>
      </View>
    </PressScale>
  );
}

/** Simple vertical bars. The selected bar is saffron, the rest are quiet. */
export function Bars({
  data,
  selected,
  onSelect,
  height = 120,
  color,
}: {
  data: { label: string; value: number }[];
  selected?: number;
  onSelect?: (index: number) => void;
  height?: number;
  color?: string;
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
            accessibilityLabel={`${d.label}: ${money(d.value)}`}
          >
            <Txt variant="tiny" color={active ? p.ink : p.muted} numberOfLines={1}>
              {d.value > 0 ? moneyCompact(d.value) : ''}
            </Txt>
            <GrowBar
              index={i}
              height={h}
              style={{ width: '100%', borderRadius: 6, backgroundColor: active ? (color ?? p.accent) : alpha(color ?? p.muted, 0.28) }}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, minHeight: 64 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewDot: { width: 7, height: 7, borderRadius: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 2, height: 40 },
  pillBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  weekRow: { flexDirection: 'row', gap: 6 },
  weekLabel: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, aspectRatio: 1.3 },
  cellBox: { borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  catRow: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
});
