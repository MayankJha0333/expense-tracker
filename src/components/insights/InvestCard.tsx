/* Insights › Savings: the SIPs and investments card. */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Card, Icon, Txt } from '../ui';
import { monthShort, shortDay } from '../../lib/analytics';
import { investmentOverview } from '../../lib/investments';
import { money } from '../../lib/money';
import { useStore } from '../../lib/store';
import { space, usePalette } from '../../theme';
import { styles } from './shared';

export function InvestCard() {
  const p = usePalette();
  const { txns, scheduled, funds, month, ignoredSchedules } = useStore();
  const o = useMemo(() => investmentOverview(txns, scheduled, funds, month, new Set(ignoredSchedules)), [txns, scheduled, funds, month, ignoredSchedules]);
  if (o.last12 === 0 && o.noDebitSeen.length === 0) return null;
  const next = o.sips.find((s) => s.active);
  return (
    <Pressable
      onPress={() => router.push('/investments')}
      accessibilityRole="button"
      accessibilityLabel={`Investments. ${money(o.thisMonth)} in ${monthShort(month)}, ${money(o.last12)} in 12 months. Opens investments.`}
    >
      <Card style={{ gap: space.md }}>
        <View style={styles.line}>
          <Badge icon="chart-line" color={p.savings} size={40} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">
              {money(o.thisMonth)} invested in {monthShort(month)}
            </Txt>
            <Txt variant="small" color={p.muted}>
              {money(o.last12)} in the last 12 months · {o.monthsInvested} of 12 months
            </Txt>
          </View>
          <Icon name="chevron-right" size={20} color={p.muted} />
        </View>
        {next ? (
          <Txt variant="small" color={p.inkSoft}>
            SIP of {money(next.amount)}
            {next.perMonth > 1 ? ` × ${next.perMonth}` : ''} a month · next about {shortDay(next.next)}
          </Txt>
        ) : null}
        {o.noDebitSeen.length ? (
          <View style={[styles.investWarn, { backgroundColor: p.warnSoft }]}>
            <Icon name="alert-circle-outline" size={16} color={p.warn} />
            <Txt variant="small" color={p.warn} style={{ flex: 1 }}>
              {o.noDebitSeen.length} scheduled {o.noDebitSeen.length === 1 ? 'SIP has' : 'SIPs have'} no payment message ({money(o.noDebitSeen.reduce((a, s) => a + s.amount, 0))}). Check them.
            </Txt>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}
