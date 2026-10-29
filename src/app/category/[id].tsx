import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { TxnList } from '../../components/TxnList';
import { Badge, NoticeRow, Txt } from '../../components/ui';
import { monthName, monthOf, parseMonthKey, sameMonth } from '../../lib/analytics';
import { money } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, countsAsIncome, countsAsSpend, isCategoryId } from '../../lib/types';
import { space, usePalette } from '../../theme';

/**
 * Every payment in one category for one month.
 * Income categories (salary, received, refund...) add up money in instead of money spent.
 * With `from`, it shows only the money one payer sent you that month (Insights › Sources).
 */
export default function CategoryScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{ id: string; month?: string; from?: string }>();
  const { txns, month: storeMonth } = useStore();
  const id = isCategoryId(params.id) ? params.id : 'other';
  const month = parseMonthKey(params.month) ?? storeMonth;
  const from = params.from || null;
  const c = cat(id);
  const isIncome = c.isIncome || from !== null;

  const list = useMemo(
    () =>
      txns.filter((t) => {
        if (!sameMonth(monthOf(t.timestamp), month)) return false;
        // A payer can show up under more than one income category, so match on who paid, not the category.
        if (from !== null) return (t.merchantKey || t.merchant) === from && countsAsIncome(t);
        return t.category === id;
      }),
    [txns, id, month, from],
  );
  const counted = list.filter(isIncome ? countsAsIncome : countsAsSpend);
  const total = counted.reduce((a, t) => a + t.amount, 0);
  const average = counted.length ? total / counted.length : 0;
  const title = from !== null ? (list[0]?.merchant ?? c.label) : c.label;

  return (
    <TxnList
      txns={list}
      header={
        <View style={{ gap: space.lg, paddingBottom: space.sm }}>
          <ScreenHeader />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Badge icon={c.icon} color={c.color} size={48} />
            <View style={{ flex: 1 }}>
              <Txt variant="heading" numberOfLines={2}>
                {title}
              </Txt>
              <Txt variant="small" color={p.muted}>
                {from !== null ? `${c.label} · ${monthName(month)}` : monthName(month)}
              </Txt>
            </View>
          </View>
          <View>
            <Txt variant="display" tabular color={isIncome ? p.income : undefined}>
              {isIncome ? '+' : ''}
              {money(total)}
            </Txt>
            <Txt variant="small" color={p.muted}>
              {counted.length} {counted.length === 1 ? 'payment' : 'payments'}
              {isIncome ? ' received' : ''}
              {counted.length > 1 ? `, about ${money(average)} each` : ''}
            </Txt>
          </View>
          {id === 'people' && from === null ? (
            <NoticeRow
              tone="info"
              icon="account-question-outline"
              title="What are these payments for?"
              body="Tag people as room rent, cook, family and more. Their payments move to the right category."
              onPress={() => router.push('/people')}
            />
          ) : null}
        </View>
      }
    />
  );
}
