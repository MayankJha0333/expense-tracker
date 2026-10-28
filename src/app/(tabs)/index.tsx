import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TxnRow, MonthSwitcher } from '../../components/finance';
import { AnimatedAmount } from '../../components/AnimatedAmount';
import { Wordmark } from '../../components/Logo';
import { PressScale, Stagger } from '../../components/motion';
import { SmsNotice } from '../../components/SmsNotice';
import { Ring } from '../../components/charts';
import { HeroCard } from '../../components/HeroCard';
import { AmountBar, Button, Card, Empty, Icon, IconButton, MixBar, NoticeRow, SectionHeader, Txt } from '../../components/ui';
import { cardDues, duesSummary, needsReview, PAY_GROUP_LABEL, payGroupColorIndex, payMix, shortCardName } from '../../lib/accounts';
import { budgetPace, shortDay, monthKey, monthName, monthShort, sameMonth, summarize, thisMonth } from '../../lib/analytics';
import { currencyOf, type CurrencyCode } from '../../lib/currency';
import { currencySymbol, formatCount, money, percent } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, isForeign, type IconName } from '../../lib/types';
import { space, usePalette } from '../../theme';


export default function Home() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { txns, month, setMonth, refresh, refreshing, stats, permission, source, budget, bills, paidBills } = useStore();

  const summary = useMemo(() => summarize(txns, month), [txns, month]);
  const mix = useMemo(() => payMix(summary.txns), [summary]);
  const dues = useMemo(() => duesSummary(cardDues(bills, txns, new Set(paidBills))), [bills, txns, paidBills]);
  const review = useMemo(() => summary.txns.filter(needsReview), [summary]);
  // Payments in another currency this month: listed, but never added to the totals above.
  const foreign = useMemo(() => {
    const list = summary.txns.filter((t) => isForeign(t) && !t.excluded);
    const sums = new Map<CurrencyCode, number>();
    for (const t of list) sums.set(currencyOf(t), (sums.get(currencyOf(t)) ?? 0) + (t.type === 'debit' ? t.amount : -t.amount));
    return { count: list.length, codes: [...sums.keys()], text: [...sums].map(([c, v]) => money(v, { currency: c })).join(' · ') };
  }, [summary]);
  const pace = budget ? budgetPace(summary, budget) : null;

  const smsOn = source === 'sms' && permission === 'granted';
  const isCurrent = sameMonth(month, thisMonth());
  const name = monthShort(month);
  const overspent = summary.saved < 0;
  const spentShare = summary.received > 0 ? summary.spent / summary.received : 0;
  const topCats = summary.byCategory.slice(0, 4);
  const maxCat = topCats[0]?.amount ?? 1;
  const rest = summary.byCategory.slice(4).reduce((a, c) => a + c.amount, 0);
  const skippedNoise = Object.entries(stats.skipped)
    .filter(([k]) => k !== 'personal' && k !== 'duplicate' && k !== 'not_transaction')
    .reduce((a, [, v]) => a + (v ?? 0), 0);

  const next = dues.next;
  const lateDays = next?.daysLeft !== null && next?.daysLeft !== undefined && next.daysLeft < 0 ? -next.daysLeft : 0;
  const dueSoon = next?.daysLeft !== null && next?.daysLeft !== undefined && next.daysLeft <= 3;
  const budgetTone = !pace ? p.income : pace.used > 1 ? p.danger : pace.used > 0.85 ? p.warn : p.income;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xl }}
        refreshControl={smsOn ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accent} colors={[p.accent]} /> : undefined}
      >
        <Stagger>
        {/* Top bar: logo, month, privacy & settings */}
        <View style={styles.topBar}>
          <Wordmark size={30} />
          <View style={styles.topRight}>
            <MonthSwitcher month={month} onChange={setMonth} compact />
            <IconButton icon="cog-outline" label="Settings, theme and privacy" onPress={() => router.push('/settings')} />
          </View>
        </View>

        {source === 'demo' ? (
          <NoticeRow
            compact
            tone="info"
            icon="flask-outline"
            title="Sample data"
            body="Not real, not saved"
            pill="Use my SMS"
            onPress={() => router.push('/settings')}
          />
        ) : (
          <SmsNotice />
        )}

        {/* 1. Saved this month, with money in and money out (design 4a) */}
        <HeroCard
          onPress={() => router.push('/insights')}
          accessibilityLabel={`${isCurrent ? `${name} so far` : monthName(month)}: money in ${money(summary.received)}, spent ${money(summary.spent)}, ${overspent ? 'overspent' : 'saved'} ${money(Math.abs(summary.saved))}. Opens insights.`}
        >
          <Txt variant="smallStrong" color={p.heroText}>
            {overspent ? 'Overspent in' : 'Saved in'} {monthName(month).split(' ')[0]}
            {isCurrent ? ' so far' : ` ${month.year}`}
          </Txt>
          <AnimatedAmount
            value={summary.saved}
            format={(v) => `${v < 0 ? '-' : ''}${money(Math.abs(v))}`}
            variant="display"
            color={p.heroValue}
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={styles.heroAmount}
          />
          {summary.received > 0 ? (
            <View style={[styles.heroChip, { backgroundColor: p.heroChip }]}>
              <Icon name={overspent ? 'trending-down' : 'trending-up'} size={14} color={p.heroChipText} />
              <Txt variant="smallStrong" color={p.heroChipText}>
                {overspent ? `${percent(spentShare)} of income spent` : `${percent(summary.savingsRate ?? 0)} of income saved`}
              </Txt>
            </View>
          ) : (
            <Txt variant="small" color={p.heroMuted}>
              No income found for {name} yet. Salary and other money in will show here.
            </Txt>
          )}
          <View style={styles.heroTiles}>
            <HeroTile icon="arrow-bottom-left" label="Money in" value={summary.received} />
            <HeroTile icon="arrow-top-right" label="Money out" value={summary.spent} />
          </View>
          {summary.invested > 0 ? (
            <Txt variant="small" color={p.heroMuted}>
              {money(summary.invested)} of what you saved went into SIPs and investments.
            </Txt>
          ) : null}
        </HeroCard>

        {foreign.count > 0 ? (
          <NoticeRow
            tone="info"
            icon="earth"
            title={`${foreign.count} ${foreign.count === 1 ? 'payment' : 'payments'} in ${foreign.codes.length > 2 ? 'other currencies' : foreign.codes.join(' and ')}`}
            body={
              foreign.codes.length > 2
                ? `${foreign.codes.join(', ')} · Not in your ${currencySymbol()} totals`
                : `${foreign.text} · Not in your ${currencySymbol()} totals (no exchange rates offline)`
            }
            pill="View"
            onPress={() => router.navigate({ pathname: '/activity', params: { filter: 'foreign' } })}
          />
        ) : null}

        {/* 2. Credit card bills still to pay */}
        {next ? (
          <NoticeRow
            tone={lateDays ? 'danger' : dueSoon ? 'warn' : 'neutral'}
            icon="credit-card-clock-outline"
            title={`${money(dues.total)} due on ${dues.open.length} ${dues.open.length === 1 ? 'card' : 'cards'}`}
            body={
              lateDays
                ? `${shortCardName(next.name)} · ${lateDays} ${lateDays === 1 ? 'day' : 'days'} late`
                : next.bill.dueDate
                  ? `${shortCardName(next.name)} · due ${shortDay(next.bill.dueDate)}`
                  : shortCardName(next.name)
            }
            pill={
              lateDays
                ? 'Late'
                : next.daysLeft === null
                  ? undefined
                  : next.daysLeft === 0
                    ? 'Due today'
                    : `${next.daysLeft} ${next.daysLeft === 1 ? 'day' : 'days'}`
            }
            onPress={() => router.push(`/account/${encodeURIComponent(next.key)}`)}
          />
        ) : null}

        {summary.txns.length === 0 ? (
          <Card>
            <Empty
              icon="tray-arrow-down"
              title={`Nothing for ${name} yet`}
              body={smsOn ? 'No bank or card alerts were found for this month. Pull down to check again.' : 'Add a cash expense or income with the + button.'}
            >
              <Button label="Add an expense" icon="plus" compact onPress={() => router.push('/add')} />
            </Empty>
          </Card>
        ) : null}

        {/* 3. Where it went */}
        {topCats.length > 0 ? (
          <View>
            <SectionHeader title="Where it went" action="See all" onAction={() => router.push('/insights')} />
            <Card style={{ gap: space.lg }}>
              {topCats.map((c) => (
                <AmountBar
                  key={c.category}
                  label={cat(c.category).label}
                  amount={money(c.amount)}
                  share={percent(c.share)}
                  fill={c.amount / maxCat}
                  onPress={() => router.push(`/category/${c.category}?month=${monthKey(month)}`)}
                />
              ))}
              {rest > 0 ? (
                <View style={styles.between}>
                  <Txt variant="small" color={p.muted}>
                    Everything else
                  </Txt>
                  <Txt variant="smallStrong" tabular>
                    {money(rest)} · {percent(rest / Math.max(1, summary.spent))}
                  </Txt>
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* 4. How you paid */}
        {mix.length > 0 ? (
          <View>
            <SectionHeader title="How you paid" action="Accounts" onAction={() => router.push('/accounts')} />
            <Card style={{ gap: space.lg }}>
              <MixBar
                parts={mix.map((m) => ({ share: m.share, color: p.series[payGroupColorIndex(m.group)] }))}
                label={mix.map((m) => `${PAY_GROUP_LABEL[m.group]} ${percent(m.share)}`).join(', ')}
              />
              <View style={styles.legend}>
                {mix.map((m) => (
                  <View key={m.group} style={styles.legendItem}>
                    <View style={styles.legendHead}>
                      <View style={[styles.swatch, { backgroundColor: p.series[payGroupColorIndex(m.group)] }]} />
                      <Txt variant="small" color={p.muted}>
                        {PAY_GROUP_LABEL[m.group]} · {percent(m.share)}
                      </Txt>
                    </View>
                    <Txt variant="bodyStrong" tabular>
                      {money(m.amount)}
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {/* Budget, with a progress ring (design 4a) */}
        {pace && budget ? (
          <PressScale
            onPress={() => router.push('/budget')}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`Monthly budget, ${pace.used > 9.99 ? 'over 999%' : `${Math.round(pace.used * 100)}%`} used. ${pace.left >= 0 ? `${money(pace.left)} left` : `${money(-pace.left)} over`}. Edit budget.`}
          >
            <Card style={styles.budget}>
              <Ring progress={pace.used} size={64} thickness={8} color={budgetTone} track={p.track}>
                <Txt variant="smallStrong" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ maxWidth: 44, textAlign: 'center' }}>
                  {pace.used > 9.99 ? '999%+' : <AnimatedAmount value={Math.round(pace.used * 100)} format={(v) => `${Math.round(v)}%`} variant="smallStrong" tabular />}
                </Txt>
              </Ring>
              <View style={{ flex: 1, gap: 3 }}>
                <Txt variant="small" color={p.muted}>
                  Monthly budget
                </Txt>
                <Txt variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {pace.left >= 0 ? `${money(pace.left)} left of ${money(budget)}` : `${money(-pace.left)} over ${money(budget)}`}
                </Txt>
                <Txt variant="small" color={pace.used > 0.85 ? budgetTone : p.muted}>
                  {pace.left < 0
                    ? 'Over budget this month'
                    : isCurrent && pace.daysLeft > 0
                      ? `About ${money(pace.perDayLeft)} a day for ${pace.daysLeft} more days`
                      : pace.onTrack
                        ? 'Stayed within budget'
                        : 'Went over budget'}
                </Txt>
              </View>
              <Icon name="chevron-right" size={20} color={p.muted} />
            </Card>
          </PressScale>
        ) : (
          <NoticeRow
            tone="accent"
            icon="target"
            title="Set a monthly budget"
            body="See how much is left each day."
            pill="Set"
            onPress={() => router.push('/budget')}
          />
        )}

        {/* Payments to check */}
        {review.length > 0 ? (
          <NoticeRow
            tone="warn"
            icon="help-circle-outline"
            title={`${review.length} ${review.length === 1 ? 'payment needs' : 'payments need'} a look`}
            body="Pick a category so your totals are right."
            pill="Review"
            onPress={() => router.navigate({ pathname: '/activity', params: { filter: 'review' } })}
          />
        ) : null}

        {/* Recent */}
        {summary.txns.length > 0 ? (
          <View>
            <SectionHeader title="Recent" action="See all" onAction={() => router.push('/activity')} />
            <Card style={{ paddingVertical: space.xs }}>
              {summary.txns.slice(0, 4).map((t) => (
                <TxnRow key={t.id} txn={t} showDate />
              ))}
            </Card>
          </View>
        ) : null}

        {(smsOn || source === 'demo') && stats.scanned > 0 ? (
          <View style={styles.trust}>
            <Icon name="shield-check-outline" size={18} color={p.income} />
            <Txt variant="small" color={p.muted} style={{ flex: 1 }}>
              {source === 'demo' ? 'Sample: ' : ''}
              Checked {formatCount(stats.scanned)} messages on this phone and found {formatCount(stats.kept)} payments
              {dues.open.length || bills.length ? ` and ${bills.length} card statements` : ''}. Skipped {formatCount(skippedNoise)} OTPs, offers and
              reminders. Nothing was uploaded.
            </Txt>
          </View>
        ) : null}
        </Stagger>
      </ScrollView>
    </View>
  );
}

function HeroTile({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  const p = usePalette();
  return (
    <View style={[styles.heroTile, { backgroundColor: p.heroTile }]}>
      <View style={styles.heroTileHead}>
        <Icon name={icon} size={14} color={p.heroText} />
        <Txt variant="small" color={p.heroText}>
          {label}
        </Txt>
      </View>
      <AnimatedAmount value={value} format={(v) => money(v)} variant="amount" color={p.heroText} tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroAmount: { marginTop: -6, marginBottom: -2 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroTiles: { flexDirection: 'row', gap: space.sm + 2, marginTop: space.xs },
  heroTile: { flex: 1, borderRadius: 18, padding: space.md, gap: 4 },
  heroTileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  budget: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  legendItem: { width: '50%', gap: 2 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  trust: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
