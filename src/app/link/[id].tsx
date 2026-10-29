import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressScale } from '../../components/motion';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Badge, Empty, PayBadge, Txt } from '../../components/ui';
import { payLabel } from '../../lib/accounts';
import { shortDay } from '../../lib/analytics';
import { linkCandidates, type LinkCandidate } from '../../lib/flows';
import { money } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, shownAmount } from '../../lib/types';
import { space, usePalette } from '../../theme';

const KIND_TEXT = { transfer: 'Same money', refund: 'Refund' } as const;

/** Link a payment to its other side by hand: a transfer between your accounts, or a refund. */
export default function LinkScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { find, txns, linkTxns } = useStore();
  const txn = id ? find(id) : undefined;
  const options = useMemo(() => (txn ? linkCandidates(txn, txns) : []), [txn, txns]);

  if (!txn) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top, paddingHorizontal: space.lg }}>
        <ScreenHeader close />
        <Empty icon="information-outline" title="Payment not found" body="It may have been deleted." />
      </View>
    );
  }
  const credit = txn.type === 'credit';
  const pick = (o: LinkCandidate) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    linkTxns(txn, o.txn, o.kind);
    router.back();
  };

  return (
    <FlatList
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xs }}
      data={options}
      keyExtractor={(o) => o.txn.id}
      ListHeaderComponent={
        <View style={{ gap: space.sm, paddingBottom: space.md }}>
          <ScreenHeader close />
          <Txt variant="heading">Link to the other side</Txt>
          <Txt variant="small" color={p.muted}>
            {txn.merchant}, {credit ? '+' : ''}
            {money(shownAmount(txn))} on {shortDay(txn.timestamp)}. Pick the payment it belongs with:
            {credit ? ' the money that left your other account, or the purchase this refund is for.' : ' the money that arrived in your other account, or a refund you got for it.'}
          </Txt>
        </View>
      }
      renderItem={({ item }) => {
        const o = item.txn;
        const c = cat(o.category);
        const oCredit = o.type === 'credit';
        return (
          <PressScale
            onPress={() => pick(item)}
            scaleTo={0.985}
            accessibilityRole="button"
            accessibilityLabel={`Link to ${o.merchant}, ${oCredit ? 'received' : 'paid'} ${money(shownAmount(o))} on ${shortDay(o.timestamp)}, as ${KIND_TEXT[item.kind]}`}
            style={[styles.row, { borderBottomColor: p.line }]}
          >
            <Badge icon={c.icon} color={c.color} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Txt variant="bodyStrong" numberOfLines={1}>
                {o.merchant}
              </Txt>
              <View style={styles.sub}>
                <Txt variant="small" color={p.muted}>
                  {shortDay(o.timestamp)}
                </Txt>
                <PayBadge label={payLabel(o)} />
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Txt variant="bodyStrong" tabular color={oCredit ? p.income : p.ink}>
                {oCredit ? '+' : ''}
                {money(shownAmount(o))}
              </Txt>
              <Txt variant="tiny" color={p.accent}>
                {KIND_TEXT[item.kind]} · {item.why}
              </Txt>
            </View>
          </PressScale>
        );
      }}
      ListEmptyComponent={
        <Empty
          icon="link-variant-off"
          title="Nothing to link"
          body="Kharcha looks for money going the other way: the same amount within a week, or a refund from the same shop within 4 months."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  sub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
