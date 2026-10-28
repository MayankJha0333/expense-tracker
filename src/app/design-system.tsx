import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ring } from '../components/charts';
import { MonthSwitcher, TxnRow } from '../components/finance';
import { HeroCard } from '../components/HeroCard';
import { LogoTile, Wordmark } from '../components/Logo';
import { ScreenHeader } from '../components/ScreenHeader';
import { AmountBar, Button, Card, Chip, Icon, MixBar, NoticeRow, PayBadge, SectionHeader, Segmented, Tag, Txt } from '../components/ui';
import { thisMonth } from '../lib/analytics';
import type { Txn } from '../lib/types';
import { ELECTRIC, ELECTRIC_IDS, MIDNIGHT, MIDNIGHT_IDS, radius, space, type, usePalette, useTheme, type Palette, type ThemeMode, type TypeVariant } from '../theme';

/*
 * Kharcha design system, live. Every token and component in the current theme,
 * with a quick switcher for all 8 themes. Used for visual QA (docs/DESIGN_SYSTEM.md).
 * Open with kharcha://design-system, or Settings › About › Design system in dev builds.
 */

const SAMPLE: Txn[] = [
  { id: 'ds-1', amount: 1899, type: 'debit', merchant: 'Amazon', merchantKey: 'amazon', category: 'shopping', mode: 'card', bank: 'HDFC Bank', account: '7788', timestamp: Date.now() - 3_600_000, isManual: false, excluded: false, categorySource: 'auto' },
  { id: 'ds-2', amount: 98000, type: 'credit', merchant: 'Acme Technologies', merchantKey: 'acme', category: 'salary', mode: 'netbanking', bank: 'HDFC Bank', account: '4521', timestamp: Date.now() - 7_200_000, isManual: false, excluded: false, categorySource: 'auto' },
  { id: 'ds-3', amount: 900, type: 'debit', merchant: 'Shri Ganesh Enterprises', merchantKey: 'shriganesh', category: 'other', mode: 'upi', bank: 'SBI', account: '9876', timestamp: Date.now() - 9_000_000, isManual: false, excluded: false, categorySource: 'auto' },
  { id: 'ds-4', amount: 7100, type: 'debit', merchant: 'CRED Club', merchantKey: 'cred', category: 'card_bill', mode: 'upi', bank: 'SBI', account: '9876', timestamp: Date.now() - 12_000_000, isManual: false, excluded: false, categorySource: 'auto' },
];

