import type { ReactElement } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dateKey, dayLabel } from '../lib/analytics';
import { inr } from '../lib/money';
import { countsAsSpend, type Txn } from '../lib/types';
import { space, usePalette } from '../theme';
import { TxnRow } from './finance';
import { Empty, Txt } from './ui';

/** Payments grouped by day, with a header block on top. Used by the category and day screens. */
export function TxnList({ txns, header, showDayHeaders = true }: { txns: Txn[]; header: ReactElement; showDayHeaders?: boolean }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const k = showDayHeaders ? dateKey(t.timestamp) : 'all';
    const g = groups.get(k);
    if (g) g.push(t);
    else groups.set(k, [t]);
  }
  const sections = [...groups.entries()].map(([key, data]) => ({
    key,
    title: showDayHeaders ? dayLabel(data[0].timestamp) : '',
    spent: data.filter(countsAsSpend).reduce((a, t) => a + t.amount, 0),
    data,
  }));

  return (
    <SectionList
      style={{ backgroundColor: p.bg }}
      sections={sections}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }}
      renderSectionHeader={({ section }) =>
        showDayHeaders ? (
          <View style={[styles.dayHeader, { borderBottomColor: p.line }]}>
            <Txt variant="smallStrong" color={p.inkSoft}>
              {section.title}
            </Txt>
            {section.spent > 0 ? (
              <Txt variant="smallStrong" color={p.muted} tabular>
                {inr(section.spent)}
              </Txt>
            ) : null}
          </View>
        ) : null
      }
      renderItem={({ item }) => <TxnRow txn={item} />}
      ListEmptyComponent={<Empty icon="tray-arrow-down" title="Nothing here" body="No payments match." />}
    />
  );
}

const styles = StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
