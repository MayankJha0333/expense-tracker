import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { TxnList } from '../../components/TxnList';
import { Txt } from '../../components/ui';
import { dateKey, dayLabel } from '../../lib/analytics';
import { inr } from '../../lib/money';
import { useStore } from '../../lib/store';
import { countsAsSpend } from '../../lib/types';
import { space, usePalette } from '../../theme';

/** Everything on one day (opened from the calendar on Home). */
export default function DayScreen() {
  const p = usePalette();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { txns } = useStore();

  const list = useMemo(() => txns.filter((t) => dateKey(t.timestamp) === date), [txns, date]);
  const spent = list.filter(countsAsSpend).reduce((a, t) => a + t.amount, 0);
  const [y, m, d] = (date ?? '').split('-').map(Number);
  const ts = new Date(y, (m || 1) - 1, d || 1).getTime();

  return (
    <TxnList
      txns={list}
      showDayHeaders={false}
      header={
        <View style={{ gap: space.lg, paddingBottom: space.sm }}>
          <ScreenHeader />
          <View>
            <Txt variant="small" color={p.muted}>
              {dayLabel(ts)}
            </Txt>
            <Txt variant="display" tabular>
              {inr(spent)}
            </Txt>
            <Txt variant="small" color={p.muted}>
              spent across {list.filter(countsAsSpend).length} payments
            </Txt>
          </View>
        </View>
      }
    />
  );
}
