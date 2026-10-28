import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { TxnList } from '../../components/TxnList';
import { Badge, Txt } from '../../components/ui';
import { monthName, monthOf, parseMonthKey, sameMonth } from '../../lib/analytics';
import { inr } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, countsAsSpend, isCategoryId } from '../../lib/types';
import { space, usePalette } from '../../theme';

/** Every payment in one category for one month. */
export default function CategoryScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{ id: string; month?: string }>();
  const { txns, month: storeMonth } = useStore();
  const id = isCategoryId(params.id) ? params.id : 'other';
  const month = parseMonthKey(params.month) ?? storeMonth;
  const c = cat(id);

  const list = useMemo(
    () => txns.filter((t) => t.category === id && sameMonth(monthOf(t.timestamp), month)),
    [txns, id, month],
  );
  const total = list.filter(countsAsSpend).reduce((a, t) => a + t.amount, 0);
  const average = list.length ? total / list.length : 0;

  return (
    <TxnList
      txns={list}
      header={
        <View style={{ gap: space.lg, paddingBottom: space.sm }}>
          <ScreenHeader />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Badge icon={c.icon} color={c.color} size={48} />
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{c.label}</Txt>
              <Txt variant="small" color={p.muted}>
                {monthName(month)}
              </Txt>
            </View>
          </View>
          <View>
            <Txt variant="display" tabular>
              {inr(total)}
            </Txt>
            <Txt variant="small" color={p.muted}>
              {list.length} {list.length === 1 ? 'payment' : 'payments'}
              {list.length > 1 ? `, about ${inr(average)} each` : ''}
            </Txt>
          </View>
        </View>
      }
    />
  );
}
