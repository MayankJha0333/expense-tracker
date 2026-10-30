import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarSpace } from '../../components/tabBarSpace';
import { MonthSwitcher } from '../../components/finance';
import { Segmented, Txt } from '../../components/ui';
import { Stagger } from '../../components/motion';
import { addMonths, cashflow, summarize } from '../../lib/analytics';
import { useStore } from '../../lib/store';
import { space, usePalette } from '../../theme';
import { Income } from '../../components/insights/Income';
import { Savings } from '../../components/insights/Savings';
import { Spending } from '../../components/insights/Spending';
import { styles } from '../../components/insights/shared';

type View_ = 'spending' | 'income' | 'savings';

/** Insights: spending, income and savings for the month. Each tab lives in components/insights. */
export default function Insights() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { txns, month, setMonth } = useStore();
  const [view, setView] = useState<View_>('spending');

  const summary = useMemo(() => summarize(txns, month), [txns, month]);
  const previous = useMemo(() => summarize(txns, addMonths(month, -1)), [txns, month]);
  const flow = useMemo(() => cashflow(txns, month, 6), [txns, month]);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: tabSpace, gap: space.xl }}
    >
      <Stagger>
      <View style={{ gap: space.md }}>
        <View style={styles.titleRow}>
          <Txt variant="title" accessibilityRole="header">
            Insights
          </Txt>
          <MonthSwitcher month={month} onChange={setMonth} compact />
        </View>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { id: 'spending', label: 'Spending' },
            { id: 'income', label: 'Income' },
            { id: 'savings', label: 'Savings' },
          ]}
        />
      </View>

      {view === 'spending' ? <Spending key="spending" summary={summary} previous={previous} flow={flow} /> : null}
      {view === 'income' ? <Income key="income" summary={summary} flow={flow} /> : null}
      {view === 'savings' ? <Savings key="savings" summary={summary} flow={flow} /> : null}
      </Stagger>
    </ScrollView>
  );
}
