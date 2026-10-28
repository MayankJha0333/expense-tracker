import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Badge, Button, Chip, Empty, Txt } from '../../components/ui';
import { dayLabel, timeLabel } from '../../lib/analytics';
import { inr } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, CREDIT_CATEGORIES, DEBIT_CATEGORIES, PAY_MODE_LABEL, type CategoryId } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

const SOURCE_TEXT = {
  auto: 'Sorted on its own from the message',
  rule: 'Sorted by a rule you made for this shop',
  manual: 'You picked this category',
} as const;

export default function TxnDetail() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { find, setCategory, setExcluded, deleteManual, txns } = useStore();
  const txn = id ? find(id) : undefined;
  const [applyToAll, setApplyToAll] = useState(true);

  if (!txn) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top, paddingHorizontal: space.lg }}>
        <ScreenHeader close />
        <Empty icon="information-outline" title="Payment not found" body="It may have been deleted." />
      </View>
    );
  }

  const c = cat(txn.category);
  const credit = txn.type === 'credit';
  const options = credit ? CREDIT_CATEGORIES : DEBIT_CATEGORIES;
  const sameShop = txns.filter((t) => t.merchantKey === txn.merchantKey && t.id !== txn.id && !t.isManual).length;
  const notCountable = !credit && !c.countsAsSpend;

  const pick = (next: CategoryId) => {
    if (next === txn.category) return;
    Haptics.selectionAsync().catch(() => {});
    setCategory(txn, next, applyToAll && !txn.isManual);
  };

  const details: [string, string][] = [
    ['When', `${dayLabel(txn.timestamp)}, ${timeLabel(txn.timestamp)}`],
    ['Paid with', txn.isManual ? 'Cash (added by you)' : PAY_MODE_LABEL[txn.mode]],
  ];
  if (txn.bank || txn.account) details.push(['Account', [txn.bank, txn.account ? `ending ${txn.account}` : null].filter(Boolean).join(', ')]);
  if (txn.note) details.push(['Note', txn.note]);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <ScreenHeader close />

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Badge icon={c.icon} color={c.color} size={56} />
        <Txt variant="heading" style={{ textAlign: 'center' }}>
          {txn.merchant}
        </Txt>
        <Txt variant="display" color={credit ? p.leaf : p.ink} tabular>
          {credit ? '+' : ''}
          {inr(txn.amount, { decimals: true })}
        </Txt>
        <Txt variant="small" color={p.muted}>
          {credit ? 'Money in' : 'Money out'}, {c.label}
        </Txt>
      </View>

      <View style={[styles.table, { borderColor: p.line }]}>
        {details.map(([k, v]) => (
          <View key={k} style={[styles.tableRow, { borderColor: p.line }]}>
            <Txt variant="small" color={p.muted}>
              {k}
            </Txt>
            <Txt variant="smallStrong" style={{ flex: 1, textAlign: 'right' }}>
              {v}
            </Txt>
          </View>
        ))}
      </View>

      <View style={{ gap: space.md }}>
        <Txt variant="heading">Category</Txt>
        <Txt variant="small" color={p.muted}>
          {SOURCE_TEXT[txn.categorySource]}
        </Txt>
        <View style={styles.grid}>
          {options.map((o) => (
            <Chip key={o.id} label={o.label} icon={o.icon} color={o.color} selected={o.id === txn.category} onPress={() => pick(o.id)} />
          ))}
        </View>
        {!txn.isManual && sameShop > 0 ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Use for all {txn.merchant} payments</Txt>
              <Txt variant="small" color={p.muted}>
                Also changes {sameShop} other {sameShop === 1 ? 'payment' : 'payments'}, and new ones from now on.
              </Txt>
            </View>
            <Switch value={applyToAll} onValueChange={setApplyToAll} trackColor={{ true: p.marigold, false: p.line }} thumbColor={p.surface} />
          </View>
        ) : null}
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{credit ? 'Count as money in' : 'Count in my spending'}</Txt>
          <Txt variant="small" color={p.muted}>
            {notCountable
              ? `${c.label} is never counted, so the same money isn't added twice.`
              : 'Turn off for things like moving money to your own account.'}
          </Txt>
        </View>
        <Switch
          value={!txn.excluded}
          disabled={notCountable}
          onValueChange={(v) => setExcluded(txn, !v)}
          trackColor={{ true: p.marigold, false: p.line }}
          thumbColor={p.surface}
        />
      </View>

      {txn.rawSms ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="heading">Original message</Txt>
          <View style={[styles.sms, { backgroundColor: p.surface, borderColor: p.line }]}>
            {txn.sender ? (
              <Txt variant="tiny" color={p.muted}>
                From {txn.sender}
              </Txt>
            ) : null}
            <Txt variant="small" color={p.inkSoft} selectable>
              {txn.rawSms}
            </Txt>
          </View>
        </View>
      ) : null}

      {txn.isManual ? (
        <Button
          label="Delete this expense"
          kind="quiet"
          icon="trash-can-outline"
          onPress={() => {
            deleteManual(txn.id);
            router.back();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: { borderTopWidth: StyleSheet.hairlineWidth },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sms: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: 6 },
});
