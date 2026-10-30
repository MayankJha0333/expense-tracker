/* Pieces the Insights sections share: labels, the small number box, styles. */

import { StyleSheet, View } from 'react-native';

import { Txt } from '../ui';
import { type SkipReason } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

export const FULL_DAY: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };

export const SKIP_LABEL: Record<SkipReason, string> = {
  otp: 'OTPs and codes',
  promo: 'Offers and promos',
  personal: 'Chats from people',
  not_transaction: 'Other messages',
  failed: 'Failed payments',
  reminder: 'Bills due and statements',
  request: 'Money requests',
  duplicate: 'Repeated alerts',
};

/** One small number box ("Spent", "Per day"). */
export function Fact({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  const p = usePalette();
  return (
    <View style={[styles.fact, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Txt variant="tiny" color={p.muted} numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="amount" tabular numberOfLines={1} adjustsFontSizeToFit color={tone ?? p.ink}>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="tiny" color={p.muted} numberOfLines={1}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** Styles shared by the Insights sections. */
export const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  investWarn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: 10, padding: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  donutCard: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  legendLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  cMonth: { flex: 1 },
  cNum: { flex: 1.3, textAlign: 'right' },
});