const ROLES: (keyof Palette)[] = ['bg', 'surface', 'surfaceAlt', 'line', 'ink', 'inkSoft', 'muted', 'accent', 'highlight', 'hero', 'card', 'income', 'savings', 'warn', 'danger', 'track'];
const TYPES: TypeVariant[] = ['display', 'title', 'amount', 'heading', 'bodyStrong', 'body', 'smallStrong', 'small', 'tiny', 'label'];
const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function DesignSystem() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { mode, scheme, midnight, electric, setMode, setMidnight, setElectric } = useTheme();
  const [chip, setChip] = useState('upi');
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <ScreenHeader />
      <View style={{ gap: 4 }}>
        <Txt variant="title" accessibilityRole="header">
          Design system
        </Txt>
        <Txt variant="small" color={p.muted}>
          Now showing {p.familyName} ({scheme} mode). Dark mode always uses Midnight, light mode always uses Electric.
        </Txt>
      </View>

      {/* Theme switcher */}
      <Card style={{ gap: space.md }}>
        <Segmented value={mode} onChange={setMode} options={MODES} />
        <View style={styles.wrap}>
          {scheme === 'dark'
            ? MIDNIGHT_IDS.map((id) => <Chip key={id} label={MIDNIGHT[id].name} selected={midnight === id} onPress={() => setMidnight(id)} a11y={`Midnight ${MIDNIGHT[id].name}`} />)
            : ELECTRIC_IDS.map((id) => <Chip key={id} label={ELECTRIC[id].name} selected={electric === id} onPress={() => setElectric(id)} a11y={`Electric ${ELECTRIC[id].name}`} />)}
        </View>
      </Card>

      {/* Hero card */}
      <View>
        <SectionHeader title="Hero card" subtitle="Family colour · ring · orb (Electric) · coloured shadow" />
        <HeroCard accessibilityLabel="Sample hero card">
          <Txt variant="smallStrong" color={p.heroText}>
            Saved in October so far
          </Txt>
          <Txt variant="display" color={p.heroValue} tabular>
            ₹38,217
          </Txt>
          <View style={[styles.heroChip, { backgroundColor: p.heroChip }]}>
            <Icon name="trending-up" size={14} color={p.heroChipText} />
            <Txt variant="smallStrong" color={p.heroChipText}>
              38% of income saved
            </Txt>
          </View>
          <View style={styles.row}>
            {['Money in · ₹1,00,570', 'Money out · ₹62,353'].map((t) => (
              <View key={t} style={[styles.heroTile, { backgroundColor: p.heroTile }]}>
                <Txt variant="smallStrong" color={p.heroText}>
                  {t}
                </Txt>
              </View>
            ))}
          </View>
        </HeroCard>
      </View>

      {/* Colour roles */}
      <View>
        <SectionHeader title="Colour roles" subtitle="Use the role, never the hex" />
        <View style={styles.grid}>
          {ROLES.map((k) => (
            <View key={k} style={styles.swatchCell}>
              <View style={[styles.swatch, { backgroundColor: p[k] as string, borderColor: p.line }]} />
              <Txt variant="tiny">{k}</Txt>
              <Txt variant="tiny" color={p.muted}>
                {String(p[k])}
              </Txt>
            </View>
          ))}
        </View>
        <View style={[styles.row, { marginTop: space.md }]}>
          {p.series.map((c, i) => (
            <View key={i} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 24, borderRadius: 6, backgroundColor: c }} />
              <Txt variant="tiny" color={p.muted}>
                series {i + 1}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {/* Type */}
      <View>
        <SectionHeader title="Type" subtitle="Sora, bundled in the app" />
        <Card style={{ gap: space.sm }}>
          {TYPES.map((t) => (
            <View key={t} style={styles.typeRow}>
              <Txt variant={t} numberOfLines={1} style={{ flex: 1 }}>
                {t === 'display' || t === 'amount' ? '₹38,217' : 'Kharcha'}
              </Txt>
              <Txt variant="tiny" color={p.muted}>
                {t} · {type[t].fontSize}
              </Txt>
            </View>
          ))}
        </Card>
      </View>

      {/* Elevation and radius */}
      <View>
        <SectionHeader title="Elevation and corners" subtitle="shadowCard · shadowHero · shadowRaised" />
        <View style={styles.row}>
          <View style={[styles.elev, { backgroundColor: p.surface, borderColor: p.line, boxShadow: p.shadowCard, borderRadius: radius.md + 4 }]}>
            <Txt variant="tiny">Card · 20</Txt>
          </View>
          <View style={[styles.elev, { backgroundColor: p.hero, boxShadow: p.shadowHero, borderRadius: radius.lg }]}>
            <Txt variant="tiny" color={p.heroText}>
              Hero · 28
            </Txt>
          </View>
          <View style={[styles.elev, { backgroundColor: p.fab, boxShadow: p.shadowRaised, borderRadius: 999 }]}>
            <Txt variant="tiny" color={p.onFab}>
              + · round
            </Txt>
          </View>
        </View>
      </View>

      {/* Components */}
      <View>
        <SectionHeader title="Buttons" />
        <Card style={{ gap: space.sm }}>
          <Button label="Primary" onPress={() => {}} />
          <Button label="Accent" kind="accent" icon="check" onPress={() => {}} />
          <Button label="Secondary" kind="secondary" onPress={() => {}} />
          <View style={styles.row}>
            <Button label="Quiet" kind="quiet" compact onPress={() => {}} />
            <Button label="Danger" kind="danger" compact icon="trash-can-outline" onPress={() => {}} />
          </View>
        </Card>
      </View>

      <View>
        <SectionHeader title="Choices" />
        <Card style={{ gap: space.md }}>
          <Segmented
            value={seg}
            onChange={setSeg}
            options={[
              { id: 'a', label: 'Spending' },
              { id: 'b', label: 'Income' },
              { id: 'c', label: 'Savings' },
            ]}
          />
          <View style={styles.wrap}>
            {['upi', 'card', 'cash'].map((c) => (
              <Chip key={c} label={c.toUpperCase()} selected={chip === c} onPress={() => setChip(c)} />
            ))}
            <Chip label="Food & dining" icon="silverware-fork-knife" color="#E8833A" selected onPress={() => {}} />
          </View>
          <View style={styles.wrap}>
            <PayBadge label="UPI" />
            <PayBadge label="HDFC card ••7788" />
            <PayBadge label="Not counted" dashed />
            <Tag label="In use now" color={p.accentInk} />
            <Tag label="Paid" color={p.income} icon="check" />
          </View>
          <MonthSwitcher month={thisMonth()} onChange={() => {}} compact />
        </Card>
      </View>

      <View>
        <SectionHeader title="Data" />
        <Card style={{ gap: space.lg }}>
          <MixBar parts={[{ share: 0.72, color: p.series[0] }, { share: 0.26, color: p.series[1] }, { share: 0.02, color: p.series[2] }]} label="UPI 72%, Card 26%, Cash 2%" />
          <AmountBar label="Rent & home" amount="₹22,000" share="35%" fill={1} />
          <AmountBar label="Shopping" amount="₹10,327" share="17%" fill={0.47} color={p.series[1]} />
          <View style={[styles.row, { justifyContent: 'space-around' }]}>
            {[
              [0.42, p.income],
              [0.88, p.warn],
              [1.04, p.danger],
            ].map(([v, c]) => (
              <Ring key={String(v)} progress={v as number} size={64} thickness={8} color={c as string} track={p.track}>
                <Txt variant="smallStrong">{Math.round((v as number) * 100)}%</Txt>
              </Ring>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ gap: space.md }}>
        <SectionHeader title="Notices" />
        <Txt variant="small" color={p.muted}>
          One tone sets every colour. Warn and danger get a tinted card; the rest sit on a normal card. The pill says what to do or how urgent.
        </Txt>
        <NoticeRow compact tone="info" icon="flask-outline" title="Sample data" body="Not real, not saved" pill="Use my SMS" onPress={() => {}} />
        <NoticeRow tone="neutral" icon="credit-card-clock-outline" title="₹21,130 due on 2 cards" body="HDFC ••7788 · due 5 Nov" pill="8 days" onPress={() => {}} />
        <NoticeRow tone="accent" icon="target" title="Set a monthly budget" body="See how much is left each day." pill="Set" onPress={() => {}} />
        <NoticeRow tone="warn" icon="help-circle-outline" title="3 payments need a look" body="Pick a category so your totals are right." pill="Review" onPress={() => {}} />
        <NoticeRow tone="danger" icon="credit-card-clock-outline" title="₹16,764 due on 1 card" body="HDFC ••7788 · 2 days late" pill="Late" onPress={() => {}} />
        <NoticeRow tone="warn" icon="help-circle-outline" title="We weren't sure what this was" body="No pill and no tap: a plain message inside a screen." />
      </View>

      <View>
        <SectionHeader title="Payment rows" />
        <Card style={{ paddingVertical: space.xs }}>
          {SAMPLE.map((t) => (
            <TxnRow key={t.id} txn={t} showDate />
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title="Logo" subtitle="Wallet, two bills, and a coin on the clasp. Follows your colour." />
        <Card style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: space.sm }}>
            <LogoTile size={96} />
            <LogoTile size={56} />
            <LogoTile size={32} />
            <LogoTile size={24} />
          </View>
          <Wordmark size={32} />
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  swatchCell: { width: '25%', gap: 2, paddingRight: 6 },
  swatch: { height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  typeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroTile: { flex: 1, borderRadius: 18, padding: space.md },
  elev: { flex: 1, height: 72, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
});
